process.env.RAG_LOGS = 'false';

import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { qdrantClient, COLLECTION_NAME } from '../repositories/qdrantRepository';
import { embeddings, PARENT_RETRIEVER_CONFIG, RERANKER_CONFIG } from '../services/rag/config';
import { getAllDocumentsFromQdrant } from '../services/rag/helpers';
import { QUESTIONS } from './questions';

const RETRIEVAL_K = 20;

// ─── Inline resolveParentChunks (same logic as pipeline, isolated for testing) ─

async function resolveParents(childDocs: any[]): Promise<{ parents: any[]; orphans: number }> {
  const parentGroups = new Map<string, any[]>();

  for (const doc of childDocs) {
    const pc = doc.metadata?.parent_child;
    if (!pc?.parent_doc_id) {
      parentGroups.set(`no_parent_${Math.random()}`, [doc]);
      continue;
    }
    if (!parentGroups.has(pc.parent_doc_id)) parentGroups.set(pc.parent_doc_id, []);
    parentGroups.get(pc.parent_doc_id)!.push(doc);
  }

  const uniqueParentIds = [...parentGroups.keys()].filter(id => !id.startsWith('no_parent_'));
  if (uniqueParentIds.length === 0) return { parents: childDocs, orphans: 0 };

  const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
    filter: {
      must: [
        { key: 'metadata.parent_child.parent_doc_id', match: { any: uniqueParentIds } },
        { key: 'metadata.parent_child.is_parent', match: { value: true } },
      ],
    },
    limit: uniqueParentIds.length + 10,
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
  let orphans = 0;

  for (const [parentId, children] of parentGroups.entries()) {
    if (parentId.startsWith('no_parent_')) { result.push(children[0]); continue; }
    const parent = parentMap.get(parentId);
    if (!parent) { orphans++; result.push(...children); continue; }
    result.push(parent);
  }

  return { parents: result, orphans };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Runtime config check
  console.log('='.repeat(70));
  console.log('PARENT-CHILD DIAGNOSTIC');
  console.log('='.repeat(70));
  console.log(`\nRuntime config:`);
  console.log(`  USE_PARENT_RETRIEVER : ${process.env.USE_PARENT_RETRIEVER}`);
  console.log(`  PARENT_RETRIEVER_CONFIG.enabled : ${PARENT_RETRIEVER_CONFIG.enabled}`);
  console.log(`  child_chunk_size  : ${PARENT_RETRIEVER_CONFIG.childChunkSize}`);
  console.log(`  parent_chunk_size : ${PARENT_RETRIEVER_CONFIG.parentChunkSize}`);

  if (!PARENT_RETRIEVER_CONFIG.enabled) {
    console.log('\n⚠️  Parent-child is DISABLED in config. Set USE_PARENT_RETRIEVER=true in .env');
    process.exit(1);
  }

  // 2. Qdrant inventory
  const allDocs = await getAllDocumentsFromQdrant();
  const children = allDocs.filter((d: any) => d.metadata?.parent_child?.is_parent === false);
  const parents  = allDocs.filter((d: any) => d.metadata?.parent_child?.is_parent === true);
  const neither  = allDocs.filter((d: any) => !d.metadata?.parent_child);

  console.log(`\nQdrant inventory (${allDocs.length} total):`);
  console.log(`  children : ${children.length}`);
  console.log(`  parents  : ${parents.length}`);
  console.log(`  neither  : ${neither.length}`);

  const childLengths = children.map((d: any) => d.pageContent.length).filter(Boolean);
  const parentLengths = parents.map((d: any) => d.pageContent.length).filter(Boolean);
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  console.log(`\nContent sizes:`);
  console.log(`  child  avg=${avg(childLengths)} min=${Math.min(...childLengths)} max=${Math.max(...childLengths)} chars`);
  console.log(`  parent avg=${avg(parentLengths)} min=${Math.min(...parentLengths)} max=${Math.max(...parentLengths)} chars`);

  // 3. Hydration probe — 3 sample queries
  console.log(`\n${'─'.repeat(70)}`);
  console.log('HYDRATION PROBE (3 sample queries)');
  console.log('─'.repeat(70));

  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrantClient, collectionName: COLLECTION_NAME,
  });

  const probeQuestions = QUESTIONS.slice(0, 3);
  let totalOrphans = 0;

  for (const { q, expected } of probeQuestions) {
    const raw = await vectorStore.similaritySearchWithScore(q, RETRIEVAL_K);
    const childResults = raw
      .filter(([doc]) => doc.metadata?.parent_child?.is_parent === false)
      .map(([doc]) => doc);

    const { parents: hydratedParents, orphans } = await resolveParents(childResults);
    totalOrphans += orphans;

    const childFiles  = new Set(childResults.map(d => d.metadata?.filename));
    const parentFiles = new Set(hydratedParents.map(d => d.metadata?.filename));
    const hit = expected.some(f => parentFiles.has(f));

    console.log(`\nQ: "${q.substring(0, 65)}"`);
    console.log(`  children retrieved : ${childResults.length} (unique files: ${childFiles.size})`);
    console.log(`  parents hydrated   : ${hydratedParents.length} (unique files: ${parentFiles.size})`);
    console.log(`  orphans            : ${orphans}`);
    console.log(`  avg parent len     : ${Math.round(hydratedParents.reduce((s, d) => s + d.pageContent.length, 0) / (hydratedParents.length || 1))} chars`);
    console.log(`  expected           : ${expected.join(', ')}`);
    console.log(`  hit                : ${hit ? 'YES' : 'NO'}`);
  }

  // 4. Full hit rate — children K vs parents after hydration
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`HIT RATE: CHILDREN (K=${RETRIEVAL_K}) vs PARENTS AFTER HYDRATION`);
  console.log('─'.repeat(70));

  let childHits = 0;
  let parentHits = 0;
  const misses: string[] = [];

  for (const { q, expected, category } of QUESTIONS) {
    const raw = await vectorStore.similaritySearchWithScore(q, RETRIEVAL_K);
    const childDocs = raw
      .filter(([doc]) => doc.metadata?.parent_child?.is_parent === false)
      .map(([doc]) => doc);

    const { parents: hydratedParents } = await resolveParents(childDocs);

    const childFiles  = new Set(childDocs.map(d => d.metadata?.filename));
    const parentFiles = new Set(hydratedParents.map(d => d.metadata?.filename));

    const childHit  = expected.some(f => childFiles.has(f));
    const parentHit = expected.some(f => parentFiles.has(f));

    if (childHit)  childHits++;
    if (parentHit) parentHits++;
    if (!parentHit) misses.push(`[${category}] ${q.substring(0, 60)}`);
  }

  const total = QUESTIONS.length;
  console.log(`  Children  : ${childHits}/${total} (${((childHits / total) * 100).toFixed(0)}%)`);
  console.log(`  Parents   : ${parentHits}/${total} (${((parentHits / total) * 100).toFixed(0)}%)`);
  console.log(`  Total orphans across all queries: ${totalOrphans}`);

  if (misses.length > 0) {
    console.log(`\nParent misses (${misses.length}):`);
    misses.forEach(m => console.log(`  - ${m}`));
  } else {
    console.log('\nNo parent misses.');
  }

  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
