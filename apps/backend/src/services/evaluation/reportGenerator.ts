import type { EvaluationResult, EvaluationReport } from './types';

export function generateReport(results: EvaluationResult[]): EvaluationReport {
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);

  // Calculate aggregated metrics
  const avgFaithfulness = calculateAverage(successful, 'faithfulness_score');
  const avgAnswerRelevancy = calculateAverage(successful, 'answer_relevancy_score');
  const avgContextPrecision = calculateAverage(successful, 'context_precision_score');
  const avgContextRecall = calculateAverage(successful, 'context_recall_score');
  const avgLatency = calculateAverage(results, 'latency_ms');

  // Group by category
  const byCategory: Record<string, {
    count: number;
    avg_faithfulness: number;
    avg_answer_relevancy: number;
    avg_context_precision: number;
    avg_context_recall: number;
  }> = {};

  // Extract category from test_case_id (e.g., "basica_1" -> "Básica")
  for (const result of successful) {
    const categoryPrefix = result.test_case_id.split('_')[0];
    const categoryMap: Record<string, string> = {
      'basica': 'Básica',
      'conceptual': 'Conceptual',
      'relacion': 'Relación',
      'proceso': 'Proceso',
      'comparativa': 'Comparativa',
    };

    const category = categoryMap[categoryPrefix] || 'Unknown';

    if (!byCategory[category]) {
      byCategory[category] = {
        count: 0,
        avg_faithfulness: 0,
        avg_answer_relevancy: 0,
        avg_context_precision: 0,
        avg_context_recall: 0,
      };
    }

    byCategory[category].count++;
  }

  // Calculate averages per category
  for (const category of Object.keys(byCategory)) {
    const categoryResults = successful.filter(r => {
      const prefix = r.test_case_id.split('_')[0];
      const categoryMap: Record<string, string> = {
        'basica': 'Básica',
        'conceptual': 'Conceptual',
        'relacion': 'Relación',
        'proceso': 'Proceso',
        'comparativa': 'Comparativa',
      };
      return categoryMap[prefix] === category;
    });

    byCategory[category].avg_faithfulness = calculateAverage(categoryResults, 'faithfulness_score');
    byCategory[category].avg_answer_relevancy = calculateAverage(categoryResults, 'answer_relevancy_score');
    byCategory[category].avg_context_precision = calculateAverage(categoryResults, 'context_precision_score');
    byCategory[category].avg_context_recall = calculateAverage(categoryResults, 'context_recall_score');
  }

  return {
    summary: {
      total_cases: results.length,
      successful: successful.length,
      failed: failed.length,
      avg_faithfulness: avgFaithfulness,
      avg_answer_relevancy: avgAnswerRelevancy,
      avg_context_precision: avgContextPrecision,
      avg_context_recall: avgContextRecall,
      avg_latency_ms: avgLatency,
    },
    by_category: byCategory,
    detailed_results: results,
    timestamp: new Date().toISOString(),
  };
}

export async function saveReport(report: EvaluationReport, outputPath: string): Promise<void> {
  const json = JSON.stringify(report, null, 2);
  await Bun.write(outputPath, json);
  console.log(`\n💾 Report saved to: ${outputPath}`);
}

export function printReportSummary(report: EvaluationReport): void {
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

function calculateAverage(results: EvaluationResult[], field: keyof EvaluationResult): number {
  if (results.length === 0) return 0;
  const sum = results.reduce((acc, r) => acc + (r[field] as number || 0), 0);
  return sum / results.length;
}
