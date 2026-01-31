import { queryRAG } from '../services/rag';
import { HTTP_STATUS } from '../shared/http';
import { MESSAGES } from '../shared/messages';

export async function queryChat({ body, set }: any) {
  try {
    const { question } = body;

    if (!question) {
      set.status = HTTP_STATUS.BAD_REQUEST;
      return { error: MESSAGES.QUESTION_REQUIRED };
    }

    const result = await queryRAG(question);
    return result;
  } catch (error: any) {
    console.error('Error querying RAG:', error);
    set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return { error: error.message };
  }
}
