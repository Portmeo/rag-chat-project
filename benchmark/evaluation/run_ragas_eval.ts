#!/usr/bin/env bun
import path from 'path';
import { RAGASEvaluator, loadDataset, validateDataset } from '../../apps/evaluation/src';
import { ReportGenerator, printReportSummary } from '../../apps/evaluation/src/reportGenerator';

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

    // Generate comprehensive report
    const reportGenerator = new ReportGenerator();
    const config = {
      bm25_weight: parseFloat(process.env.BM25_WEIGHT || '0.7'),
      vector_weight: parseFloat(process.env.VECTOR_WEIGHT || '0.3'),
      use_reranker: process.env.USE_RERANKER === 'true'
    };

    const report = reportGenerator.generateReport(results, 'golden_qa.json', config);

    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const outputPath = path.join(outputDir, `ragas_${timestamp}.json`);
    await Bun.write(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved to: ${outputPath}`);

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
