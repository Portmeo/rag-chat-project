import { queryRAG, queryRAGStream } from '../services/rag';
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

export async function queryChatStream({ body }: any) {
  const { question } = body;

  if (!question) {
    return new Response(
      JSON.stringify({ error: MESSAGES.QUESTION_REQUIRED }),
      { status: HTTP_STATUS.BAD_REQUEST, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of queryRAGStream(question)) {
          const message = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(message));
        }
      } catch (error: any) {
        const errorEvent = `event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`;
        controller.enqueue(new TextEncoder().encode(errorEvent));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
