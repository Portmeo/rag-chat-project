/**
 * Reranker Worker Thread
 *
 * Uses BGE-Reranker-Base (Cross-Encoder) to rerank documents.
 * Runs in isolated thread to avoid blocking main event loop.
 */

// Disable sharp BEFORE importing transformers
process.env.TRANSFORMERS_DISABLE_SHARP = '1';

import { pipeline, env } from '@xenova/transformers';
import { parentPort } from 'worker_threads';

// Disable sharp for text-only processing
env.allowLocalModels = false;
env.useBrowserCache = false;

interface Document {
  pageContent: string;
  metadata: any;
}

interface RerankRequest {
  query: string;
  documents: Document[];
  topK?: number;
}

interface RerankResult extends Document {
  rerankScore: number;
}

let rerankerModel: any = null;

/**
 * Initialize reranker model (lazy loading)
 */
async function initReranker() {
  if (!rerankerModel) {
    console.log('🔄 Loading bge-reranker-base model...');

    // Use text-classification pipeline with bge-reranker
    rerankerModel = await pipeline(
      'text-classification',
      'Xenova/bge-reranker-base'
    );

    console.log('✅ Reranker model loaded');
  }
  return rerankerModel;
}

/**
 * Rerank documents using cross-encoder
 */
async function rerankDocuments(
  query: string,
  documents: Document[],
  topK: number = 5
): Promise<RerankResult[]> {
  const model = await initReranker();

  console.log(`📊 Reranking ${documents.length} documents...`);
  const startTime = Date.now();

  // Create query-document pairs
  const pairs = documents.map(doc => {
    // Cross-encoder input format: [query, document]
    // bge-reranker uses [SEP] token internally
    return `${query} [SEP] ${doc.pageContent}`;
  });

  // Batch inference for efficiency
  const scores = await Promise.all(
    pairs.map(pair => model(pair))
  );

  // Combine documents with scores
  const rerankedDocs: RerankResult[] = documents
    .map((doc, i) => {
      // Extract score from model output
      // Format: [{ label: 'LABEL_0', score: 0.1 }, { label: 'LABEL_1', score: 0.9 }]
      // LABEL_1 typically represents "relevant"
      const relevantScore = scores[i].find((s: any) => s.label === 'LABEL_1')?.score || 0;

      return {
        ...doc,
        rerankScore: relevantScore,
      };
    })
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topK);

  const elapsed = Date.now() - startTime;
  console.log(`✅ Reranking completed in ${elapsed}ms`);
  console.log(`   Top score: ${rerankedDocs[0]?.rerankScore.toFixed(4)}`);
  console.log(`   Bottom score: ${rerankedDocs[rerankedDocs.length - 1]?.rerankScore.toFixed(4)}`);

  return rerankedDocs;
}

/**
 * Worker message handler
 */
if (parentPort) {
  parentPort.on('message', async (request: RerankRequest) => {
    try {
      const { query, documents, topK = 5 } = request;

      const rerankedDocs = await rerankDocuments(query, documents, topK);

      // Send results back to main thread
      parentPort!.postMessage({
        success: true,
        documents: rerankedDocs,
      });
    } catch (error) {
      console.error('❌ Reranker worker error:', error);
      parentPort!.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

export { rerankDocuments };
