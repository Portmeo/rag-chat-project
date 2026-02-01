import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { initQdrant, qdrantClient, COLLECTION_NAME } from './repositories/qdrantRepository';
import { uploadDocument, getDocuments, clearDocuments, downloadDocument, deleteDocument } from './controllers/documentController';
import { queryChat, queryChatStream } from './controllers/chatController';
import { runEvaluation } from './controllers/evaluationController';
import { STATUS, MESSAGES } from './shared/messages';

const app = new Elysia()
  .use(cors())
  .get('/health', () => ({
    status: STATUS.OK,
    message: MESSAGES.HEALTH_OK,
  }))
  .get('/api/debug/qdrant', async () => {
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
      return {
        error: error.message,
      };
    }
  })
  .get('/api/documents', getDocuments)
  .get('/api/documents/:filename', downloadDocument)
  .post('/api/documents/upload', uploadDocument, {
    body: t.Object({
      file: t.File(),
    }),
  })
  .delete('/api/documents/:filename', deleteDocument)
  .delete('/api/documents', clearDocuments)
  .post('/api/chat/query', queryChat, {
    body: t.Object({
      question: t.String(),
      history: t.Optional(t.Array(t.Object({
        role: t.Union([t.Literal('user'), t.Literal('assistant')]),
        content: t.String(),
      }))),
    }),
  })
  .post('/api/chat/query-stream', queryChatStream, {
    body: t.Object({
      question: t.String(),
      history: t.Optional(t.Array(t.Object({
        role: t.Union([t.Literal('user'), t.Literal('assistant')]),
        content: t.String(),
      }))),
    }),
  })
  .post('/api/evaluation/ragas', runEvaluation, {
    body: t.Optional(t.Object({
      datasetPath: t.Optional(t.String()),
      saveResults: t.Optional(t.Boolean()),
    })),
  });

async function startServer() {
  await initQdrant();

  const PORT = process.env.PORT || 3001;

  app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
