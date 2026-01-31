import path from 'path';
import { RAGASEvaluator } from '../services/evaluation/ragasEvaluator';
import { loadDataset, validateDataset } from '../services/evaluation/datasetLoader';
import { generateReport, saveReport, printReportSummary } from '../services/evaluation/reportGenerator';

export async function runEvaluation({ body, set }: any) {
  try {
    const {
      datasetPath = path.join(process.cwd(), 'benchmark/evaluation/datasets/golden_qa.json'),
      saveResults = true,
    } = body || {};

    console.log('\n🚀 Starting RAGAS evaluation...');
    console.log(`📂 Dataset: ${datasetPath}`);

    // Load and validate dataset
    const dataset = await loadDataset(datasetPath);
    validateDataset(dataset);

    // Run evaluation
    const evaluator = new RAGASEvaluator();
    const results = [];

    console.log(`\n🔬 Evaluating ${dataset.test_cases.length} test cases...\n`);

    for (const testCase of dataset.test_cases) {
      const result = await evaluator.evaluateSingleCase(testCase);
      results.push(result);
    }

    // Generate report
    const report = generateReport(results);

    // Save results if requested
    if (saveResults) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const outputPath = path.join(
        process.cwd(),
        'benchmark/evaluation/results',
        `ragas_${timestamp}.json`
      );
      await saveReport(report, outputPath);
    }

    // Print summary
    printReportSummary(report);

    return {
      success: true,
      summary: report.summary,
      by_category: report.by_category,
      detailed_results: report.detailed_results,
    };
  } catch (error: any) {
    console.error('❌ Evaluation failed:', error);
    set.status = 500;
    return {
      success: false,
      error: error.message,
    };
  }
}
