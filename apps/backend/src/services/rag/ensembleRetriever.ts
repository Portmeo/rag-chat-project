import type { Document } from 'langchain/document';
import { BaseRetriever, type BaseRetrieverInput } from 'langchain/schema/retriever';
import { CallbackManagerForRetrieverRun } from 'langchain/callbacks';

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

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    const allResults = await Promise.all(
      this.retrievers.map((retriever) =>
        retriever.getRelevantDocuments(query, runManager?.getChild())
      )
    );

    // DEBUG: Log what each retriever returned
    console.log('\n📊 Ensemble Retriever Results:');
    allResults.forEach((docs, retrieverIndex) => {
      console.log(`\nRetriever ${retrieverIndex} (weight: ${this.weights[retrieverIndex]}): ${docs.length} docs`);
      docs.slice(0, 3).forEach((doc, idx) => {
        const metadata = doc.metadata as any;
        console.log(`  ${idx + 1}. ${metadata.filename} chunk ${metadata.chunk_index}`);
      });
    });

    const docScores = new Map<string, { doc: Document; score: number }>();

    allResults.forEach((docs, retrieverIndex) => {
      const weight = this.weights[retrieverIndex];

      docs.forEach((doc, rank) => {
        const score = weight / (rank + 1);
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

    console.log(`\n✅ Final ensemble results: ${sortedDocs.length} docs`);
    sortedDocs.slice(0, 5).forEach((doc, idx) => {
      const metadata = doc.metadata as any;
      console.log(`  ${idx + 1}. ${metadata.filename} chunk ${metadata.chunk_index}`);
    });

    return sortedDocs;
  }
}
