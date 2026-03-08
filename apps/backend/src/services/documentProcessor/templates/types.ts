export interface ParentChildMetadata {
  parent_doc_id: string;
  is_parent: boolean;
  child_index?: number;
  child_chunk_size: number;
  parent_chunk_size: number;
  is_alignment_question?: boolean;
}

export interface TechnicalMetadata {
  filename: string;
  uploadDate: string;
  chunk_index: number;
  total_chunks?: number;

  // Estructura del documento
  section_path?: string;

  // Tipo de contenido
  content_type?: 'text' | 'code' | 'table' | 'list' | 'mixed';

  // Parent Document Retriever
  parent_child?: ParentChildMetadata;
}
