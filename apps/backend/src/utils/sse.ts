import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Writes CORS and SSE headers directly to the raw Node.js response.
 *
 * Must be called before the first `reply.raw.write()` because
 * Fastify's `reply.header()` is bypassed when streaming via `reply.raw`.
 */
export function initSseResponse(request: FastifyRequest, reply: FastifyReply) {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': request.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Content-Disposition',
  });
}
