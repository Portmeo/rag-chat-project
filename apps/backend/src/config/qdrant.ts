const DEFAULTS = {
  URL: 'http://localhost:6333',
  COLLECTION_NAME: 'documents',
  VECTOR_DIMENSION: 1024,
  DISTANCE_METRIC: 'Cosine',
} as const;

type DistanceMetric = 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan';

export const QDRANT_CONFIG = {
  url: process.env.QDRANT_URL || DEFAULTS.URL,
  collectionName: process.env.QDRANT_COLLECTION_NAME || DEFAULTS.COLLECTION_NAME,
  vectorDimension: parseInt(process.env.QDRANT_VECTOR_DIMENSION || String(DEFAULTS.VECTOR_DIMENSION)),
  distanceMetric: (process.env.QDRANT_DISTANCE_METRIC || DEFAULTS.DISTANCE_METRIC) as DistanceMetric,
};
