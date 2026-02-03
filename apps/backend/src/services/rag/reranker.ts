/**
 * Reranker Service
 *
 * Manages worker thread for document reranking.
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Document {
  pageContent: string;
  metadata: any;
}

interface RerankResult extends Document {
  rerankScore: number;
}

/**
 * Rerank documents using worker thread
 *
 * @param query - User query
 * @param documents - Candidate documents (typically Top 20-25 from retriever)
 * @param topK - Number of top documents to return (default: 5)
 * @returns Reranked top K documents
 */
export async function rerankDocuments(
  query: string,
  documents: Document[],
  topK: number = 5
): Promise<RerankResult[]> {
  return new Promise((resolve, reject) => {
    // Create worker thread
    // Use .js extension as TypeScript is compiled to JavaScript
    const workerPath = join(__dirname, 'reranker.worker.js');
    const worker = new Worker(workerPath);

    // Set timeout (configurable via env, default 30s)
    const timeoutMs = parseInt(process.env.RERANKER_TIMEOUT_MS || '30000');
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Reranking timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    // Listen for messages from worker
    worker.on('message', (result) => {
      clearTimeout(timeout);
      worker.terminate();

      if (result.success) {
        resolve(result.documents);
      } else {
        reject(new Error(result.error || 'Reranking failed'));
      }
    });

    // Handle worker errors
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

    // Send reranking request to worker
    worker.postMessage({ query, documents, topK });
  });
}
