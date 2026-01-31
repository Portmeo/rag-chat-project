import { QdrantClient } from '@qdrant/js-client-rest';
import { QDRANT_CONFIG } from '../config/qdrant';

// ============================================================================
// CLIENTE
// ============================================================================

export const qdrantClient = new QdrantClient({ url: QDRANT_CONFIG.url });

// ============================================================================
// CONSTANTES
// ============================================================================

export const COLLECTION_NAME = QDRANT_CONFIG.collectionName;

const MESSAGES = {
  COLLECTION_EXISTS: '✅ Qdrant collection already exists',
  COLLECTION_CREATED: '✅ Created Qdrant collection',
  COLLECTION_CLEARED: '✅ Qdrant collection cleared',
  ERROR_INITIALIZING: '❌ Error initializing Qdrant:',
  ERROR_CLEARING: '❌ Error clearing Qdrant:',
} as const;

// ============================================================================
// FUNCIONES
// ============================================================================

export async function initQdrant(): Promise<void> {
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some((col) => col.name === COLLECTION_NAME);

    if (exists) {
      console.log(`${MESSAGES.COLLECTION_EXISTS}: ${COLLECTION_NAME}`);
      return;
    }

    await qdrantClient.createCollection(COLLECTION_NAME, {
      vectors: {
        size: QDRANT_CONFIG.vectorDimension,
        distance: QDRANT_CONFIG.distanceMetric,
      },
    });

    console.log(
      `${MESSAGES.COLLECTION_CREATED}: ${COLLECTION_NAME} with dimension ${QDRANT_CONFIG.vectorDimension}`
    );
  } catch (error) {
    console.error(MESSAGES.ERROR_INITIALIZING, error);
    throw error;
  }
}

export async function clearQdrant(): Promise<void> {
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some((col) => col.name === COLLECTION_NAME);

    if (exists) {
      await qdrantClient.deleteCollection(COLLECTION_NAME);
    }

    await qdrantClient.createCollection(COLLECTION_NAME, {
      vectors: {
        size: QDRANT_CONFIG.vectorDimension,
        distance: QDRANT_CONFIG.distanceMetric,
      },
    });

    console.log(MESSAGES.COLLECTION_CLEARED);
  } catch (error) {
    console.error(MESSAGES.ERROR_CLEARING, error);
    throw error;
  }
}
