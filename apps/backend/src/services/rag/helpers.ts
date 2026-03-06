import { RecursiveCharacterTextSplitter, MarkdownTextSplitter } from 'langchain/text_splitter';
import { qdrantClient, COLLECTION_NAME } from '../../repositories/qdrantRepository';
import { getFileExtension, isMarkdownFile, isHtmlFile } from '../documentProcessor/helpers';
import { CHUNK_CONFIG, TEXT_SEPARATORS, PROMPT_TEMPLATE, CONVERSATIONAL_HISTORY_CONFIG, llm } from './config';
import type { ConversationMessage } from './types';

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

export function buildPrompt(
  context: string,
  question: string,
  history: ConversationMessage[] = []
): string {
  let prompt = PROMPT_TEMPLATE.SYSTEM;

  // Agregar historial si está habilitado y hay mensajes
  if (CONVERSATIONAL_HISTORY_CONFIG.enabled && history.length > 0) {
    const historyText = history
      .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
      .join('\n\n');

    prompt += `${PROMPT_TEMPLATE.HISTORY_PREFIX}${historyText}`;
  }

  // Agregar contexto de documentos
  prompt += `${PROMPT_TEMPLATE.CONTEXT_PREFIX}${context}`;

  // Agregar pregunta actual
  prompt += `${PROMPT_TEMPLATE.QUESTION_PREFIX} ${question}`;

  // Agregar prefijo de respuesta
  prompt += PROMPT_TEMPLATE.RESPONSE_PREFIX;

  return prompt;
}

export function limitHistory(
  history: ConversationMessage[],
  maxMessages: number = CONVERSATIONAL_HISTORY_CONFIG.maxMessages
): ConversationMessage[] {
  if (!CONVERSATIONAL_HISTORY_CONFIG.enabled || history.length === 0) {
    return [];
  }

  // Tomar solo los últimos N mensajes (ventana deslizante)
  return history.slice(-maxMessages);
}

export async function checkCollectionExists(): Promise<boolean> {
  const collections = await qdrantClient.getCollections();
  return collections.collections.some((col) => col.name === COLLECTION_NAME);
}

export async function generateMultipleQueries(question: string): Promise<string[]> {
  try {
    const prompt = PROMPT_TEMPLATE.MULTI_QUERY_PROMPT.replace('{question}', question);
    const response = await llm.invoke(prompt);

    // Handle both ChatModel (Claude) and LLM (Ollama) responses
    let content: string;
    if (typeof response === 'string') {
      content = response;
    } else if (response && typeof response === 'object' && 'content' in response) {
      const responseContent = (response as any).content;
      content = typeof responseContent === 'string' ? responseContent : String(responseContent);
    } else {
      content = String(response);
    }

    const queries = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.match(/^\d+[\.)]/));

    return [question, ...queries];
  } catch (error) {
    console.error('Error generating multiple queries:', error);
    return [question];
  }
}

export async function getAllDocumentsFromQdrant() {
  const allDocs: any[] = [];
  let offset: string | null = null;
  let iterationCount = 0;
  const MAX_ITERATIONS = 1000; // Safety limit

  while (true) {
    iterationCount++;

    // Safety check to prevent infinite loops
    if (iterationCount > MAX_ITERATIONS) {
      console.error(`[Qdrant] Pagination exceeded ${MAX_ITERATIONS} iterations. Possible infinite loop detected.`);
      throw new Error(`Pagination safety limit exceeded (${MAX_ITERATIONS} iterations)`);
    }

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
      console.log(`[Qdrant] Loaded ${allDocs.length} documents in ${iterationCount} iterations`);
      break;
    }
    offset = scrollResult.next_page_offset as string;
  }

  return allDocs;
}

export { getFileExtension };
