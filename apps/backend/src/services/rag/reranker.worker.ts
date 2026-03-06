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
    const modelName = process.env.RERANKER_MODEL || 'Xenova/bge-reranker-base';

    rerankerTokenizer = await AutoTokenizer.from_pretrained(modelName);
    rerankerModel = await AutoModelForSequenceClassification.from_pretrained(modelName);

    console.log(`✅ Reranker model and tokenizer loaded: ${modelName}`);
  }
  return { model: rerankerModel, tokenizer: rerankerTokenizer };
}

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

  // BATCH PROCESSING: Tokenize all pairs at once (much faster)
  // For batch with text pairs, we need to pass queries and docs as separate arrays
  const queries = documents.map(() => query);  // Repeat query for each doc
  const docs = documents.map(doc => doc.pageContent);

  // Tokenize all pairs in a single batch operation
  const inputs = await tokenizer(queries, {
    text_pair: docs,  // Pass docs as text_pair array
    padding: true,
    truncation: true,
  });

  // Single model inference for all documents (GPU optimized)
  const { logits } = await model(inputs);

  // Extract relevance logits (one per document)
  const numDocs = documents.length;
  const logitsArray = Array.from(logits.data) as number[];

  // For sequence classification, we get [batch_size, num_labels] output
  // If num_labels = 1: logitsArray = [score1, score2, ...]
  // If num_labels > 1: extract first logit of each batch
  const numLabels = logits.dims[1] || 1;
  const relevanceLogits = numLabels === 1
    ? logitsArray
    : logitsArray.filter((_, idx) => idx % numLabels === 0);

  // BGE reranker uses UNBOUNDED logits (not probabilities)
  // Higher logit = more relevant. DO NOT apply sigmoid - scores are meant to be compared relatively.
  // Typical range: -10 to +10, but can be higher/lower
  const rerankedDocs: RerankResult[] = documents
    .map((doc, i) => ({
      ...doc,
      rerankScore: relevanceLogits[i]  // Raw logits for BGE
    }))
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topK);

  const elapsed = Date.now() - startTime;
  console.log(`✅ Reranked ${numDocs} docs → Top ${topK} in ${elapsed}ms (batch)`);
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
