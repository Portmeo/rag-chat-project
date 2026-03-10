/**
 * Reranker Hit Rate Test
 *
 * Mide el hit rate de las 35 preguntas después del pipeline completo:
 * Ensemble (Vector+BM25) → Parent Hydration → Drop-off → Reranker (Top K)
 *
 * Uso:
 *   cd apps/backend && npm run test:reranker
 */

process.env.RAG_LOGS = 'false';

import { QdrantVectorStore } from '@langchain/qdrant';
import { qdrantClient, COLLECTION_NAME } from '../repositories/qdrantRepository.js';
import { parentStorage } from '../repositories/index.js';
import { embeddings, BM25_CONFIG, RERANKER_CONFIG, SIMILARITY_DROPOFF_CONFIG } from '../services/rag/config.js';
import { BM25Retriever } from '../services/rag/bm25Retriever.js';
import { EnsembleRetriever } from '../services/rag/ensembleRetriever.js';
import { getAllDocumentsFromQdrant } from '../services/rag/helpers.js';
import { rerankDocuments } from '../services/rag/reranker.js';
import { applySimilarityDropoff } from '../services/rag/similarityDropoff.js';
import { QUESTIONS } from './questions.js';

const RETRIEVAL_K   = RERANKER_CONFIG.retrievalTopK;
const FINAL_K       = RERANKER_CONFIG.finalTopK;
const VECTOR_WEIGHT = BM25_CONFIG.vectorWeight;
const BM25_WEIGHT   = BM25_CONFIG.weight;

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

  const parentMap = await parentStorage.getParentsByIds(uniqueIds);

  const result: any[] = [];
  for (const [pid, children] of parentGroups.entries()) {
    if (pid.startsWith('no_parent_')) { result.push(children[0]); continue; }
    const parent = parentMap.get(pid);
    if (parent) {
      // Propagar scores del mejor child al parent
      for (const scoreKey of ['ensembleScore', 'vectorScore', 'bm25Score']) {
        const best = Math.max(...children.map((c: any) => c[scoreKey] ?? -Infinity));
        if (best !== -Infinity) (parent as any)[scoreKey] = best;
      }
      result.push(parent);
    } else {
      result.push(children[0]);
    }
  }
  return result;
}

async function main() {
  console.log('='.repeat(70));
  console.log('RERANKER HIT RATE TEST');
  console.log('='.repeat(70));
  console.log(`\nConfig: V=${VECTOR_WEIGHT} B=${BM25_WEIGHT}  retrieval K=${RETRIEVAL_K}  final K=${FINAL_K}`);
  console.log(`Reranker: ${RERANKER_CONFIG.enabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Drop-off: ${SIMILARITY_DROPOFF_CONFIG.enabled ? `ENABLED (maxDrop=${SIMILARITY_DROPOFF_CONFIG.maxDrop}, minDocs=${SIMILARITY_DROPOFF_CONFIG.minDocs})` : 'DISABLED'}`);

  if (!RERANKER_CONFIG.enabled) {
    console.log('\n⚠️  Reranker is DISABLED. Set USE_RERANKER=true in .env');
    process.exit(1);
  }

  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrantClient, collectionName: COLLECTION_NAME,
  });
  const allDocs = await getAllDocumentsFromQdrant();
  const childDocs = allDocs.filter((d: any) =>
    d.metadata?.parent_child?.is_parent === false &&
    !d.metadata?.parent_child?.is_alignment_question
  );

  const vectorRetriever = {
    invoke: async (query: string) => {
      const results = await vectorStore.similaritySearchWithScore(query, RETRIEVAL_K);
      return results.map(([doc, score]) => {
        (doc as any).vectorScore = score;
        return doc;
      });
    },
  };
  const bm25Retriever   = new BM25Retriever({ documents: childDocs, k: RETRIEVAL_K });
  const ensemble        = new EnsembleRetriever({
    retrievers: [vectorRetriever as any, bm25Retriever as any],
    weights: [VECTOR_WEIGHT, BM25_WEIGHT],
  });

  console.log(`Documents: ${allDocs.length} total, ${childDocs.length} children`);
  console.log(`Questions: ${QUESTIONS.length}\n`);

  const header = ` # ${'CAT'.padEnd(12)} ${'Question'.padEnd(60)} PARENTS  DROP-OFF  RERANKER`;
  console.log(header);
  console.log('─'.repeat(header.length));

  let parentHits = 0;
  let dropoffHits = 0;
  let rerankerHits = 0;
  const categoryStats: Record<string, { hits: number; total: number }> = {};
  const misses: string[] = [];

  for (let i = 0; i < QUESTIONS.length; i++) {
    const { q, expected, category } = QUESTIONS[i];
    if (!categoryStats[category]) categoryStats[category] = { hits: 0, total: 0 };
    categoryStats[category].total++;

    // Ensemble → children
    const ensembleDocs = await ensemble.invoke(q);
    const childOnly = ensembleDocs.filter((d: any) => !d.metadata?.parent_child?.is_parent);

    // Hydrate → parents
    const parents = await resolveParents(childOnly);
    const parentFiles = new Set(parents.map(d => d.metadata?.filename));
    const parentHit = expected.some(f => parentFiles.has(f));
    if (parentHit) parentHits++;

    // Drop-off → filter by ensemble score
    let filtered = parents;
    if (SIMILARITY_DROPOFF_CONFIG.enabled) {
      filtered = applySimilarityDropoff(
        parents,
        SIMILARITY_DROPOFF_CONFIG.maxDrop,
        SIMILARITY_DROPOFF_CONFIG.minDocs,
        'ensembleScore',
        { vector: VECTOR_WEIGHT, bm25: BM25_WEIGHT }
      );
    }
    const filteredFiles = new Set(filtered.map(d => d.metadata?.filename));
    const dropoffHit = expected.some(f => filteredFiles.has(f));
    if (dropoffHit) dropoffHits++;

    // Rerank → top K
    const reranked = await rerankDocuments(q, filtered, FINAL_K) as any[];
    const rerankedFiles = new Set(reranked.map(d => d.metadata?.filename));
    const rerankerHit = expected.some(f => rerankedFiles.has(f));
    if (rerankerHit) {
      rerankerHits++;
      categoryStats[category].hits++;
    } else {
      misses.push(`[${category}] ${q.substring(0, 60)} — expected: ${expected.join(', ')}`);
    }

    const num = String(i + 1).padStart(2);
    const pTag = parentHit   ? 'HIT' : 'MISS';
    const dTag = dropoffHit  ? 'HIT' : 'MISS';
    const rTag = rerankerHit ? 'HIT' : 'MISS';
    console.log(`${num} ${category.padEnd(12)} ${q.substring(0, 60).padEnd(60)} ${pTag.padEnd(8)} ${dTag.padEnd(9)} ${rTag}`);
  }

  const total = QUESTIONS.length;
  console.log('\n' + '='.repeat(70));
  console.log('HIT RATE SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Parents (hydrated)      : ${parentHits}/${total} (${((parentHits / total) * 100).toFixed(0)}%)`);
  if (SIMILARITY_DROPOFF_CONFIG.enabled) {
    console.log(`  After drop-off          : ${dropoffHits}/${total} (${((dropoffHits / total) * 100).toFixed(0)}%)`);
  }
  console.log(`  After reranker (Top ${FINAL_K})  : ${rerankerHits}/${total} (${((rerankerHits / total) * 100).toFixed(0)}%)`);

  console.log(`\nPost-reranker by category:`);
  for (const [cat, { hits, total: catTotal }] of Object.entries(categoryStats)) {
    console.log(`  ${cat.padEnd(12)} ${hits}/${catTotal} (${((hits / catTotal) * 100).toFixed(0)}%)`);
  }

  if (misses.length > 0) {
    console.log(`\nMisses (${misses.length}):`);
    misses.forEach(m => console.log(`  - ${m}`));
  } else {
    console.log('\nNo misses.');
  }

  console.log('\n' + '='.repeat(70));
  process.exit(0);
}

main().catch(console.error);
