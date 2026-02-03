#!/usr/bin/env node
/**
 * RAGAS Evaluation Script
 *
 * Features:
 * - Runs complete evaluation on specified dataset
 * - Generates detailed Markdown and JSON reports
 * - Error analysis and pattern detection
 * - Performance metrics tracking
 * - Shows current RAG configuration from backend .env
 *
 * Usage:
 *   npm run eval
 *   npm run eval -- --limit 5
 *   npx tsx apps/evaluation/src/cli/run-eval.ts [options]
 *
 * Options:
 *   --dataset <name>    Dataset name (default: golden_qa_v2.json)
 *   --output <dir>      Output directory (default: ./benchmark/evaluation/results)
 *   --limit <n>         Limit number of test cases (for quick testing)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { RAGASEvaluator } from '../core/ragasEvaluator';
import { loadDataset, validateDataset } from '../core/datasetLoader';
import { ReportGenerator } from '../core/reportGenerator';
import type { EvaluationResult } from '../core/types';

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

// Get current RAG configuration from backend .env file
async function getRAGConfig(projectRoot: string) {
  const fs = await import('fs/promises');
  const backendEnvPath = path.join(projectRoot, 'apps/backend/.env');

  try {
    const envContent = await fs.readFile(backendEnvPath, 'utf-8');
    const envVars: Record<string, string> = {};

    // Parse .env file
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          // Remove inline comments (everything after #)
          let value = valueParts.join('=').trim();
          const commentIndex = value.indexOf('#');
          if (commentIndex !== -1) {
            value = value.substring(0, commentIndex).trim();
          }
          envVars[key.trim()] = value;
        }
      }
    });

    return {
      bm25_weight: parseFloat(envVars.BM25_WEIGHT || '0.7'),
      vector_weight: parseFloat(envVars.VECTOR_WEIGHT || '0.3'),
      use_reranker: envVars.USE_RERANKER === 'true',
      reranker_retrieval_top_k: parseInt(envVars.RERANKER_RETRIEVAL_TOP_K || '20'),
      reranker_final_top_k: parseInt(envVars.RERANKER_FINAL_TOP_K || '5'),
      min_rerank_score: parseFloat(envVars.MIN_RERANK_SCORE || '0.3'),
      chunk_size: parseInt(envVars.CHUNK_SIZE || '1000'),
      chunk_overlap: parseInt(envVars.CHUNK_OVERLAP || '200'),
      use_bm25_retriever: envVars.USE_BM25_RETRIEVER === 'true',
      use_parent_retriever: envVars.USE_PARENT_RETRIEVER === 'true',
      child_chunk_size: parseInt(envVars.CHILD_CHUNK_SIZE || '200'),
      child_chunk_overlap: parseInt(envVars.CHILD_CHUNK_OVERLAP || '50'),
      parent_chunk_size: parseInt(envVars.PARENT_CHUNK_SIZE || '1000'),
      parent_chunk_overlap: parseInt(envVars.PARENT_CHUNK_OVERLAP || '200'),
    };
  } catch (error) {
    console.error('⚠️  Could not read backend .env, using defaults');
    return {
      bm25_weight: 0.7,
      vector_weight: 0.3,
      use_reranker: false,
      reranker_retrieval_top_k: 20,
      reranker_final_top_k: 5,
      min_rerank_score: 0.3,
      chunk_size: 1000,
      chunk_overlap: 200,
      use_bm25_retriever: false,
      use_parent_retriever: false,
      child_chunk_size: 200,
      child_chunk_overlap: 50,
      parent_chunk_size: 1000,
      parent_chunk_overlap: 200,
    };
  }
}

async function main() {
  const options = parseArgs();

  console.log('\n🚀 RAGAS Comprehensive Benchmark');
  console.log('='.repeat(70));

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = path.resolve(__dirname, '../../../..');

  const datasetPath = path.join(projectRoot, 'benchmark/evaluation/datasets', options.dataset);
  // Use absolute path if provided, otherwise resolve relative to project root
  const outputDir = path.isAbsolute(options.output)
    ? options.output
    : path.join(projectRoot, options.output);

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

    // Get current configuration from backend .env
    const config = await getRAGConfig(projectRoot);
    console.log('\n⚙️  Current RAG Configuration:');
    console.log(`   USE_BM25_RETRIEVER: ${config.use_bm25_retriever ? 'true' : 'false'}`);
    if (config.use_bm25_retriever) {
      console.log(`   BM25 weight: ${config.bm25_weight}`);
      console.log(`   Vector weight: ${config.vector_weight}`);
    }
    console.log(`   USE_RERANKER: ${config.use_reranker ? 'true' : 'false'}`);
    if (config.use_reranker) {
      console.log(`   Reranker retrieval top K: ${config.reranker_retrieval_top_k}`);
      console.log(`   Reranker final top K: ${config.reranker_final_top_k}`);
    }
    console.log(`   USE_PARENT_RETRIEVER: ${config.use_parent_retriever ? 'true' : 'false'}`);
    if (config.use_parent_retriever) {
      console.log(`   Child chunk size: ${config.child_chunk_size} (overlap: ${config.child_chunk_overlap})`);
      console.log(`   Parent chunk size: ${config.parent_chunk_size} (overlap: ${config.parent_chunk_overlap})`);
    } else {
      console.log(`   Chunk size: ${config.chunk_size} (overlap: ${config.chunk_overlap})`);
    }

    // Run evaluation in 2 phases to avoid Ollama saturation
    const evaluator = new RAGASEvaluator('http://localhost:3001', projectRoot);
    const results: EvaluationResult[] = [];

    const startTime = Date.now();

    // ============================================================================
    // PHASE 1: Collect all RAG responses (without RAGAS evaluation)
    // ============================================================================
    console.log(`\n📥 PHASE 1: Collecting RAG responses for ${testCases.length} test cases...`);
    console.log('   (This avoids Ollama saturation by separating RAG queries from RAGAS evaluation)\n');
    console.log('Progress: [' + ' '.repeat(50) + '] 0%');

    const ragResponses: Array<{ testCase: any; response?: any; error?: string }> = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const progress = ((i + 1) / testCases.length * 100).toFixed(0);
      const barLength = Math.floor((i + 1) / testCases.length * 50);
      const bar = '█'.repeat(barLength) + ' '.repeat(50 - barLength);

      process.stdout.write(`\r Progress: [${bar}] ${progress}% - ${testCase.id}` + ' '.repeat(20));

      try {
        const response = await Promise.race([
          evaluator.queryRAG(testCase.question),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`RAG query timeout after 90s`)), 90000)
          )
        ]);
        ragResponses.push({ testCase, response });
      } catch (error: any) {
        console.error(`\n⚠️  RAG query failed for ${testCase.id}: ${error.message}`);
        ragResponses.push({ testCase, error: error.message });
      }
    }

    process.stdout.write('\n\n');

    const phase1Time = Date.now() - startTime;
    const successfulQueries = ragResponses.filter(r => r.response).length;
    console.log(`✅ Phase 1 completed in ${(phase1Time / 1000).toFixed(1)}s`);
    console.log(`   ${successfulQueries}/${testCases.length} RAG queries successful`);
    if (successfulQueries < testCases.length) {
      console.log(`   ⚠️  ${testCases.length - successfulQueries} queries failed (will be marked as errors)`);
    }

    // ============================================================================
    // PHASE 2: Evaluate all responses with RAGAS sequentially
    // ============================================================================
    console.log(`\n📊 PHASE 2: Evaluating ${ragResponses.length} responses with RAGAS metrics...\n`);
    console.log('Progress: [' + ' '.repeat(50) + '] 0%');

    const phase2StartTime = Date.now();

    for (let i = 0; i < ragResponses.length; i++) {
      const { testCase, response, error } = ragResponses[i];
      const progress = ((i + 1) / ragResponses.length * 100).toFixed(0);
      const barLength = Math.floor((i + 1) / ragResponses.length * 50);
      const bar = '█'.repeat(barLength) + ' '.repeat(50 - barLength);

      process.stdout.write(`\r Progress: [${bar}] ${progress}% - ${testCase.id}` + ' '.repeat(20));

      if (error || !response) {
        // Push error result for failed RAG queries
        results.push({
          test_case_id: testCase.id,
          question: testCase.question,
          generated_answer: '',
          retrieved_contexts: [],
          retrieved_sources: [],
          faithfulness_score: 0,
          answer_relevancy_score: 0,
          context_precision_score: 0,
          context_recall_score: 0,
          latency_ms: 90000,
          timestamp: new Date().toISOString(),
          error: error || 'RAG query failed',
        });
        continue;
      }

      try {
        const result = await Promise.race([
          evaluator.evaluateResponse(testCase, response),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`RAGAS evaluation timeout after 150s`)), 150000)
          )
        ]);
        results.push(result);
      } catch (error: any) {
        console.error(`\n❌ RAGAS evaluation failed for ${testCase.id}: ${error.message}`);
        // Push error result for failed RAGAS evaluation
        results.push({
          test_case_id: testCase.id,
          question: testCase.question,
          generated_answer: response.answer || '',
          retrieved_contexts: [],
          retrieved_sources: response.sources?.map((s: any) => s.filename) || [],
          faithfulness_score: 0,
          answer_relevancy_score: 0,
          context_precision_score: 0,
          context_recall_score: 0,
          latency_ms: 150000,
          timestamp: new Date().toISOString(),
          error: error.message,
        });
      }
    }

    process.stdout.write('\n\n');

    const phase2Time = Date.now() - phase2StartTime;
    const totalTime = Date.now() - startTime;

    console.log(`✅ Evaluation completed in ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`   Phase 1 (RAG queries): ${(phase1Time / 1000).toFixed(1)}s`);
    console.log(`   Phase 2 (RAGAS eval): ${(phase2Time / 1000).toFixed(1)}s`);
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
    const { ErrorAnalyzer } = await import('../core/errorAnalyzer');
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
    console.error('Stack trace:', error.stack);
    console.error('Error details:', error);
    process.exit(1);
  }
}

main();
