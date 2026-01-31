# RAGAS Evaluation System

This directory contains the RAGAS (Retrieval-Augmented Generation Assessment) evaluation system for measuring RAG quality.

## Overview

RAGAS provides automated metrics to evaluate RAG system quality without manual inspection:

- **Faithfulness**: Checks if LLM responses are grounded in retrieved contexts (0-1)
- **Answer Relevancy**: Measures how relevant answers are to questions (0-1)
- **Context Precision**: Evaluates if retrieved documents are relevant (0-1)
- **Context Recall**: Checks if all necessary documents were retrieved (0-1)

## Structure

```
benchmark/evaluation/
├── datasets/
│   └── golden_qa.json          # Test cases with ground truth
├── results/
│   └── ragas_YYYY-MM-DD.json  # Evaluation results (generated)
└── run_ragas_eval.ts          # CLI script for batch evaluation
```

## Usage

### 1. CLI Script (Recommended for batch evaluation)

```bash
# From project root
bun run benchmark/evaluation/run_ragas_eval.ts
```

This will:
- Load all 17 test cases from `golden_qa.json`
- Run each through the RAG pipeline
- Evaluate with RAGAS metrics using LLM-as-judge
- Save results to `results/ragas_YYYY-MM-DD.json`
- Print summary statistics

**Expected time**: ~5-10 minutes for 17 test cases

### 2. API Endpoint (For integration testing)

```bash
# Start backend first
cd apps/backend
bun run src/index.ts

# In another terminal
curl -X POST http://localhost:3001/api/evaluation/ragas \
  -H "Content-Type: application/json" \
  -d '{"saveResults": true}'
```

Response includes:
```json
{
  "success": true,
  "summary": {
    "total_cases": 17,
    "successful": 17,
    "avg_faithfulness": 0.85,
    "avg_answer_relevancy": 0.78,
    "avg_context_precision": 0.72,
    "avg_context_recall": 0.80
  },
  "by_category": { ... },
  "detailed_results": [ ... ]
}
```

## Dataset Format

The `golden_qa.json` dataset contains test cases derived from `QUERIES_PROFUNDAS.md`:

```json
{
  "version": "1.0",
  "test_cases": [
    {
      "id": "basica_1",
      "category": "Básica",
      "question": "¿Qué versión de Angular se usa?",
      "ground_truth_answer": "Angular 15",
      "expected_contexts": ["01-arquitectura-general.md"],
      "must_contain_keywords": ["Angular 15"],
      "difficulty": "easy"
    }
  ]
}
```

## Metrics Thresholds

| Metric | Minimum | Target | Interpretation |
|--------|---------|--------|----------------|
| Faithfulness | 0.70 | 0.85+ | Low = hallucinations |
| Answer Relevancy | 0.65 | 0.80+ | Low = off-topic answers |
| Context Precision | 0.60 | 0.75+ | Low = noisy retrieval |
| Context Recall | 0.70 | 0.85+ | Low = missing relevant docs |

## When to Run

**Run RAGAS evaluation:**
- After changes to RAG configuration (BM25 weights, reranker settings, etc.)
- After updating embeddings or chunking strategy
- Weekly for monitoring quality drift
- Before deploying to production

**Do NOT run:**
- On every query (too slow, ~20-30s per query)
- For individual debugging (use manual testing instead)

## Results Interpretation

### Good Results
```
Faithfulness: 85%+       ✅ No hallucinations
Answer Relevancy: 80%+   ✅ Answers are on-topic
Context Precision: 75%+  ✅ Retrieval is precise
Context Recall: 85%+     ✅ All relevant docs found
```

### Poor Results
```
Faithfulness: <70%       ⚠️ Check for hallucinations
Answer Relevancy: <65%   ⚠️ LLM not understanding questions
Context Precision: <60%  ⚠️ Retrieval too noisy, tune BM25/Vector weights
Context Recall: <70%     ⚠️ Missing relevant docs, increase k or improve indexing
```

## Extending the Dataset

To add more test cases, edit `datasets/golden_qa.json`:

1. Add new entry to `test_cases` array
2. Follow naming convention: `{category}_{number}`
3. Specify expected contexts for recall calculation
4. List keywords that should appear in answer

Categories: `Básica`, `Conceptual`, `Relación`, `Proceso`, `Comparativa`

## Technical Details

### Implementation

- **Language**: TypeScript (Bun runtime)
- **LLM-as-Judge**: Uses same Ollama model (llama3.1:8b) with temperature=0.1
- **Evaluation Logic**: Located in `apps/backend/src/services/evaluation/`
- **Scoring**: LLM returns 0.0-1.0 scores based on prompt criteria

### Limitations

- Scores are subjective (LLM-as-judge can be inconsistent)
- Slow evaluation (~20-30s per test case)
- Requires running LLM service (Ollama)
- Context Recall depends on accurate `expected_contexts` metadata

## Troubleshooting

**Error: Dataset not found**
- Check file exists: `benchmark/evaluation/datasets/golden_qa.json`
- Run from project root directory

**Error: Ollama connection failed**
- Ensure Ollama is running: `ollama list`
- Check baseUrl: `http://localhost:11434`

**Low scores across all metrics**
- Check if vector store has documents indexed
- Verify LLM is responding correctly
- Review sample answers in detailed results

## Example Output

```
========================================================
📊 RAGAS EVALUATION REPORT
========================================================

📈 SUMMARY:
  Total cases: 17
  Successful: 17
  Failed: 0
  Avg Latency: 3245ms

🎯 OVERALL METRICS:
  Faithfulness: 82.3%
  Answer Relevancy: 76.5%
  Context Precision: 71.2%
  Context Recall: 79.4%

📂 BY CATEGORY:

  Básica (4 cases):
    Faithfulness: 91.2%
    Answer Relevancy: 88.7%
    Context Precision: 85.3%
    Context Recall: 95.0%

  Conceptual (3 cases):
    Faithfulness: 79.5%
    Answer Relevancy: 72.1%
    Context Precision: 68.9%
    Context Recall: 71.2%
...
```
