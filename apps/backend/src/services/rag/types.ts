import type { TechnicalMetadata } from '../documentProcessor/templates/types';

export type { TechnicalMetadata };
export type DocumentMetadata = TechnicalMetadata;

export interface RAGSource extends DocumentMetadata {
  rerankScore?: number; // Rerank score if available
}

export interface RAGResponse {
  answer: string;
  sources: RAGSource[];
}

export interface AddDocumentResult {
  success: boolean;
  chunksCount: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QueryWithHistory {
  question: string;
  history?: ConversationMessage[];
  filenameFilter?: string[];
}
