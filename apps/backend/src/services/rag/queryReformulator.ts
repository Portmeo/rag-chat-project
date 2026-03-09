import { llm } from './config';
import { extractLLMContent } from './helpers';
import { createLogger } from '../../lib/logger.js';
import type { ConversationMessage } from './types';

const logger = createLogger('REFORMULATOR');

const REFORMULATION_PROMPT = `Dada la siguiente conversación y una pregunta de seguimiento, reformula la pregunta para que sea independiente y autocontenida.

Reglas:
- Si la pregunta está relacionada con la conversación anterior, genera una pregunta corta e independiente que capture el contexto necesario.
- Si la pregunta NO está relacionada con la conversación anterior, devuélvela tal cual.
- Responde SOLO con la pregunta reformulada, sin explicaciones ni prefijos.
- Todo en español.

Historial:
{history}

Pregunta de seguimiento: {question}

Pregunta independiente:`;

export interface ReformulationResult {
  originalQuestion: string;
  standaloneQuestion: string;
  wasReformulated: boolean;
}

export async function reformulateQuery(
  question: string,
  history: ConversationMessage[]
): Promise<ReformulationResult> {
  if (history.length === 0) {
    return {
      originalQuestion: question,
      standaloneQuestion: question,
      wasReformulated: false,
    };
  }

  try {
    const historyText = history
      .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
      .join('\n');

    const prompt = REFORMULATION_PROMPT
      .replace('{history}', historyText)
      .replace('{question}', question);

    const response = await llm.invoke(prompt);
    const standalone = extractLLMContent(response);
    const wasReformulated = standalone.toLowerCase() !== question.toLowerCase();

    logger.log(`Original: "${question}"`);
    logger.log(`Standalone: "${standalone}" (reformulated: ${wasReformulated})`);

    return {
      originalQuestion: question,
      standaloneQuestion: standalone,
      wasReformulated,
    };
  } catch (error: any) {
    logger.warn(`Reformulation failed, using original: ${error.message}`);
    return {
      originalQuestion: question,
      standaloneQuestion: question,
      wasReformulated: false,
    };
  }
}
