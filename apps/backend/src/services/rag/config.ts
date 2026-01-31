import { Ollama } from '@langchain/community/llms/ollama';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { OLLAMA_CONFIG } from '../../config/ollama';

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

export const PROMPT_TEMPLATE = {
  SYSTEM: `Eres un asistente experto que responde preguntas basándote ÚNICAMENTE en el contexto proporcionado.

INSTRUCCIONES IMPORTANTES:
1. Usa SOLO la información del contexto para responder
2. Si la respuesta está en el contexto, cita partes relevantes entre comillas
3. Si NO encuentras la respuesta en el contexto, di claramente "No encuentro esa información en los documentos proporcionados"
4. Sé preciso y conciso
5. Si el contexto es ambiguo o incompleto, reconócelo
6. IMPORTANTE: Responde SIEMPRE en español, NUNCA en chino u otros idiomas

Contexto de documentos:`,
  QUESTION_PREFIX: '\n\nPregunta del usuario:',
  INSTRUCTION: '',
  RESPONSE_PREFIX: '\n\nRespuesta en español (basada únicamente en el contexto):',
  MULTI_QUERY_PROMPT: `Eres un asistente de IA que ayuda a mejorar las búsquedas.
Genera 3 versiones diferentes de la siguiente pregunta para buscar información relevante en una base de datos vectorial.
Las variaciones deben mantener la intención pero usar diferentes palabras y enfoques.

Pregunta original: {question}

Devuelve solo las 3 preguntas alternativas, una por línea, sin numeración ni formato adicional.`,
} as const;

export const embeddings = new OllamaEmbeddings({
  model: OLLAMA_CONFIG.embeddingsModel,
  baseUrl: OLLAMA_CONFIG.baseUrl,
});

export const llm = new Ollama({
  model: OLLAMA_CONFIG.model,
  baseUrl: OLLAMA_CONFIG.baseUrl,
});

// BM25 Retriever Configuration
export const BM25_CONFIG = {
  enabled: process.env.USE_BM25_RETRIEVER === 'true',
  weight: parseFloat(process.env.BM25_WEIGHT || '0.8'),
  vectorWeight: parseFloat(process.env.VECTOR_WEIGHT || '0.2'),
} as const;

// Reranker Configuration
export const RERANKER_CONFIG = {
  enabled: process.env.USE_RERANKER === 'true',
  retrievalTopK: parseInt(process.env.RERANKER_RETRIEVAL_TOP_K || '20'), // Retrieve Top 20-25 candidates
  finalTopK: parseInt(process.env.RERANKER_FINAL_TOP_K || '5'),           // Rerank to Top 5
} as const;
