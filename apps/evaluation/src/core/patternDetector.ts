import { ValidatedCase, DetectedPattern } from './types.js';

/**
 * Detects patterns in validated evaluation cases
 */
export class PatternDetector {
  /**
   * Analyze all validated cases and detect patterns
   */
  detectPatterns(cases: ValidatedCase[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    const retrievalFailure = this.detectRetrievalFailure(cases);
    if (retrievalFailure) patterns.push(retrievalFailure);

    const falseHallucinations = this.detectFalseHallucinations(cases);
    if (falseHallucinations) patterns.push(falseHallucinations);

    const contradictoryMetrics = this.detectContradictoryMetrics(cases);
    if (contradictoryMetrics) patterns.push(contradictoryMetrics);

    const timeoutMasking = this.detectTimeoutMasking(cases);
    if (timeoutMasking) patterns.push(timeoutMasking);

    const wrongAnswers = this.detectWrongAnswers(cases);
    if (wrongAnswers) patterns.push(wrongAnswers);

    return patterns;
  }

  /**
   * Detect total retrieval failure (no contexts retrieved)
   */
  private detectRetrievalFailure(cases: ValidatedCase[]): DetectedPattern | null {
    const failedCases = cases.filter(
      (c) => c.automated_scores.retrieved_contexts.length === 0
    );

    if (failedCases.length === 0) return null;

    const allFailed = failedCases.length === cases.length;
    const percentage = ((failedCases.length / cases.length) * 100).toFixed(0);

    return {
      pattern_name: 'Total Retrieval Failure',
      frequency: failedCases.length,
      case_ids: failedCases.map((c) => c.test_case_id),
      characteristics: [
        'retrieved_contexts: []',
        'No documents returned by retriever',
        'All scores affected',
        allFailed ? 'ALL cases affected' : `${percentage}% of cases affected`,
      ],
      root_cause_hypothesis:
        'BM25 cache empty, vector store not indexed, or parent retriever not working',
      recommended_fix:
        'Check backend retrieval logs, rebuild BM25 cache, verify vector store indexing, test parent retriever independently',
      priority: 'critical',
      effort_estimate: 'High (2-4 hours investigation + debugging)',
    };
  }

  /**
   * Detect false positive hallucination detection
   */
  private detectFalseHallucinations(cases: ValidatedCase[]): DetectedPattern | null {
    const falsePositives = cases.filter(
      (c) =>
        c.user_validation.is_factually_correct === true &&
        c.user_validation.uses_only_context === true &&
        (c.automated_scores.hallucination_score ?? 0) > 0.3
    );

    if (falsePositives.length === 0) return null;

    const avgHallucinationScore =
      falsePositives.reduce(
        (sum, c) => sum + (c.automated_scores.hallucination_score ?? 0),
        0
      ) / falsePositives.length;

    return {
      pattern_name: 'False Hallucination Detection',
      frequency: falsePositives.length,
      case_ids: falsePositives.map((c) => c.test_case_id),
      characteristics: [
        'User confirms answer is correct',
        'User confirms uses only context',
        `Automated detector flags as hallucination (avg score: ${avgHallucinationScore.toFixed(2)})`,
        'Information is present in retrieved contexts',
      ],
      root_cause_hypothesis:
        'Hallucination detector too strict, prompt issue, or synthesis considered as hallucination',
      recommended_fix:
        'Review hallucination detection prompt, add test cases for valid synthesis, lower detection threshold, or improve context matching logic',
      priority: 'high',
      effort_estimate: 'Medium (2-3 hours)',
    };
  }

  /**
   * Detect contradictory metrics (e.g., high relevancy + low faithfulness)
   */
  private detectContradictoryMetrics(cases: ValidatedCase[]): DetectedPattern | null {
    const contradictory = cases.filter((c) => {
      const faithfulness = c.automated_scores.faithfulness_score;
      const relevancy = c.automated_scores.answer_relevancy_score;

      // High relevancy but low faithfulness is contradictory
      return relevancy > 0.7 && faithfulness < 0.5;
    });

    if (contradictory.length === 0) return null;

    return {
      pattern_name: 'Contradictory Metrics',
      frequency: contradictory.length,
      case_ids: contradictory.map((c) => c.test_case_id),
      characteristics: [
        'High answer relevancy (>0.7) with low faithfulness (<0.5)',
        'Metrics calculated independently without cross-validation',
        'Logically impossible combination',
      ],
      root_cause_hypothesis:
        'Metrics are calculated independently without consistency checks between them',
      recommended_fix:
        'Add validation logic to detect contradictory scores, review metric calculation prompts, add consistency checks',
      priority: 'high',
      effort_estimate: 'Medium (3-4 hours)',
    };
  }

  /**
   * Detect timeout masking real issues
   */
  private detectTimeoutMasking(cases: ValidatedCase[]): DetectedPattern | null {
    const timeoutCases = cases.filter((c) => c.automated_scores.error?.includes('timeout'));

    if (timeoutCases.length === 0) return null;

    const avgLatency =
      timeoutCases.reduce((sum, c) => sum + c.automated_scores.latency_ms, 0) /
      timeoutCases.length;

    return {
      pattern_name: 'Systematic Timeouts',
      frequency: timeoutCases.length,
      case_ids: timeoutCases.map((c) => c.test_case_id),
      characteristics: [
        `Timeout after ${(avgLatency / 1000).toFixed(0)}s`,
        'Empty responses',
        'All scores set to 0',
        'Cannot evaluate RAG quality',
      ],
      root_cause_hypothesis:
        'LLM API calls too slow, reranker performance issues, or network problems',
      recommended_fix:
        'Profile LLM API calls, check reranker performance, increase timeout temporarily, add detailed timing logs, consider caching',
      priority: 'critical',
      effort_estimate: 'High (3-5 hours profiling + optimization)',
    };
  }

  /**
   * Detect wrong answers (factually incorrect)
   */
  private detectWrongAnswers(cases: ValidatedCase[]): DetectedPattern | null {
    const wrongCases = cases.filter(
      (c) =>
        c.user_validation.is_factually_correct === false ||
        c.user_validation.is_factually_correct === 'partial'
    );

    if (wrongCases.length === 0) return null;

    const withContexts = wrongCases.filter(
      (c) => c.automated_scores.retrieved_contexts.length > 0
    );
    const withoutContexts = wrongCases.filter(
      (c) => c.automated_scores.retrieved_contexts.length === 0
    );

    const characteristics = ['User confirms answer is incorrect or incomplete'];

    if (withoutContexts.length > 0) {
      characteristics.push(`${withoutContexts.length} cases with no contexts (retrieval issue)`);
    }
    if (withContexts.length > 0) {
      characteristics.push(`${withContexts.length} cases with contexts (generation issue)`);
    }

    return {
      pattern_name: 'Wrong Answers Generated',
      frequency: wrongCases.length,
      case_ids: wrongCases.map((c) => c.test_case_id),
      characteristics,
      root_cause_hypothesis:
        withoutContexts.length === wrongCases.length
          ? 'Retrieval failure - no contexts to answer from'
          : withContexts.length === wrongCases.length
          ? 'Generation issue - contexts available but wrong answer produced'
          : 'Mixed issue - both retrieval and generation problems',
      recommended_fix:
        withoutContexts.length === wrongCases.length
          ? 'Fix retrieval first - check BM25 cache, vector store, and embeddings'
          : 'Review generation prompt, check temperature setting, verify context is being used',
      priority: 'critical',
      effort_estimate: 'High (3-6 hours)',
    };
  }
}

export const patternDetector = new PatternDetector();
