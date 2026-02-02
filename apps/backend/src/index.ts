import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { initQdrant, qdrantClient, COLLECTION_NAME } from './repositories/qdrantRepository.js';
import {
  uploadDocument,
  getDocuments,
  clearDocuments,
  downloadDocument,
  deleteDocument
} from './controllers/documentController.js';
import { queryChat, queryChatStream } from './controllers/chatController.js';

import { STATUS, MESSAGES } from './shared/messages.js';

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

// Register plugins
await fastify.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
});
await fastify.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Rate limiting to prevent abuse
await fastify.register(rateLimit, {
  max: 10, // 10 requests
  timeWindow: '1 minute', // per minute
  cache: 10000, // cache for 10000 IPs
  allowList: ['127.0.0.1'], // localhost without limits
});

// Health check
fastify.get('/health', async (request, reply) => {
  return {
    status: STATUS.OK,
    message: MESSAGES.HEALTH_OK,
  };
});

// Debug endpoint
fastify.get('/api/debug/qdrant', async (request, reply) => {
  try {
    const result = await qdrantClient.scroll(COLLECTION_NAME, {
      limit: 5,
      with_payload: true,
      with_vector: false,
    });

    return {
      total_points: result.points.length,
      sample_payloads: result.points.map((point) => ({
        id: point.id,
        payload_keys: Object.keys(point.payload || {}),
        payload: point.payload,
      })),
    };
  } catch (error: any) {
    return reply.code(500).send({
      error: error.message,
    });
  }
});

// Document routes
fastify.get('/api/documents', getDocuments);
fastify.get('/api/documents/:filename', downloadDocument);
fastify.post('/api/documents/upload', uploadDocument);
fastify.delete('/api/documents/:filename', deleteDocument);
fastify.delete('/api/documents', clearDocuments);

// Chat routes
fastify.post('/api/chat/query', queryChat);

fastify.post('/api/chat/query-stream', queryChatStream);

// Start server
async function startServer() {
  await initQdrant();

  const PORT = process.env.PORT || 3001;

  try {
    await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

startServer().catch(console.error);
