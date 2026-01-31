import { RecursiveCharacterTextSplitter, MarkdownTextSplitter } from 'langchain/text_splitter';
import { qdrantClient, COLLECTION_NAME } from '../../repositories/qdrantRepository';
import { getFileExtension, isMarkdownFile, isHtmlFile } from '../documentProcessor/helpers';
import { CHUNK_CONFIG, TEXT_SEPARATORS, PROMPT_TEMPLATE, llm } from './config';

export function createTextSplitter(extension: string) {
  const baseConfig = {
    chunkSize: CHUNK_CONFIG.SIZE,
    chunkOverlap: CHUNK_CONFIG.OVERLAP,
  };

  if (isMarkdownFile(extension)) {
    return MarkdownTextSplitter.fromLanguage('markdown', baseConfig);
  }

  if (isHtmlFile(extension)) {
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

export function buildPrompt(context: string, question: string): string {
  return `${PROMPT_TEMPLATE.SYSTEM}
${context}${PROMPT_TEMPLATE.QUESTION_PREFIX} ${question}${PROMPT_TEMPLATE.RESPONSE_PREFIX}`;
}

export async function checkCollectionExists(): Promise<boolean> {
  const collections = await qdrantClient.getCollections();
  return collections.collections.some((col) => col.name === COLLECTION_NAME);
}

export async function generateMultipleQueries(question: string): Promise<string[]> {
  try {
    const prompt = PROMPT_TEMPLATE.MULTI_QUERY_PROMPT.replace('{question}', question);
    const response = await llm.invoke(prompt);

    const queries = response
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.match(/^\d+[\.)]/));

    return [question, ...queries];
  } catch (error) {
    console.error('Error generating multiple queries:', error);
    return [question];
  }
}

export async function getAllDocumentsFromQdrant() {
  const allDocs: any[] = [];
  let offset: string | null = null;

  while (true) {
    const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
      limit: 100,
      with_payload: true,
      with_vector: false,
      offset: offset || undefined,
    });

    for (const point of scrollResult.points) {
      const payload = point.payload as any;

      // DEBUG: Log first payload to see structure
      if (allDocs.length === 0) {
        console.log('🔍 First payload structure:', JSON.stringify(payload, null, 2));
      }

      // LangChain stores content in 'text' field, not 'content'
      const pageContent = payload.text || payload.content || payload.pageContent || '';

      allDocs.push({
        pageContent,
        metadata: payload.metadata || {},
      });
    }

    if (!scrollResult.next_page_offset) {
      break;
    }
    offset = scrollResult.next_page_offset as string;
  }

  return allDocs;
}

export { getFileExtension };
