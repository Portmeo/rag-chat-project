import * as fs from 'fs';
import * as path from 'path';
import {
  ValidationSession,
  DetectedPattern,
  Recommendation,
  ValidatedCase,
} from './types.js';
import { manualValidator } from './manualValidator.js';

/**
 * Generate validation reports in multiple formats
 */
export class ValidationReportGenerator {
  /**
   * Save validation session to JSON
   */
  saveSessionJson(session: ValidationSession, outputDir: string): string {
    const filename = `validation_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(session, null, 2));

    return filepath;
  }

  /**
   * Generate pattern analysis report in Markdown
   */
  generatePatternReport(session: ValidationSession, outputDir: string): string {
    const filename = `patterns_${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    const filepath = path.join(outputDir, filename);

    let markdown = '# Manual Validation Report - Pattern Analysis\n\n';
    markdown += `**Validation Date:** ${new Date(session.timestamp).toLocaleString()}\n`;
    markdown += `**Source File:** ${session.result_file}\n`;
    markdown += `**Cases Reviewed:** ${session.total_cases_reviewed}\n\n`;

    markdown += '---\n\n';

    if (session.patterns.length === 0) {
      markdown += '## No Patterns Detected\n\n';
      markdown += 'All evaluations appear consistent. No systematic issues found.\n';
    } else {
      markdown += '## Patterns Identified\n\n';

      // Sort by priority
      const sortedPatterns = [...session.patterns].sort((a, b) => {
        const priority = { critical: 0, high: 1, medium: 2, low: 3 };
        return priority[a.priority] - priority[b.priority];
      });

      sortedPatterns.forEach((pattern, index) => {
        markdown += this.formatPattern(pattern, index + 1);
      });
    }

    fs.writeFileSync(filepath, markdown);
    return filepath;
  }

  /**
   * Generate recommendations report in Markdown
   */
  generateRecommendationsReport(session: ValidationSession, outputDir: string): string {
    const filename = `recommendations_${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    const filepath = path.join(outputDir, filename);

    let markdown = '# Manual Validation Report - Recommendations\n\n';
    markdown += `**Validation Date:** ${new Date(session.timestamp).toLocaleString()}\n`;
    markdown += `**Source File:** ${session.result_file}\n`;
    markdown += `**Cases Reviewed:** ${session.total_cases_reviewed}\n\n`;

    markdown += '---\n\n';

    // Generate recommendations from patterns
    const recommendations = this.generateRecommendations(session);

    const critical = recommendations.filter((r) => r.priority === 'critical');
    const high = recommendations.filter((r) => r.priority === 'high');
    const medium = recommendations.filter((r) => r.priority === 'medium');
    const low = recommendations.filter((r) => r.priority === 'low');

    if (critical.length > 0) {
      markdown += '## 🚨 Critical Priority\n\n';
      critical.forEach((rec, i) => {
        markdown += this.formatRecommendation(rec, i + 1);
      });
    }

    if (high.length > 0) {
      markdown += '## ⚠️ High Priority\n\n';
      high.forEach((rec, i) => {
        markdown += this.formatRecommendation(rec, i + 1);
      });
    }

    if (medium.length > 0) {
      markdown += '## 📋 Medium Priority\n\n';
      medium.forEach((rec, i) => {
        markdown += this.formatRecommendation(rec, i + 1);
      });
    }

    if (low.length > 0) {
      markdown += '## 💡 Low Priority\n\n';
      low.forEach((rec, i) => {
        markdown += this.formatRecommendation(rec, i + 1);
      });
    }

    markdown += '\n---\n\n';
    markdown += '## Summary Statistics\n\n';
    markdown += this.generateSummaryStats(session);

    fs.writeFileSync(filepath, markdown);
    return filepath;
  }

  /**
   * Format a single pattern for markdown
   */
  private formatPattern(pattern: DetectedPattern, index: number): string {
    const priorityEmoji = {
      critical: '🚨',
      high: '⚠️',
      medium: '📋',
      low: '💡',
    };

    let md = `### ${priorityEmoji[pattern.priority]} PATTERN ${index}: ${pattern.pattern_name}\n\n`;
    md += `**Priority:** ${pattern.priority.toUpperCase()}\n`;
    md += `**Frequency:** ${pattern.frequency} case(s)\n`;
    md += `**Effort Estimate:** ${pattern.effort_estimate}\n\n`;

    md += '**Affected Cases:**\n';
    pattern.case_ids.forEach((id) => {
      md += `- ${id}\n`;
    });
    md += '\n';

    md += '**Characteristics:**\n';
    pattern.characteristics.forEach((char) => {
      md += `- ${char}\n`;
    });
    md += '\n';

    md += '**Root Cause Hypothesis:**\n';
    md += `${pattern.root_cause_hypothesis}\n\n`;

    md += '**Recommended Fix:**\n';
    md += `${pattern.recommended_fix}\n\n`;

    md += '---\n\n';

    return md;
  }

  /**
   * Format a single recommendation
   */
  private formatRecommendation(rec: Recommendation, index: number): string {
    let md = `### ${index}. ${rec.title}\n\n`;
    md += `**Issue:** ${rec.issue}\n\n`;

    md += '**Evidence:**\n';
    rec.evidence.forEach((ev) => {
      md += `- ${ev}\n`;
    });
    md += '\n';

    md += '**Action Items:**\n';
    rec.action.forEach((action, i) => {
      md += `${i + 1}. ${action}\n`;
    });
    md += '\n';

    return md;
  }

  /**
   * Generate recommendations from patterns and validations
   */
  private generateRecommendations(session: ValidationSession): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Generate from patterns
    session.patterns.forEach((pattern) => {
      recommendations.push({
        title: `Fix ${pattern.pattern_name}`,
        issue: pattern.root_cause_hypothesis,
        evidence: [
          `${pattern.frequency} case(s) affected: ${pattern.case_ids.join(', ')}`,
          ...pattern.characteristics,
        ],
        action: pattern.recommended_fix.split('.').filter((s) => s.trim()),
        priority: pattern.priority,
      });
    });

    // Generate from manual validations
    const lowQualityCases = session.validated_cases.filter(
      (c) => c.user_validation.quality_rating <= 2
    );

    if (lowQualityCases.length > 0) {
      recommendations.push({
        title: 'Improve Overall Answer Quality',
        issue: `${lowQualityCases.length} cases rated 2 or below by manual reviewer`,
        evidence: lowQualityCases.map(
          (c) =>
            `${c.test_case_id}: quality ${c.user_validation.quality_rating}/5${c.user_validation.notes ? ` - ${c.user_validation.notes}` : ''}`
        ),
        action: [
          'Review generation prompt for clarity',
          'Check temperature and sampling settings',
          'Verify context quality and relevance',
          'Consider adding few-shot examples',
        ],
        priority: 'high',
      });
    }

    return recommendations;
  }

  /**
   * Generate summary statistics
   */
  private generateSummaryStats(session: ValidationSession): string {
    let md = '';

    const totalCases = session.validated_cases.length;
    const avgQuality =
      session.validated_cases.reduce(
        (sum, c) => sum + c.user_validation.quality_rating,
        0
      ) / totalCases;

    const correctCount = session.validated_cases.filter(
      (c) => c.user_validation.is_factually_correct === true
    ).length;
    const partialCount = session.validated_cases.filter(
      (c) => c.user_validation.is_factually_correct === 'partial'
    ).length;
    const incorrectCount = session.validated_cases.filter(
      (c) => c.user_validation.is_factually_correct === false
    ).length;

    const usesOnlyContextCount = session.validated_cases.filter(
      (c) => c.user_validation.uses_only_context === true
    ).length;

    const hallucinationAccuracyCount = session.validated_cases.filter(
      (c) => c.user_validation.hallucinations_correct === true
    ).length;

    // Calculate average agreement
    const avgAgreement =
      session.validated_cases.reduce((sum, c) => {
        return sum + manualValidator.calculateAgreementScore(c);
      }, 0) / totalCases;

    md += `- **Total Cases Validated:** ${totalCases}\n`;
    md += `- **Average Quality Rating:** ${avgQuality.toFixed(2)}/5\n`;
    md += `- **Factually Correct:** ${correctCount} (${((correctCount / totalCases) * 100).toFixed(0)}%)\n`;
    md += `- **Partially Correct:** ${partialCount} (${((partialCount / totalCases) * 100).toFixed(0)}%)\n`;
    md += `- **Incorrect:** ${incorrectCount} (${((incorrectCount / totalCases) * 100).toFixed(0)}%)\n`;
    md += `- **Uses Only Context:** ${usesOnlyContextCount} (${((usesOnlyContextCount / totalCases) * 100).toFixed(0)}%)\n`;
    md += `- **Hallucination Detection Accuracy:** ${hallucinationAccuracyCount} (${((hallucinationAccuracyCount / totalCases) * 100).toFixed(0)}%)\n`;
    md += `- **Automated-Manual Agreement:** ${(avgAgreement * 100).toFixed(0)}%\n`;

    md += '\n**Issue Type Breakdown:**\n';
    const issueTypes = session.validated_cases.reduce((acc, c) => {
      acc[c.user_validation.issue_type] = (acc[c.user_validation.issue_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(issueTypes)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        md += `- ${type}: ${count}\n`;
      });

    return md;
  }
}

export const reportGenerator = new ValidationReportGenerator();
