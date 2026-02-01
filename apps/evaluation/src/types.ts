export interface EvaluationTestCase {
  id: string;
  category: 'Básica' | 'Conceptual' | 'Relación' | 'Proceso' | 'Comparativa' | 'Edge Cases' | 'Multi-Hop';
  sub_category?: string;
  question: string;
  ground_truth_answer: string;
  expected_contexts: string[];
  must_contain_keywords: string[];
  difficulty: 'easy' | 'medium' | 'hard';

  // V2 fields
  requires_multi_hop?: boolean;
  expected_hallucination_risk?: 'low' | 'medium' | 'high';
  expected_behavior?: string;
}

export interface EvaluationResult {
  test_case_id: string;
  question: string;
  generated_answer: string;
  retrieved_contexts: string[];
  retrieved_sources: string[];

  // Core RAGAS Metrics
  faithfulness_score: number;
  answer_relevancy_score: number;
  context_precision_score: number;
  context_recall_score: number;

  // Additional RAGAS Metrics
  context_relevancy_score?: number;
  context_entity_recall_score?: number;
  answer_correctness_score?: number;
  answer_similarity_score?: number;
  answer_completeness_score?: number;
  context_noise_ratio?: number;

  // Hallucination Detection
  hallucination_score?: number;
  hallucinations_detected?: string[];

  // Performance Metrics
  retrieval_latency_ms?: number;
  reranking_latency_ms?: number;
  generation_latency_ms?: number;
  num_retrieved_docs?: number;
  num_final_docs?: number;
  avg_rerank_score?: number;

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
