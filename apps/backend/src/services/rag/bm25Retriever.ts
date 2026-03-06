import type { Document } from 'langchain/document';
import { BaseRetriever, type BaseRetrieverInput } from '@langchain/core/retrievers';
import { CallbackManagerForRetrieverRun } from 'langchain/callbacks';
import natural from 'natural';

const { TfIdf } = natural;

export interface BM25RetrieverInput extends BaseRetrieverInput {
  documents: Document[];
  k?: number;
}

export class BM25Retriever extends BaseRetriever {
  lc_namespace = ['langchain', 'retrievers', 'bm25'];

  private documents: Document[];
  private k: number;
  private tfidf: InstanceType<typeof TfIdf>;

  constructor(fields: BM25RetrieverInput) {
    super(fields);
    this.documents = fields.documents;
    this.k = fields.k ?? 4;
    this.tfidf = new TfIdf();

    for (const doc of this.documents) {
      this.tfidf.addDocument(doc.pageContent);
    }
  }

  // @ts-ignore - Type conflict between @langchain/core versions
  async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document<Record<string, any>>[]> {
    const scores: Array<{ doc: Document; score: number; index: number }> = [];

    this.documents.forEach((doc, index) => {
      let score = 0;
      const terms = query.toLowerCase().split(/\s+/);

      terms.forEach((term) => {
        score += this.tfidf.tfidf(term, index);
      });

      scores.push({ doc, score, index });
    });

    scores.sort((a, b) => b.score - a.score);

    // DEBUG: Log top BM25 results
    console.log(`\n🔍 BM25 query: "${query}"`);
    console.log('Top 5 BM25 results:');
    scores.slice(0, 5).forEach((item, idx) => {
      const metadata = item.doc.metadata as any;
      console.log(`  ${idx + 1}. Score: ${item.score.toFixed(4)} | File: ${metadata.filename} | Chunk: ${metadata.chunk_index} | Preview: ${item.doc.pageContent.substring(0, 80)}...`);
    });

    return scores.slice(0, this.k).map((item) => item.doc);
  }
}
