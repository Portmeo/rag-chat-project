import { Ollama } from '@langchain/community/llms/ollama';
import { queryRAG } from '../rag';
import type { EvaluationTestCase, EvaluationResult } from './types';

export class RAGASEvaluator {
  private llm: Ollama;

  constructor() {
    // Use same LLM for evaluation but with lower temperature for consistency
    this.llm = new Ollama({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.1:8b',
      temperature: 0.1, // Low temperature for consistent scoring
    });
  }

  async evaluateSingleCase(testCase: EvaluationTestCase): Promise<EvaluationResult> {
    const startTime = Date.now();

    try {
      // 1. Execute RAG pipeline
      console.log(`\n🧪 Evaluating: ${testCase.question}`);
      const ragResponse = await queryRAG(testCase.question);

      // Extract contexts and sources
      const contexts = ragResponse.sources.map(s => s.text || '');
      const sourceFilenames = ragResponse.sources.map(s => s.filename);

      // 2. Calculate RAGAS metrics
      const faithfulness = await this.calculateFaithfulness(ragResponse.answer, contexts);
      const answerRelevancy = await this.calculateAnswerRelevancy(testCase.question, ragResponse.answer);
      const contextPrecision = await this.calculateContextPrecision(testCase.question, contexts);
      const contextRecall = this.calculateContextRecall(sourceFilenames, testCase.expected_contexts);

      const latency = Date.now() - startTime;

      console.log(`✅ Metrics - F: ${faithfulness.toFixed(2)}, AR: ${answerRelevancy.toFixed(2)}, CP: ${contextPrecision.toFixed(2)}, CR: ${contextRecall.toFixed(2)}`);

      return {
        test_case_id: testCase.id,
        question: testCase.question,
        generated_answer: ragResponse.answer,
        retrieved_contexts: contexts,
        retrieved_sources: sourceFilenames,
        faithfulness_score: faithfulness,
        answer_relevancy_score: answerRelevancy,
        context_precision_score: contextPrecision,
        context_recall_score: contextRecall,
        latency_ms: latency,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ Error evaluating ${testCase.id}:`, error.message);

      return {
        test_case_id: testCase.id,
        question: testCase.question,
        generated_answer: '',
        retrieved_contexts: [],
        retrieved_sources: [],
        faithfulness_score: 0,
        answer_relevancy_score: 0,
        context_precision_score: 0,
        context_recall_score: 0,
        latency_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  private async calculateFaithfulness(answer: string, contexts: string[]): Promise<number> {
    if (contexts.length === 0 || !answer) return 0;

    const prompt = `Evalúa si la respuesta está completamente soportada por los contextos proporcionados.

Contextos:
${contexts.map((c, i) => `[${i + 1}] ${c.substring(0, 500)}...`).join('\n---\n')}

Respuesta:
${answer}

Criterios:
- 1.0 = Toda la información en la respuesta está soportada por los contextos
- 0.5 = Parte de la respuesta está soportada, pero hay información no verificable
- 0.0 = La respuesta contiene información no presente en los contextos (alucinación)

Responde SOLO con un número decimal entre 0.0 y 1.0 (ej: 0.85)`;

    try {
      const response = await this.llm.invoke(prompt);
      // Ollama returns string directly, not an object with .content
      const content = typeof response === 'string' ? response : response.toString();
      const score = this.extractScore(content.trim());
      return score;
    } catch (error) {
      console.error('Error calculating faithfulness:', error);
      return 0;
    }
  }

  private async calculateAnswerRelevancy(question: string, answer: string): Promise<number> {
    if (!answer || !question) return 0;

    const prompt = `Evalúa qué tan relevante es la respuesta para la pregunta.

Pregunta:
${question}

Respuesta:
${answer}

Criterios:
- 1.0 = La respuesta responde directamente y completamente la pregunta
- 0.5 = La respuesta es parcialmente relevante o incompleta
- 0.0 = La respuesta no responde la pregunta

Responde SOLO con un número decimal entre 0.0 y 1.0 (ej: 0.75)`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = typeof response === 'string' ? response : response.toString();
      const score = this.extractScore(content.trim());
      return score;
    } catch (error) {
      console.error('Error calculating answer relevancy:', error);
      return 0;
    }
  }

  private async calculateContextPrecision(question: string, contexts: string[]): Promise<number> {
    if (contexts.length === 0) return 0;

    const prompt = `Evalúa cuántos de los contextos proporcionados son relevantes para responder la pregunta.

Pregunta:
${question}

Contextos:
${contexts.map((c, i) => `[${i + 1}] ${c.substring(0, 300)}...`).join('\n---\n')}

Criterios:
- 1.0 = Todos los contextos son relevantes para la pregunta
- 0.5 = Aproximadamente la mitad de los contextos son relevantes
- 0.0 = Ninguno de los contextos es relevante

Responde SOLO con un número decimal entre 0.0 y 1.0 (ej: 0.60)`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = typeof response === 'string' ? response : response.toString();
      const score = this.extractScore(content.trim());
      return score;
    } catch (error) {
      console.error('Error calculating context precision:', error);
      return 0;
    }
  }

  private calculateContextRecall(retrievedSources: string[], expectedContexts: string[]): number {
    if (expectedContexts.length === 0) return 1;

    const retrieved = new Set(retrievedSources);
    const expected = new Set(expectedContexts);

    let matches = 0;
    for (const expectedFile of expected) {
      // Check if any retrieved file contains the expected filename
      for (const retrievedFile of retrieved) {
        if (retrievedFile.includes(expectedFile) || expectedFile.includes(retrievedFile)) {
          matches++;
          break;
        }
      }
    }

    return matches / expected.size;
  }

  private extractScore(content: string): number {
    // Extract decimal number from response
    const match = content.match(/\d+\.?\d*/);
    if (match) {
      const score = parseFloat(match[0]);
      // Ensure score is between 0 and 1
      return Math.max(0, Math.min(1, score));
    }
    return 0;
  }
}
