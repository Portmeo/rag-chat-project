import { llm } from './config';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('INTENT');

const CLASSIFICATION_PROMPT = `Clasifica la siguiente entrada del usuario en una de estas categorías:
- "casual" si es un saludo, despedida, agradecimiento, charla informal o pregunta no relacionada con documentación técnica (ej: "hola buenas tardes", "muchas gracias por la ayuda", "qué tal estás", "bueno pues nada adiós", "ok perfecto gracias", "cómo estás")
- "query" si es una pregunta o solicitud que requiere buscar información en documentos (ej: "routing", "guards", "cómo funciona el login", "interceptors http", "qué es un observable")

Responde SOLO con la palabra "casual" o "query", sin explicación.

Entrada: {input}`;

const CASUAL_RESPONSES: Record<string, string> = {
  greeting: '¡Hola! Soy tu asistente de documentación. ¿En qué puedo ayudarte?',
  thanks: '¡De nada! Si tienes más preguntas, aquí estoy.',
  farewell: '¡Hasta luego! No dudes en volver si necesitas algo.',
  default: '¡Hola! Puedo ayudarte a buscar información en la documentación. ¿Qué necesitas saber?',
};

// Patterns match anywhere in the input (not anchored to start)
const GREETING_WORDS = /\b(hola|hey|buenas|buenos días|buenas tardes|buenas noches|saludos|qué tal|hi|hello)\b/i;
const THANKS_WORDS = /\b(gracias|thank|genial|perfecto)\b/i;
const FAREWELL_WORDS = /\b(adiós|adios|hasta luego|chao|bye|nos vemos)\b/i;

export type IntentMode = 'regex' | 'hybrid' | 'llm';

export interface IntentResult {
  isCasual: boolean;
  response?: string;
}

/**
 * Attempts regex-based classification for obvious casual patterns.
 * Returns null if no pattern matched (ambiguous).
 */
function classifyByRegex(input: string): IntentResult | null {
  const hasGreeting = GREETING_WORDS.test(input);
  const hasThanks = THANKS_WORDS.test(input);
  const hasFarewell = FAREWELL_WORDS.test(input);

  if (hasThanks) {
    logger.log(`Detected thanks (regex): "${input}"`);
    return { isCasual: true, response: CASUAL_RESPONSES.thanks };
  }

  if (hasFarewell) {
    logger.log(`Detected farewell (regex): "${input}"`);
    return { isCasual: true, response: CASUAL_RESPONSES.farewell };
  }

  if (hasGreeting) {
    logger.log(`Detected greeting (regex): "${input}"`);
    return { isCasual: true, response: CASUAL_RESPONSES.greeting };
  }

  return null; // Ambiguous — no pattern matched
}

/**
 * Uses LLM to classify the input as casual or query.
 */
async function classifyByLLM(input: string): Promise<IntentResult> {
  try {
    const prompt = CLASSIFICATION_PROMPT.replace('{input}', input);
    const response = await llm.invoke(prompt);

    let content: string;
    if (typeof response === 'string') {
      content = response;
    } else if (response && typeof response === 'object' && 'content' in response) {
      const responseContent = (response as any).content;
      content = typeof responseContent === 'string' ? responseContent : String(responseContent);
    } else {
      content = String(response);
    }

    const classification = content.trim().toLowerCase();
    const isCasual = classification.includes('casual');

    logger.log(`LLM classification for "${input}": ${classification} → ${isCasual ? 'casual' : 'query'}`);

    return isCasual
      ? { isCasual: true, response: CASUAL_RESPONSES.default }
      : { isCasual: false };
  } catch (error: any) {
    logger.warn(`LLM classification failed, treating as query: ${error.message}`);
    return { isCasual: false };
  }
}

/**
 * Classifies user input intent before entering the RAG pipeline.
 *
 * Modes:
 * - "regex"  → Only regex patterns. Fast, no LLM cost, but misses ambiguous inputs.
 * - "hybrid" → Regex first, LLM fallback for unmatched inputs. Good balance.
 * - "llm"    → Everything goes through LLM. Most robust, +0.5s latency per query.
 */
export async function classifyIntent(input: string, mode: IntentMode = 'hybrid'): Promise<IntentResult> {
  const trimmed = input.trim();

  if (mode === 'llm') {
    return classifyByLLM(trimmed);
  }

  // regex and hybrid both start with regex
  const regexResult = classifyByRegex(trimmed);

  if (regexResult) {
    return regexResult;
  }

  // regex mode: no match → treat as query
  if (mode === 'regex') {
    logger.log(`No regex match, treating as query: "${trimmed}"`);
    return { isCasual: false };
  }

  // hybrid mode: no regex match → LLM fallback
  logger.log(`No regex match, falling back to LLM: "${trimmed}"`);
  return classifyByLLM(trimmed);
}
