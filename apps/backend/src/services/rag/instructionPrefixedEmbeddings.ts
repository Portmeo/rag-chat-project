import { OllamaEmbeddings } from '@langchain/ollama';

export interface InstructionPrefixedEmbeddingsParams {
  model?: string;
  baseUrl?: string;
  queryPrefix?: string;
  documentPrefix?: string;
}

/**
 * Custom embeddings class that adds asymmetric instruction prefixes
 * for improved retrieval performance.
 *
 * Based on benchmark data:
 * - Without prefix: MRR 0.844
 * - With query prefix: MRR 0.875 (+3.7%)
 */
export class InstructionPrefixedEmbeddings extends OllamaEmbeddings {
  private queryPrefix: string;
  private documentPrefix: string;

  constructor(params: InstructionPrefixedEmbeddingsParams) {
    super(params);
    this.queryPrefix = params.queryPrefix || '';
    this.documentPrefix = params.documentPrefix || '';
  }

  /**
   * Override: Add instruction prefix to query embeddings
   */
  async embedQuery(query: string): Promise<number[]> {
    const prefixedQuery = this.queryPrefix + query;
    return super.embedQuery(prefixedQuery);
  }

  /**
   * Override: Add prefix to document embeddings (typically empty)
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    const prefixedDocuments = documents.map(doc => this.documentPrefix + doc);
    return super.embedDocuments(prefixedDocuments);
  }
}
