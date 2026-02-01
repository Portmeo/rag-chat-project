#!/usr/bin/env bun
/**
 * Comprehensive RAGAS Benchmark Runner
 *
 * Features:
 * - Runs complete evaluation on specified dataset
 * - Generates detailed Markdown and JSON reports
 * - Error analysis and pattern detection
 * - Performance metrics tracking
 * - Comparison with previous runs
 *
 * Usage:
 *   bun run benchmark/evaluation/run_full_benchmark.ts [options]
 *
 * Options:
 *   --dataset <path>    Path to dataset (default: golden_qa_v2.json)
 *   --output <dir>      Output directory (default: ./benchmark/evaluation/results)
 *   --limit <n>         Limit number of test cases (for testing)
 */

import path from 'path';
import { RAGASEvaluator, loadDataset, validateDataset, ReportGenerator } from '../../apps/evaluation/src';
import type { EvaluationResult } from '../../apps/evaluation/src';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    options[key] = args[i + 1];
  }

  return {
    dataset: options.dataset || 'golden_qa_v2.json',
    output: options.output || './benchmark/evaluation/results',
    limit: options.limit ? parseInt(options.limit) : undefined
  };
}

// Get current RAG configuration
function getRAGConfig() {
  return {
    bm25_weight: parseFloat(process.env.BM25_WEIGHT || '0.7'),
    vector_weight: parseFloat(process.env.VECTOR_WEIGHT || '0.3'),
    use_reranker: process.env.USE_RERANKER === 'true',
    reranker_retrieval_top_k: parseInt(process.env.RERANKER_RETRIEVAL_TOP_K || '20'),
    reranker_final_top_k: parseInt(process.env.RERANKER_FINAL_TOP_K || '5'),
    min_rerank_score: parseFloat(process.env.MIN_RERANK_SCORE || '0.3'),
    chunk_size: parseInt(process.env.CHUNK_SIZE || '1000'),
    chunk_overlap: parseInt(process.env.CHUNK_OVERLAP || '200'),
  };
}

async function main() {
  const options = parseArgs();

  console.log('\n🚀 RAGAS Comprehensive Benchmark');
  console.log('='.repeat(70));

  const datasetPath = path.join(process.cwd(), 'benchmark/evaluation/datasets', options.dataset);
  const outputDir = path.join(process.cwd(), options.output);

  console.log(`\n📂 Dataset: ${datasetPath}`);
  console.log(`📁 Output directory: ${outputDir}`);
  if (options.limit) {
    console.log(`⚠️  Limiting to ${options.limit} test cases`);
  }

  try {
    // Load and validate dataset
    console.log('\n📥 Loading dataset...');
    const dataset = await loadDataset(datasetPath);
    validateDataset(dataset);

    let testCases = dataset.test_cases;
    if (options.limit) {
      testCases = testCases.slice(0, options.limit);
    }

    console.log(`✅ Loaded ${testCases.length} test cases from ${options.dataset}`);

    // Get current configuration
    const config = getRAGConfig();
    console.log('\n⚙️  Current RAG Configuration:');
    console.log(`   BM25 weight: ${config.bm25_weight}`);
    console.log(`   Vector weight: ${config.vector_weight}`);
    console.log(`   Reranker: ${config.use_reranker ? 'ON' : 'OFF'}`);
    if (config.use_reranker) {
      console.log(`   Reranker retrieval top K: ${config.reranker_retrieval_top_k}`);
      console.log(`   Reranker final top K: ${config.reranker_final_top_k}`);
    }
    console.log(`   Chunk size: ${config.chunk_size}`);

    // Run evaluation
    const evaluator = new RAGASEvaluator();
    const results: EvaluationResult[] = [];

    console.log(`\n🔬 Evaluating ${testCases.length} test cases...\n`);
    console.log('Progress: [' + ' '.repeat(50) + '] 0%');

    const startTime = Date.now();

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const progress = ((i + 1) / testCases.length * 100).toFixed(0);
      const barLength = Math.floor((i + 1) / testCases.length * 50);
      const bar = '█'.repeat(barLength) + ' '.repeat(50 - barLength);

      process.stdout.write(`\r Progress: [${bar}] ${progress}% - ${testCase.id}` + ' '.repeat(20));

      const result = await evaluator.evaluateSingleCase(testCase);
      results.push(result);
    }

    process.stdout.write('\n\n');

    const totalTime = Date.now() - startTime;

    console.log(`✅ Evaluation completed in ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`⚡ Average time per case: ${(totalTime / testCases.length / 1000).toFixed(1)}s`);

    // Generate comprehensive reports
    console.log('\n📊 Generating reports...');
    const reportGenerator = new ReportGenerator();

    const { markdownPath, jsonPath } = await reportGenerator.saveReports(
      results,
      options.dataset,
      config,
      outputDir
    );

    // Print summary to console
    const report = reportGenerator.generateReport(results, options.dataset, config);
    reportGenerator.printReportSummary(report);

    // Calculate additional stats
    console.log('\n📈 Additional Statistics:');
    const avgContextRelevancy = results
      .map(r => r.context_relevancy_score || 0)
      .reduce((a, b) => a + b, 0) / results.length;
    const avgAnswerCorrectness = results
      .map(r => r.answer_correctness_score || 0)
      .reduce((a, b) => a + b, 0) / results.length;
    const avgHallucination = results
      .map(r => r.hallucination_score || 0)
      .reduce((a, b) => a + b, 0) / results.length;

    if (avgContextRelevancy > 0) {
      console.log(`   Context Relevancy: ${(avgContextRelevancy * 100).toFixed(1)}%`);
    }
    if (avgAnswerCorrectness > 0) {
      console.log(`   Answer Correctness: ${(avgAnswerCorrectness * 100).toFixed(1)}%`);
    }
    if (avgHallucination > 0) {
      console.log(`   Hallucination Detection: ${(avgHallucination * 100).toFixed(1)}%`);
    }

    // Count errors by severity
    const { ErrorAnalyzer } = await import('../../apps/evaluation/src/errorAnalyzer');
    const errorAnalyzer = new ErrorAnalyzer();
    const analyses = results.map(r => errorAnalyzer.analyzeResult(r));
    const criticalCount = analyses.filter(a => a.severity === 'critical').length;
    const highCount = analyses.filter(a => a.severity === 'high').length;
    const mediumCount = analyses.filter(a => a.severity === 'medium').length;

    console.log('\n🚨 Error Summary:');
    if (criticalCount > 0) {
      console.log(`   ❌ Critical: ${criticalCount}`);
    }
    if (highCount > 0) {
      console.log(`   ⚠️  High: ${highCount}`);
    }
    if (mediumCount > 0) {
      console.log(`   ⚡ Medium: ${mediumCount}`);
    }
    if (criticalCount === 0 && highCount === 0 && mediumCount === 0) {
      console.log(`   ✅ No significant errors detected!`);
    }

    console.log('\n📄 Reports generated:');
    console.log(`   📝 Markdown: ${markdownPath}`);
    console.log(`   📦 JSON: ${jsonPath}`);

    console.log('\n✅ Benchmark completed successfully!');
    console.log('\n💡 Next steps:');
    console.log(`   1. Review Markdown report: cat "${markdownPath}"`);
    console.log(`   2. Review JSON details: cat "${jsonPath}" | jq`);
    if (criticalCount > 0 || highCount > 0) {
      console.log(`   3. Address ${criticalCount + highCount} critical/high priority issues`);
    }

  } catch (error: any) {
    console.error('\n❌ Benchmark failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
