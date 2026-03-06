import { Ollama } from '@langchain/community/llms/ollama';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { ChatAnthropic } from '@langchain/anthropic';
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
  SYSTEM: `Eres un asistente técnico especializado en documentación.

INSTRUCCIONES:

1. ALCANCE DE LA RESPUESTA:
   - Responde SOLO lo que se pregunta
   - Añade contexto relevante únicamente si ayuda a entender la respuesta
   - No incluyas información adicional del contexto que no responda directamente a la pregunta

2. FUENTE DE INFORMACIÓN:
   - Usa EXCLUSIVAMENTE el contexto proporcionado
   - NUNCA inventes información que no esté en el contexto
   - Si no hay información suficiente, indícalo claramente

3. CUANDO NO HAY RESPUESTA:
   - Di: "No encontré información sobre [tema específico] en la documentación."
   - Si hay información parcial relacionada, menciónala brevemente

4. PROHIBICIONES ESTRICTAS:
   - NO uses frases de relleno como: "Según el texto", "Revisando los documentos", "Espero que esto ayude"
   - NO menciones los documentos fuente: "Esto viene del documento X", "según Y.md", "en el contexto proporcionado"
   - NO añadas notas explicativas sobre el origen de la información
   - NO uses prefijos como "Nota:", "Aclaración:", "Información adicional:"
   - NO respondas con una sola palabra sin contexto

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

// Claude Configuration
export const CLAUDE_CONFIG = {
  enabled: process.env.USE_CLAUDE === 'true',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
} as const;

// LLM Configuration - Use Claude if enabled, otherwise Ollama
export const llm = CLAUDE_CONFIG.enabled
  ? new ChatAnthropic({
      anthropicApiKey: CLAUDE_CONFIG.apiKey,
      model: CLAUDE_CONFIG.model,
      temperature: 0.1,
      maxTokens: 4096,
    })
  : new Ollama({
      model: OLLAMA_CONFIG.model,
      baseUrl: OLLAMA_CONFIG.baseUrl,
      temperature: 0.1,
    });

// Log which LLM is being used
console.log('🤖 LLM Configuration:', CLAUDE_CONFIG.enabled 
  ? `Claude API (${CLAUDE_CONFIG.model})` 
  : `Ollama (${OLLAMA_CONFIG.model})`
);

// BM25 Retriever Configuration
export const BM25_CONFIG = {
  enabled: process.env.USE_BM25_RETRIEVER === 'true',
  weight: parseFloat(process.env.BM25_WEIGHT || '0.5'),
  vectorWeight: parseFloat(process.env.VECTOR_WEIGHT || '0.5'),
} as const;

// Reranker Configuration
export const RERANKER_CONFIG = {
  enabled: process.env.USE_RERANKER === 'true',
  model: process.env.RERANKER_MODEL || 'Xenova/bge-reranker-base',
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
