import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { unlink, writeFile, readFile, readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import { processDocument } from '../services/documentProcessor/index.js';
import { addDocumentToVectorStore, listDocuments, clearBM25Cache, deleteDocumentFromVectorStore } from '../services/rag/index.js';
import { clearQdrant } from '../repositories/qdrantRepository.js';
import { HTTP_STATUS } from '../shared/http.js';
import { MESSAGES } from '../shared/messages.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('DOCUMENT');

const DOCUMENTS_DIR = join('uploads', 'documents');

export async function uploadDocument(
  request: FastifyRequest,
  reply: FastifyReply
) {
  let storedPath: string | null = null;

  try {
    const data = await request.file();

    if (!data) {
      return reply.code(HTTP_STATUS.BAD_REQUEST).send({
        error: MESSAGES.NO_FILE,
      });
    }

    const file = data as MultipartFile;
    const buffer = await file.toBuffer();
    const filename = file.filename;

    // Ensure upload directory exists
    await mkdir(DOCUMENTS_DIR, { recursive: true });

    // 1. Write file to disk
    storedPath = join(DOCUMENTS_DIR, filename);
    await writeFile(storedPath, buffer);

    // 2. Process document
    const text = await processDocument(storedPath, filename);

    // 3. Index document in vector store
    const result = await addDocumentToVectorStore(
      text,
      filename,
      new Date().toISOString()
    );

    return {
      message: MESSAGES.DOCUMENT_SUCCESS,
      filename,
      chunksCount: result.chunksCount,
    };
  } catch (error: any) {
    // ROLLBACK: Delete file from disk if indexation failed
    if (storedPath) {
      try {
        await unlink(storedPath);
        logger.log(`Rollback: deleted ${storedPath}`);
      } catch (unlinkError) {
        logger.error('Failed to rollback file:', unlinkError);
      }
    }

    logger.error(MESSAGES.ERROR_PROCESSING_DOC, error);
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: error.message || 'Failed to upload document',
    });
  }
}

export async function getDocuments(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const documents = await listDocuments();
    return { documents };
  } catch (error: any) {
    logger.error(MESSAGES.ERROR_GETTING_DOCS, error);
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: error.message,
    });
  }
}

interface DownloadDocumentParams {
  filename: string;
}

export async function downloadDocument(
  request: FastifyRequest<{ Params: DownloadDocumentParams }>,
  reply: FastifyReply
) {
  try {
    const filename = request.params.filename;
    const filePath = join(DOCUMENTS_DIR, filename);

    const fileContent = await readFile(filePath);

    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(fileContent);
  } catch (error: any) {
    logger.error('Error downloading document:', error);
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: 'Document not found',
    });
  }
}

interface DeleteDocumentParams {
  filename: string;
}

export async function deleteDocument(
  request: FastifyRequest<{ Params: DeleteDocumentParams }>,
  reply: FastifyReply
) {
  try {
    const filename = decodeURIComponent(request.params.filename);

    // Delete from Qdrant first (source of truth)
    const result = await deleteDocumentFromVectorStore(filename);

    // Delete file from disk
    const filePath = join(DOCUMENTS_DIR, filename);
    try {
      await unlink(filePath);
    } catch (error: any) {
      // File might not exist on disk - just warn, don't fail
      logger.warn(`File not found on disk: ${filename}`);
    }

    return {
      message: MESSAGES.DOCUMENT_DELETED,
      filename,
      chunksDeleted: result.chunksDeleted,
    };
  } catch (error: any) {
    logger.error(MESSAGES.ERROR_DELETING_DOC, error);
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: error.message,
    });
  }
}

export async function clearDocuments(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await clearQdrant();
    await clearBM25Cache();

    const files = await readdir(DOCUMENTS_DIR);
    await Promise.all(files.map((file) => unlink(join(DOCUMENTS_DIR, file))));

    return { message: MESSAGES.DOCUMENTS_CLEARED };
  } catch (error: any) {
    logger.error(MESSAGES.ERROR_CLEARING_DOCS, error);
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: error.message,
    });
  }
}
