import { RecursiveCharacterTextSplitter, MarkdownTextSplitter } from 'langchain/text_splitter';
import type { Document } from 'langchain/document';
import { PARENT_RETRIEVER_CONFIG, TEXT_SEPARATORS } from './config';
import type { TechnicalMetadata, ParentChildMetadata } from '../documentProcessor/templates/types';
import { extractTechnicalMetadata } from '../documentProcessor/templates';

interface ParentChildChunks {
  children: Document[];  // Children con vector embedding
  parents: Document[];   // Parents SIN vector (solo storage)
}

export async function createParentChildChunks(
  text: string,
  filename: string,
  uploadDate: string,
  extension: string
): Promise<ParentChildChunks> {

  // 1. Crear splitter para PARENT chunks (1000 chars)
  const parentSplitter = createSplitterForSize(
    extension,
    PARENT_RETRIEVER_CONFIG.parentChunkSize,
    PARENT_RETRIEVER_CONFIG.parentChunkOverlap
  );

  // 2. Generar parent chunks
  const parentTexts = await parentSplitter.splitText(text);

  // 3. Para cada parent, generar children Y crear parent documents
  const children: Document[] = [];
  const parents: Document[] = [];

  for (let parentIdx = 0; parentIdx < parentTexts.length; parentIdx++) {
    const parentText = parentTexts[parentIdx];
    const parentDocId = `${filename}_parent_${parentIdx}`;

    // Crear parent document (se indexará SIN vector)
    const parentBaseMeta = extractTechnicalMetadata(
      parentText,
      filename,
      uploadDate,
      parentIdx
    );

    const parentMetadata: TechnicalMetadata = {
      ...parentBaseMeta,
      total_chunks: parentTexts.length,
      parent_child: {
        parent_doc_id: parentDocId,
        is_parent: true,
        child_chunk_size: PARENT_RETRIEVER_CONFIG.childChunkSize,
        parent_chunk_size: PARENT_RETRIEVER_CONFIG.parentChunkSize,
      }
    };

    parents.push({
      pageContent: parentText,
      metadata: parentMetadata,
    });

    // Crear child splitter (200 chars)
    const childSplitter = createSplitterForSize(
      extension,
      PARENT_RETRIEVER_CONFIG.childChunkSize,
      PARENT_RETRIEVER_CONFIG.childChunkOverlap
    );

    // Dividir parent en children
    const childTexts = await childSplitter.splitText(parentText);

    // Crear documentos child con metadata
    for (let childIdx = 0; childIdx < childTexts.length; childIdx++) {
      const childText = childTexts[childIdx];

      // Extraer metadata técnica
      const baseMeta = extractTechnicalMetadata(
        childText,
        filename,
        uploadDate,
        parentIdx * 10 + childIdx // Índice único global
      );

      // Agregar parent-child metadata (solo referencia, NO contenido completo)
      const metadata: TechnicalMetadata = {
        ...baseMeta,
        total_chunks: parentTexts.length * 10, // Estimación
        parent_child: {
          parent_doc_id: parentDocId,
          is_parent: false,
          child_index: childIdx,
          child_chunk_size: PARENT_RETRIEVER_CONFIG.childChunkSize,
          parent_chunk_size: PARENT_RETRIEVER_CONFIG.parentChunkSize,
        }
      };

      children.push({
        pageContent: childText,
        metadata,
      });
    }
  }

  return { children, parents };
}

function createSplitterForSize(
  extension: string,
  chunkSize: number,
  chunkOverlap: number
) {
  const baseConfig = { chunkSize, chunkOverlap };

  if (extension === '.md') {
    return MarkdownTextSplitter.fromLanguage('markdown', baseConfig);
  }

  if (extension === '.html') {
    return RecursiveCharacterTextSplitter.fromLanguage('html', baseConfig);
  }

  return new RecursiveCharacterTextSplitter({
    ...baseConfig,
    separators: [
      TEXT_SEPARATORS.SECTION,
      TEXT_SEPARATORS.PARAGRAPH,
      TEXT_SEPARATORS.LINE,
      TEXT_SEPARATORS.SENTENCE,
      TEXT_SEPARATORS.WORD,
      TEXT_SEPARATORS.CHAR,
    ],
  });
}
