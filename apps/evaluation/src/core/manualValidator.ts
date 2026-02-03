import { EvaluationResult, UserValidation, ValidatedCase } from './types.js';

/**
 * Manual validation logic - compares automated vs manual validations
 */
export class ManualValidator {
  /**
   * Create a validated case from automated scores and user validation
   */
  createValidatedCase(
    automatedScores: EvaluationResult,
    userValidation: UserValidation
  ): ValidatedCase {
    const discrepancies = this.findDiscrepancies(automatedScores, userValidation);

    return {
      test_case_id: automatedScores.test_case_id,
      automated_scores: automatedScores,
      user_validation: userValidation,
      discrepancies,
    };
  }

  /**
   * Find discrepancies between automated and manual validation
   */
  private findDiscrepancies(
    automated: EvaluationResult,
    manual: UserValidation
  ): string[] {
    const discrepancies: string[] = [];

    // Check hallucination detection accuracy
    if (manual.hallucinations_correct === false || manual.hallucinations_correct === 'false-positive') {
      discrepancies.push('hallucination detection false positive');
    }

    // Check if factually correct but low faithfulness
    if (manual.is_factually_correct === true && automated.faithfulness_score < 0.7) {
      discrepancies.push(
        `user confirms correct but faithfulness low (${automated.faithfulness_score.toFixed(2)})`
      );
    }

    // Check if uses only context but hallucinations detected
    if (
      manual.uses_only_context === true &&
      (automated.hallucination_score ?? 0) > 0.3
    ) {
      discrepancies.push(
        `user confirms uses only context but hallucination score high (${(automated.hallucination_score ?? 0).toFixed(2)})`
      );
    }

    // Check contradictory metrics
    if (
      automated.answer_relevancy_score > 0.7 &&
      automated.faithfulness_score < 0.5
    ) {
      discrepancies.push(
        `contradictory metrics: high relevancy (${automated.answer_relevancy_score.toFixed(2)}) + low faithfulness (${automated.faithfulness_score.toFixed(2)})`
      );
    }

    // Check retrieval issues
    if (automated.retrieved_contexts.length === 0) {
      discrepancies.push('no contexts retrieved - retrieval failure');
    } else if (manual.contexts_relevant === false) {
      discrepancies.push(
        `${automated.retrieved_contexts.length} contexts retrieved but user confirms they are not relevant`
      );
    }

    // Check timeout masking
    if (automated.error?.includes('timeout')) {
      discrepancies.push('timeout prevented proper evaluation');
    }

    return discrepancies;
  }

  /**
   * Calculate agreement percentage between automated and manual validation
   */
  calculateAgreementScore(validated: ValidatedCase): number {
    let agreements = 0;
    let total = 0;

    const { automated_scores, user_validation } = validated;

    // Faithfulness agreement
    total++;
    if (
      (automated_scores.faithfulness_score >= 0.7 &&
        user_validation.is_factually_correct === true &&
        user_validation.uses_only_context === true) ||
      (automated_scores.faithfulness_score < 0.7 &&
        (user_validation.is_factually_correct === false ||
          user_validation.uses_only_context === false))
    ) {
      agreements++;
    }

    // Hallucination detection agreement
    total++;
    const hasHallucinations = (automated_scores.hallucination_score ?? 0) > 0.3;
    if (
      (hasHallucinations && user_validation.hallucinations_correct === true) ||
      (!hasHallucinations && user_validation.hallucinations_correct !== false)
    ) {
      agreements++;
    }

    // Context relevance agreement
    total++;
    if (
      (automated_scores.context_precision_score >= 0.5 &&
        user_validation.contexts_relevant === true) ||
      (automated_scores.context_precision_score < 0.5 &&
        user_validation.contexts_relevant === false)
    ) {
      agreements++;
    }

    return agreements / total;
  }
}

export const manualValidator = new ManualValidator();
