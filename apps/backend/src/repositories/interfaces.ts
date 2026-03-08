import type { Document } from 'langchain/document';

// ─── Parent Storage ────────────────────────────────────────────────────────────

export interface ParentEntry {
  id: string;
  filename: string;
  document: Document;
}

export interface IParentStorage {
  saveParents(parents: ParentEntry[]): Promise<void>;
  getParentsByIds(ids: string[]): Promise<Map<string, Document>>;
  getByFilename(filename: string): Promise<Document[]>;
  getAllGroupedByFilename(): Promise<Map<string, Document[]>>;
  deleteByFilename(filename: string): Promise<void>;
  clear(): Promise<void>;
}

// ─── BM25 Storage ──────────────────────────────────────────────────────────────

export interface SerializedDocument {
  content: string;
  metadata: Record<string, unknown>;
  filename: string;
}

export interface IBM25Storage {
  save(documents: SerializedDocument[]): Promise<void>;
  load(): Promise<SerializedDocument[] | null>;
  clear(): Promise<void>;
}

// ─── Query Logger ──────────────────────────────────────────────────────────────

export interface QueryLogSource {
  filename: string;
  chunk_index: number;
  rerank_score?: number;
  section_path?: string;
}

export interface QueryLogEntry {
  id: string;
  timestamp: string;
  question: string;
  answer: string;
  model: string;
  latency_ms: number;
  sources: QueryLogSource[];
  num_retrieved: number;
  context_size: number;
}

export interface IQueryLogger {
  log(entry: QueryLogEntry): Promise<void>;
  getRecent(limit?: number): Promise<QueryLogEntry[]>;
}
