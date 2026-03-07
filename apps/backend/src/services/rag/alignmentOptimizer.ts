import { Document } from 'langchain/document';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('ALIGN');

const QUESTION_PROMPT = (text: string, n: number) =>
  `Genera exactamente ${n} preguntas breves que este fragmento de documentación respondería directamente.
Solo devuelve las preguntas, una por línea, sin numeración ni prefijos.

FRAGMENTO:
${text.substring(0, 600)}`;

/**
 * Genera preguntas hipotéticas para un parent chunk y las devuelve como
 * Documents adicionales apuntando al mismo parent_doc_id.
 * Se indexan como children más para que el retrieval los encuentre cuando
 * la query del usuario coincide semánticamente con una de esas preguntas.
 */
export async function generateAlignmentQuestions(
  parentDoc: Document,
  llm: { invoke: (prompt: string) => Promise<any> },
  questionsPerChunk: number = 3
): Promise<Document[]> {
  const text = parentDoc.pageContent.trim();
  if (text.length < 50) return [];

  try {
    const response = await llm.invoke(QUESTION_PROMPT(text, questionsPerChunk));

    // Handle both ChatModel (Claude/AIMessage) and LLM (Ollama/string)
    let raw: string;
    if (typeof response === 'string') {
      raw = response;
    } else if (response && typeof response === 'object' && 'content' in response) {
      raw = typeof response.content === 'string' ? response.content : String(response.content);
    } else {
      raw = String(response);
    }

    const questions = raw
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 10 && l.endsWith('?'));

    if (questions.length === 0) return [];

    logger.log(`Generated ${questions.length} alignment questions for chunk from ${(parentDoc.metadata as any).filename}`);

    return questions.map((question: string) => new Document({
      pageContent: question,
      metadata: {
        ...parentDoc.metadata,
        parent_child: {
          ...(parentDoc.metadata as any).parent_child,
          is_parent: false,       // indexable como child
          is_alignment_question: true,
        },
      },
    }));

  } catch (error: any) {
    logger.warn(`Failed to generate alignment questions: ${error.message}`);
    return [];
  }
}
