#!/usr/bin/env node
/**
 * Comparison Report Generator
 *
 * Generates comprehensive comparison reports across multiple RAG configurations.
 * Reads all config-prefixed JSON files in the results directory and produces:
 * - Markdown comparison report with tables and insights
 * - JSON data file for visualization
 *
 * Usage:
 *   npx tsx benchmark/evaluation/generateComparisonReport.ts [options]
 *
 * Options:
 *   --results-dir <path>   Results directory (default: ./benchmark/evaluation/results)
 *   --output <name>        Output filename prefix (default: comparison-report)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promises as fs } from 'fs';

interface ConfigResult {
  config: string;
  timestamp: string;
  summary: {
    total_cases: number;
    avg_faithfulness: number;
    avg_answer_relevancy: number;
    avg_context_precision: number;
    avg_context_recall: number;
    avg_context_relevancy?: number;
    avg_answer_correctness?: number;
    avg_hallucination?: number;
    avg_total_latency_ms: number;
    avg_retrieval_latency_ms: number;
    avg_reranking_latency_ms?: number;
    avg_generation_latency_ms: number;
  };
  by_category?: Record<string, any>;
  results?: any[];
}

function parseConfigFromFilename(filename: string): string | null {
  const match = filename.match(/^([a-z\-]+)_\d{4}-\d{2}-\d{2}/);
  return match ? match[1] : null;
}

async function loadConfigResults(resultsDir: string): Promise<Map<string, ConfigResult>> {
  const files = await fs.readdir(resultsDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.startsWith('comparison'));

  const results = new Map<string, ConfigResult>();

  for (const file of jsonFiles) {
    const config = parseConfigFromFilename(file);
    if (!config) continue;

    // If we already have a result for this config, skip (use most recent only)
    if (results.has(config)) continue;

    const filePath = path.join(resultsDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    results.set(config, {
      config,
      timestamp: file,
      summary: data.summary,
      by_category: data.by_category,
      results: data.results,
    });
  }

  return results;
}

function calculateQualityScore(summary: ConfigResult['summary']): number {
  // Composite quality score: average of key metrics
  const metrics = [
    summary.avg_faithfulness,
    summary.avg_answer_relevancy,
    summary.avg_context_precision,
  ];

  return metrics.reduce((a, b) => a + b, 0) / metrics.length;
}

function calculateDelta(value: number, baseline: number): string {
  if (baseline === 0) return 'N/A';
  const delta = ((value - baseline) / baseline) * 100;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

function generateMarkdownReport(
  results: Map<string, ConfigResult>,
  baselineConfig: string = 'baseline'
): string {
  const md: string[] = [];

  md.push('# RAG Optimization Benchmark - Comparison Report\n');
  md.push(`**Generated:** ${new Date().toISOString()}\n`);
  md.push(`**Configurations tested:** ${results.size}\n`);
  md.push('---\n');

  // Get baseline for comparisons
  const baseline = results.get(baselineConfig);
  if (!baseline) {
    md.push('⚠️  Warning: No baseline configuration found for comparison\n\n');
  }

  // Summary Table
  md.push('## 📊 Summary Comparison\n\n');
  md.push('| Config | Faithfulness | Answer Rel. | Context Prec. | Context Rec. | Avg Latency | Δ Quality | Δ Latency |\n');
  md.push('|--------|--------------|-------------|---------------|--------------|-------------|-----------|-----------|');

  const configOrder = [
    'baseline',
    'bm25',
    'rerank',
    'parent',
    'bm25-rerank',
    'bm25-parent',
    'rerank-parent',
    'full',
  ];

  const sortedConfigs = Array.from(results.entries()).sort((a, b) => {
    const indexA = configOrder.indexOf(a[0]);
    const indexB = configOrder.indexOf(b[0]);
    if (indexA === -1 && indexB === -1) return a[0].localeCompare(b[0]);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  for (const [config, result] of sortedConfigs) {
    const s = result.summary;
    const quality = calculateQualityScore(s);
    const latency = s.avg_total_latency_ms;

    let deltaQuality = '-';
    let deltaLatency = '-';

    if (baseline && config !== baselineConfig) {
      const baselineQuality = calculateQualityScore(baseline.summary);
      const baselineLatency = baseline.summary.avg_total_latency_ms;
      deltaQuality = calculateDelta(quality, baselineQuality);
      deltaLatency = calculateDelta(latency, baselineLatency);
    }

    md.push(
      `| ${config.padEnd(12)} | ${(s.avg_faithfulness * 100).toFixed(1)}% | ${(
        s.avg_answer_relevancy * 100
      ).toFixed(1)}% | ${(s.avg_context_precision * 100).toFixed(1)}% | ${(
        s.avg_context_recall * 100
      ).toFixed(1)}% | ${latency.toFixed(0)}ms | ${deltaQuality} | ${deltaLatency} |`
    );
  }

  md.push('\n');

  // Detailed Metrics
  md.push('## 📈 Detailed Metrics\n\n');

  for (const [config, result] of sortedConfigs) {
    const s = result.summary;
    md.push(`### ${config}\n\n`);
    md.push('**Quality Metrics:**\n');
    md.push(`- Faithfulness: ${(s.avg_faithfulness * 100).toFixed(1)}%\n`);
    md.push(`- Answer Relevancy: ${(s.avg_answer_relevancy * 100).toFixed(1)}%\n`);
    md.push(`- Context Precision: ${(s.avg_context_precision * 100).toFixed(1)}%\n`);
    md.push(`- Context Recall: ${(s.avg_context_recall * 100).toFixed(1)}%\n`);
    if (s.avg_context_relevancy) {
      md.push(`- Context Relevancy: ${(s.avg_context_relevancy * 100).toFixed(1)}%\n`);
    }
    if (s.avg_answer_correctness) {
      md.push(`- Answer Correctness: ${(s.avg_answer_correctness * 100).toFixed(1)}%\n`);
    }
    if (s.avg_hallucination) {
      md.push(`- Hallucination Score: ${(s.avg_hallucination * 100).toFixed(1)}%\n`);
    }

    md.push('\n**Performance Metrics:**\n');
    md.push(`- Total Latency: ${s.avg_total_latency_ms.toFixed(0)}ms\n`);
    md.push(`- Retrieval Latency: ${s.avg_retrieval_latency_ms.toFixed(0)}ms\n`);
    if (s.avg_reranking_latency_ms) {
      md.push(`- Reranking Latency: ${s.avg_reranking_latency_ms.toFixed(0)}ms\n`);
    }
    md.push(`- Generation Latency: ${s.avg_generation_latency_ms.toFixed(0)}ms\n`);
    md.push('\n');
  }

  // Performance by Category
  md.push('## 🎯 Performance by Category\n\n');

  const categories = ['Básica', 'Conceptual', 'Relación', 'Proceso', 'Comparativa'];
  const categoryResults = new Map<string, Map<string, any>>();

  for (const [config, result] of results.entries()) {
    if (!result.by_category) continue;

    for (const category of categories) {
      if (!categoryResults.has(category)) {
        categoryResults.set(category, new Map());
      }
      categoryResults.get(category)!.set(config, result.by_category[category]);
    }
  }

  for (const category of categories) {
    const catResults = categoryResults.get(category);
    if (!catResults) continue;

    md.push(`### ${category}\n\n`);
    md.push('| Config | Faithfulness | Context Precision | Avg Latency |\n');
    md.push('|--------|--------------|-------------------|-------------|');

    for (const [config] of sortedConfigs) {
      const catData = catResults.get(config);
      if (!catData) continue;

      md.push(
        `| ${config.padEnd(12)} | ${(catData.avg_faithfulness * 100).toFixed(1)}% | ${(
          catData.avg_context_precision * 100
        ).toFixed(1)}% | ${catData.avg_total_latency_ms.toFixed(0)}ms |`
      );
    }

    md.push('\n');
  }

  // Insights
  md.push('## 💡 Key Insights\n\n');

  if (baseline) {
    const baselineQuality = calculateQualityScore(baseline.summary);
    const baselineLatency = baseline.summary.avg_total_latency_ms;

    // Find best quality
    let bestQualityConfig = baselineConfig;
    let bestQuality = baselineQuality;

    for (const [config, result] of results.entries()) {
      const quality = calculateQualityScore(result.summary);
      if (quality > bestQuality) {
        bestQuality = quality;
        bestQualityConfig = config;
      }
    }

    // Find best latency
    let bestLatencyConfig = baselineConfig;
    let bestLatency = baselineLatency;

    for (const [config, result] of results.entries()) {
      const latency = result.summary.avg_total_latency_ms;
      if (latency < bestLatency) {
        bestLatency = latency;
        bestLatencyConfig = config;
      }
    }

    md.push(`**Best Quality:** ${bestQualityConfig} (${(bestQuality * 100).toFixed(1)}%)\n`);
    md.push(`**Best Performance:** ${bestLatencyConfig} (${bestLatency.toFixed(0)}ms)\n\n`);

    // Quality/Latency trade-off
    md.push('**Quality vs Latency Trade-off:**\n\n');
    for (const [config, result] of sortedConfigs) {
      if (config === baselineConfig) continue;

      const quality = calculateQualityScore(result.summary);
      const latency = result.summary.avg_total_latency_ms;

      const qualityDelta = ((quality - baselineQuality) / baselineQuality) * 100;
      const latencyDelta = ((latency - baselineLatency) / baselineLatency) * 100;

      const qualityPerLatency = qualityDelta / (latencyDelta || 1);

      md.push(
        `- **${config}**: ${qualityDelta > 0 ? '+' : ''}${qualityDelta.toFixed(
          1
        )}% quality, ${latencyDelta > 0 ? '+' : ''}${latencyDelta.toFixed(
          1
        )}% latency (efficiency: ${qualityPerLatency.toFixed(2)})\n`
      );
    }

    md.push('\n');
  }

  // Optimization Impact
  md.push('## 🔧 Optimization Impact\n\n');

  const optimizations = new Map<string, { configs: string[]; avgDelta: number }>();

  if (baseline) {
    const bm25Configs = Array.from(results.keys()).filter((c) => c.includes('bm25'));
    const rerankConfigs = Array.from(results.keys()).filter((c) => c.includes('rerank'));
    const parentConfigs = Array.from(results.keys()).filter((c) => c.includes('parent'));

    const baselineQuality = calculateQualityScore(baseline.summary);

    for (const [name, configs] of [
      ['BM25 Ensemble', bm25Configs],
      ['Reranking', rerankConfigs],
      ['Parent Retriever', parentConfigs],
    ]) {
      if (configs.length === 0) continue;

      const deltas = configs.map((c) => {
        const result = results.get(c);
        if (!result) return 0;
        const quality = calculateQualityScore(result.summary);
        return ((quality - baselineQuality) / baselineQuality) * 100;
      });

      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

      md.push(
        `**${name}**: Average ${avgDelta > 0 ? '+' : ''}${avgDelta.toFixed(
          1
        )}% quality improvement\n`
      );
      md.push(`- Used in: ${configs.join(', ')}\n\n`);
    }
  }

  md.push('---\n');
  md.push('*Report generated by RAG Optimization Benchmark Suite*\n');

  return md.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    options[key] = args[i + 1];
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = path.resolve(__dirname, '../../../..');

  const resultsDir =
    options['results-dir'] ||
    path.join(projectRoot, 'benchmark/evaluation/results');
  const outputPrefix = options.output || 'comparison-report';

  console.log('\n📊 Generating Comparison Report');
  console.log('='.repeat(70));
  console.log(`\n📂 Results directory: ${resultsDir}`);

  try {
    // Load all config results
    console.log('\n📥 Loading results...');
    const results = await loadConfigResults(resultsDir);

    console.log(`✅ Loaded ${results.size} configurations:`);
    for (const config of results.keys()) {
      console.log(`   - ${config}`);
    }

    if (results.size === 0) {
      console.log('\n❌ No results found. Run benchmarks first.');
      process.exit(1);
    }

    // Generate markdown report
    console.log('\n📝 Generating Markdown report...');
    const markdown = generateMarkdownReport(results);
    const markdownPath = path.join(resultsDir, `${outputPrefix}.md`);
    await fs.writeFile(markdownPath, markdown, 'utf-8');
    console.log(`✅ Markdown report saved: ${markdownPath}`);

    // Generate JSON data
    console.log('\n📦 Generating JSON data...');
    const jsonData = {
      generated_at: new Date().toISOString(),
      configurations: Array.from(results.entries()).map(([config, result]) => ({
        config,
        summary: result.summary,
        by_category: result.by_category,
      })),
    };

    const jsonPath = path.join(resultsDir, `${outputPrefix}-data.json`);
    await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
    console.log(`✅ JSON data saved: ${jsonPath}`);

    console.log('\n✅ Comparison report generation completed!');
    console.log('\n📄 Generated files:');
    console.log(`   📝 ${markdownPath}`);
    console.log(`   📦 ${jsonPath}`);

    console.log('\n💡 View the report:');
    console.log(`   cat "${markdownPath}"`);
  } catch (error: any) {
    console.error('\n❌ Failed to generate comparison report:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
