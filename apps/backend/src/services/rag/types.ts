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

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QueryWithHistory {
  question: string;
  history?: ConversationMessage[];
}
