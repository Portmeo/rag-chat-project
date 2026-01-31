import path from 'path';
import { existsSync } from 'fs';
import { RAGASEvaluator } from '../services/evaluation/ragasEvaluator';
import { loadDataset, validateDataset } from '../services/evaluation/datasetLoader';
import { generateReport, saveReport, printReportSummary } from '../services/evaluation/reportGenerator';

// Find project root by looking for package.json
function findProjectRoot(): string {
  let currentDir = process.cwd();

  // Try going up from apps/backend
  const possibleRoots = [
    path.resolve(currentDir, '../..'),  // From apps/backend
    path.resolve(currentDir, '..'),     // From apps
    currentDir,                          // Already at root
  ];

  for (const root of possibleRoots) {
    const datasetPath = path.join(root, 'benchmark/evaluation/datasets/golden_qa.json');
    if (existsSync(datasetPath)) {
      return root;
    }
  }

  // Fallback to 2 levels up
  return path.resolve(currentDir, '../..');
}

export async function runEvaluation({ body, set }: any) {
  try {
    const projectRoot = findProjectRoot();
    const {
      datasetPath = path.join(projectRoot, 'benchmark/evaluation/datasets/golden_qa.json'),
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
        projectRoot,
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
