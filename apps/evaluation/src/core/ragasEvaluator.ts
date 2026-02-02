import { Ollama } from '@langchain/community/llms/ollama';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
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
  private llm: Ollama;
  private embeddings: OllamaEmbeddings;
  private backendUrl: string;

  constructor(backendUrl: string = 'http://localhost:3001') {
    this.backendUrl = backendUrl;

    // Use same LLM for evaluation but with lower temperature for consistency
    this.llm = new Ollama({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.1:8b',
      temperature: 0.1, // Low temperature for consistent scoring
    });

    // Use same embeddings as RAG system
    this.embeddings = new OllamaEmbeddings({
      baseUrl: 'http://localhost:11434',
      model: 'mxbai-embed-large',
    });
  }

  /**
   * Call RAG backend via HTTP API
   */
  private async callRAGAPI(question: string): Promise<RAGResponse> {
    const response = await fetch(`${this.backendUrl}/api/chat/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`RAG API failed (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Get full content of a source file from filesystem
   */
  private async getSourceContent(source: RAGSource): Promise<string> {
    const filePath = path.join(
      process.cwd(),
      'apps/backend/uploads/documents',
      source.filename
    );

    try {
      return await readFile(filePath, 'utf-8');
    } catch (error) {
      console.warn(`Could not read ${source.filename}:`, error);
      return '';
    }
  }

  async evaluateSingleCase(testCase: EvaluationTestCase): Promise<EvaluationResult> {
    const totalStartTime = Date.now();

    try {
      // 1. Execute RAG pipeline via HTTP API
      console.log(`\n🧪 Evaluating: ${testCase.question}`);

      const ragStartTime = Date.now();
      const ragResponse = await this.callRAGAPI(testCase.question);
      const ragEndTime = Date.now();

      // Extract contexts and sources - get full content from filesystem
      const contextsPromises = ragResponse.sources.map(async (source) => {
        const fullContent = await this.getSourceContent(source);
        return fullContent;
      });
      const contexts = (await Promise.all(contextsPromises)).filter(text => text.length > 0);
      const sourceFilenames = ragResponse.sources.map(s => s.filename);

      // 2. Calculate core RAGAS metrics
      const faithfulness = await this.calculateFaithfulness(ragResponse.answer, contexts);
      const answerRelevancy = await this.calculateAnswerRelevancy(testCase.question, ragResponse.answer);
      const contextPrecision = await this.calculateContextPrecision(testCase.question, contexts);
      const contextRecall = await this.calculateContextRecall(contexts, sourceFilenames, testCase.expected_contexts);

      // 3. Calculate additional metrics
      const contextRelevancy = await this.calculateContextRelevancy(testCase.question, contexts);
      const answerCorrectness = await this.calculateAnswerCorrectness(ragResponse.answer, testCase.ground_truth_answer);
      const answerSimilarity = this.calculateAnswerSimilarity(ragResponse.answer, testCase.ground_truth_answer);
      const answerCompleteness = await this.calculateAnswerCompleteness(testCase.question, ragResponse.answer);

      // 4. Hallucination detection
      const hallucinationResult = await this.detectHallucinations(ragResponse.answer, contexts);

      const latency = Date.now() - totalStartTime;

      console.log(`✅ Core Metrics - F: ${faithfulness.toFixed(2)}, AR: ${answerRelevancy.toFixed(2)}, CP: ${contextPrecision.toFixed(2)}, CR: ${contextRecall.toFixed(2)}`);
      console.log(`✅ Additional - CRel: ${contextRelevancy.toFixed(2)}, AC: ${answerCorrectness.toFixed(2)}, AS: ${answerSimilarity.toFixed(2)}, ACom: ${answerCompleteness.toFixed(2)}`);
      console.log(`✅ Hallucination Score: ${hallucinationResult.score.toFixed(2)}${hallucinationResult.hallucinations.length > 0 ? ` (${hallucinationResult.hallucinations.length} detected)` : ''}`);

      return {
        test_case_id: testCase.id,
        question: testCase.question,
        generated_answer: ragResponse.answer,
        retrieved_contexts: contexts,
        retrieved_sources: sourceFilenames,

        // Core RAGAS metrics
        faithfulness_score: faithfulness,
        answer_relevancy_score: answerRelevancy,
        context_precision_score: contextPrecision,
        context_recall_score: contextRecall,

        // Additional metrics
        context_relevancy_score: contextRelevancy,
        answer_correctness_score: answerCorrectness,
        answer_similarity_score: answerSimilarity,
        answer_completeness_score: answerCompleteness,

        // Hallucination detection
        hallucination_score: hallucinationResult.score,
        hallucinations_detected: hallucinationResult.hallucinations,

        // Performance metrics
        retrieval_latency_ms: ragResponse.performance?.retrieval_latency_ms,
        reranking_latency_ms: ragResponse.performance?.reranking_latency_ms,
        generation_latency_ms: ragResponse.performance?.generation_latency_ms,
        num_retrieved_docs: ragResponse.performance?.num_retrieved_docs,
        num_final_docs: ragResponse.performance?.num_final_docs,
        avg_rerank_score: ragResponse.performance?.avg_rerank_score,

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
        latency_ms: Date.now() - totalStartTime,
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

  private async calculateContextRecall(
    retrievedContexts: string[],
    retrievedSources: string[],
    expectedContexts: string[]
  ): Promise<number> {
    if (expectedContexts.length === 0) return 1;

    // Method 1: Filename matching (fast, for when expected_contexts are filenames)
    const retrieved = new Set(retrievedSources);
    const expected = new Set(expectedContexts);

    let filenameMatches = 0;
    for (const expectedFile of expected) {
      // Check if any retrieved file contains the expected filename
      for (const retrievedFile of retrieved) {
        if (retrievedFile.includes(expectedFile) || expectedFile.includes(retrievedFile)) {
          filenameMatches++;
          break;
        }
      }
    }

    // If all expected contexts are found by filename, return perfect score
    if (filenameMatches === expected.size) {
      return 1.0;
    }

    // Method 2: Semantic similarity (slower, more accurate for content-based expected contexts)
    // This handles cases where expected_contexts might be text descriptions rather than filenames
    if (retrievedContexts.length > 0) {
      try {
        // For each expected context, find if any retrieved context is semantically similar
        let semanticMatches = 0;

        for (const expectedCtx of expectedContexts) {
          // Check if this is a filename first (fast path)
          let foundByFilename = false;
          for (const retrievedFile of retrieved) {
            if (retrievedFile.includes(expectedCtx) || expectedCtx.includes(retrievedFile)) {
              foundByFilename = true;
              break;
            }
          }

          if (foundByFilename) {
            semanticMatches++;
            continue;
          }

          // Otherwise, check semantic similarity
          // Embed the expected context and all retrieved contexts
          const [expectedEmbed, ...retrievedEmbeds] = await this.embeddings.embedDocuments([
            expectedCtx,
            ...retrievedContexts.slice(0, 10) // Limit to top 10 to avoid too many embeddings
          ]);

          // Calculate cosine similarity with each retrieved context
          let maxSimilarity = 0;
          for (const retrievedEmbed of retrievedEmbeds) {
            const similarity = this.cosineSimilarity(expectedEmbed, retrievedEmbed);
            maxSimilarity = Math.max(maxSimilarity, similarity);
          }

          // If any retrieved context has high similarity (>0.7), count as a match
          if (maxSimilarity > 0.7) {
            semanticMatches++;
          }
        }

        return semanticMatches / expected.size;
      } catch (error) {
        console.warn('[RAGAS] Semantic Context Recall failed, falling back to filename matching:', error);
        return filenameMatches / expected.size;
      }
    }

    // Fallback to filename matching only
    return filenameMatches / expected.size;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // ============================================================================
  // ADDITIONAL RAGAS METRICS
  // ============================================================================

  private async calculateContextRelevancy(question: string, contexts: string[]): Promise<number> {
    if (contexts.length === 0) return 0;

    const prompt = `Evalúa qué porcentaje de la información en los contextos es relevante para la pregunta.

Pregunta:
${question}

Contextos:
${contexts.map((c, i) => `[${i + 1}] ${c.substring(0, 400)}...`).join('\n---\n')}

Criterios:
- 1.0 = Toda la información en los contextos es relevante para la pregunta
- 0.5 = Aproximadamente la mitad de la información es relevante, el resto es ruido
- 0.0 = Los contextos contienen mucha información irrelevante

Responde SOLO con un número decimal entre 0.0 y 1.0 (ej: 0.65)`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = typeof response === 'string' ? response : response.toString();
      return this.extractScore(content.trim());
    } catch (error) {
      console.error('Error calculating context relevancy:', error);
      return 0;
    }
  }

  private async calculateAnswerCorrectness(generatedAnswer: string, groundTruthAnswer: string): Promise<number> {
    if (!generatedAnswer || !groundTruthAnswer) return 0;

    try {
      // Use embedding similarity for semantic correctness
      const [genEmbed, truthEmbed] = await this.embeddings.embedDocuments([
        generatedAnswer,
        groundTruthAnswer
      ]);

      return this.cosineSimilarity(genEmbed, truthEmbed);
    } catch (error) {
      console.error('Error calculating answer correctness:', error);
      return 0;
    }
  }

  private calculateAnswerSimilarity(generatedAnswer: string, groundTruthAnswer: string): number {
    if (!generatedAnswer || !groundTruthAnswer) return 0;

    // Tokenize into words
    const genWords = new Set(
      generatedAnswer.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2) // Filter out very short words
    );

    const truthWords = new Set(
      groundTruthAnswer.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
    );

    // Calculate F1 score
    const intersection = new Set([...genWords].filter(w => truthWords.has(w)));
    const precision = genWords.size > 0 ? intersection.size / genWords.size : 0;
    const recall = truthWords.size > 0 ? intersection.size / truthWords.size : 0;

    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall);
  }

  private async calculateAnswerCompleteness(question: string, answer: string): Promise<number> {
    if (!answer || !question) return 0;

    const prompt = `Evalúa qué tan completa es la respuesta para la pregunta.

Pregunta:
${question}

Respuesta:
${answer}

Criterios:
- 1.0 = La respuesta cubre completamente todos los aspectos de la pregunta
- 0.7 = La respuesta cubre la mayoría de los aspectos pero falta algo
- 0.5 = La respuesta es parcial, cubre solo algunos aspectos
- 0.0 = La respuesta no aborda la pregunta o está muy incompleta

Responde SOLO con un número decimal entre 0.0 y 1.0 (ej: 0.80)`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = typeof response === 'string' ? response : response.toString();
      return this.extractScore(content.trim());
    } catch (error) {
      console.error('Error calculating answer completeness:', error);
      return 0;
    }
  }

  private async detectHallucinations(answer: string, contexts: string[]): Promise<{
    score: number;
    hallucinations: string[];
  }> {
    if (!answer || contexts.length === 0) {
      return { score: 0, hallucinations: ['No contexts provided'] };
    }

    const prompt = `Identifica TODAS las afirmaciones en la respuesta que NO están soportadas por los contextos proporcionados.

Contextos:
${contexts.map((c, i) => `[${i + 1}] ${c.substring(0, 500)}...`).join('\n---\n')}

Respuesta:
${answer}

Instrucciones:
- Lista cada alucinación (afirmación no soportada) en una línea nueva precedida por "-"
- Si NO hay alucinaciones, responde exactamente: "NINGUNA"
- Una alucinación es cualquier información que no se puede verificar en los contextos

Formato:
- [Alucinación 1]
- [Alucinación 2]

o bien:

NINGUNA`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = typeof response === 'string' ? response : response.toString();

      // Parse hallucinations
      const lines = content.split('\n').map(l => l.trim());
      const hallucinations = lines
        .filter(line => line.startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(line => line.length > 0);

      // Check for "NINGUNA" response
      if (content.toUpperCase().includes('NINGUNA') || hallucinations.length === 0) {
        return { score: 1.0, hallucinations: [] };
      }

      // Calculate score: 1.0 = no hallucinations, decreases by 0.2 per hallucination
      const score = Math.max(0, 1 - hallucinations.length * 0.2);

      return { score, hallucinations };
    } catch (error) {
      console.error('Error detecting hallucinations:', error);
      return { score: 0.5, hallucinations: [] };
    }
  }

  private extractScore(content: string): number {
    // 1. Try to extract decimal in range 0.0-1.0 (most precise)
    const decimalMatch = content.match(/\b(0?\.\d+|1\.0+|0\.0+)\b/);
    if (decimalMatch) {
      const score = parseFloat(decimalMatch[1]);
      if (score >= 0 && score <= 1) {
        return score;
      }
    }

    // 2. Try to extract percentage (0-100%)
    const percentMatch = content.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch) {
      const percent = parseFloat(percentMatch[1]);
      if (percent >= 0 && percent <= 100) {
        return percent / 100;
      }
    }

    // 3. Try to extract any number and clamp it
    const anyNumberMatch = content.match(/\d+\.?\d*/);
    if (anyNumberMatch) {
      const num = parseFloat(anyNumberMatch[0]);
      // If it's in range 0-1, use it directly
      if (num >= 0 && num <= 1) {
        return num;
      }
      // If it's in range 0-100, treat as percentage
      if (num >= 0 && num <= 100) {
        return num / 100;
      }
      // Otherwise clamp to 0-1
      return Math.max(0, Math.min(1, num));
    }

    // 4. Look for keyword indicators if no number found
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('completamente') || lowerContent.includes('totalmente') || lowerContent.includes('perfecta')) {
      return 1.0;
    }
    if (lowerContent.includes('alta') || lowerContent.includes('mayoría')) {
      return 0.8;
    }
    if (lowerContent.includes('parcialmente') || lowerContent.includes('medianamente') || lowerContent.includes('mitad')) {
      return 0.5;
    }
    if (lowerContent.includes('baja') || lowerContent.includes('poco')) {
      return 0.2;
    }
    if (lowerContent.includes('ninguna') || lowerContent.includes('nada') || lowerContent.includes(' no ')) {
      return 0.0;
    }

    // 5. Fallback: log warning and return neutral score
    console.warn(`[RAGAS] Could not extract score from LLM response: "${content.substring(0, 100)}..."`);
    return 0.5; // Neutral score instead of 0
  }
}
