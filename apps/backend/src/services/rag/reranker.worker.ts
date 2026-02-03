/**
 * Reranker Worker Thread
 *
 * Uses BGE-Reranker-Base (Cross-Encoder) to rerank documents.
 * Runs in isolated thread to avoid blocking main event loop.
 */

// Disable sharp BEFORE importing transformers
process.env.TRANSFORMERS_DISABLE_SHARP = '1';

import { pipeline, env, AutoTokenizer, AutoModelForSequenceClassification } from '@xenova/transformers';
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
let rerankerTokenizer: any = null;

/**
 * Initialize reranker model (lazy loading)
 */
async function initReranker() {
  if (!rerankerModel || !rerankerTokenizer) {
    console.log('🔄 Loading reranker model and tokenizer directly...');

    // Load tokenizer and model DIRECTLY (bypass pipeline to access raw logits)
    const modelName = 'Xenova/ms-marco-MiniLM-L-6-v2';

    rerankerTokenizer = await AutoTokenizer.from_pretrained(modelName);
    rerankerModel = await AutoModelForSequenceClassification.from_pretrained(modelName);

    console.log('✅ Reranker model and tokenizer loaded (direct access)');
  }
  return { model: rerankerModel, tokenizer: rerankerTokenizer };
}

/**
 * Sigmoid activation function
 * Converts logits to probabilities in range [0, 1]
 */
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/**
 * Rerank documents using cross-encoder
 */
async function rerankDocuments(
  query: string,
  documents: Document[],
  topK: number = 5
): Promise<RerankResult[]> {
  const { model, tokenizer } = await initReranker();
  const startTime = Date.now();

  // Get relevance logits for each document
  const logits = await Promise.all(
    documents.map(async (doc) => {
      try {
        // Tokenize (query, document) pair
        const inputs = await tokenizer(query, {
          text_pair: doc.pageContent,
          padding: true,
          truncation: true,
        });

        // Get raw logits from model
        const { logits } = await model(inputs);
        return logits.data[0];  // Relevance logit
      } catch (error: any) {
        console.error('⚠️ Reranking error:', error.message);
        return -999;  // Very low score for errors
      }
    })
  );

  // Convert logits to probabilities and rank by relevance
  const rerankedDocs: RerankResult[] = documents
    .map((doc, i) => ({
      ...doc,
      rerankScore: sigmoid(logits[i])
    }))
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
