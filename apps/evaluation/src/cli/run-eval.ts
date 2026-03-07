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
import { createLogger } from '../lib/logger';
import type { EvaluationResult } from '../core/types';

const logger = createLogger('EVAL');
const log = (msg: string) => console.log(`[EVAL] ${msg}`);

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
    limit: options.limit ? parseInt(options.limit) : undefined,
    judge: (options.judge || 'ollama') as 'ollama' | 'claude' | 'sonnet',
    categories: options.categories ? options.categories.split(',').map(c => c.trim()) : undefined,
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

    // Expose API keys to process.env for evaluator constructors
    if (envVars.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = envVars.ANTHROPIC_API_KEY;

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


  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = path.resolve(__dirname, '../../../..');

  const datasetPath = path.join(projectRoot, 'benchmark/evaluation/datasets', options.dataset);
  // Use absolute path if provided, otherwise resolve relative to project root
  const outputDir = path.isAbsolute(options.output)
    ? options.output
    : path.join(projectRoot, options.output);

  try {
    // Load and validate dataset
    const dataset = await loadDataset(datasetPath);
    validateDataset(dataset);

    let testCases = dataset.test_cases;
    if (options.categories) {
      testCases = testCases.filter(tc => options.categories!.some(c => tc.category.toLowerCase().includes(c.toLowerCase())));
    }
    if (options.limit) {
      testCases = testCases.slice(0, options.limit);
    }

    log(`Dataset: ${options.dataset} — ${testCases.length} casos | Judge: ${options.judge}${options.categories ? ` | Categorías: ${options.categories.join(',')}` : ''}`);

    // Get current configuration from backend .env
    const config = await getRAGConfig(projectRoot);
    log(`Config: BM25=${config.use_bm25_retriever} | Reranker=${config.use_reranker} | ParentRetriever=${config.use_parent_retriever}`);

    // Run evaluation in 2 phases to avoid Ollama saturation
    const evaluator = new RAGASEvaluator('http://localhost:3001', projectRoot, options.judge as any);
    const results: EvaluationResult[] = [];

    // ============================================================================
    // PHASE 1: Collect all RAG responses (without RAGAS evaluation)
    // ============================================================================

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
        ragResponses.push({ testCase, error: error.message });
      }
    }

    process.stdout.write('\n\n');

    const failed = ragResponses.filter(r => r.error).length;
    if (failed > 0) logger.warn(`Phase 1: ${failed}/${testCases.length} queries fallaron`);

    // ============================================================================
    // PHASE 2: Evaluate all responses with RAGAS sequentially
    // ============================================================================

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

    // Generate reports
    const reportGenerator = new ReportGenerator();
    const { markdownPath, jsonPath } = await reportGenerator.saveReports(results, options.dataset, config, outputDir);

    // Print summary to console
    const report = reportGenerator.generateReport(results, options.dataset, config);
    reportGenerator.printReportSummary(report);

    // Extra stats behind EVAL_LOGS
    const avgHallucination = results.map(r => r.hallucination_score || 0).reduce((a, b) => a + b, 0) / results.length;
    const avgCorrectness = results.map(r => r.answer_correctness_score || 0).reduce((a, b) => a + b, 0) / results.length;
    logger.log(`Hallucination avg: ${avgHallucination.toFixed(2)} | Answer correctness avg: ${avgCorrectness.toFixed(2)}`);

    log(`Reportes guardados:\n  MD:   ${markdownPath}\n  JSON: ${jsonPath}`);

  } catch (error: any) {
    console.error('[EVAL] Error:', error.message);
    process.exit(1);
  }
}

main();
