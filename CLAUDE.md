# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Development (3 terminals needed: Qdrant, Ollama, App)
npm run docker:up          # Start Qdrant (localhost:6333)
ollama serve               # Start Ollama (localhost:11434)
npm run dev:backend        # Backend on :3001 (tsx watch, no compilation)
npm run dev:frontend       # Frontend on :5173 (Vite)

# Production build
npm run build              # Build all workspaces
cd apps/backend && npm start  # Run compiled backend

# Type checking
cd apps/backend && npm run type-check

# Frontend lint
cd apps/frontend && npm run lint

# Retrieval layer tests (run from project root or apps/backend)
cd apps/backend && npm run test:base
cd apps/backend && npm run test:ensemble
cd apps/backend && npm run test:parent-child
cd apps/backend && npm run test:reranker-inspect

# RAGAS evaluation (always use --judge sonnet, Haiku is too lenient)
cd apps/evaluation && npm run eval -- --judge sonnet --limit 5        # Quick
cd apps/evaluation && npm run eval -- --judge sonnet                  # Full (58 cases)
cd apps/evaluation && npm run eval -- --judge sonnet --categories "Comparativa,Multi-Hop"

# Kill stuck backend
lsof -i :3001 -sTCP:LISTEN -t | xargs kill -9
```

## Architecture

**Monorepo** with npm workspaces: `apps/backend`, `apps/frontend`, `apps/evaluation`.

### RAG Pipeline (apps/backend/src/services/rag/index.ts)

1. **Multi-query generation** — 3 query variants via LLM
2. **Ensemble retrieval** — Vector (60%) + BM25 (40%) on child chunks (~200 chars)
3. **Parent-child hydration** — children → unique parents (~1000 chars) via 1 SQLite query
4. **Reranking** — bge-reranker-base in Worker thread (Top 20 → Top 5), 30s timeout
5. **Contextual compression** — cosine similarity filter (threshold 0.30) per parent
6. **LLM generation** — Claude Haiku or Ollama, temperature 0.0

### Storage

- **Qdrant** — child chunks with embeddings (mxbai-embed-large, 1024 dims, Cosine)
- **SQLite** (`apps/backend/data/rag.db`) — parents, BM25 index, query log. WAL mode. Singleton in `lib/database.ts`
- Repositories use interfaces (`repositories/interfaces.ts`): IParentStorage, IBM25Storage, IQueryLogger

### Configuration

All RAG config via environment variables, centralized in `services/rag/config.ts`. Key toggles:
- `USE_CLAUDE=true` → Claude API; `false` → Ollama (`OLLAMA_MODEL`)
- `USE_RERANKER`, `USE_BM25_RETRIEVER`, `USE_PARENT_RETRIEVER`, `USE_CONTEXTUAL_COMPRESSION`

### Frontend

React 19 + React Router 7 + Radix UI + Tailwind CSS. Streaming responses via SSE.

## Critical Constraints

- **Embeddings model is mxbai-embed-large** — DO NOT change without re-indexing the entire vector DB
- **BGE reranker scores are logits** (unbounded, can be negative) — never treat as percentages or apply absolute thresholds
- **tsx watch (dev mode)**: Worker threads (.ts) fail silently — reranker falls back gracefully. Workers only work after `npm run build`
- **BM25 indexes only children** when Parent-Child is active. Indexing parents too causes duplicates
- **Instruction-prefixed embeddings**: query prefix differs from document prefix (see `instructionPrefixedEmbeddings.ts`)
- **DO NOT re-index without user confirmation** — destroys the entire vector DB

## Code Conventions

- **Logger**: always use `createLogger('LAYER_NAME')` from `lib/logger.ts`. Enable with `RAG_LOGS=true`
- **Config**: all values from `services/rag/config.ts` via `process.env`. Never hardcode
- **Sources deduplication**: `docsToSources()` in `index.ts` deduplicates by filename with Set

## Memory System (Engram)

Persistent memory via Engram MCP server. Use these tools to record decisions, discoveries, and learnings so future sessions can build on this work.

### When to Save Memory

Call `mem_save` immediately after:
- Completing a bug fix
- Making an architecture or design decision
- Discovering non-obvious codebase patterns
- Setting up configuration or environment
- Establishing naming or structural conventions
- Learning user preferences or constraints

### Save Format

```
title: [Verb + what] — short, searchable (e.g., "Fixed N+1 query in UserList")
type: bugfix | decision | architecture | discovery | pattern | config | preference
scope: project (default) | personal
topic_key: (optional) stable key like architecture/auth-model for evolving topics
content:
  **What**: One sentence describing the action
  **Why**: Motivation (user request, performance, bug, etc.)
  **Where**: Files or paths affected
  **Learned**: Gotchas or surprising findings (omit if none)
```

### Reusing Topic Keys

- Call `mem_suggest_topic_key` before `mem_save` if uncertain
- Reuse the same `topic_key` to update an evolving topic instead of creating duplicates
- Use `mem_update` when you have an exact observation ID to correct

### When to Search Memory

Search when the user asks to "remember," "recall," or references past work:
1. Call `mem_context` first (checks recent sessions — fast)
2. If not found, call `mem_search` with keywords (full-text search)
3. Use `mem_get_observation` for full untruncated content

Also search proactively when starting work that may have been done before or when the user mentions a topic with no context.

### Session Close (Mandatory)

Before saying "done" or ending a session, call `mem_session_summary` with this structure:

```
## Goal
[What we were working on]

## Instructions
[User preferences or constraints discovered]

## Discoveries
- [Technical findings, gotchas, learnings]

## Accomplished
- [Completed items with key details]

## Next Steps
- [What remains for the next session]

## Relevant Files
- path/to/file — [what changed or what it does]
```

Skipping this means the next session starts without context.

### After Compaction

If you see "FIRST ACTION REQUIRED" in your context:
1. IMMEDIATELY call `mem_session_summary` with the compacted summary content
2. Then call `mem_context` to recover additional context from previous sessions
3. Only then continue working

Do not skip step 1 — everything before compaction is lost without it.

## Repository Rules (from .claude/CLAUDE.md)

- **No git commits without explicit user request** — always ask before committing
- **No plan/summary files** — communicate via chat, not temp files
- **README.md is the central doc** — update it directly for project-level changes
- **Technical docs in /docs/** — always link new docs from README.md
