import { Ollama } from '@langchain/community/llms/ollama';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { OLLAMA_CONFIG } from '../../config/ollama';
import { InstructionPrefixedEmbeddings } from './instructionPrefixedEmbeddings';

export const CHUNK_CONFIG = {
  SIZE: parseInt(process.env.CHUNK_SIZE || '1000'),
  OVERLAP: parseInt(process.env.CHUNK_OVERLAP || '200'),
} as const;

export const SIMILARITY_SEARCH_CONFIG = {
  MAX_RESULTS: parseInt(process.env.SIMILARITY_SEARCH_MAX_RESULTS || '4'),
} as const;

export const TEXT_SEPARATORS = {
  SECTION: '\n\n\n',
  PARAGRAPH: '\n\n',
  LINE: '\n',
  SENTENCE: '. ',
  WORD: ' ',
  CHAR: '',
} as const;

export const MESSAGES = {
  NO_DOCUMENTS: 'No hay documentos cargados. Por favor, sube algunos documentos primero en la sección "Upload".',
  NO_RELEVANT_DOCS: 'No encontré información relevante en los documentos subidos.',
  ERROR_PREFIX: 'RAG query failed',
  ERROR_LISTING: 'Error listing documents:',
  ERROR_LIST_FAILED: 'Failed to list documents',
} as const;

export const CONVERSATIONAL_HISTORY_CONFIG = {
  enabled: process.env.CONVERSATIONAL_HISTORY_ENABLED === 'true',
  maxMessages: parseInt(process.env.MAX_HISTORY_MESSAGES || '5'),
} as const;

export const PROMPT_TEMPLATE = {
  SYSTEM: `Eres un asistente técnico especializado en documentación de software y sistemas.

INSTRUCCIONES:

1. ALCANCE Y PRECISIÓN:
   - Responde de forma directa y técnica a la consulta.
   - Analiza tanto el texto descriptivo como los bloques de datos estructurados (JSON, tablas, archivos de configuración, código).
   - Identifica y relaciona entidades técnicas (librerías, parámetros, versiones, dependencias) aunque aparezcan en formatos de definición técnica o sintaxis de programación.

2. RAZONAMIENTO SOBRE EL CONTEXTO:
   - Usa el contexto proporcionado para extraer hechos concretos. 
   - Si la información está presente en un bloque de datos (ej: un package.json o un YAML), interprétala para responder a la pregunta del usuario.
   - Si la información es parcial o contradictoria, indícalo basándote exclusivamente en lo que aparece en los documentos.

3. CUANDO NO HAY RESPUESTA:
   - Di claramente: "No encontré información sobre [tema] en la documentación."

4. PROHIBICIONES:
   - NO inventes datos técnicos que no aparezcan explícitamente.
   - NO uses frases de relleno como "revisando el contexto" o "según los documentos". Ve directo a la información.
   - NO menciones el nombre de los archivos fuente ni añadas metacomentarios sobre la búsqueda.

5. FORMATO:
   - Usa bullet points para listas de elementos o pasos.
   - Preserva los bloques de código o ejemplos técnicos si ayudan a ilustrar la respuesta.
   - Proporciona nombres técnicos completos cuando sea posible.

6. IDIOMA:
   - Responde SIEMPRE en español.`,


  // Estructura compacta para evitar que el modelo se pierda en espacios en blanco
  HISTORY_PREFIX: '\n[HISTORIAL]:',
  CONTEXT_PREFIX: '\n[CONTEXTO_RELEVANTE]:',
  QUESTION_PREFIX: '\n[PREGUNTA_USUARIO]:',

  RESPONSE_PREFIX: 'Respuesta:',

  MULTI_QUERY_PROMPT: `Genera 3 variantes breves de la siguiente pregunta para búsqueda semántica. 
Solo devuelve las preguntas, una por línea, sin números.

Pregunta: {question}`,
} as const;

export const EMBEDDINGS_CONFIG = {
  enabled: process.env.USE_INSTRUCTION_PREFIX === 'true',
  queryPrefix: process.env.EMBEDDING_QUERY_PREFIX ||
    'Represent this sentence for searching relevant passages: ',
  documentPrefix: process.env.EMBEDDING_DOCUMENT_PREFIX || '',
} as const;

export const embeddings = EMBEDDINGS_CONFIG.enabled
  ? new InstructionPrefixedEmbeddings({
      model: OLLAMA_CONFIG.embeddingsModel,
      baseUrl: OLLAMA_CONFIG.baseUrl,
      queryPrefix: EMBEDDINGS_CONFIG.queryPrefix,
      documentPrefix: EMBEDDINGS_CONFIG.documentPrefix,
    })
  : new OllamaEmbeddings({
      model: OLLAMA_CONFIG.embeddingsModel,
      baseUrl: OLLAMA_CONFIG.baseUrl,
    });

export const llm = new Ollama({
  model: OLLAMA_CONFIG.model,
  baseUrl: OLLAMA_CONFIG.baseUrl,
  temperature: 0.1, // Baja temperatura para respuestas más deterministas y precisas
});

// BM25 Retriever Configuration
export const BM25_CONFIG = {
  enabled: process.env.USE_BM25_RETRIEVER === 'true',
  weight: parseFloat(process.env.BM25_WEIGHT || '0.5'),
  vectorWeight: parseFloat(process.env.VECTOR_WEIGHT || '0.5'),
} as const;

// Reranker Configuration
export const RERANKER_CONFIG = {
  enabled: process.env.USE_RERANKER === 'true',
  retrievalTopK: parseInt(process.env.RERANKER_RETRIEVAL_TOP_K || '20'), // Retrieve Top 20 children candidates
  finalTopK: parseInt(process.env.RERANKER_FINAL_TOP_K || '3'),          // Top parents después de reranking
  minScore: parseFloat(process.env.MIN_RERANK_SCORE || '0.6'),           // Minimum score to show sources (estricto)
} as const;

// Parent Document Retriever Configuration
export const PARENT_RETRIEVER_CONFIG = {
  enabled: process.env.USE_PARENT_RETRIEVER === 'true',

  // Child chunks: para búsqueda vectorial
  childChunkSize: parseInt(process.env.CHILD_CHUNK_SIZE || '200'),
  childChunkOverlap: parseInt(process.env.CHILD_CHUNK_OVERLAP || '50'),

  // Parent chunks: para contexto al LLM
  parentChunkSize: parseInt(process.env.PARENT_CHUNK_SIZE || '1000'),
  parentChunkOverlap: parseInt(process.env.PARENT_CHUNK_OVERLAP || '200'),
} as const;

// Debug log
console.log('🔧 Parent Retriever Config:', {
  enabled: PARENT_RETRIEVER_CONFIG.enabled,
  env_value: process.env.USE_PARENT_RETRIEVER,
  childChunkSize: PARENT_RETRIEVER_CONFIG.childChunkSize,
  parentChunkSize: PARENT_RETRIEVER_CONFIG.parentChunkSize,
});
