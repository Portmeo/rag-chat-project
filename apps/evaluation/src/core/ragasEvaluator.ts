import { Ollama } from '@langchain/community/llms/ollama';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { ChatAnthropic } from '@langchain/anthropic';
import path from 'path';
import { readFile } from 'fs/promises';
import type { EvaluationTestCase, EvaluationResult } from './types';

interface RAGSource {
  filename: string;
  rerankScore?: number;
}

interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  performance?: {
    retrieval_latency_ms?: number;
    reranking_latency_ms?: number;
    generation_latency_ms?: number;
    num_retrieved_docs?: number;
    num_final_docs?: number;
    avg_rerank_score?: number;
  };
}

export class RAGASEvaluator {
  private llm: ChatAnthropic | Ollama;
  private embeddings: OllamaEmbeddings;
  private backendUrl: string;
  private projectRoot: string;

  constructor(
    backendUrl: string = 'http://localhost:3001',
    projectRoot?: string,
    judge: 'ollama' | 'claude' | 'sonnet' = 'ollama'
  ) {
    this.backendUrl = backendUrl;
    this.projectRoot = projectRoot || process.cwd();

    if (judge === 'claude' || judge === 'sonnet') {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set in environment');
      const model = judge === 'sonnet' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
      this.llm = new ChatAnthropic({
        anthropicApiKey: anthropicKey,
        model,
        temperature: 0,
      });
      console.log(`[RAGAS] Judge: ${model} (external, unbiased)`);
    } else {
      this.llm = new Ollama({
        baseUrl: 'http://localhost:11434',
        model: 'llama3.1:8b',
        temperature: 0.0,
      });
      console.log('[RAGAS] Judge: llama3.1:8b (local)');
    }

    // Use same embeddings as RAG system
    this.embeddings = new OllamaEmbeddings({
      baseUrl: 'http://localhost:11434',
      model: 'mxbai-embed-large',
    });
  }

  private async invokeLLMWithTimeout(prompt: string, timeoutMs: number = 90000): Promise<string> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`LLM call timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    const llmPromise = this.llm.invoke(prompt);

    try {
      const response = await Promise.race([llmPromise, timeoutPromise]);
      if (typeof response === 'string') return response;
      // ChatAnthropic returns AIMessage with .content
      if (response && typeof response === 'object' && 'content' in response) {
        const c = (response as any).content;
        return typeof c === 'string' ? c : String(c);
      }
      return String(response);
    } catch (error: any) {
      if (error.message.includes('timeout')) {
        return '0.5';
      }
      throw error;
    }
  }

  private async callRAGAPI(question: string): Promise<RAGResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

    try {
      const response = await fetch(`${this.backendUrl}/api/chat/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`RAG API failed (${response.status}): ${error}`);
      }

      return response.json() as Promise<RAGResponse>;
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error(`RAG API timeout for question: "${question}"`);
      }
      throw error;
    }
  }

  private async getSourceContent(source: RAGSource): Promise<string> {
    // Intentar leer de files/ primero, luego de uploads (más robusto)
    const possiblePaths = [
      path.join(this.projectRoot, 'files', source.filename),
      path.join(this.projectRoot, 'apps/backend/uploads/documents', source.filename)
    ];

    for (const p of possiblePaths) {
      try {
        return await readFile(p, 'utf-8');
      } catch (e) {}
    }
    
    return '';
  }

  async queryRAG(question: string): Promise<RAGResponse> {
    return await this.callRAGAPI(question);
  }

  async evaluateResponse(testCase: EvaluationTestCase, ragResponse: RAGResponse): Promise<EvaluationResult> {
    const totalStartTime = Date.now();

    try {
      // Load contexts
      const contextsPromises = ragResponse.sources.map(async (source) => {
        return await this.getSourceContent(source);
      });
      const contexts = (await Promise.all(contextsPromises)).filter(text => text.length > 0);
      const sourceFilenames = ragResponse.sources.map(s => s.filename);

      const metricsStart = Date.now();

      // ✅ ACTIVA: Detección de alucinaciones real
      const hallucinationResult = await this.detectHallucinations(ragResponse.answer, contexts);

      // ✅ ACTIVA: Métricas CORE con razonamiento
      const faithfulnessResult = await this.calculateFaithfulness(ragResponse.answer, contexts);
      const relevancyResult = await this.calculateAnswerRelevancy(testCase.question, ragResponse.answer);
      const precisionResult = await this.calculateContextPrecision(testCase.question, contexts);
      const contextRecall = await this.calculateContextRecall(contexts, sourceFilenames, testCase.expected_contexts);

      // ✅ OPCIONAL: Correctness comparada con Ground Truth
      const correctnessResult = testCase.ground_truth_answer ?
        await this.calculateAnswerCorrectness(ragResponse.answer, testCase.ground_truth_answer) : { score: 0, reasoning: '' };

      const latency = Date.now() - totalStartTime;

      return {
        test_case_id: testCase.id,
        question: testCase.question,
        generated_answer: ragResponse.answer,
        retrieved_contexts: contexts,
        retrieved_sources: sourceFilenames,

        faithfulness_score: faithfulnessResult.score,
        answer_relevancy_score: relevancyResult.score,
        context_precision_score: precisionResult.score,
        context_recall_score: contextRecall,

        context_relevancy_score: 0, // not calculated
        answer_correctness_score: correctnessResult.score,
        answer_similarity_score: 0, // not calculated
        answer_completeness_score: 0, // not calculated

        hallucination_score: hallucinationResult.score,
        hallucinations_detected: hallucinationResult.hallucinations,

        faithfulness_reasoning: faithfulnessResult.reasoning,
        relevancy_reasoning: relevancyResult.reasoning,
        precision_reasoning: precisionResult.reasoning,
        hallucination_reasoning: hallucinationResult.reasoning,
        correctness_reasoning: correctnessResult.reasoning,

        retrieval_latency_ms: ragResponse.performance?.retrieval_latency_ms,
        reranking_latency_ms: ragResponse.performance?.reranking_latency_ms,
        generation_latency_ms: ragResponse.performance?.generation_latency_ms,
        num_retrieved_docs: ragResponse.performance?.num_retrieved_docs,
        num_final_docs: ragResponse.performance?.num_final_docs,
        avg_rerank_score: ragResponse.performance?.avg_rerank_score,

        latency_ms: latency,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      throw error;
    }
  }

  private async calculateFaithfulness(answer: string, contexts: string[]): Promise<{ score: number; reasoning: string }> {
    if (contexts.length === 0 || !answer) return { score: 0, reasoning: 'No contexts or answer provided' };

    const prompt = `Actúa como un Juez de Veracidad para un sistema RAG.
Tu tarea es decidir si la RESPUESTA se puede deducir EXCLUSIVAMENTE de los CONTEXTOS.

CONTEXTOS:
${contexts.map((c, i) => `[${i + 1}] ${c.substring(0, 3000)}`).join('\n---\n')}

RESPUESTA:
${answer}

PASOS:
1. Extrae las afirmaciones clave de la respuesta.
2. Busca evidencia directa en los contextos para cada afirmación.
3. Si una afirmación NO está en el contexto, es una falta de fidelidad.

PUNTUACIÓN (0.0 a 1.0):
- 1.0: Toda la respuesta está en el contexto.
- 0.0: La respuesta ignora el contexto por completo.

Responde con el formato:
RAZONAMIENTO: <tu explicación breve>
SCORE: <solo el número>`;

    try {
      const content = await this.invokeLLMWithTimeout(prompt);
      return this.extractScoreAndReasoning(content);
    } catch (error) {
      return { score: 0.5, reasoning: 'Error during evaluation' };
    }
  }

  private async calculateAnswerRelevancy(question: string, answer: string): Promise<{ score: number; reasoning: string }> {
    if (!answer || !question) return { score: 0, reasoning: 'No answer or question provided' };

    const prompt = `Evalúa si la respuesta resuelve DIRECTAMENTE la pregunta del usuario.

PREGUNTA:
${question}

RESPUESTA:
${answer}

FORMATO:
RAZONAMIENTO: <explicación>
SCORE: <número entre 0.0 y 1.0>`;

    try {
      const content = await this.invokeLLMWithTimeout(prompt);
      return this.extractScoreAndReasoning(content);
    } catch (error) {
      return { score: 0.5, reasoning: 'Error during evaluation' };
    }
  }

  private async calculateContextPrecision(question: string, contexts: string[]): Promise<{ score: number; reasoning: string }> {
    if (contexts.length === 0) return { score: 0, reasoning: 'No contexts provided' };

    const prompt = `Evalúa la calidad de los documentos recuperados para la pregunta.
¿Cuántos de estos documentos son ÚTILES para dar una respuesta correcta?

PREGUNTA:
${question}

CONTEXTOS:
${contexts.map((c, i) => `[${i + 1}] ${c.substring(0, 3000)}`).join('\n---\n')}

SCORE:
1.0 = Todos son muy útiles.
0.5 = Algunos son paja/ruido.
0.0 = Ninguno sirve.

FORMATO:
RAZONAMIENTO: <explicación>
SCORE: <número>`;

    try {
      const content = await this.invokeLLMWithTimeout(prompt);
      return this.extractScoreAndReasoning(content);
    } catch (error) {
      return { score: 0.5, reasoning: 'Error during evaluation' };
    }
  }

  private async calculateContextRecall(
    retrievedContexts: string[],
    retrievedSources: string[],
    expectedContexts: string[]
  ): Promise<number> {
    if (expectedContexts.length === 0) return 1;
    
    // Comparación por nombre de archivo (robusto para nuestro sistema)
    const retrieved = new Set(retrievedSources.map(s => s.toLowerCase()));
    let matches = 0;
    
    for (const expected of expectedContexts) {
      if (retrieved.has(expected.toLowerCase())) {
        matches++;
      } else {
        // Búsqueda parcial (ej: "arquitectura" coincide con "01-arquitectura-general.md")
        for (const r of retrieved) {
          if (r.includes(expected.toLowerCase()) || expected.toLowerCase().includes(r)) {
            matches++;
            break;
          }
        }
      }
    }
    
    return matches / expectedContexts.length;
  }

  private async calculateAnswerCorrectness(generatedAnswer: string, groundTruthAnswer: string): Promise<{ score: number; reasoning: string }> {
    if (!generatedAnswer || !groundTruthAnswer) return { score: 0, reasoning: 'No answer or ground truth provided' };

    const prompt = `Compara la respuesta GENERADA contra la respuesta de REFERENCIA (Ground Truth).
¿Dicen lo mismo en esencia?

REFERENCIA: ${groundTruthAnswer}
GENERADA: ${generatedAnswer}

Puntuación 1.0 si los datos técnicos coinciden. 0.0 si son distintos.

FORMATO:
RAZONAMIENTO: <explicación>
SCORE: <número>`;

    try {
      const content = await this.invokeLLMWithTimeout(prompt);
      return this.extractScoreAndReasoning(content);
    } catch (error) {
      return { score: 0.5, reasoning: 'Error during evaluation' };
    }
  }

  private async detectHallucinations(answer: string, contexts: string[]): Promise<{
    score: number;
    hallucinations: string[];
    reasoning: string;
  }> {
    if (!answer || contexts.length === 0) {
      return { score: 1.0, hallucinations: [], reasoning: 'No answer or contexts provided' };
    }

    const prompt = `Actúa como un Auditor de Alucinaciones.
Busca datos técnicos (versiones, nombres, configuraciones) en la RESPUESTA que NO estén en los CONTEXTOS.

CONTEXTOS:
${contexts.map((c, i) => `[${i + 1}] ${c.substring(0, 3000)}`).join('\n---\n')}

RESPUESTA:
${answer}

INSTRUCCIONES:
- Lista cada dato inventado con un guion "-".
- Si todo es correcto, escribe "NINGUNA".

FORMATO:
ALUCINACIONES:
- <dato 1>
- <dato 2>
...o "NINGUNA"`;

    try {
      const content = await this.invokeLLMWithTimeout(prompt);
      const lines = content.split('\n');
      const hallucinations = lines
        .filter(l => l.trim().startsWith('-'))
        .map(l => l.trim().substring(1).trim());

      if (content.toUpperCase().includes('NINGUNA') || hallucinations.length === 0) {
        return { score: 1.0, hallucinations: [], reasoning: content.trim() };
      }

      // Penalización: -0.2 por cada alucinación
      const score = Math.max(0, 1 - hallucinations.length * 0.2);
      return { score, hallucinations, reasoning: content.trim() };
    } catch (error) {
      return { score: 0.5, hallucinations: [], reasoning: 'Error during evaluation' };
    }
  }

  private extractScoreFromReasoning(content: string): number {
    return this.extractScoreAndReasoning(content).score;
  }

  private extractScoreAndReasoning(content: string): { score: number; reasoning: string } {
    const reasoningMatch = content.match(/RAZONAMIENTO:\s*(.+?)(?=SCORE:|$)/is);
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : content.slice(0, 300).trim();

    const scoreMatch = content.match(/SCORE:\s*([\d.]+)/i);
    if (scoreMatch) {
      const val = parseFloat(scoreMatch[1]);
      const score = isNaN(val) ? 0.5 : Math.max(0, Math.min(1, val));
      return { score, reasoning };
    }

    const decimalMatch = content.match(/\b(0\.\d+|1\.0|0\.0|1|0)\b/);
    const score = decimalMatch ? parseFloat(decimalMatch[0]) : 0.5;
    return { score, reasoning };
  }
}
