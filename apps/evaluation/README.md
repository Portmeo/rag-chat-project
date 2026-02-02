# RAGAS Evaluation Module

This is an independent evaluation module for the RAG Chat project. It provides comprehensive RAGAS (Retrieval-Augmented Generation Assessment) metrics for evaluating the RAG system.

## Architecture

The evaluation module is **completely separated** from the production backend:

- **Backend** (`apps/backend`): Production RAG system
- **Evaluation** (`apps/evaluation`): Testing & benchmarking (this module)

## How it Works

The evaluator connects to the backend via HTTP API:

1. Starts the backend server (`npm run dev:backend`)
2. Calls `/api/chat/query` endpoint to get RAG responses
3. Reads source documents from filesystem (`uploads/` directory)
4. Evaluates responses using RAGAS metrics
5. Generates detailed reports

## Usage

### Basic Evaluation

```bash
# From project root
npm run eval

# From apps/evaluation directory
cd apps/evaluation
npm run eval
```

### With Options

```bash
# Custom dataset
npm run eval -- --dataset golden_qa.json

# Limit test cases (for quick testing)
npm run eval -- --limit 5

# Custom output directory
npm run eval -- --output ./my-results

# Combine options
npm run eval -- --dataset custom.json --limit 10
```

### Direct Execution

```bash
# Using npx
npx tsx apps/evaluation/src/cli/run-eval.ts

# With options
npx tsx apps/evaluation/src/cli/run-eval.ts --limit 5
```

## Configuration

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
- **Faithfulness**: Answer supported by context (0-1)
- **Answer Relevancy**: How relevant is the answer (0-1)
- **Context Precision**: Relevance of retrieved contexts (0-1)
- **Context Recall**: Coverage of expected contexts (0-1)

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
│   ├── cli/
│   │   └── run-eval.ts           # Unified evaluation script
│   ├── core/
│   │   ├── ragasEvaluator.ts     # Core RAGAS evaluator
│   │   ├── datasetLoader.ts      # Dataset loading utilities
│   │   ├── reportGenerator.ts    # Report generation (MD + JSON)
│   │   ├── errorAnalyzer.ts      # Error pattern analysis
│   │   └── types.ts              # Type definitions
│   └── index.ts                  # Public exports
├── package.json
└── tsconfig.json

benchmark/evaluation/
├── datasets/
│   ├── golden_qa.json            # Test cases with ground truth
│   └── golden_qa_v2.json         # Extended test set
└── results/                      # Generated reports (auto-generated, git-ignored)
    ├── ragas_YYYY-MM-DD.json     # Evaluation results
    └── ragas_YYYY-MM-DD.md       # Human-readable report
```

## Features

### Comprehensive Reports
- **Markdown**: Human-readable summary with tables and insights
- **JSON**: Structured data for processing and analysis

### Error Analysis
- Classifies errors by severity (critical/high/medium)
- Identifies common failure patterns
- Counts errors across categories

### Additional Statistics
- Context Relevancy metrics
- Answer Correctness scores
- Hallucination detection rates
- Latency measurements (retrieval, generation, total)

### Visual Progress
- Real-time progress bar
- Case-by-case feedback
- Clear status messages

### Configuration Display
Shows current backend configuration before evaluation:
- BM25 retriever status
- Reranker settings
- Parent retriever configuration
- Chunk sizes and overlaps

## Dependencies

- `@langchain/community`: LLM & embeddings for evaluation
- `langchain`: Core LangChain utilities
- `tsx`: TypeScript execution

## Why Separate?

- ✅ Clean separation: production vs development code
- ✅ Backend stays pure: no evaluation contamination
- ✅ Realistic testing: evaluates the actual HTTP API
- ✅ Flexible deployment: can point to any backend (local, staging, prod)
- ✅ CI/CD: evaluation can run in separate pipeline

## Datasets

### golden_qa.json
Test cases derived from the project documentation:
- Various difficulty levels
- Expected contexts for each query
- Ground truth answers
- Keywords that should appear in answers

### golden_qa_v2.json (default)
Extended test set with more comprehensive coverage:
- Basic to advanced queries
- Edge cases
- Multi-hop reasoning
- Various query types

## Testing Different Configurations

To test different RAG configurations:

1. Edit `apps/backend/.env` with desired settings
2. Restart backend: `npm run dev:backend`
3. Run evaluation: `npm run eval`
4. Compare results manually

Example configurations to test:
- Vector search only (baseline)
- BM25 ensemble (USE_BM25_RETRIEVER=true)
- With reranking (USE_RERANKER=true)
- Parent retriever (USE_PARENT_RETRIEVER=true)
- Combinations of above

## Notes

- Requires backend running on port 3001 (or custom URL)
- Reads document files from `uploads/` directory
- Uses same LLM/embeddings as RAG system (llama3.1:8b, mxbai-embed-large)
- Evaluation temperature: 0.1 (for consistency)
- Results are saved to `benchmark/evaluation/results/`
- Generated files are git-ignored to keep repository clean
