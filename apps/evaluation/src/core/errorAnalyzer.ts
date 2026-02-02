import type { EvaluationResult } from './types';

export enum ErrorType {
  HALLUCINATION = 'hallucination',
  INCOMPLETE_ANSWER = 'incomplete',
  IRRELEVANT_ANSWER = 'irrelevant',
  POOR_RETRIEVAL = 'poor_retrieval',
  LOW_RERANK_SCORES = 'low_rerank',
  CONTEXT_NOT_FOUND = 'context_not_found',
  CONTRADICTORY = 'contradictory',
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorAnalysis {
  error_types: ErrorType[];
  error_description: string;
  suggested_fix: string;
  severity: ErrorSeverity;
}

export interface ErrorPattern {
  pattern_name: string;
  frequency: number;
  affected_categories: string[];
  affected_test_cases: string[];
  common_characteristics: string[];
  recommended_action: string;
  severity: ErrorSeverity;
}

export class ErrorAnalyzer {
  /**
   * Analyze a single evaluation result and identify error types
   */
  analyzeResult(result: EvaluationResult): ErrorAnalysis {
    const errors: ErrorType[] = [];
    let description = '';
    let suggestedFix = '';
    let severity: ErrorSeverity = 'low';

    // 1. Detect hallucinations
    if (result.faithfulness_score < 0.7 || (result.hallucination_score && result.hallucination_score < 0.7)) {
      errors.push(ErrorType.HALLUCINATION);
      severity = 'critical';
      description += 'Respuesta contiene alucinaciones (información no soportada por contextos). ';
      suggestedFix += 'Revisar prompt del LLM para enfatizar uso estricto de contextos. Reducir temperatura a 0.0. ';

      if (result.hallucinations_detected && result.hallucinations_detected.length > 0) {
        description += `Alucinaciones detectadas: ${result.hallucinations_detected.slice(0, 2).join('; ')}. `;
      }
    }

    // 2. Detect incomplete answers
    if (result.answer_completeness_score && result.answer_completeness_score < 0.7) {
      errors.push(ErrorType.INCOMPLETE_ANSWER);
      if (severity !== 'critical') severity = 'high';
      description += 'Respuesta incompleta, no cubre todos los aspectos. ';
      suggestedFix += 'Aumentar RERANKER_FINAL_TOP_K o mejorar multi-query generation. ';
    }

    // 3. Detect irrelevant answers
    if (result.answer_relevancy_score < 0.6) {
      errors.push(ErrorType.IRRELEVANT_ANSWER);
      if (severity !== 'critical' && severity !== 'high') severity = 'high';
      description += 'Respuesta no es relevante para la pregunta. ';
      suggestedFix += 'Revisar prompt de generación para enfocarse en la pregunta. ';
    }

    // 4. Detect poor retrieval
    if (result.context_precision_score < 0.5) {
      errors.push(ErrorType.POOR_RETRIEVAL);
      if (severity !== 'critical' && severity !== 'high') severity = 'high';
      description += 'Contextos recuperados son poco relevantes. ';
      suggestedFix += 'Ajustar BM25/vector weights, revisar embeddings o aumentar retrieval k. ';
    }

    // 5. Detect low rerank scores
    if (result.avg_rerank_score && result.avg_rerank_score < 0.4) {
      errors.push(ErrorType.LOW_RERANK_SCORES);
      if (severity === 'low') severity = 'medium';
      description += 'Reranking no encontró documentos altamente relevantes. ';
      suggestedFix += 'Aumentar RERANKER_RETRIEVAL_TOP_K para dar más opciones al reranker. ';
    }

    // 6. Detect missing expected contexts
    if (result.context_recall_score < 0.8) {
      errors.push(ErrorType.CONTEXT_NOT_FOUND);
      if (severity === 'low') severity = 'medium';
      description += 'No se recuperaron todos los documentos esperados. ';
      suggestedFix += 'Revisar chunking, embeddings, BM25 cache o multi-query generation. ';
    }

    // 7. Detect low context relevancy (too much noise)
    if (result.context_relevancy_score && result.context_relevancy_score < 0.5) {
      errors.push(ErrorType.CONTRADICTORY);
      if (severity === 'low') severity = 'medium';
      description += 'Contextos contienen mucha información irrelevante o contradictoria. ';
      suggestedFix += 'Mejorar filtrado de contextos, ajustar reranker threshold. ';
    }

    // If no errors detected, mark as success
    if (errors.length === 0) {
      description = 'Test case ejecutado exitosamente sin errores detectados.';
      suggestedFix = 'Ninguna acción necesaria.';
    }

    return {
      error_types: errors,
      error_description: description.trim(),
      suggested_fix: suggestedFix.trim(),
      severity
    };
  }

  /**
   * Find common error patterns across multiple evaluation results
   */
  findErrorPatterns(results: EvaluationResult[]): ErrorPattern[] {
    const patterns: ErrorPattern[] = [];

    // Analyze each result to get error types
    const analyzedResults = results.map(r => ({
      result: r,
      analysis: this.analyzeResult(r)
    }));

    // Pattern 1: Hallucinations in specific categories or difficulty levels
    const hallucinationCases = analyzedResults.filter(ar =>
      ar.analysis.error_types.includes(ErrorType.HALLUCINATION)
    );

    if (hallucinationCases.length >= 2) {
      // Group by category if available
      const categoryCounts = new Map<string, number>();
      hallucinationCases.forEach(({ result }) => {
        // Extract category from test_case_id or use a default
        const category = this.extractCategory(result.test_case_id);
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
      });

      const dominantCategories = Array.from(categoryCounts.entries())
        .filter(([_, count]) => count >= 2)
        .map(([cat]) => cat);

      if (dominantCategories.length > 0) {
        patterns.push({
          pattern_name: `Alucinaciones en categorías ${dominantCategories.join(', ')}`,
          frequency: hallucinationCases.length,
          affected_categories: dominantCategories,
          affected_test_cases: hallucinationCases.map(ar => ar.result.test_case_id),
          common_characteristics: ['Faithfulness < 0.7', 'Información no verificable en contextos'],
          recommended_action: 'Mejorar prompt del LLM con instrucciones más estrictas sobre usar SOLO información de contextos. Considerar temperatura 0.0.',
          severity: 'critical'
        });
      }
    }

    // Pattern 2: Poor retrieval in specific categories
    const poorRetrievalCases = analyzedResults.filter(ar =>
      ar.analysis.error_types.includes(ErrorType.POOR_RETRIEVAL)
    );

    if (poorRetrievalCases.length >= 2) {
      const categoryCounts = new Map<string, number>();
      poorRetrievalCases.forEach(({ result }) => {
        const category = this.extractCategory(result.test_case_id);
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
      });

      const dominantCategories = Array.from(categoryCounts.entries())
        .filter(([_, count]) => count >= 2)
        .map(([cat]) => cat);

      if (dominantCategories.length > 0) {
        patterns.push({
          pattern_name: `Retrieval pobre en categorías ${dominantCategories.join(', ')}`,
          frequency: poorRetrievalCases.length,
          affected_categories: dominantCategories,
          affected_test_cases: poorRetrievalCases.map(ar => ar.result.test_case_id),
          common_characteristics: ['Context Precision < 0.5', 'Documentos irrelevantes'],
          recommended_action: `Revisar embeddings y BM25 weights para mejorar retrieval en categorías ${dominantCategories.join(', ')}. Considerar ajustar chunk size.`,
          severity: 'high'
        });
      }
    }

    // Pattern 3: Incomplete answers (systematic issue)
    const incompleteCases = analyzedResults.filter(ar =>
      ar.analysis.error_types.includes(ErrorType.INCOMPLETE_ANSWER)
    );

    if (incompleteCases.length >= 3) {
      patterns.push({
        pattern_name: 'Respuestas incompletas sistemáticas',
        frequency: incompleteCases.length,
        affected_categories: [...new Set(incompleteCases.map(ar => this.extractCategory(ar.result.test_case_id)))],
        affected_test_cases: incompleteCases.map(ar => ar.result.test_case_id),
        common_characteristics: ['Answer Completeness < 0.7', 'Aspectos de la pregunta sin responder'],
        recommended_action: 'Aumentar RERANKER_FINAL_TOP_K de 5 a 8-10 para dar más contexto al LLM. Revisar prompt para asegurar respuestas completas.',
        severity: 'high'
      });
    }

    // Pattern 4: Missing expected contexts (retrieval issue)
    const missingContextCases = analyzedResults.filter(ar =>
      ar.analysis.error_types.includes(ErrorType.CONTEXT_NOT_FOUND)
    );

    if (missingContextCases.length >= 3) {
      patterns.push({
        pattern_name: 'Contextos esperados no recuperados',
        frequency: missingContextCases.length,
        affected_categories: [...new Set(missingContextCases.map(ar => this.extractCategory(ar.result.test_case_id)))],
        affected_test_cases: missingContextCases.map(ar => ar.result.test_case_id),
        common_characteristics: ['Context Recall < 0.8', 'Documentos esperados no encontrados'],
        recommended_action: 'Revisar BM25 cache rebuild, verificar embeddings, o considerar implementar query decomposition para multi-hop.',
        severity: 'medium'
      });
    }

    // Pattern 5: High latency cases
    const highLatencyCases = results.filter(r => r.latency_ms > 20000); // > 20s

    if (highLatencyCases.length >= 3) {
      patterns.push({
        pattern_name: 'Latencia alta sistemática',
        frequency: highLatencyCases.length,
        affected_categories: [...new Set(highLatencyCases.map(r => this.extractCategory(r.test_case_id)))],
        affected_test_cases: highLatencyCases.map(r => r.test_case_id),
        common_characteristics: ['Latency > 20s', 'Procesamiento lento'],
        recommended_action: 'Optimizar reranking (considerar cache), reducir número de multi-queries, o usar modelo LLM más rápido.',
        severity: 'medium'
      });
    }

    return patterns;
  }

  /**
   * Extract category from test case ID (e.g., "basica_1" -> "Básica")
   */
  private extractCategory(testCaseId: string): string {
    const parts = testCaseId.split('_');
    if (parts.length > 0) {
      const category = parts[0];
      // Capitalize first letter
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
    return 'Unknown';
  }

  /**
   * Generate prioritized recommendations based on error patterns
   */
  generateRecommendations(patterns: ErrorPattern[]): {
    high_priority: string[];
    medium_priority: string[];
    low_priority: string[];
  } {
    const highPriority: string[] = [];
    const mediumPriority: string[] = [];
    const lowPriority: string[] = [];

    // Sort patterns by severity and frequency
    const sortedPatterns = patterns.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.frequency - a.frequency;
    });

    for (const pattern of sortedPatterns) {
      const recommendation = `${pattern.pattern_name} (${pattern.frequency} casos): ${pattern.recommended_action}`;

      if (pattern.severity === 'critical' || pattern.severity === 'high') {
        highPriority.push(recommendation);
      } else if (pattern.severity === 'medium') {
        mediumPriority.push(recommendation);
      } else {
        lowPriority.push(recommendation);
      }
    }

    return {
      high_priority: highPriority,
      medium_priority: mediumPriority,
      low_priority: lowPriority
    };
  }
}
