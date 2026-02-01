import type { EvaluationResult, EvaluationReport } from './types';
import { ErrorAnalyzer, type ErrorPattern } from './errorAnalyzer';
import path from 'path';

export class ReportGenerator {
  private errorAnalyzer: ErrorAnalyzer;

  constructor() {
    this.errorAnalyzer = new ErrorAnalyzer();
  }

  /**
   * Generate comprehensive evaluation report
   */
  generateReport(results: EvaluationResult[], datasetName: string, config: any): EvaluationReport {
    const timestamp = new Date().toISOString();

    // Calculate summary metrics
    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;

    const summary = {
      total_cases: results.length,
      successful,
      failed,
      avg_faithfulness: this.average(results.map(r => r.faithfulness_score)),
      avg_answer_relevancy: this.average(results.map(r => r.answer_relevancy_score)),
      avg_context_precision: this.average(results.map(r => r.context_precision_score)),
      avg_context_recall: this.average(results.map(r => r.context_recall_score)),
      avg_latency_ms: this.average(results.map(r => r.latency_ms)),
    };

    // Group by category
    const by_category = this.groupByCategory(results);

    return {
      summary,
      by_category,
      detailed_results: results,
      timestamp,
    };
  }

  /**
   * Generate detailed Markdown report
   */
  async generateMarkdownReport(
    results: EvaluationResult[],
    datasetName: string,
    config: any,
    previousReport?: EvaluationReport
  ): Promise<string> {
    const report = this.generateReport(results, datasetName, config);
    const patterns = this.errorAnalyzer.findErrorPatterns(results);
    const recommendations = this.errorAnalyzer.generateRecommendations(patterns);

    // Analyze individual results for errors
    const analyzedResults = results.map(r => ({
      result: r,
      analysis: this.errorAnalyzer.analyzeResult(r)
    }));

    const criticalErrors = analyzedResults.filter(ar => ar.analysis.severity === 'critical');
    const highErrors = analyzedResults.filter(ar => ar.analysis.severity === 'high');

    let markdown = `# Reporte de Evaluación RAGAS\n\n`;
    markdown += `**Fecha:** ${new Date().toLocaleString('es-ES')}\n`;
    markdown += `**Dataset:** ${datasetName} (${results.length} test cases)\n`;
    markdown += `**Configuración:**\n`;
    markdown += `\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\`\n\n`;
    markdown += `---\n\n`;

    // Executive Summary
    markdown += `## Resumen Ejecutivo\n\n`;
    markdown += `| Métrica | Score | Status |${previousReport ? ' Cambio vs Anterior' : ''}\n`;
    markdown += `|---------|-------|--------|${previousReport ? '--------------------' : ''}\n`;

    const getStatusEmoji = (score: number) => {
      if (score >= 0.8) return '✓ Excelente';
      if (score >= 0.7) return '✓ Bueno';
      if (score >= 0.5) return '⚠️ Mejorable';
      return '❌ Crítico';
    };

    const getChange = (current: number, previous?: number) => {
      if (!previous) return '';
      const diff = current - previous;
      const percentage = Math.round((diff / previous) * 100);
      if (percentage > 0) return ` +${percentage}% ↑ |`;
      if (percentage < 0) return ` ${percentage}% ↓ |`;
      return ' → |';
    };

    markdown += `| **Faithfulness** | ${Math.round(report.summary.avg_faithfulness * 100)}% | ${getStatusEmoji(report.summary.avg_faithfulness)} |${previousReport ? getChange(report.summary.avg_faithfulness, previousReport.summary.avg_faithfulness) : ''}\n`;
    markdown += `| **Answer Relevancy** | ${Math.round(report.summary.avg_answer_relevancy * 100)}% | ${getStatusEmoji(report.summary.avg_answer_relevancy)} |${previousReport ? getChange(report.summary.avg_answer_relevancy, previousReport.summary.avg_answer_relevancy) : ''}\n`;
    markdown += `| **Context Precision** | ${Math.round(report.summary.avg_context_precision * 100)}% | ${getStatusEmoji(report.summary.avg_context_precision)} |${previousReport ? getChange(report.summary.avg_context_precision, previousReport.summary.avg_context_precision) : ''}\n`;
    markdown += `| **Context Recall** | ${Math.round(report.summary.avg_context_recall * 100)}% | ${getStatusEmoji(report.summary.avg_context_recall)} |${previousReport ? getChange(report.summary.avg_context_recall, previousReport.summary.avg_context_recall) : ''}\n`;

    // Add new metrics if available
    const avgContextRelevancy = this.average(results.map(r => r.context_relevancy_score || 0));
    const avgAnswerCorrectness = this.average(results.map(r => r.answer_correctness_score || 0));
    const avgHallucination = this.average(results.map(r => r.hallucination_score || 0));

    if (avgContextRelevancy > 0) {
      markdown += `| **Context Relevancy** | ${Math.round(avgContextRelevancy * 100)}% | ${getStatusEmoji(avgContextRelevancy)} | N/A (nueva) |\n`;
    }
    if (avgAnswerCorrectness > 0) {
      markdown += `| **Answer Correctness** | ${Math.round(avgAnswerCorrectness * 100)}% | ${getStatusEmoji(avgAnswerCorrectness)} | N/A (nueva) |\n`;
    }
    if (avgHallucination > 0) {
      markdown += `| **Hallucination Detection** | ${Math.round(avgHallucination * 100)}% | ${getStatusEmoji(avgHallucination)} | N/A (nueva) |\n`;
    }

    markdown += `\n**Veredicto:** `;
    if (report.summary.avg_faithfulness >= 0.8 && report.summary.avg_answer_relevancy >= 0.8) {
      markdown += `Sistema funcionando excelentemente. `;
    } else if (report.summary.avg_faithfulness >= 0.7) {
      markdown += `Sistema funcionando bien con margen de mejora. `;
    } else {
      markdown += `Sistema requiere mejoras urgentes. `;
    }
    markdown += `\n\n---\n\n`;

    // Error Analysis
    markdown += `## Análisis de Errores\n\n`;

    if (criticalErrors.length > 0) {
      markdown += `### Errores Críticos (${criticalErrors.length})\n\n`;
      for (const { result, analysis } of criticalErrors.slice(0, 5)) {
        markdown += `#### ${result.test_case_id}\n`;
        markdown += `- **Pregunta:** ${result.question}\n`;
        markdown += `- **Error:** ${analysis.error_types.join(', ')}\n`;
        markdown += `- **Descripción:** ${analysis.error_description}\n`;
        markdown += `- **Sugerencia:** ${analysis.suggested_fix}\n`;
        if (result.hallucinations_detected && result.hallucinations_detected.length > 0) {
          markdown += `- **Alucinaciones detectadas:**\n`;
          result.hallucinations_detected.slice(0, 3).forEach(h => {
            markdown += `  - ${h}\n`;
          });
        }
        markdown += `\n`;
      }
    }

    if (highErrors.length > 0) {
      markdown += `### Errores de Alta Prioridad (${highErrors.length})\n\n`;
      for (const { result, analysis } of highErrors.slice(0, 3)) {
        markdown += `#### ${result.test_case_id}\n`;
        markdown += `- **Pregunta:** ${result.question}\n`;
        markdown += `- **Error:** ${analysis.error_types.join(', ')}\n`;
        markdown += `- **Descripción:** ${analysis.error_description}\n`;
        markdown += `\n`;
      }
    }

    // Error Patterns
    if (patterns.length > 0) {
      markdown += `### Patrones Identificados (${patterns.length})\n\n`;
      for (let i = 0; i < Math.min(patterns.length, 5); i++) {
        const pattern = patterns[i];
        markdown += `#### Patrón ${i + 1}: ${pattern.pattern_name}\n`;
        markdown += `- **Frecuencia:** ${pattern.frequency} casos\n`;
        markdown += `- **Categorías afectadas:** ${pattern.affected_categories.join(', ')}\n`;
        markdown += `- **Características comunes:** ${pattern.common_characteristics.join(', ')}\n`;
        markdown += `- **Acción recomendada:** ${pattern.recommended_action}\n`;
        markdown += `\n`;
      }
    }

    markdown += `---\n\n`;

    // Metrics by Category
    markdown += `## Métricas por Categoría\n\n`;
    for (const [category, metrics] of Object.entries(report.by_category)) {
      const avgScore = (metrics.avg_faithfulness + metrics.avg_answer_relevancy + metrics.avg_context_precision + metrics.avg_context_recall) / 4;
      const status = avgScore >= 0.8 ? '✓ Excelente' : avgScore >= 0.7 ? '✓ Bueno' : avgScore >= 0.5 ? '⚠️ Mejorable' : '❌ Crítico';

      markdown += `### ${category} (${metrics.count} casos) - ${status}\n`;
      markdown += `- Faithfulness: ${Math.round(metrics.avg_faithfulness * 100)}%\n`;
      markdown += `- Answer Relevancy: ${Math.round(metrics.avg_answer_relevancy * 100)}%\n`;
      markdown += `- Context Precision: ${Math.round(metrics.avg_context_precision * 100)}%\n`;
      markdown += `- Context Recall: ${Math.round(metrics.avg_context_recall * 100)}%\n\n`;

      // Add analysis
      if (avgScore < 0.7) {
        markdown += `**Análisis:** Categoría requiere atención. `;
        if (metrics.avg_faithfulness < 0.7) markdown += `Alucinaciones frecuentes. `;
        if (metrics.avg_context_precision < 0.7) markdown += `Retrieval pobre. `;
        markdown += `\n\n`;
      }
    }

    markdown += `---\n\n`;

    // Performance Metrics
    markdown += `## Performance\n\n`;
    markdown += `| Métrica | Valor | Status |\n`;
    markdown += `|---------|-------|--------|\n`;
    markdown += `| Latencia promedio | ${(report.summary.avg_latency_ms / 1000).toFixed(1)}s | ${report.summary.avg_latency_ms < 15000 ? '✓ OK' : '⚠️ Alto'} |\n`;
    markdown += `| Casos procesados/min | ${(60000 / report.summary.avg_latency_ms).toFixed(1)} | ${(60000 / report.summary.avg_latency_ms) > 3 ? '✓ OK' : '⚠️ Lento'} |\n`;

    // Breakdown of latency if available
    const avgRetrievalLatency = this.average(results.map(r => r.retrieval_latency_ms || 0));
    const avgRerankingLatency = this.average(results.map(r => r.reranking_latency_ms || 0));
    const avgGenerationLatency = this.average(results.map(r => r.generation_latency_ms || 0));

    if (avgRetrievalLatency > 0) {
      markdown += `| Retrieval avg | ${(avgRetrievalLatency / 1000).toFixed(1)}s | ${avgRetrievalLatency < 3000 ? '✓ OK' : '⚠️ Alto'} |\n`;
    }
    if (avgRerankingLatency > 0) {
      markdown += `| Reranking avg | ${(avgRerankingLatency / 1000).toFixed(1)}s | ${avgRerankingLatency < 5000 ? '✓ OK' : '⚠️ Alto'} |\n`;
    }
    if (avgGenerationLatency > 0) {
      markdown += `| Generation avg | ${(avgGenerationLatency / 1000).toFixed(1)}s | ${avgGenerationLatency < 8000 ? '✓ OK' : '⚠️ Alto'} |\n`;
    }

    markdown += `\n**Cuellos de botella:** `;
    if (avgRerankingLatency > avgGenerationLatency && avgRerankingLatency > avgRetrievalLatency) {
      markdown += `Reranking es el más lento. `;
    } else if (avgGenerationLatency > avgRerankingLatency && avgGenerationLatency > avgRetrievalLatency) {
      markdown += `Generación (LLM) es el más lento. `;
    }
    markdown += `\n\n---\n\n`;

    // Best and Worst Cases
    const sortedByScore = [...results].sort((a, b) => {
      const scoreA = (a.faithfulness_score + a.answer_relevancy_score + a.context_precision_score + a.context_recall_score) / 4;
      const scoreB = (b.faithfulness_score + b.answer_relevancy_score + b.context_precision_score + b.context_recall_score) / 4;
      return scoreB - scoreA;
    });

    markdown += `## Casos con Mejor Performance\n\n`;
    for (const result of sortedByScore.slice(0, 3)) {
      const avgScore = (result.faithfulness_score + result.answer_relevancy_score + result.context_precision_score + result.context_recall_score) / 4;
      markdown += `- **${result.test_case_id}** - "${result.question}" - ${Math.round(avgScore * 100)}% promedio\n`;
    }

    markdown += `\n## Casos con Peor Performance\n\n`;
    for (const result of sortedByScore.slice(-3).reverse()) {
      const avgScore = (result.faithfulness_score + result.answer_relevancy_score + result.context_precision_score + result.context_recall_score) / 4;
      markdown += `- **${result.test_case_id}** - "${result.question}" - ${Math.round(avgScore * 100)}% promedio\n`;
    }

    markdown += `\n---\n\n`;

    // Recommendations
    markdown += `## Recomendaciones Accionables\n\n`;

    if (recommendations.high_priority.length > 0) {
      markdown += `### Prioridad Alta\n`;
      recommendations.high_priority.forEach((rec, i) => {
        markdown += `${i + 1}. ${rec}\n`;
      });
      markdown += `\n`;
    }

    if (recommendations.medium_priority.length > 0) {
      markdown += `### Prioridad Media\n`;
      recommendations.medium_priority.forEach((rec, i) => {
        markdown += `${i + 1}. ${rec}\n`;
      });
      markdown += `\n`;
    }

    if (recommendations.low_priority.length > 0) {
      markdown += `### Prioridad Baja\n`;
      recommendations.low_priority.forEach((rec, i) => {
        markdown += `${i + 1}. ${rec}\n`;
      });
    }

    return markdown;
  }

  /**
   * Generate detailed JSON report
   */
  generateDetailedJsonReport(
    results: EvaluationResult[],
    datasetName: string,
    config: any
  ): any {
    const report = this.generateReport(results, datasetName, config);
    const patterns = this.errorAnalyzer.findErrorPatterns(results);
    const recommendations = this.errorAnalyzer.generateRecommendations(patterns);

    // Analyze individual results
    const analyzedResults = results.map(r => ({
      ...r,
      error_analysis: this.errorAnalyzer.analyzeResult(r)
    }));

    // Best and worst performing
    const sortedByScore = [...results].sort((a, b) => {
      const scoreA = (a.faithfulness_score + a.answer_relevancy_score + a.context_precision_score + a.context_recall_score) / 4;
      const scoreB = (b.faithfulness_score + b.answer_relevancy_score + b.context_precision_score + b.context_recall_score) / 4;
      return scoreB - scoreA;
    });

    return {
      metadata: {
        timestamp: new Date().toISOString(),
        dataset: datasetName,
        total_cases: results.length,
        config
      },
      summary: {
        ...report.summary,
        // Add new metrics
        avg_context_relevancy: this.average(results.map(r => r.context_relevancy_score || 0)),
        avg_answer_correctness: this.average(results.map(r => r.answer_correctness_score || 0)),
        avg_hallucination_score: this.average(results.map(r => r.hallucination_score || 0)),
        avg_retrieval_latency_ms: this.average(results.map(r => r.retrieval_latency_ms || 0)),
        avg_reranking_latency_ms: this.average(results.map(r => r.reranking_latency_ms || 0)),
        avg_generation_latency_ms: this.average(results.map(r => r.generation_latency_ms || 0)),
      },
      by_category: report.by_category,
      error_patterns: patterns,
      recommendations,
      detailed_results: analyzedResults,
      best_performing_cases: sortedByScore.slice(0, 5).map(r => ({
        test_case_id: r.test_case_id,
        avg_score: (r.faithfulness_score + r.answer_relevancy_score + r.context_precision_score + r.context_recall_score) / 4,
        question: r.question
      })),
      worst_performing_cases: sortedByScore.slice(-5).reverse().map(r => ({
        test_case_id: r.test_case_id,
        avg_score: (r.faithfulness_score + r.answer_relevancy_score + r.context_precision_score + r.context_recall_score) / 4,
        question: r.question
      }))
    };
  }

  /**
   * Save reports to filesystem
   */
  async saveReports(
    results: EvaluationResult[],
    datasetName: string,
    config: any,
    outputDir: string = './benchmark/evaluation/results'
  ): Promise<{
    markdownPath: string;
    jsonPath: string;
  }> {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const baseFilename = `ragas_${timestamp}`;

    // Generate reports
    const markdownReport = await this.generateMarkdownReport(results, datasetName, config);
    const jsonReport = this.generateDetailedJsonReport(results, datasetName, config);

    // Save Markdown
    const markdownPath = path.join(outputDir, `${baseFilename}.md`);
    await Bun.write(markdownPath, markdownReport);

    // Save JSON
    const jsonPath = path.join(outputDir, `${baseFilename}.json`);
    await Bun.write(jsonPath, JSON.stringify(jsonReport, null, 2));

    console.log(`\n📄 Reports saved:`);
    console.log(`  - Markdown: ${markdownPath}`);
    console.log(`  - JSON: ${jsonPath}`);

    return { markdownPath, jsonPath };
  }

  /**
   * Print summary to console
   */
  printReportSummary(report: EvaluationReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RAGAS EVALUATION REPORT');
    console.log('='.repeat(60));

    console.log('\n📈 SUMMARY:');
    console.log(`  Total cases: ${report.summary.total_cases}`);
    console.log(`  Successful: ${report.summary.successful}`);
    console.log(`  Failed: ${report.summary.failed}`);
    console.log(`  Avg Latency: ${report.summary.avg_latency_ms.toFixed(0)}ms`);

    console.log('\n🎯 OVERALL METRICS:');
    console.log(`  Faithfulness: ${(report.summary.avg_faithfulness * 100).toFixed(1)}%`);
    console.log(`  Answer Relevancy: ${(report.summary.avg_answer_relevancy * 100).toFixed(1)}%`);
    console.log(`  Context Precision: ${(report.summary.avg_context_precision * 100).toFixed(1)}%`);
    console.log(`  Context Recall: ${(report.summary.avg_context_recall * 100).toFixed(1)}%`);

    console.log('\n📂 BY CATEGORY:');
    for (const [category, metrics] of Object.entries(report.by_category)) {
      console.log(`\n  ${category} (${metrics.count} cases):`);
      console.log(`    Faithfulness: ${(metrics.avg_faithfulness * 100).toFixed(1)}%`);
      console.log(`    Answer Relevancy: ${(metrics.avg_answer_relevancy * 100).toFixed(1)}%`);
      console.log(`    Context Precision: ${(metrics.avg_context_precision * 100).toFixed(1)}%`);
      console.log(`    Context Recall: ${(metrics.avg_context_recall * 100).toFixed(1)}%`);
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * Helper: Calculate average
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const validNumbers = numbers.filter(n => !isNaN(n) && n !== null && n !== undefined);
    if (validNumbers.length === 0) return 0;
    return validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length;
  }

  /**
   * Helper: Group results by category
   */
  private groupByCategory(results: EvaluationResult[]): Record<string, any> {
    const categories = new Map<string, EvaluationResult[]>();

    for (const result of results) {
      // Extract category from test_case_id (e.g., "basica_1" -> "Básica")
      const category = this.extractCategory(result.test_case_id);
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(result);
    }

    const grouped: Record<string, any> = {};

    for (const [category, categoryResults] of categories) {
      grouped[category] = {
        count: categoryResults.length,
        avg_faithfulness: this.average(categoryResults.map(r => r.faithfulness_score)),
        avg_answer_relevancy: this.average(categoryResults.map(r => r.answer_relevancy_score)),
        avg_context_precision: this.average(categoryResults.map(r => r.context_precision_score)),
        avg_context_recall: this.average(categoryResults.map(r => r.context_recall_score)),
      };
    }

    return grouped;
  }

  /**
   * Helper: Extract category from test case ID
   */
  private extractCategory(testCaseId: string): string {
    const parts = testCaseId.split('_');
    if (parts.length > 0) {
      const category = parts[0];
      // Map to display names
      const categoryMap: Record<string, string> = {
        'basica': 'Básica',
        'conceptual': 'Conceptual',
        'relacion': 'Relación',
        'proceso': 'Proceso',
        'comparativa': 'Comparativa',
        'edge': 'Edge Cases',
        'multihop': 'Multi-Hop',
      };
      return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
    }
    return 'Unknown';
  }
}

// Export legacy functions for backward compatibility
export function generateReport(results: EvaluationResult[]): EvaluationReport {
  const generator = new ReportGenerator();
  return generator.generateReport(results, 'unknown', {});
}

export async function saveReport(report: EvaluationReport, outputPath: string): Promise<void> {
  const json = JSON.stringify(report, null, 2);
  await Bun.write(outputPath, json);
  console.log(`\n💾 Report saved to: ${outputPath}`);
}

export function printReportSummary(report: EvaluationReport): void {
  const generator = new ReportGenerator();
  generator.printReportSummary(report);
}
