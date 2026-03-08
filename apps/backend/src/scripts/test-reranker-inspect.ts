/**
 * Reranker Inspection Script
 *
 * Muestra para cada query:
 *   - Los parents que entran al reranker (posición ensemble, filename, preview)
 *   - Los mismos docs después del reranker (score BGE, nueva posición)
 *   - Delta de posición: cuánto movió el reranker cada documento
 *
 * Uso:
 *   cd apps/backend && npx tsx --env-file=.env src/scripts/test-reranker-inspect.ts
 *   cd apps/backend && npx tsx --env-file=.env src/scripts/test-reranker-inspect.ts --query "¿Cómo funciona JWT?"
 */

process.env.RAG_LOGS = 'false';

import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { qdrantClient, COLLECTION_NAME } from '../repositories/qdrantRepository.js';
import { parentStorage } from '../repositories/index.js';
import { embeddings, BM25_CONFIG, RERANKER_CONFIG } from '../services/rag/config.js';
import { BM25Retriever } from '../services/rag/bm25Retriever.js';
import { EnsembleRetriever } from '../services/rag/ensembleRetriever.js';
import { getAllDocumentsFromQdrant } from '../services/rag/helpers.js';
import { rerankDocuments } from '../services/rag/reranker.js';
import { QUESTIONS } from './questions.js';

const RETRIEVAL_K   = RERANKER_CONFIG.retrievalTopK;
const FINAL_K       = RERANKER_CONFIG.finalTopK;
const VECTOR_WEIGHT = BM25_CONFIG.vectorWeight;
const BM25_WEIGHT   = BM25_CONFIG.weight;

// Pick queries: custom via --query or first N from QUESTIONS
const customQuery = (() => {
  const idx = process.argv.indexOf('--query');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const INSPECT_N = parseInt(process.argv.find(a => a.startsWith('--n='))?.split('=')[1] ?? '5');

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

  // Use SQLite instead of Qdrant for parent resolution
  const parentMap = await parentStorage.getParentsByIds(uniqueIds);

  const result: any[] = [];
  for (const [pid, children] of parentGroups.entries()) {
    if (pid.startsWith('no_parent_')) { result.push(children[0]); continue; }
    const parent = parentMap.get(pid);
    result.push(parent ?? children[0]);
  }
  return result;
}

function preview(text: string, len = 80): string {
  const clean = text.replace(/\n/g, ' ').trim();
  return clean.length > len ? clean.slice(0, len - 1) + '…' : clean;
}

function deltaSymbol(delta: number): string {
  if (delta < 0) return `↑${Math.abs(delta)}`;
  if (delta > 0) return `↓${delta}`;
  return '=';
}

async function inspectQuery(
  query: string,
  expected: string[],
  ensemble: EnsembleRetriever
) {
  console.log(`\n${'─'.repeat(100)}`);
  console.log(`QUERY: "${query}"`);
  if (expected.length) console.log(`Expected: ${expected.join(', ')}`);
  console.log('─'.repeat(100));

  // Stage 1: ensemble (children)
  const ensembleDocs = await ensemble.invoke(query);
  const childOnly = ensembleDocs.filter((d: any) => !d.metadata?.parent_child?.is_parent);

  // Stage 2: hydrate to parents
  const parents = await resolveParents(childOnly);

  // Deduplicate by filename (keep first occurrence = highest ensemble rank)
  const seenFiles = new Set<string>();
  const uniqueParents: any[] = [];
  for (const doc of parents) {
    const fn = doc.metadata?.filename ?? 'unknown';
    if (!seenFiles.has(fn)) {
      seenFiles.add(fn);
      uniqueParents.push(doc);
    }
  }

  // Stage 3: rerank
  const reranked = await rerankDocuments(query, uniqueParents, FINAL_K) as any[];

  // Build pre-rerank index: filename → position (0-based)
  const preRankMap = new Map<string, number>();
  uniqueParents.forEach((doc, i) => {
    preRankMap.set(doc.metadata?.filename ?? `unknown_${i}`, i);
  });

  // --- Print pre-rerank table ---
  console.log(`\nPRE-RERANK  (${uniqueParents.length} parents entering reranker)`);
  console.log(`${'Pos'.padStart(3)}  ${'Filename'.padEnd(40)}  ${'Preview'}`);
  console.log(`${'─'.repeat(3)}  ${'─'.repeat(40)}  ${'─'.repeat(55)}`);
  uniqueParents.slice(0, FINAL_K + 3).forEach((doc, i) => {
    const fn = (doc.metadata?.filename ?? 'unknown').padEnd(40);
    const mark = expected.includes(doc.metadata?.filename) ? ' ★' : '';
    console.log(`${String(i + 1).padStart(3)}  ${fn}  ${preview(doc.pageContent)}${mark}`);
  });
  if (uniqueParents.length > FINAL_K + 3) {
    console.log(`     … and ${uniqueParents.length - FINAL_K - 3} more`);
  }

  // --- Print post-rerank table ---
  console.log(`\nPOST-RERANK  (top ${FINAL_K} after BGE reranker)`);
  console.log(`${'New'.padStart(3)}  ${'Old'.padStart(3)}  ${'Δ'.padStart(4)}  ${'BGE score'.padStart(9)}  ${'Filename'.padEnd(40)}  ${'Preview'}`);
  console.log(`${'─'.repeat(3)}  ${'─'.repeat(3)}  ${'─'.repeat(4)}  ${'─'.repeat(9)}  ${'─'.repeat(40)}  ${'─'.repeat(40)}`);
  reranked.forEach((doc, newPos) => {
    const fn = doc.metadata?.filename ?? 'unknown';
    const oldPos = preRankMap.get(fn) ?? -1;
    const delta = oldPos === -1 ? 0 : newPos - oldPos;
    const mark = expected.includes(fn) ? ' ★' : '';
    console.log(
      `${String(newPos + 1).padStart(3)}  ` +
      `${oldPos === -1 ? '?' : String(oldPos + 1).padStart(3)}  ` +
      `${deltaSymbol(delta).padStart(4)}  ` +
      `${doc.rerankScore.toFixed(4).padStart(9)}  ` +
      `${fn.padEnd(40)}  ` +
      `${preview(doc.pageContent, 40)}${mark}`
    );
  });

  // --- Summary ---
  const movedDocs = reranked.filter((doc, newPos) => {
    const fn = doc.metadata?.filename ?? 'unknown';
    const oldPos = preRankMap.get(fn) ?? newPos;
    return oldPos !== newPos;
  });

  const scoreRange = reranked.length > 0
    ? `min=${Math.min(...reranked.map(d => d.rerankScore)).toFixed(4)}  max=${Math.max(...reranked.map(d => d.rerankScore)).toFixed(4)}`
    : 'n/a';

  console.log(`\nSummary: ${movedDocs.length}/${reranked.length} docs changed position  |  BGE scores: ${scoreRange}`);

  const expectedHit = expected.some(f => reranked.some((d: any) => d.metadata?.filename === f));
  const expectedInPre = expected.some(f => uniqueParents.some((d: any) => d.metadata?.filename === f));
  console.log(`Expected doc in pre-rerank: ${expectedInPre ? 'YES' : 'NO'}  →  in top-${FINAL_K} post-rerank: ${expectedHit ? 'YES ★' : 'NO ✗'}`);
}

async function main() {
  console.log('Loading Qdrant + BM25...');
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrantClient, collectionName: COLLECTION_NAME,
  });
  const allDocs = await getAllDocumentsFromQdrant();
  const childDocs = allDocs.filter((d: any) => d.metadata?.parent_child?.is_parent === false && !d.metadata?.parent_child?.is_alignment_question);

  const vectorRetriever = vectorStore.asRetriever({ k: RETRIEVAL_K });
  const bm25Retriever   = new BM25Retriever({ documents: childDocs, k: RETRIEVAL_K });
  const ensemble        = new EnsembleRetriever({
    retrievers: [vectorRetriever as any, bm25Retriever as any],
    weights: [VECTOR_WEIGHT, BM25_WEIGHT],
  });

  console.log(`Config: V=${VECTOR_WEIGHT} B=${BM25_WEIGHT}  retrieval K=${RETRIEVAL_K}  final K=${FINAL_K}`);

  if (customQuery) {
    await inspectQuery(customQuery, [], ensemble);
  } else {
    const queries = QUESTIONS.slice(0, INSPECT_N);
    for (const { q, expected } of queries) {
      await inspectQuery(q, expected, ensemble);
    }
  }

  console.log(`\n${'─'.repeat(100)}`);
  console.log('Done.');
  process.exit(0);
}

main().catch(console.error);
