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

### Run Full Benchmark

```bash
bun run ../../benchmark/evaluation/run_full_benchmark.ts
```

### Run Quick Test

```bash
bun run ../../benchmark/evaluation/run_full_benchmark.ts --limit 5
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
│   └── datasetLoader.ts      # Dataset loading utilities
├── package.json
└── tsconfig.json
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

## Notes

- Requires backend to be running on port 3001 (or custom URL)
- Reads document files from `uploads/` directory
- Uses same LLM/embeddings as RAG system (llama3.1:8b, mxbai-embed-large)
- Evaluation temperature: 0.1 (for consistency)
