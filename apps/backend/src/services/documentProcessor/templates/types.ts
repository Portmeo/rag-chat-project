export interface ParentChildMetadata {
  // Parent-Child relationship
  parent_doc_id: string;           // ID único del documento padre
  is_parent: boolean;              // false = child (para búsqueda), true = parent (no se indexa)
  child_index?: number;            // Índice del child dentro del parent (0, 1, 2...)
  parent_content?: string;         // Contenido completo del parent (solo en parents)

  // Sizes para validación
  child_chunk_size: number;        // Tamaño del chunk child (200)
  parent_chunk_size: number;       // Tamaño del chunk parent (1000)
}

export interface TechnicalMetadata {
  filename: string;
  uploadDate: string;
  chunk_index: number;
  total_chunks?: number;

  // Estructura del documento
  heading_h1?: string;
  heading_h2?: string;
  heading_h3?: string;
  section_path?: string;

  // Tipo de contenido
  content_type?: 'text' | 'code' | 'table' | 'list' | 'mixed';
  language?: string;

  // Características
  has_code?: boolean;
  has_links?: boolean;
  word_count?: number;

  // Contexto técnico (detectado automáticamente)
  framework?: string;
  library?: string;
  version?: string;

  // Parent Document Retriever
  parent_child?: ParentChildMetadata;
}
