import type { TechnicalMetadata } from '../documentProcessor/templates';

export type DocumentMetadata = TechnicalMetadata;

export interface RAGResponse {
  answer: string;
  sources: DocumentMetadata[];
}

export interface AddDocumentResult {
  success: boolean;
  chunksCount: number;
}
