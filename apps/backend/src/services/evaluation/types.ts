export interface EvaluationTestCase {
  id: string;
  category: 'Básica' | 'Conceptual' | 'Relación' | 'Proceso' | 'Comparativa';
  question: string;
  ground_truth_answer: string;
  expected_contexts: string[];
  must_contain_keywords: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface EvaluationResult {
  test_case_id: string;
  question: string;
  generated_answer: string;
  retrieved_contexts: string[];
  retrieved_sources: string[];

  // RAGAS Metrics
  faithfulness_score: number;
  answer_relevancy_score: number;
  context_precision_score: number;
  context_recall_score: number;

  latency_ms: number;
  timestamp: string;
  error?: string;
}

export interface EvaluationDataset {
  version: string;
  test_cases: EvaluationTestCase[];
}

export interface EvaluationReport {
  summary: {
    total_cases: number;
    successful: number;
    failed: number;
    avg_faithfulness: number;
    avg_answer_relevancy: number;
    avg_context_precision: number;
    avg_context_recall: number;
    avg_latency_ms: number;
  };
  by_category: Record<string, {
    count: number;
    avg_faithfulness: number;
    avg_answer_relevancy: number;
    avg_context_precision: number;
    avg_context_recall: number;
  }>;
  detailed_results: EvaluationResult[];
  timestamp: string;
}
