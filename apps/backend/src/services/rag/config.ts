import { Ollama } from '@langchain/ollama';
import { OllamaEmbeddings } from '@langchain/ollama';
import { ChatAnthropic } from '@langchain/anthropic';
import { OLLAMA_CONFIG } from '../../config/ollama';
import { InstructionPrefixedEmbeddings } from './instructionPrefixedEmbeddings';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('CONFIG');

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

export const QUERY_REFORMULATION_CONFIG = {
  enabled: process.env.QUERY_REFORMULATION_ENABLED === 'true',
  maxMessages: parseInt(process.env.QUERY_REFORMULATION_MAX_MESSAGES || '5'),
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
   - SÍ puedes contar elementos de listas o tablas, extraer datos numéricos, y sintetizar información que esté presente en el contexto — eso es leer, no inventar
   - Lo que NO debes hacer es añadir información que no aparezca en el contexto, aunque la sepas por tu conocimiento previo
   - Cuando el contexto no cubre algo, di que no tienes esa información — no uses tu conocimiento de Angular, NgRx, Ionic ni ninguna otra tecnología para rellenar huecos

3. CUANDO NO HAY RESPUESTA:
   - Di: "No encontré información sobre [tema específico] en la documentación disponible."
   - Si hay información parcial relacionada, responde con lo que sí hay — no digas "no encontré" si el contexto contiene datos relevantes aunque no sean una respuesta literal

3b. CUANDO LA PREGUNTA ASUME ALGO INCORRECTO:
   - Si la pregunta contiene una premisa falsa o una tecnología/concepto que no existe en la documentación, corrígela y responde con la información real que sí está disponible.

4. PROHIBICIONES ESTRICTAS:
   - NO uses frases de relleno como: "Según el texto", "Revisando los documentos", "Espero que esto ayude"
   - NO menciones los documentos fuente: "Esto viene del documento X", "según Y.md", "en el contexto proporcionado"
   - NO copies, cites ni hagas referencia a los encabezados internos del contexto como "[DOCUMENTO X]", "[Fuente: ...]" o cualquier etiqueta de formato interna
   - NO añadas notas explicativas sobre el origen de la información
   - NO uses prefijos como "Nota:", "Aclaración:", "Información adicional:"
   - NO respondas con una sola palabra sin contexto
   - NO especifiques más detalle del que aparece en el contexto: si el contexto da un dato parcial, reprodúcelo tal cual sin completarlo
   - NO uses tu conocimiento previo de frameworks, librerías o tecnologías para ampliar una respuesta más allá de lo que dice el contexto

5. FORMATO:
   - Usa bullet points para listas de elementos o pasos.
   - Preserva los bloques de código o ejemplos técnicos si ayudan a ilustrar la respuesta.
   - Proporciona nombres técnicos completos cuando sea posible.

6. IDIOMA:
   - Responde SIEMPRE en español.`,


  // Estructura compacta para evitar que el modelo se pierda en espacios en blanco
  CONTEXT_PREFIX: '\n[CONTEXTO_RELEVANTE]:',
  QUESTION_PREFIX: '\n[PREGUNTA_USUARIO]:',

  RESPONSE_PREFIX: 'Respuesta:',

  MULTI_QUERY_PROMPT: `Genera 2 variantes breves de la siguiente pregunta para búsqueda semántica.
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
      temperature: 0.0,
      maxTokens: 4096,
    })
  : new Ollama({
      model: OLLAMA_CONFIG.model,
      baseUrl: OLLAMA_CONFIG.baseUrl,
      temperature: 0.0,
    });

export const ACTIVE_MODEL = CLAUDE_CONFIG.enabled
  ? CLAUDE_CONFIG.model
  : OLLAMA_CONFIG.model;

// Log which LLM is being used
logger.log('LLM Configuration:', CLAUDE_CONFIG.enabled
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

// Intent Classifier Configuration
// Detects casual inputs (greetings, thanks, farewells) to skip the RAG pipeline
// Modes: 'regex' (fast, no LLM) | 'hybrid' (regex + LLM fallback) | 'llm' (all through LLM)
export const INTENT_CLASSIFIER_CONFIG = {
  enabled: process.env.USE_INTENT_CLASSIFIER === 'true',
  mode: (process.env.INTENT_CLASSIFIER_MODE || 'hybrid') as 'regex' | 'hybrid' | 'llm',
} as const;

// Similarity Drop-off Configuration
// Removes documents whose score drops too far from the best result
// More intelligent than fixed top-K: adapts to retrieval quality
export const SIMILARITY_DROPOFF_CONFIG = {
  enabled: process.env.USE_SIMILARITY_DROPOFF === 'true',
  maxDrop: parseFloat(process.env.SIMILARITY_DROPOFF_MAX_DROP || '0.20'), // 20% drop-off threshold
  minDocs: parseInt(process.env.SIMILARITY_DROPOFF_MIN_DOCS || '2'),      // Always keep at least N docs
} as const;

// Alignment Optimization Configuration
// Generates hypothetical questions per parent chunk during indexing
// Improves retrieval matching: query↔question instead of query↔raw text
export const ALIGNMENT_OPTIMIZATION_CONFIG = {
  enabled: process.env.USE_ALIGNMENT_OPTIMIZATION === 'true',
  questionsPerChunk: parseInt(process.env.ALIGNMENT_QUESTIONS_PER_CHUNK || '3'),
} as const;

// Contextual Compression Configuration
export const CONTEXTUAL_COMPRESSION_CONFIG = {
  enabled: process.env.USE_CONTEXTUAL_COMPRESSION === 'true',
  threshold: parseFloat(process.env.COMPRESSION_THRESHOLD || '0.20'),
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
logger.log('Parent Retriever Config:', {
  enabled: PARENT_RETRIEVER_CONFIG.enabled,
  env_value: process.env.USE_PARENT_RETRIEVER,
  childChunkSize: PARENT_RETRIEVER_CONFIG.childChunkSize,
  parentChunkSize: PARENT_RETRIEVER_CONFIG.parentChunkSize,
});
