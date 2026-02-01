import { unlink, writeFile, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { processDocument } from '../services/documentProcessor';
import { addDocumentToVectorStore, listDocuments, clearBM25Cache, deleteDocumentFromVectorStore } from '../services/rag';
import { clearQdrant } from '../repositories/qdrantRepository';
import { HTTP_STATUS } from '../shared/http';
import { MESSAGES } from '../shared/messages';

const DOCUMENTS_DIR = join('uploads', 'documents');

export async function uploadDocument({ body, set }: any) {
  try {
    const file = body.file;

    if (!file) {
      set.status = HTTP_STATUS.BAD_REQUEST;
      return { error: MESSAGES.NO_FILE };
    }

    const storedPath = join(DOCUMENTS_DIR, file.name);
    const buffer = await file.arrayBuffer();
    await writeFile(storedPath, Buffer.from(buffer));

    const text = await processDocument(storedPath, file.name);

    const result = await addDocumentToVectorStore(
      text,
      file.name,
      new Date().toISOString()
    );

    return {
      message: MESSAGES.DOCUMENT_SUCCESS,
      filename: file.name,
      chunksCount: result.chunksCount,
    };
  } catch (error: any) {
    console.error(MESSAGES.ERROR_PROCESSING_DOC, error);
    set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return { error: error.message };
  }
}

export async function getDocuments({ set }: any) {
  try {
    const documents = await listDocuments();
    return { documents };
  } catch (error: any) {
    console.error(MESSAGES.ERROR_GETTING_DOCS, error);
    set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return { error: error.message };
  }
}

export async function downloadDocument({ params, set }: any) {
  try {
    const filename = params.filename;
    const filePath = join(DOCUMENTS_DIR, filename);

    const fileContent = await readFile(filePath);

    set.headers['Content-Type'] = 'application/octet-stream';
    set.headers['Content-Disposition'] = `attachment; filename="${filename}"`;

    return fileContent;
  } catch (error: any) {
    console.error('Error downloading document:', error);
    set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return { error: 'Document not found' };
  }
}

export async function deleteDocument({ params, set }: any) {
  try {
    const filename = decodeURIComponent(params.filename);

    // Delete from Qdrant first (source of truth)
    const result = await deleteDocumentFromVectorStore(filename);

    // Delete file from disk
    const filePath = join(DOCUMENTS_DIR, filename);
    try {
      await unlink(filePath);
    } catch (error: any) {
      // File might not exist on disk - just warn, don't fail
      console.warn(`File not found on disk: ${filename}`);
    }

    return {
      message: MESSAGES.DOCUMENT_DELETED,
      filename,
      chunksDeleted: result.chunksDeleted,
    };
  } catch (error: any) {
    console.error(MESSAGES.ERROR_DELETING_DOC, error);
    set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return { error: error.message };
  }
}

export async function clearDocuments({ set }: any) {
  try {
    await clearQdrant();
    await clearBM25Cache();

    const files = await readdir(DOCUMENTS_DIR);
    await Promise.all(files.map((file) => unlink(join(DOCUMENTS_DIR, file))));

    return { message: MESSAGES.DOCUMENTS_CLEARED };
  } catch (error: any) {
    console.error(MESSAGES.ERROR_CLEARING_DOCS, error);
    set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return { error: error.message };
  }
}
