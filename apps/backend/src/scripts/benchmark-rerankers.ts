/**
 * Reranker Model Benchmark
 *
 * Compara múltiples modelos de reranker contra las mismas queries.
 * Para cada modelo muestra: hit rate, rango de scores, gap de discriminación.
 *
 * Uso:
 *   cd apps/backend && npm run benchmark:rerankers
 *   cd apps/backend && npm run benchmark:rerankers -- --n=5
 */

process.env.RAG_LOGS = 'false';
process.env.TRANSFORMERS_DISABLE_SHARP = '1';

import { env, AutoTokenizer, AutoModelForSequenceClassification } from '@xenova/transformers';
env.allowLocalModels = false;
env.useBrowserCache = false;

import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { qdrantClient, COLLECTION_NAME } from '../repositories/qdrantRepository.js';
import { embeddings, BM25_CONFIG, RERANKER_CONFIG } from '../services/rag/config.js';
import { BM25Retriever } from '../services/rag/bm25Retriever.js';
import { EnsembleRetriever } from '../services/rag/ensembleRetriever.js';
import { getAllDocumentsFromQdrant } from '../services/rag/helpers.js';
import { QUESTIONS } from './questions.js';

// ── Config ────────────────────────────────────────────────────────────────────

const MODELS_TO_TEST = [
  'Xenova/bge-reranker-base',
  'mixedbread-ai/mxbai-rerank-base-v1',
  'Xenova/ms-marco-MiniLM-L-6-v2',
];

const RETRIEVAL_K = RERANKER_CONFIG.retrievalTopK;
const FINAL_K     = RERANKER_CONFIG.finalTopK;
const N_QUERIES   = parseInt(process.argv.find(a => a.startsWith('--n='))?.split('=')[1] ?? '9');

// ── Reranker per-model (no cached singleton) ──────────────────────────────────

async function loadModel(modelName: string) {
  const tokenizer = await AutoTokenizer.from_pretrained(modelName);
  const model = await AutoModelForSequenceClassification.from_pretrained(modelName);
  return { tokenizer, model };
}

async function rerankWithModel(
  query: string,
  documents: any[],
  tokenizer: any,
  model: any,
  topK: number
): Promise<Array<{ doc: any; score: number }>> {
  const queries = documents.map(() => query);
  const docs    = documents.map(d => d.pageContent);

  const inputs = await tokenizer(queries, { text_pair: docs, padding: true, truncation: true });
  const { logits } = await model(inputs);
  const logitsArray = Array.from(logits.data) as number[];
  const numLabels = logits.dims[1] || 1;
  const scores = numLabels === 1
    ? logitsArray
    : logitsArray.filter((_, i) => i % numLabels === 0);

  return documents
    .map((doc, i) => ({ doc, score: scores[i] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Parent resolution (same as inspect script) ────────────────────────────────

async function resolveParents(childDocs: any[]): Promise<any[]> {
  const groups = new Map<string, any[]>();
  for (const doc of childDocs) {
    const pid = doc.metadata?.parent_child?.parent_doc_id;
    if (!pid) { groups.set(`no_parent_${Math.random()}`, [doc]); continue; }
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid)!.push(doc);
  }

  const uniqueIds = [...groups.keys()].filter(id => !id.startsWith('no_parent_'));
  if (uniqueIds.length === 0) return childDocs;

  const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
    filter: {
      must: [
        { key: 'metadata.parent_child.parent_doc_id', match: { any: uniqueIds } },
        { key: 'metadata.parent_child.is_parent',     match: { value: true } },
      ],
    },
    limit: uniqueIds.length + 10,
    with_payload: true,
    with_vector: false,
  });

  const parentMap = new Map<string, any>();
  for (const point of scrollResult.points) {
    const payload = point.payload as any;
    parentMap.set(payload.metadata.parent_child.parent_doc_id, {
      pageContent: payload.text,
      metadata: payload.metadata,
    });
  }

  return uniqueIds.map(id => parentMap.get(id)).filter(Boolean);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('Loading Qdrant + BM25...');

const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
  client: qdrantClient,
  collectionName: COLLECTION_NAME,
});

const allDocs = await getAllDocumentsFromQdrant();
const childDocs = allDocs.filter(d => {
  const meta = d.metadata?.parent_child;
  return meta && meta.is_parent === false && !meta.is_alignment_question;
});

const bm25 = new BM25Retriever({ documents: childDocs, k: RETRIEVAL_K });
const vectorRetriever = vectorStore.asRetriever({ k: RETRIEVAL_K });
const ensemble = new EnsembleRetriever({
  retrievers: [vectorRetriever as any, bm25 as any],
  weights: [BM25_CONFIG.vectorWeight, BM25_CONFIG.weight],
});

const queries = QUESTIONS.slice(0, N_QUERIES);

// Pre-fetch parents for all queries (shared across models)
console.log(`\nPre-fetching parents for ${queries.length} queries...`);
const queryParents: { q: string; expected: string[]; parents: any[] }[] = [];
for (const { q, expected } of queries) {
  const ensembleDocs = await ensemble.invoke(q);
  const parents = await resolveParents(ensembleDocs);
  queryParents.push({ q, expected, parents });
}
console.log('Done. Starting model benchmark...\n');

// ── Per-model results ─────────────────────────────────────────────────────────

interface ModelResult {
  model: string;
  hits: number;
  total: number;
  scoreMin: number;
  scoreMax: number;
  topScores: number[];   // score of the top-1 doc per query
  loadMs: number;
  inferMs: number;
}

const results: ModelResult[] = [];

for (const modelName of MODELS_TO_TEST) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`MODEL: ${modelName}`);
  console.log('─'.repeat(80));

  let tokenizer: any, model: any;
  const loadStart = Date.now();
  try {
    ({ tokenizer, model } = await loadModel(modelName));
    console.log(`  Loaded in ${Date.now() - loadStart}ms`);
  } catch (e: any) {
    console.log(`  ❌ FAILED to load: ${e.message.slice(0, 100)}`);
    results.push({ model: modelName, hits: -1, total: queries.length, scoreMin: 0, scoreMax: 0, topScores: [], loadMs: -1, inferMs: -1 });
    continue;
  }

  let hits = 0;
  let allScores: number[] = [];
  let topScores: number[] = [];
  let totalInferMs = 0;

  for (const { q, expected, parents } of queryParents) {
    const inferStart = Date.now();
    const reranked = await rerankWithModel(q, parents, tokenizer, model, FINAL_K);
    totalInferMs += Date.now() - inferStart;

    const scores = reranked.map(r => r.score);
    allScores.push(...scores);
    topScores.push(scores[0] ?? 0);

    const hit = expected.some(e => reranked.some(r => r.doc.metadata?.filename === e));
    if (hit) hits++;

    const mark = hit ? '★' : '✗';
    const topFile = reranked[0]?.doc.metadata?.filename ?? '?';
    const topScore = (reranked[0]?.score ?? 0).toFixed(2);
    console.log(`  ${mark} [${q.slice(0, 55).padEnd(55)}]  top1=${topFile} (${topScore})`);
  }

  const scoreMin = Math.min(...allScores);
  const scoreMax = Math.max(...allScores);

  console.log(`\n  Hit rate: ${hits}/${queries.length}  |  Scores: [${scoreMin.toFixed(2)}, ${scoreMax.toFixed(2)}]  |  Infer avg: ${Math.round(totalInferMs / queries.length)}ms/query`);

  results.push({
    model: modelName,
    hits,
    total: queries.length,
    scoreMin,
    scoreMax,
    topScores,
    loadMs: Date.now() - loadStart,
    inferMs: Math.round(totalInferMs / queries.length),
  });
}

// ── Summary table ─────────────────────────────────────────────────────────────

console.log(`\n\n${'═'.repeat(90)}`);
console.log('COMPARATIVA FINAL DE RERANKERS');
console.log('═'.repeat(90));
console.log(`${'Modelo'.padEnd(42)} ${'Hit rate'.padStart(9)} ${'Score min'.padStart(10)} ${'Score max'.padStart(10)} ${'ms/query'.padStart(9)}`);
console.log('─'.repeat(90));

for (const r of results) {
  if (r.hits === -1) {
    console.log(`${r.model.padEnd(42)} ${'LOAD FAIL'.padStart(9)}`);
    continue;
  }
  const hitStr = `${r.hits}/${r.total}`;
  console.log(
    `${r.model.padEnd(42)} ${hitStr.padStart(9)} ${r.scoreMin.toFixed(2).padStart(10)} ${r.scoreMax.toFixed(2).padStart(10)} ${String(r.inferMs).padStart(9)}`
  );
}
console.log('═'.repeat(90));
console.log('\nNota: Hit rate = doc esperado en top-5 | Score range = discriminación del modelo');
