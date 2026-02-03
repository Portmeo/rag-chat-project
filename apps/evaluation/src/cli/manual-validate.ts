#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { EvaluationReport, UserValidation, IssueType, ValidationSession } from '../core/types.js';
import { formatter } from '../utils/displayFormatters.js';
import { manualValidator } from '../core/manualValidator.js';
import { patternDetector } from '../core/patternDetector.js';
import { reportGenerator } from '../core/validationReport.js';

/**
 * Manual validation CLI tool
 */
class ManualValidationCLI {
  private rl: readline.Interface;
  private resultsDir: string;
  private outputDir: string;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Determine project root and paths
    const projectRoot = this.findProjectRoot();
    this.resultsDir = path.join(projectRoot, 'benchmark/evaluation/results');
    this.outputDir = path.join(this.resultsDir, 'validations');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Find project root directory (the one containing both apps/ and benchmark/ folders)
   */
  private findProjectRoot(): string {
    let currentDir = process.cwd();

    // Look for the directory containing both apps/ and benchmark/
    while (currentDir !== '/') {
      const hasApps = fs.existsSync(path.join(currentDir, 'apps'));
      const hasBenchmark = fs.existsSync(path.join(currentDir, 'benchmark'));

      if (hasApps && hasBenchmark) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }

    // Fallback: look for the directory with benchmark/evaluation/results that has actual files
    currentDir = process.cwd();
    while (currentDir !== '/') {
      const benchmarkDir = path.join(currentDir, 'benchmark/evaluation/results');
      if (fs.existsSync(benchmarkDir)) {
        const files = fs.readdirSync(benchmarkDir);
        // Only consider it the root if it has actual result files
        if (files.some(f => f.startsWith('ragas_') && f.endsWith('.json'))) {
          return currentDir;
        }
      }
      currentDir = path.dirname(currentDir);
    }

    return process.cwd();
  }

  /**
   * Prompt user for input
   */
  private async prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * List available result files
   */
  private listResultFiles(): Array<{ name: string; size: number; date: Date; path: string }> {
    const files = fs
      .readdirSync(this.resultsDir)
      .filter((f) => f.startsWith('ragas_') && f.endsWith('.json'))
      .map((f) => {
        const filepath = path.join(this.resultsDir, f);
        const stats = fs.statSync(filepath);
        return {
          name: f,
          size: stats.size,
          date: stats.mtime,
          path: filepath,
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return files;
  }

  /**
   * Select a result file
   */
  private async selectFile(): Promise<string | null> {
    const files = this.listResultFiles();

    if (files.length === 0) {
      console.log(formatter.colorize('\n❌ No evaluation result files found', 'red'));
      return null;
    }

    console.log(formatter.formatFileMenu(files));

    const answer = await this.prompt(`Select file [1-${files.length}] or 'q' to quit: `);

    if (answer.toLowerCase() === 'q') {
      return null;
    }

    const index = parseInt(answer) - 1;
    if (index >= 0 && index < files.length) {
      return files[index].path;
    }

    console.log(formatter.colorize('Invalid selection', 'red'));
    return this.selectFile();
  }

  /**
   * Load evaluation report from file
   */
  private loadReport(filepath: string): EvaluationReport {
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content) as EvaluationReport;
  }

  /**
   * Validate a single test case
   */
  private async validateCase(
    result: (typeof EvaluationReport.prototype.detailed_results)[0],
    index: number,
    total: number
  ): Promise<UserValidation | null> {
    console.clear();
    console.log(formatter.formatTestCase(result, index, total));

    // Ask if user wants to view full contexts
    if (result.retrieved_contexts.length > 0) {
      const viewContexts = await this.prompt('\nView full contexts? [y/n]: ');
      if (viewContexts.toLowerCase() === 'y') {
        result.retrieved_contexts.forEach((context, i) => {
          console.log(`\n${formatter.colorize(`[${i + 1}] ${result.retrieved_sources[i]}`, 'cyan')}`);
          console.log('─'.repeat(65));
          console.log(context);
          console.log('─'.repeat(65));
        });
        await this.prompt('\nPress Enter to continue...');
        console.clear();
        console.log(formatter.formatTestCase(result, index, total));
      }
    }

    console.log(formatter.formatValidationQuestions());

    // Collect validation
    const isFactuallyCorrect = await this.prompt('1. Factually correct? [y/n/partial]: ');
    if (isFactuallyCorrect.toLowerCase() === 'q') return null;

    const usesOnlyContext = await this.prompt('2. Uses only context? [y/n]: ');
    if (usesOnlyContext.toLowerCase() === 'q') return null;

    const hallucinationsCorrect = await this.prompt(
      '3. Hallucinations correct? [y/n/false-positive]: '
    );
    if (hallucinationsCorrect.toLowerCase() === 'q') return null;

    const contextsRelevant = await this.prompt('4. Contexts relevant? [y/n/partial]: ');
    if (contextsRelevant.toLowerCase() === 'q') return null;

    const qualityRating = await this.prompt('5. Quality rating (1-5): ');
    if (qualityRating.toLowerCase() === 'q') return null;

    const issueTypeInput = await this.prompt('6. Issue type [1-6]: ');
    if (issueTypeInput.toLowerCase() === 'q') return null;

    const notes = await this.prompt('7. Notes (optional): ');

    // Map issue type
    const issueTypeMap: Record<string, IssueType> = {
      '1': 'correct_but_flagged',
      '2': 'missing_context',
      '3': 'wrong_answer',
      '4': 'contradictory_metrics',
      '5': 'timeout_masked',
      '6': 'no_issue',
    };

    const issueType = issueTypeMap[issueTypeInput] || 'no_issue';

    // Parse responses
    const parseYesNoPartial = (input: string): boolean | 'partial' => {
      if (input === 'partial') return 'partial';
      return input.toLowerCase() === 'y';
    };

    const parseHallucination = (input: string): boolean | 'false-positive' => {
      if (input === 'false-positive') return 'false-positive';
      return input.toLowerCase() === 'y';
    };

    const validation: UserValidation = {
      is_factually_correct: parseYesNoPartial(isFactuallyCorrect),
      uses_only_context: usesOnlyContext.toLowerCase() === 'y',
      hallucinations_correct: parseHallucination(hallucinationsCorrect),
      contexts_relevant: parseYesNoPartial(contextsRelevant),
      quality_rating: parseInt(qualityRating) || 3,
      issue_type: issueType,
      notes: notes || undefined,
    };

    console.log(formatter.colorize(`\n✓ Validation recorded for ${result.test_case_id}`, 'green'));
    await this.prompt('\nPress Enter to continue...');

    return validation;
  }

  /**
   * Run the validation session
   */
  async run(): Promise<void> {
    console.clear();
    console.log(formatter.formatHeader('Manual RAGAS Evaluation Validator'));
    console.log('\nThis tool allows you to manually validate RAGAS evaluation results');
    console.log('and identify patterns of failures or inconsistencies.\n');

    // Select file
    const filepath = await this.selectFile();
    if (!filepath) {
      console.log('\nExiting...');
      this.rl.close();
      return;
    }

    // Load report
    let report: EvaluationReport;
    try {
      report = this.loadReport(filepath);
    } catch (error) {
      console.log(formatter.colorize(`\n❌ Error loading file: ${error}`, 'red'));
      this.rl.close();
      return;
    }

    console.log(
      formatter.colorize(
        `\n✓ Loaded: ${path.basename(filepath)} (${report.detailed_results.length} cases)`,
        'green'
      )
    );

    const validateAll = await this.prompt('\nValidate all cases? [y/n]: ');
    if (validateAll.toLowerCase() !== 'y') {
      console.log('\nExiting...');
      this.rl.close();
      return;
    }

    // Validate each case
    const session: ValidationSession = {
      timestamp: new Date().toISOString(),
      result_file: path.basename(filepath),
      total_cases_reviewed: 0,
      validated_cases: [],
      patterns: [],
      recommendations: [],
    };

    for (let i = 0; i < report.detailed_results.length; i++) {
      const result = report.detailed_results[i];
      const validation = await this.validateCase(result, i + 1, report.detailed_results.length);

      if (!validation) {
        console.log('\nValidation cancelled by user.');
        break;
      }

      const validatedCase = manualValidator.createValidatedCase(result, validation);
      session.validated_cases.push(validatedCase);
      session.total_cases_reviewed++;
    }

    // Detect patterns
    console.log('\n\nAnalyzing patterns...');
    session.patterns = patternDetector.detectPatterns(session.validated_cases);

    // Generate reports
    console.log('Generating reports...\n');

    const jsonPath = reportGenerator.saveSessionJson(session, this.outputDir);
    console.log(formatter.colorize(`✓ Session saved: ${path.basename(jsonPath)}`, 'green'));

    const patternPath = reportGenerator.generatePatternReport(session, this.outputDir);
    console.log(formatter.colorize(`✓ Patterns report: ${path.basename(patternPath)}`, 'green'));

    const recommendPath = reportGenerator.generateRecommendationsReport(session, this.outputDir);
    console.log(
      formatter.colorize(`✓ Recommendations: ${path.basename(recommendPath)}`, 'green')
    );

    // Summary
    console.log(
      formatter.formatSummary(
        session.total_cases_reviewed,
        report.detailed_results.length,
        session.patterns.length
      )
    );

    console.log('📄 Reports saved to:');
    console.log(`   ${this.outputDir}\n`);

    // Show pattern summary
    if (session.patterns.length > 0) {
      console.log(formatter.colorize('⚠️  Patterns Detected:', 'yellow'));
      session.patterns.forEach((pattern) => {
        console.log(`   - ${pattern.pattern_name} (${pattern.priority}, ${pattern.frequency} cases)`);
      });
      console.log('');
    }

    this.rl.close();
  }
}

// Run CLI
const cli = new ManualValidationCLI();
cli.run().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
