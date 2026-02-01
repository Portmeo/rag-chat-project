import type { FastifyRequest, FastifyReply } from 'fastify';
import { queryRAG, queryRAGStream } from '../services/rag/index.js';
import { HTTP_STATUS } from '../shared/http.js';
import { MESSAGES } from '../shared/messages.js';
import { initSseResponse } from '../utils/sse.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatQueryBody {
  question: string;
  history?: ChatMessage[];
}

export async function queryChat(
  request: FastifyRequest<{ Body: ChatQueryBody }>,
  reply: FastifyReply
) {
  try {
    const { question, history = [] } = request.body;

    if (!question) {
      return reply.code(HTTP_STATUS.BAD_REQUEST).send({
        error: MESSAGES.QUESTION_REQUIRED,
      });
    }

    const result = await queryRAG(question, { history });
    return result;
  } catch (error: any) {
    console.error('Error querying RAG:', error);
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: error.message,
    });
  }
}

export async function queryChatStream(
  request: FastifyRequest<{ Body: ChatQueryBody }>,
  reply: FastifyReply
) {
  try {
    const { question, history = [] } = request.body;

    if (!question) {
      return reply.code(HTTP_STATUS.BAD_REQUEST).send({
        error: MESSAGES.QUESTION_REQUIRED,
      });
    }

    initSseResponse(request, reply);

    try {
      for await (const event of queryRAGStream(question, history)) {
        const message = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
        reply.raw.write(message);
      }
    } catch (error: any) {
      const errorEvent = `event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`;
      reply.raw.write(errorEvent);
    } finally {
      reply.raw.end();
    }
  } catch (error: any) {
    console.error('Error in chat stream:', error);
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: error.message,
    });
  }
}
