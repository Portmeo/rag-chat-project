import { QdrantVectorStore } from '@langchain/qdrant';
import { qdrantClient, COLLECTION_NAME } from '../repositories/qdrantRepository';
import { embeddings } from '../services/rag/config';
import { QUESTIONS } from './questions';

const TOP_K = 5;

async function testBaseRetrieval() {
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrantClient,
    collectionName: COLLECTION_NAME,
  });

  const hitsByCategory = new Map<string, { hits: number; total: number }>();
  let totalHits = 0;

  for (let i = 0; i < QUESTIONS.length; i++) {
    const { q, expected, category } = QUESTIONS[i];
    console.log(`\n[${i + 1}/${QUESTIONS.length}] [${category}] ${q}`);
    console.log(`Expected: ${expected.join(', ')}`);
    console.log('-'.repeat(80));

    const results = await vectorStore.similaritySearchWithScore(q, TOP_K + 5);

    // Filter out parent chunks (null vectors — not meaningful for base retrieval)
    const childResults = results.filter(([doc]) => {
      const meta = doc.metadata as any;
      return !meta?.parent_child?.is_parent;
    }).slice(0, TOP_K);

    const retrievedFiles = new Set(childResults.map(([doc]) => (doc.metadata as any).filename));

    for (const [doc, score] of childResults) {
      const filename = (doc.metadata as any).filename || 'unknown';
      const preview = doc.pageContent.replace(/\n/g, ' ').substring(0, 150);
      console.log(`  [${score.toFixed(4)}] ${filename}`);
      console.log(`         ${preview}...`);
    }

    const hit = expected.some(f => retrievedFiles.has(f));
    if (hit) totalHits++;
    console.log(hit ? `  HIT` : `  MISS - got: ${[...retrievedFiles].join(', ')}`);

    if (!hitsByCategory.has(category)) hitsByCategory.set(category, { hits: 0, total: 0 });
    const cat = hitsByCategory.get(category)!;
    cat.total++;
    if (hit) cat.hits++;
  }

  const total = QUESTIONS.length;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`BASE RETRIEVAL HIT RATE: ${totalHits}/${total} (${((totalHits / total) * 100).toFixed(0)}%)`);
  console.log(`(Pure vector search, no BM25, no reranker, no parent-child, no multi-query)\n`);
  console.log('By category:');
  for (const [cat, { hits, total: t }] of hitsByCategory) {
    console.log(`  ${cat.padEnd(12)} ${hits}/${t} (${((hits / t) * 100).toFixed(0)}%)`);
  }
}

testBaseRetrieval().catch(console.error);
