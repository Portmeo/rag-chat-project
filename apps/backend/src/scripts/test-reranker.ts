process.env.RAG_LOGS = 'false';

import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { qdrantClient, COLLECTION_NAME } from '../repositories/qdrantRepository';
import { embeddings, BM25_CONFIG, RERANKER_CONFIG, PARENT_RETRIEVER_CONFIG } from '../services/rag/config';
import { BM25Retriever } from '../services/rag/bm25Retriever';
import { EnsembleRetriever } from '../services/rag/ensembleRetriever';
import { getAllDocumentsFromQdrant } from '../services/rag/helpers';
import { rerankDocuments } from '../services/rag/reranker';
import { QUESTIONS } from './questions';

const RETRIEVAL_K   = RERANKER_CONFIG.retrievalTopK;  // 20 — candidates fed to reranker
const FINAL_K       = RERANKER_CONFIG.finalTopK;       // 5  — final docs after reranking
const VECTOR_WEIGHT = BM25_CONFIG.vectorWeight;        // 0.6
const BM25_WEIGHT   = BM25_CONFIG.weight;              // 0.4

function getFiles(docs: any[], limit?: number): Set<string> {
  const filtered = docs.filter(d => !d.metadata?.parent_child?.is_parent);
  return new Set((limit ? filtered.slice(0, limit) : filtered).map(d => d.metadata?.filename as string));
}

async function resolveParents(childDocs: any[]): Promise<any[]> {
  const parentGroups = new Map<string, any[]>();
  for (const doc of childDocs) {
    const pid = doc.metadata?.parent_child?.parent_doc_id;
    if (!pid) { parentGroups.set(`no_parent_${Math.random()}`, [doc]); continue; }
    if (!parentGroups.has(pid)) parentGroups.set(pid, []);
    parentGroups.get(pid)!.push(doc);
  }

  const uniqueIds = [...parentGroups.keys()].filter(id => !id.startsWith('no_parent_'));
  if (uniqueIds.length === 0) return childDocs;

  const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
    filter: {
      must: [
        { key: 'metadata.parent_child.parent_doc_id', match: { any: uniqueIds } },
        { key: 'metadata.parent_child.is_parent', match: { value: true } },
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

  const result: any[] = [];
  for (const [pid, children] of parentGroups.entries()) {
    if (pid.startsWith('no_parent_')) { result.push(children[0]); continue; }
    const parent = parentMap.get(pid);
    result.push(parent ?? children[0]);
  }
  return result;
}

async function main() {
  console.log('Loading Qdrant + BM25...');
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrantClient, collectionName: COLLECTION_NAME,
  });
  const allDocs = await getAllDocumentsFromQdrant();
  const childDocs = allDocs.filter((d: any) => d.metadata?.parent_child?.is_parent === false);

  const vectorRetriever = vectorStore.asRetriever({ k: RETRIEVAL_K });
  const bm25Retriever   = new BM25Retriever({ documents: childDocs, k: RETRIEVAL_K });
  const ensemble        = new EnsembleRetriever({
    retrievers: [vectorRetriever as any, bm25Retriever as any],
    weights: [VECTOR_WEIGHT, BM25_WEIGHT],
  });

  console.log(`Config: ensemble V${VECTOR_WEIGHT}/B${BM25_WEIGHT}, retrieval K=${RETRIEVAL_K}, final K=${FINAL_K}\n`);

  const ensembleHits: boolean[] = [];
  const parentHits:   boolean[] = [];
  const rerankedHits: boolean[] = [];
  const rerankedScores: (number | null)[] = [];

  const header = `${'#'.padStart(2)} ${'CAT'.padEnd(11)} ${'Question'.padEnd(55)} ${'ENSEMBLE'.padEnd(9)} ${'PARENTS'.padEnd(8)} ${'RERANKED'.padEnd(9)} SCORE`;
  console.log(header);
  console.log('-'.repeat(header.length));

  for (let i = 0; i < QUESTIONS.length; i++) {
    const { q, expected, category } = QUESTIONS[i];

    // Stage 1: ensemble retrieval (children)
    const ensembleDocs = await ensemble.invoke(q);
    const eHit = expected.some(f => getFiles(ensembleDocs, RETRIEVAL_K).has(f));

    // Stage 2: hydrate children → parents
    const childOnly = ensembleDocs.filter((d: any) => !d.metadata?.parent_child?.is_parent);
    const parents   = await resolveParents(childOnly);
    const pHit = expected.some(f => new Set(parents.map((d: any) => d.metadata?.filename)).has(f));

    // Stage 3: rerank parents → top FINAL_K
    const reranked = await rerankDocuments(q, parents, FINAL_K);
    const rerankedFiles = new Set(reranked.map((d: any) => d.metadata?.filename));
    const rHit = expected.some(f => rerankedFiles.has(f));

    // Score of the hit doc (if found)
    let hitScore: number | null = null;
    if (rHit) {
      const hitDoc = reranked.find((d: any) => expected.includes(d.metadata?.filename));
      hitScore = hitDoc ? (hitDoc as any).rerankScore : null;
    }

    ensembleHits.push(eHit);
    parentHits.push(pHit);
    rerankedHits.push(rHit);
    rerankedScores.push(hitScore);

    const qShort = q.length > 54 ? q.substring(0, 51) + '...' : q;
    const scoreStr = rHit && hitScore !== null ? hitScore.toFixed(2) : (rHit ? '?' : '—');
    console.log(
      `${String(i + 1).padStart(2)} ${category.padEnd(11)} ${qShort.padEnd(55)} ` +
      `${(eHit ? 'HIT' : 'MISS').padEnd(9)} ${(pHit ? 'HIT' : 'MISS').padEnd(8)} ` +
      `${(rHit ? 'HIT' : 'MISS').padEnd(9)} ${scoreStr}`
    );
  }

  const total = QUESTIONS.length;
  const eTotal = ensembleHits.filter(Boolean).length;
  const pTotal = parentHits.filter(Boolean).length;
  const rTotal = rerankedHits.filter(Boolean).length;

  console.log('\n' + '='.repeat(header.length));
  console.log('HIT RATE BY STAGE');
  console.log('='.repeat(header.length));
  console.log(`  Ensemble (children K=${RETRIEVAL_K}) : ${eTotal}/${total} (${((eTotal / total) * 100).toFixed(0)}%)`);
  console.log(`  Parents (post-hydration)      : ${pTotal}/${total} (${((pTotal / total) * 100).toFixed(0)}%)`);
  console.log(`  Reranked (top ${String(FINAL_K).padEnd(2)})            : ${rTotal}/${total} (${((rTotal / total) * 100).toFixed(0)}%)`);

  // Score stats for hits
  const scores = rerankedScores.filter((s): s is number => s !== null);
  if (scores.length > 0) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`\nRerank score of hit docs: avg=${avg.toFixed(2)} min=${Math.min(...scores).toFixed(2)} max=${Math.max(...scores).toFixed(2)}`);
  }

  // By category
  const categories = [...new Set(QUESTIONS.map(q => q.category))];
  console.log('\nReranked by category:');
  for (const cat of categories) {
    const indices = QUESTIONS.map((q, i) => q.category === cat ? i : -1).filter(i => i >= 0);
    const catHits = indices.filter(i => rerankedHits[i]).length;
    console.log(`  ${cat.padEnd(12)} ${catHits}/${indices.length} (${((catHits / indices.length) * 100).toFixed(0)}%)`);
  }

  // Reranker losses (had parent hit but lost after reranking)
  const rerankerLosses = QUESTIONS.filter((_, i) => parentHits[i] && !rerankedHits[i]);
  if (rerankerLosses.length > 0) {
    console.log(`\nReranker losses — parent hit but dropped in top ${FINAL_K} (${rerankerLosses.length}):`);
    rerankerLosses.forEach(({ q, expected, category }) => {
      console.log(`  [${category}] "${q.substring(0, 60)}" → ${expected.join(', ')}`);
    });
  } else {
    console.log('\nReranker: no losses vs parent stage.');
  }
}

main().catch(console.error);
