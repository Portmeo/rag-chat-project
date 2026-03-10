import type { Document } from 'langchain/document';
import { BaseRetriever, type BaseRetrieverInput } from '@langchain/core/retrievers';
import { CallbackManagerForRetrieverRun } from 'langchain/callbacks';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('ENSEMBLE');

export interface EnsembleRetrieverInput extends BaseRetrieverInput {
  retrievers: BaseRetriever[];
  weights?: number[];
}

export class EnsembleRetriever extends BaseRetriever {
  lc_namespace = ['langchain', 'retrievers', 'ensemble'];

  private retrievers: BaseRetriever[];
  private weights: number[];

  constructor(fields: EnsembleRetrieverInput) {
    super(fields);
    this.retrievers = fields.retrievers;
    this.weights = fields.weights ?? Array(fields.retrievers.length).fill(1 / fields.retrievers.length);

    if (this.retrievers.length !== this.weights.length) {
      throw new Error('Number of retrievers and weights must match');
    }

    const sumWeights = this.weights.reduce((sum, w) => sum + w, 0);
    if (Math.abs(sumWeights - 1.0) > 0.01) {
      throw new Error('Weights must sum to 1');
    }
  }

  // @ts-ignore - Type conflict between @langchain/core versions
  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document<Record<string, any>>[]> {
    const allResults = await Promise.all(
      this.retrievers.map((retriever) =>
        // Use invoke() for compatibility with newer LangChain versions
        retriever.invoke(query)
      )
    );

    logger.log('Ensemble Retriever Results:');
    allResults.forEach((docs, retrieverIndex) => {
      logger.log(`Retriever ${retrieverIndex} (weight: ${this.weights[retrieverIndex]}): ${docs.length} docs`);
      docs.slice(0, 3).forEach((doc, idx) => {
        const metadata = doc.metadata as any;
        logger.log(`  ${idx + 1}. ${metadata.filename} chunk ${metadata.chunk_index}`);
      });
    });

    const docScores = new Map<string, { doc: Document; score: number }>();

    allResults.forEach((docs, retrieverIndex) => {
      const weight = this.weights[retrieverIndex];

      docs.forEach((doc, rank) => {
        const k = 60; // RRF standard constant
        const score = weight * (1 / (k + rank + 1));
        const key = doc.pageContent;

        if (docScores.has(key)) {
          const existing = docScores.get(key)!;
          existing.score += score;
        } else {
          docScores.set(key, { doc, score });
        }
      });
    });

    const sortedDocs = Array.from(docScores.values())
      .sort((a, b) => b.score - a.score)
      .map((item) => item.doc);

    logger.log(`Final ensemble results: ${sortedDocs.length} docs`);
    sortedDocs.slice(0, 5).forEach((doc, idx) => {
      const metadata = doc.metadata as any;
      logger.log(`  ${idx + 1}. ${metadata.filename} chunk ${metadata.chunk_index}`);
    });

    return sortedDocs;
  }
}
