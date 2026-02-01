#!/usr/bin/env bun
/**
 * RAG Optimization Benchmark Orchestrator
 *
 * Runs comprehensive benchmarks across 8 different optimization configurations:
 * - baseline: Vector search only
 * - bm25: BM25 ensemble (70/30)
 * - rerank: Cross-encoder reranking
 * - parent: Parent document retriever
 * - bm25-rerank: BM25 + Reranking
 * - bm25-parent: BM25 + Parent
 * - rerank-parent: Reranking + Parent
 * - full: All optimizations enabled
 *
 * Each configuration is tested on 16 queries across 5 categories.
 *
 * Usage:
 *   bun run benchmark/evaluation/run_optimization_benchmark.ts [options]
 *
 * Options:
 *   --configs <list>    Comma-separated list of configs (default: all 8)
 *   --dataset <name>    Dataset name (default: rag-optimization-benchmark.json)
 *   --skip-comparison   Skip comparison report generation
 *
 * Examples:
 *   # Run all configurations
 *   bun run benchmark/evaluation/run_optimization_benchmark.ts
 *
 *   # Run only baseline and full
 *   bun run benchmark/evaluation/run_optimization_benchmark.ts --configs baseline,full
 *
 *   # Use custom dataset
 *   bun run benchmark/evaluation/run_optimization_benchmark.ts --dataset golden_qa_v2.json
 */

import path from 'path';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  applyConfig,
  type OptimizationConfig,
  ALL_CONFIGS,
  getConfigDescription,
} from '../../apps/evaluation/src/configManager.js';

const execAsync = promisify(exec);

interface BenchmarkOptions {
  configs: OptimizationConfig[];
  dataset: string;
  skipComparison: boolean;
}

function parseArgs(): BenchmarkOptions {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace(/^--/, '');
      if (key === 'skip-comparison') {
        options[key] = 'true';
      } else if (i + 1 < args.length) {
        options[key] = args[i + 1];
        i++;
      }
    }
  }

  const configs = options.configs
    ? (options.configs.split(',') as OptimizationConfig[])
    : ALL_CONFIGS;

  return {
    configs,
    dataset: options.dataset || 'rag-optimization-benchmark.json',
    skipComparison: options['skip-comparison'] === 'true',
  };
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

async function runBenchmarkForConfig(
  config: OptimizationConfig,
  dataset: string,
  resultsDir: string
): Promise<{ success: boolean; resultFile: string; duration: number }> {
  const startTime = Date.now();

  try {
    // Generate timestamp for this run
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const tempResultsDir = path.join(resultsDir, 'temp');

    // Ensure temp directory exists
    await fs.mkdir(tempResultsDir, { recursive: true });

    // Run the benchmark
    const benchmarkCmd = `bun run ${path.join(
      process.cwd(),
      'benchmark/evaluation/run_full_benchmark.ts'
    )} --dataset ${dataset} --output ${tempResultsDir}`;

    console.log(`\n🚀 Running benchmark...`);
    console.log(`   Command: ${benchmarkCmd}\n`);

    const { stdout, stderr } = await execAsync(benchmarkCmd);

    // Print the output
    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }

    // Find the generated files in temp directory
    const files = await fs.readdir(tempResultsDir);
    const jsonFile = files.find((f) => f.endsWith('.json'));
    const mdFile = files.find((f) => f.endsWith('.md'));

    if (!jsonFile || !mdFile) {
      throw new Error('Benchmark did not generate expected output files');
    }

    // Move files to main results directory with config prefix
    const finalJsonFile = path.join(resultsDir, `${config}_${timestamp}.json`);
    const finalMdFile = path.join(resultsDir, `${config}_${timestamp}.md`);

    await fs.rename(path.join(tempResultsDir, jsonFile), finalJsonFile);
    await fs.rename(path.join(tempResultsDir, mdFile), finalMdFile);

    // Clean up temp directory
    await fs.rm(tempResultsDir, { recursive: true, force: true });

    const duration = Date.now() - startTime;

    console.log(`\n✅ ${config} benchmark completed in ${formatDuration(duration)}`);
    console.log(`📦 Results saved:`);
    console.log(`   JSON: ${finalJsonFile}`);
    console.log(`   MD:   ${finalMdFile}`);

    return { success: true, resultFile: finalJsonFile, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ ${config} benchmark failed:`, error.message);
    return { success: false, resultFile: '', duration };
  }
}

async function main() {
  const options = parseArgs();
  const resultsDir = path.join(process.cwd(), 'benchmark/evaluation/results');

  console.log('\n' + '='.repeat(70));
  console.log('🎯 RAG OPTIMIZATION BENCHMARK SUITE');
  console.log('='.repeat(70));

  console.log(`\n📋 Configuration:`);
  console.log(`   Configurations to test: ${options.configs.length}`);
  console.log(`   Dataset: ${options.dataset}`);
  console.log(`   Results directory: ${resultsDir}`);
  console.log(`   Skip comparison: ${options.skipComparison}`);

  console.log(`\n🔧 Configurations to benchmark:`);
  options.configs.forEach((config, index) => {
    console.log(`   ${index + 1}. ${config.padEnd(15)} - ${getConfigDescription(config)}`);
  });

  // Ensure results directory exists
  await fs.mkdir(resultsDir, { recursive: true });

  const startTime = Date.now();
  const configResults = new Map<string, { success: boolean; file: string; duration: number }>();

  // Run benchmarks for each configuration
  for (let i = 0; i < options.configs.length; i++) {
    const config = options.configs[i];

    console.log('\n' + '='.repeat(70));
    console.log(`🔧 CONFIGURATION ${i + 1}/${options.configs.length}: ${config.toUpperCase()}`);
    console.log(`   ${getConfigDescription(config)}`);
    console.log('='.repeat(70));

    try {
      // Apply configuration
      await applyConfig(config);

      // Run benchmark
      const result = await runBenchmarkForConfig(config, options.dataset, resultsDir);
      configResults.set(config, {
        success: result.success,
        file: result.resultFile,
        duration: result.duration,
      });

      if (!result.success) {
        console.log(`\n⚠️  Skipping remaining configurations due to failure`);
        break;
      }
    } catch (error: any) {
      console.error(`\n❌ Failed to process ${config}:`, error.message);
      configResults.set(config, { success: false, file: '', duration: 0 });
      break;
    }
  }

  const totalDuration = Date.now() - startTime;

  console.log('\n' + '='.repeat(70));
  console.log('📊 BENCHMARK SUITE COMPLETED');
  console.log('='.repeat(70));

  console.log(`\n⏱️  Total time: ${formatDuration(totalDuration)}`);

  console.log(`\n📈 Results summary:`);
  let successCount = 0;
  configResults.forEach((result, config) => {
    const status = result.success ? '✅' : '❌';
    const duration = result.duration > 0 ? formatDuration(result.duration) : 'N/A';
    console.log(`   ${status} ${config.padEnd(15)} - ${duration}`);
    if (result.success) successCount++;
  });

  console.log(`\n🎯 Success rate: ${successCount}/${configResults.size}`);

  // Generate comparison report if not skipped
  if (!options.skipComparison && successCount > 1) {
    console.log('\n📊 Generating comparison report...');

    try {
      const comparisonCmd = `bun run ${path.join(
        process.cwd(),
        'benchmark/evaluation/generateComparisonReport.ts'
      )}`;

      await execAsync(comparisonCmd);
      console.log('✅ Comparison report generated!');
      console.log(
        `   📄 ${path.join(resultsDir, 'comparison-report.md')}`
      );
    } catch (error: any) {
      console.error('❌ Failed to generate comparison report:', error.message);
    }
  } else if (successCount <= 1) {
    console.log('\n⚠️  Skipping comparison report (need at least 2 successful runs)');
  }

  console.log('\n📁 All results saved to:', resultsDir);
  console.log('\n💡 Next steps:');
  console.log(`   1. Review individual reports in ${resultsDir}`);
  if (!options.skipComparison && successCount > 1) {
    console.log(`   2. Check comparison report: cat ${path.join(resultsDir, 'comparison-report.md')}`);
  }
  console.log(
    `   3. Analyze JSON data: ls ${resultsDir}/*.json | xargs jq '.summary'`
  );

  console.log('\n✅ Done!\n');

  if (successCount < configResults.size) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
