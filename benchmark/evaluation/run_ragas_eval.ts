#!/usr/bin/env bun
import path from 'path';
import { RAGASEvaluator } from '../../apps/backend/src/services/evaluation/ragasEvaluator';
import { loadDataset, validateDataset } from '../../apps/backend/src/services/evaluation/datasetLoader';
import { generateReport, saveReport, printReportSummary } from '../../apps/backend/src/services/evaluation/reportGenerator';

async function main() {
  console.log('\n🚀 RAGAS Evaluation CLI');
  console.log('='.repeat(60));

  const datasetPath = path.join(process.cwd(), 'benchmark/evaluation/datasets/golden_qa.json');
  const outputDir = path.join(process.cwd(), 'benchmark/evaluation/results');

  console.log(`\n📂 Dataset: ${datasetPath}`);
  console.log(`📁 Output directory: ${outputDir}`);

  try {
    // Load and validate dataset
    const dataset = await loadDataset(datasetPath);
    validateDataset(dataset);

    // Run evaluation
    const evaluator = new RAGASEvaluator();
    const results = [];

    console.log(`\n🔬 Evaluating ${dataset.test_cases.length} test cases...\n`);

    const startTime = Date.now();

    for (let i = 0; i < dataset.test_cases.length; i++) {
      const testCase = dataset.test_cases[i];
      console.log(`[${i + 1}/${dataset.test_cases.length}] ${testCase.id}`);

      const result = await evaluator.evaluateSingleCase(testCase);
      results.push(result);
    }

    const totalTime = Date.now() - startTime;

    // Generate report
    const report = generateReport(results);

    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const outputPath = path.join(outputDir, `ragas_${timestamp}.json`);
    await saveReport(report, outputPath);

    // Print summary
    printReportSummary(report);

    console.log(`\n⏱️  Total evaluation time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`⚡ Average time per case: ${(totalTime / dataset.test_cases.length / 1000).toFixed(1)}s`);

    console.log('\n✅ Evaluation completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Evaluation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
