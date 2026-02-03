import { EvaluationResult } from '../core/types.js';

/**
 * Terminal display formatting utilities
 */
export class DisplayFormatters {
  /**
   * Colors for terminal output
   */
  private colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
  };

  /**
   * Format a header box
   */
  formatHeader(text: string): string {
    const width = 65;
    const line = '═'.repeat(width);
    const padding = Math.floor((width - text.length) / 2);
    const paddedText = ' '.repeat(padding) + text + ' '.repeat(padding);

    return `\n${line}\n${paddedText}\n${line}\n`;
  }

  /**
   * Format a section header
   */
  formatSection(icon: string, title: string): string {
    return `\n${this.colors.bright}${icon} ${title}${this.colors.reset}\n`;
  }

  /**
   * Format a progress bar
   */
  formatProgressBar(value: number, maxValue: number = 1): string {
    const percentage = Math.min(value / maxValue, 1);
    const barLength = 12;
    const filledLength = Math.round(barLength * percentage);
    const emptyLength = barLength - filledLength;

    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);

    let color = this.colors.green;
    if (percentage < 0.5) color = this.colors.red;
    else if (percentage < 0.7) color = this.colors.yellow;

    return `${color}${filled}${empty}${this.colors.reset}`;
  }

  /**
   * Format a score with bar and status
   */
  formatScore(label: string, value: number, threshold: number = 0.7): string {
    const bar = this.formatProgressBar(value);
    const status = value >= threshold ? '✓' : '⚠️';
    const statusText = value >= threshold ? 'Good' : 'BELOW THRESHOLD';

    return `  ${label.padEnd(20)} ${bar} ${value.toFixed(2)} ${status}  ${statusText}`;
  }

  /**
   * Format test case details
   */
  formatTestCase(result: EvaluationResult, index: number, total: number): string {
    let output = this.formatHeader(`Test Case ${index}/${total}: ${result.test_case_id}`);

    // Question and answer
    output += this.formatSection('📝', 'QUESTION:');
    output += `${result.question}\n`;

    output += this.formatSection('🤖', 'GENERATED ANSWER:');
    if (result.generated_answer) {
      output += `${result.generated_answer}\n`;
    } else {
      output += `${this.colors.dim}(empty response)${this.colors.reset}\n`;
    }

    // Contexts
    output += this.formatSection(
      '📚',
      `RETRIEVED CONTEXTS: ${result.retrieved_contexts.length} documents`
    );

    if (result.retrieved_contexts.length === 0) {
      output += `${this.colors.red}⚠️  NO CONTEXTS RETRIEVED${this.colors.reset}\n`;
    } else {
      result.retrieved_contexts.forEach((context, i) => {
        const source = result.retrieved_sources[i] || 'unknown';
        output += `\n  ${this.colors.cyan}[${i + 1}] ${source}${this.colors.reset} (${context.length} chars)\n`;

        // Show preview (first 200 chars)
        const preview = context.substring(0, 200).replace(/\n/g, ' ');
        output += `      ${this.colors.dim}Preview: ${preview}...${this.colors.reset}\n`;
      });
    }

    // Metrics
    output += this.formatSection('📊', 'METRICS:');
    output += this.formatScore('Faithfulness:', result.faithfulness_score);
    output += '\n';
    output += this.formatScore('Answer Relevancy:', result.answer_relevancy_score);
    output += '\n';
    output += this.formatScore('Context Precision:', result.context_precision_score);
    output += '\n';
    output += this.formatScore('Context Recall:', result.context_recall_score);
    output += '\n';

    if (result.hallucination_score !== undefined) {
      // Lower is better for hallucination
      const bar = this.formatProgressBar(result.hallucination_score);
      const status = result.hallucination_score < 0.3 ? '✓' : '⚠️';
      const statusText = result.hallucination_score < 0.3 ? 'Good' : 'HIGH';
      output += `  ${'Hallucination Score:'.padEnd(20)} ${bar} ${result.hallucination_score.toFixed(2)} ${status}  ${statusText}\n`;
    }

    // Hallucinations detected
    if (
      result.hallucinations_detected &&
      result.hallucinations_detected.length > 0
    ) {
      output += `\n${this.colors.yellow}⚠️  HALLUCINATIONS DETECTED (${result.hallucinations_detected.length}):${this.colors.reset}\n`;
      result.hallucinations_detected.forEach((hal, i) => {
        output += `  ${i + 1}. "${hal}"\n`;
      });
    }

    // Errors
    if (result.error) {
      output += `\n${this.colors.red}❌ ERROR: ${result.error}${this.colors.reset}\n`;
    }

    output += '\n' + '─'.repeat(65) + '\n';

    return output;
  }

  /**
   * Format validation questions
   */
  formatValidationQuestions(): string {
    let output = this.formatSection('❓', 'MANUAL VALIDATION');
    output += '\n';
    output += '1. Is the generated answer FACTUALLY CORRECT?\n';
    output += '   Enter: y (yes) / n (no) / partial\n\n';
    output += '2. Does the answer use ONLY information from contexts?\n';
    output += '   Enter: y (yes) / n (no)\n\n';
    output += '3. Are the hallucinations marked correctly?\n';
    output += '   Enter: y (yes) / n (no) / false-positive\n\n';
    output += '4. Were relevant contexts retrieved?\n';
    output += '   Enter: y (yes) / n (no) / partial\n\n';
    output += '5. Rate answer quality (1-5):\n';
    output += '   1=Very Poor, 2=Poor, 3=Acceptable, 4=Good, 5=Excellent\n\n';
    output += '6. Issue type:\n';
    output += '   [1] correct_but_flagged (false positive hallucination)\n';
    output += '   [2] missing_context (retrieval failure)\n';
    output += '   [3] wrong_answer (generation failure)\n';
    output += '   [4] contradictory_metrics (metric calculation issue)\n';
    output += '   [5] timeout_masked (timeout hiding real issue)\n';
    output += '   [6] no_issue (working correctly)\n\n';
    output += '7. Additional notes (optional, press Enter to skip):\n';

    return output;
  }

  /**
   * Format file selection menu
   */
  formatFileMenu(files: Array<{ name: string; size: number; date: Date }>): string {
    let output = this.formatSection('📂', 'Recent Evaluation Results:');
    output += '\n';

    files.forEach((file, i) => {
      const date = file.date.toISOString().split('T')[0];
      const sizeKB = (file.size / 1024).toFixed(0);
      output += `  ${this.colors.cyan}${i + 1}.${this.colors.reset} ${file.name}\n`;
      output += `     ${this.colors.dim}${date} - ${sizeKB} KB${this.colors.reset}\n`;
    });

    output += '\n';
    return output;
  }

  /**
   * Format summary statistics
   */
  formatSummary(validated: number, total: number, patterns: number): string {
    let output = '\n' + '═'.repeat(65) + '\n';
    output += this.colors.bright + this.colors.green;
    output += '✅ Validation Complete\n';
    output += this.colors.reset;
    output += '\n';
    output += `  Cases Validated: ${validated}/${total}\n`;
    output += `  Patterns Detected: ${patterns}\n`;
    output += '\n';

    return output;
  }

  /**
   * Color a string
   */
  colorize(text: string, color: keyof typeof this.colors): string {
    return `${this.colors[color]}${text}${this.colors.reset}`;
  }
}

export const formatter = new DisplayFormatters();
