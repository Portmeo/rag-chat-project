const DEFAULTS = {
  BASE_URL: 'http://localhost:11434',
  MODEL: 'llama3.1:8b',
  EMBEDDINGS_MODEL: 'mxbai-embed-large',
} as const;

export const OLLAMA_CONFIG = {
  baseUrl: process.env.OLLAMA_BASE_URL || DEFAULTS.BASE_URL,
  model: process.env.OLLAMA_MODEL || DEFAULTS.MODEL,
  embeddingsModel: process.env.OLLAMA_EMBEDDINGS_MODEL || DEFAULTS.EMBEDDINGS_MODEL,
} as const;
