import type { FastifyRequest, FastifyReply } from 'fastify';
import { queryRAG, queryRAGStream } from '../services/rag/index.js';
import { HTTP_STATUS } from '../shared/http.js';
import { MESSAGES } from '../shared/messages.js';
import { initSseResponse } from '../utils/sse.js';
import { createLogger } from '../lib/logger.js';
import { categoryStorage, onboardingStorage } from '../repositories/index.js';
import type { OnboardingQuestion } from '../repositories/index.js';

const logger = createLogger('CHAT');

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatQueryBody {
  question: string;
  history?: ChatMessage[];
  filenameFilter?: string[];
}

export async function queryChat(
  request: FastifyRequest<{ Body: ChatQueryBody }>,
  reply: FastifyReply
) {
  try {
    const { question, history = [], filenameFilter } = request.body;

    if (!question) {
      return reply.code(HTTP_STATUS.BAD_REQUEST).send({
        error: MESSAGES.QUESTION_REQUIRED,
      });
    }

    const result = await queryRAG(question, { history, filenameFilter });
    return result;
  } catch (error: any) {
    logger.error('Error querying RAG:', error);
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
    const { question, history = [], filenameFilter } = request.body;

    if (!question) {
      return reply.code(HTTP_STATUS.BAD_REQUEST).send({
        error: MESSAGES.QUESTION_REQUIRED,
      });
    }

    initSseResponse(request, reply);

    try {
      for await (const event of queryRAGStream(question, history, filenameFilter)) {
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
    logger.error('Error in chat stream:', error);
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: error.message,
    });
  }
}

export async function getCategories(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const categories = await categoryStorage.getAll();
    return categories;
  } catch (error: any) {
    logger.error('Error fetching categories:', error);
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: error.message,
    });
  }
}

export async function getOnboardingQuestions(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const questions = await onboardingStorage.getAll();
    return questions;
  } catch (error: any) {
    logger.error('Error fetching onboarding questions:', error);
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: error.message,
    });
  }
}

export async function upsertOnboardingQuestion(
  request: FastifyRequest<{ Body: Omit<OnboardingQuestion, 'id'> & { id?: number } }>,
  reply: FastifyReply
) {
  try {
    const { text, icon = 'MessageSquare', filename = null, sort_order = 0, id } = request.body;
    if (!text) {
      return reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: 'Text is required' });
    }
    await onboardingStorage.upsert({ text, icon, filename, sort_order, ...(id ? { id } : {}) });
    return { message: 'Question saved' };
  } catch (error: any) {
    logger.error('Error saving onboarding question:', error);
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: error.message });
  }
}

export async function deleteOnboardingQuestion(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    await onboardingStorage.delete(Number(request.params.id));
    return { message: 'Question deleted' };
  } catch (error: any) {
    logger.error('Error deleting onboarding question:', error);
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: error.message });
  }
}
