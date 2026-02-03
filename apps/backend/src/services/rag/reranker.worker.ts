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
 * Rerank documents using cross-encoder
 */
async function rerankDocuments(
  query: string,
  documents: Document[],
  topK: number = 5
): Promise<RerankResult[]> {
  const { model, tokenizer } = await initReranker();

  console.log(`📊 Reranking ${documents.length} documents...`);
  const startTime = Date.now();

  // Process documents and get RAW LOGITS (not normalized probabilities)
  const scores = await Promise.all(
    documents.map(async (doc, idx) => {
      try {
        // Tokenize the (query, document) pair
        const inputs = await tokenizer(query, {
          text_pair: doc.pageContent,
          padding: true,
          truncation: true,
        });

        // Run model inference to get RAW logits
        const { logits } = await model(inputs);

        // Extract logit for the relevance class
        // For cross-encoders, typically a single output neuron or first logit
        const logitArray = logits.data;  // Access raw tensor data
        const relevanceLogit = logitArray[0];  // First logit is relevance score

        // DEBUG: Log for first 3 docs
        if (idx < 3) {
          console.log(`\n🔍 ===== DOC ${idx} RAW LOGITS =====`);
          console.log('Query:', query.substring(0, 60));
          console.log('Doc preview:', doc.pageContent.substring(0, 80) + '...');
          console.log('Logits shape:', logits.dims);
          console.log('Logits data (first 5):', logitArray.slice(0, 5));
          console.log('Relevance logit:', relevanceLogit);
          console.log('================================\n');
        }

        return relevanceLogit;
      } catch (error: any) {
        console.error(`⚠️  Reranking error for doc ${idx}:`, error.message);
        console.error(`⚠️  Full error:`, error);
        return -999;  // Very low score for errors
      }
    })
  );

  // Combine documents with scores
  // Scores are now RAW LOGITS - apply sigmoid to normalize to 0-1 range
  const rerankedDocs: RerankResult[] = documents
    .map((doc, i) => {
      const rawLogit = scores[i];

      // Apply sigmoid to convert logit to probability: σ(x) = 1 / (1 + e^(-x))
      const relevantScore = 1 / (1 + Math.exp(-rawLogit));

      if (i < 3) {
        console.log(`📊 Doc ${i}: logit=${rawLogit.toFixed(4)} → score=${relevantScore.toFixed(4)}`);
      }

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
