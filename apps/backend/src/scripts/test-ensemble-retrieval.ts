// Silence all RAG logs during this test
process.env.RAG_LOGS = 'false';

import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { qdrantClient, COLLECTION_NAME } from '../repositories/qdrantRepository';
import { embeddings } from '../services/rag/config';
import { BM25Retriever } from '../services/rag/bm25Retriever';
import { EnsembleRetriever } from '../services/rag/ensembleRetriever';
import { getAllDocumentsFromQdrant } from '../services/rag/helpers';
import { QUESTIONS } from './questions';

const TOP_K = 7;

function hit(retrieved: Set<string>, expected: string[]): boolean {
  return expected.some(f => retrieved.has(f));
}

async function testEnsembleRetrieval() {
  console.log('Loading Qdrant vector store...');
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrantClient,
    collectionName: COLLECTION_NAME,
  });

  console.log('Loading all documents for BM25...');
  const allDocuments = await getAllDocumentsFromQdrant();
  const childDocs = allDocuments.filter((doc: any) => {
    const meta = doc.metadata as any;
    return !meta?.parent_child?.is_parent;
  });
  console.log(`BM25 index: ${childDocs.length} child docs\n`);

  const vectorRetriever = vectorStore.asRetriever({ k: TOP_K + 5 });
  const bm25Retriever = new BM25Retriever({ documents: childDocs, k: TOP_K + 5 });
  const ensembleRetriever = new EnsembleRetriever({
    retrievers: [vectorRetriever as any, bm25Retriever as any],
    weights: [0.6, 0.4],
  });

  const vectorHits: boolean[] = [];
  const bm25Hits: boolean[] = [];
  const ensembleHits: boolean[] = [];

  const header = `${'#'.padStart(2)} ${'CAT'.padEnd(11)} ${'Question'.padEnd(62)} ${'VECTOR'.padEnd(7)} ${'BM25'.padEnd(6)} ENSEMBLE`;
  console.log(header);
  console.log('-'.repeat(header.length));

  for (let i = 0; i < QUESTIONS.length; i++) {
    const { q, expected, category } = QUESTIONS[i];

    const [vectorResults, bm25Results, ensembleResults] = await Promise.all([
      vectorRetriever.invoke(q),
      bm25Retriever.invoke(q),
      ensembleRetriever.invoke(q),
    ]);

    const getFiles = (docs: any[]) => new Set(
      docs
        .filter(d => !d.metadata?.parent_child?.is_parent)
        .slice(0, TOP_K)
        .map(d => d.metadata?.filename as string)
    );

    const vHit = hit(getFiles(vectorResults), expected);
    const bHit = hit(getFiles(bm25Results), expected);
    const eHit = hit(getFiles(ensembleResults), expected);

    vectorHits.push(vHit);
    bm25Hits.push(bHit);
    ensembleHits.push(eHit);

    const qShort = q.length > 61 ? q.substring(0, 58) + '...' : q;
    console.log(
      `${String(i + 1).padStart(2)} ${category.padEnd(11)} ${qShort.padEnd(62)} ${(vHit ? 'HIT' : 'MISS').padEnd(7)} ${(bHit ? 'HIT' : 'MISS').padEnd(6)} ${eHit ? 'HIT' : 'MISS'}`
    );
  }

  const total = QUESTIONS.length;
  const vTotal = vectorHits.filter(Boolean).length;
  const bTotal = bm25Hits.filter(Boolean).length;
  const eTotal = ensembleHits.filter(Boolean).length;

  console.log('\n' + '='.repeat(header.length));
  console.log('HIT RATE SUMMARY');
  console.log('='.repeat(header.length));
  console.log(`  Vector only:  ${vTotal}/${total} (${((vTotal / total) * 100).toFixed(0)}%)`);
  console.log(`  BM25 only:    ${bTotal}/${total} (${((bTotal / total) * 100).toFixed(0)}%)`);
  console.log(`  Ensemble:     ${eTotal}/${total} (${((eTotal / total) * 100).toFixed(0)}%)`);

  // By category
  const categories = [...new Set(QUESTIONS.map(q => q.category))];
  console.log('\nEnsemble by category:');
  for (const cat of categories) {
    const indices = QUESTIONS.map((q, i) => q.category === cat ? i : -1).filter(i => i >= 0);
    const catHits = indices.filter(i => ensembleHits[i]).length;
    console.log(`  ${cat.padEnd(12)} ${catHits}/${indices.length} (${((catHits / indices.length) * 100).toFixed(0)}%)`);
  }

  // Misses
  const misses = QUESTIONS.filter((_, i) => !ensembleHits[i]);
  if (misses.length > 0) {
    console.log(`\nEnsemble MISSES (${misses.length}):`);
    misses.forEach(({ q, expected, category }) => {
      console.log(`  [${category}] "${q.substring(0, 65)}" → ${expected.join(', ')}`);
    });
  } else {
    console.log('\nEnsemble: no misses');
  }
}

testEnsembleRetrieval().catch(console.error);
