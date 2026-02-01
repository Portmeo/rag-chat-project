# RAGAS Evaluation Module

This is an independent evaluation module for the RAG Chat project. It provides comprehensive RAGAS (Retrieval-Augmented Generation Assessment) metrics for evaluating the RAG system.

## Architecture

The evaluation module is **completely separated** from the production backend:

- **Backend** (`apps/backend`): Production RAG system
- **Evaluation** (`apps/evaluation`): Testing & benchmarking (this module)

## How it Works

The evaluator connects to the backend via HTTP API:

1. Starts the backend server (`bun run dev` in `apps/backend`)
2. Calls `/api/chat/query` endpoint to get RAG responses
3. Reads source documents from filesystem (`uploads/` directory)
4. Evaluates responses using RAGAS metrics
5. Generates detailed reports

## Usage

### Optimization Benchmark (Recommended)

Runs comprehensive benchmarks across 8 RAG configurations:

```bash
# From project root
npm run benchmark:optimization

# Or directly
bun run benchmark/evaluation/run_optimization_benchmark.ts
```

This will test:
- `baseline` - Vector search only
- `bm25` - BM25 ensemble (70/30)
- `rerank` - Cross-encoder reranking
- `parent` - Parent document retriever
- `bm25-rerank` - BM25 + Reranking
- `bm25-parent` - BM25 + Parent
- `rerank-parent` - Reranking + Parent
- `full` - All optimizations enabled

Each configuration is tested on 16 queries and automatically generates:
- Individual reports (JSON + Markdown)
- Comparison report across all configurations
- Performance vs quality trade-off analysis

**⚠️ Warning:** Full benchmark takes 2-3 hours (8 configs × 16 queries × ~60-80s/query)

### Single Configuration Benchmark

Test only the current configuration:

```bash
# From project root
npm run benchmark:single

# Or with custom dataset
bun run benchmark/evaluation/run_full_benchmark.ts --dataset golden_qa_v2.json

# Quick test (limit to 5 cases)
bun run benchmark/evaluation/run_full_benchmark.ts --limit 5
```

### Generate Comparison Report

If you already have results from multiple configurations:

```bash
npm run benchmark:compare
```

### Configuration

The evaluator can be configured via constructor:

```typescript
import { RAGASEvaluator } from '@rag-chat/evaluation';

// Default: http://localhost:3001
const evaluator = new RAGASEvaluator();

// Custom backend URL
const evaluator = new RAGASEvaluator('http://staging.example.com');
```

## RAGAS Metrics

### Core Metrics
- **Faithfulness**: Answer supported by context
- **Answer Relevancy**: How relevant is the answer
- **Context Precision**: Relevance of retrieved contexts
- **Context Recall**: Coverage of expected contexts

### Additional Metrics
- **Context Relevancy**: Information density in contexts
- **Answer Correctness**: Semantic similarity to ground truth
- **Answer Similarity**: Lexical overlap with ground truth
- **Answer Completeness**: How complete is the answer
- **Hallucination Detection**: Identifies unsupported claims

## Project Structure

```
apps/evaluation/
├── src/
│   ├── index.ts              # Public exports
│   ├── types.ts              # Type definitions
│   ├── ragasEvaluator.ts     # Core RAGAS evaluator
│   ├── errorAnalyzer.ts      # Error pattern analysis
│   ├── reportGenerator.ts    # Report generation (MD + JSON)
│   ├── datasetLoader.ts      # Dataset loading utilities
│   └── configManager.ts      # Configuration management for benchmarks
├── package.json
└── tsconfig.json

benchmark/evaluation/
├── datasets/
│   ├── golden_qa_v2.json            # Comprehensive test set (52 cases)
│   └── rag-optimization-benchmark.json  # Optimization test set (16 cases)
├── run_full_benchmark.ts            # Single config benchmark runner
├── run_optimization_benchmark.ts    # Multi-config orchestrator
├── generateComparisonReport.ts      # Comparison report generator
└── results/                         # Generated reports (JSON + MD)
```

## Dependencies

- `@langchain/community`: LLM & embeddings for evaluation
- `langchain`: Core LangChain utilities
- `bun`: Runtime & package manager

## Why Separate?

- ✅ Clean separation: production vs development code
- ✅ Backend stays pure: no evaluation contamination
- ✅ Realistic testing: evaluates the actual HTTP API
- ✅ Flexible deployment: can point to any backend (local, staging, prod)
- ✅ CI/CD: evaluation can run in separate pipeline

## Datasets

### rag-optimization-benchmark.json
16 queries across 5 categories designed to test RAG optimizations:
- **Básica (4)**: Keyword-based queries (BM25 should excel)
- **Conceptual (3)**: Semantic understanding queries
- **Relación (3)**: Multi-concept queries
- **Proceso (3)**: Process/flow queries
- **Comparativa (3)**: Comparison queries

### golden_qa_v2.json
Comprehensive test set with 52 cases covering:
- Basic to advanced queries
- Edge cases
- Multi-hop reasoning
- Various difficulty levels

## Optimization Benchmark Results

After running `npm run benchmark:optimization`, you'll find in `benchmark/evaluation/results/`:

### Individual Config Reports
- `baseline_TIMESTAMP.json` / `.md` - Baseline results (vector search only)
- `bm25_TIMESTAMP.json` / `.md` - BM25 ensemble results
- `rerank_TIMESTAMP.json` / `.md` - Reranking results
- `parent_TIMESTAMP.json` / `.md` - Parent retriever results
- `bm25-rerank_TIMESTAMP.json` / `.md` - BM25 + Reranking
- `bm25-parent_TIMESTAMP.json` / `.md` - BM25 + Parent
- `rerank-parent_TIMESTAMP.json` / `.md` - Reranking + Parent
- `full_TIMESTAMP.json` / `.md` - All optimizations

### Comparison Report
- `comparison-report.md` - Comprehensive comparison table and insights
- `comparison-report-data.json` - Data for visualization

The comparison report includes:
- Summary table with all metrics
- Delta vs baseline (quality and latency)
- Performance by category
- Optimization impact analysis
- Quality vs latency trade-offs
- Recommendations for production config

## Notes

- Requires backend to be running on port 3001 (or custom URL)
- Reads document files from `uploads/` directory
- Uses same LLM/embeddings as RAG system (llama3.1:8b, mxbai-embed-large)
- Evaluation temperature: 0.1 (for consistency)
- Optimization benchmark automatically restarts backend for each config
- Backend logs are saved to `benchmark/evaluation/results/backend.log`
