/**
 * Reranker Service
 *
 * Manages reranking of documents.
 * Priority: Worker thread (isolated)
 * Fallback: Main thread (if worker fails or during development)
 */

import { Worker } from 'worker_threads';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { env, AutoTokenizer, AutoModelForSequenceClassification } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Disable sharp BEFORE importing transformers (via env)
process.env.TRANSFORMERS_DISABLE_SHARP = '1';
env.allowLocalModels = false;
env.useBrowserCache = false;

interface Document {
  pageContent: string;
  metadata: any;
}

interface RerankResult extends Document {
  rerankScore: number;
}

// State for main thread fallback
let rerankerModel: any = null;
let rerankerTokenizer: any = null;

/**
 * Initialize reranker model in main thread (lazy loading fallback)
 */
async function initRerankerInMainThread() {
  if (!rerankerModel || !rerankerTokenizer) {
    console.log('🔄 [Reranker] Loading model in main thread (fallback)...');
    const { RERANKER_CONFIG } = await import('./config.js');
    const modelName = RERANKER_CONFIG.model;
    rerankerTokenizer = await AutoTokenizer.from_pretrained(modelName);
    rerankerModel = await AutoModelForSequenceClassification.from_pretrained(modelName);
    console.log(`✅ [Reranker] Model loaded in main thread: ${modelName}`);
  }
  return { model: rerankerModel, tokenizer: rerankerTokenizer };
}

/**
 * Rerank documents in main thread (fallback)
 */
async function rerankInMainThread(
  query: string,
  documents: Document[],
  topK: number = 5
): Promise<RerankResult[]> {
  const { model, tokenizer } = await initRerankerInMainThread();
  const startTime = Date.now();

  const queries = documents.map(() => query);
  const docs = documents.map(doc => doc.pageContent);

  const inputs = await tokenizer(queries, {
    text_pair: docs,
    padding: true,
    truncation: true,
  });

  const { logits } = await model(inputs);
  const logitsArray = Array.from(logits.data) as number[];
  const numLabels = logits.dims[1] || 1;
  const relevanceLogits = numLabels === 1
    ? logitsArray
    : logitsArray.filter((_, idx) => idx % numLabels === 0);

  const rerankedDocs: RerankResult[] = documents
    .map((doc, i) => ({
      ...doc,
      rerankScore: relevanceLogits[i]
    }))
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topK);

  const elapsed = Date.now() - startTime;
  console.log(`✅ [Reranker] Reranked ${documents.length} docs → Top ${topK} in ${elapsed}ms (Main Thread)`);
  
  return rerankedDocs;
}

/**
 * Rerank documents using worker thread with main thread fallback
 */
export async function rerankDocuments(
  query: string,
  documents: Document[],
  topK: number = 5
): Promise<RerankResult[]> {
  if (documents.length === 0) return [];

  // Attempt to use worker thread
  try {
    return await new Promise<RerankResult[]>((resolve, reject) => {
      const isTS = __filename.endsWith('.ts');
      const workerExtension = isTS ? '.ts' : '.js';
      const workerPath = join(__dirname, `reranker.worker${workerExtension}`);
      
      // Use pathToFileURL for absolute paths in ESM
      const workerURL = pathToFileURL(workerPath);
      
      const worker = new Worker(workerURL, {
        execArgv: isTS ? ['--import', 'tsx'] : []
      });

      const timeoutMs = parseInt(process.env.RERANKER_TIMEOUT_MS || '30000');
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error(`Reranking timeout (${timeoutMs}ms)`));
      }, timeoutMs);

      worker.on('message', (result) => {
        clearTimeout(timeout);
        worker.terminate();
        if (result.success) {
          resolve(result.documents);
        } else {
          reject(new Error(result.error || 'Reranking failed'));
        }
      });

      worker.on('error', (error) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(error);
      });

      worker.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });

      worker.postMessage({ query, documents, topK });
    });
  } catch (error) {
    console.warn(`⚠️  Reranker worker failed, falling back to main thread:`, error instanceof Error ? error.message : String(error));
    // Fallback to main thread
    return await rerankInMainThread(query, documents, topK);
  }
}
