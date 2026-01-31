#!/bin/bash

# Health Check Script
# Verifica que todo el stack RAG esté funcionando correctamente

echo "🏥 RAG SYSTEM HEALTH CHECK"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check Qdrant
echo "1️⃣  Checking Qdrant..."
if curl -s http://localhost:6333/health > /dev/null 2>&1; then
    pass "Qdrant is running on port 6333"

    # Check collection exists
    COLLECTION_EXISTS=$(curl -s http://localhost:6333/collections | grep -o '"documents"' || echo "")
    if [ -n "$COLLECTION_EXISTS" ]; then
        pass "Collection 'documents' exists"

        # Count documents
        DOC_COUNT=$(curl -s http://localhost:6333/collections/documents | grep -o '"points_count":[0-9]*' | cut -d':' -f2)
        if [ "$DOC_COUNT" -gt 0 ]; then
            pass "Documents indexed: $DOC_COUNT chunks"
        else
            warn "No documents indexed yet (run ./upload-docs.sh)"
        fi
    else
        warn "Collection 'documents' doesn't exist (will be created on first upload)"
    fi
else
    fail "Qdrant not running (run: bun run docker:up)"
fi
echo ""

# 2. Check Ollama
echo "2️⃣  Checking Ollama..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    pass "Ollama is running on port 11434"

    # Check models
    MODELS=$(curl -s http://localhost:11434/api/tags)

    if echo "$MODELS" | grep -q "llama3.1:8b"; then
        pass "LLM model found: llama3.1:8b"
    else
        fail "LLM model not found (run: ollama pull llama3.1:8b)"
    fi

    if echo "$MODELS" | grep -q "mxbai-embed-large"; then
        pass "Embedding model found: mxbai-embed-large"
    else
        fail "Embedding model not found (run: ollama pull mxbai-embed-large)"
    fi
else
    fail "Ollama not running (run: ollama serve)"
fi
echo ""

# 3. Check Backend
echo "3️⃣  Checking Backend..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    pass "Backend is running on port 3001"

    # Test API endpoint
    RESPONSE=$(curl -s http://localhost:3001/health)
    if echo "$RESPONSE" | grep -q "ok"; then
        pass "Backend health endpoint responding"
    else
        warn "Backend health endpoint returned unexpected response"
    fi
else
    fail "Backend not running (run: bun run dev:backend)"
fi
echo ""

# 4. Check Frontend
echo "4️⃣  Checking Frontend..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    pass "Frontend is running on port 5173"
else
    warn "Frontend not running (optional, run: bun run dev:frontend)"
fi
echo ""

# 5. Check Configuration
echo "5️⃣  Checking Configuration..."
if [ -f "apps/backend/.env" ]; then
    pass ".env file exists"

    # Check critical variables
    source apps/backend/.env 2>/dev/null

    if [ "$USE_BM25_RETRIEVER" = "true" ]; then
        pass "BM25 retriever enabled (${BM25_WEIGHT}/${VECTOR_WEIGHT})"
    else
        warn "BM25 retriever disabled (vector-only mode)"
    fi

    if [ "$USE_RERANKER" = "true" ]; then
        pass "Reranker enabled (Top ${RERANKER_RETRIEVAL_TOP_K} → ${RERANKER_FINAL_TOP_K})"
    else
        warn "Reranker disabled"
    fi

    if [ "$OLLAMA_MODEL" = "llama3.1:8b" ]; then
        pass "LLM configured: llama3.1:8b"
    else
        warn "LLM configured: $OLLAMA_MODEL (recommended: llama3.1:8b)"
    fi

    if [ "$OLLAMA_EMBEDDINGS_MODEL" = "mxbai-embed-large" ]; then
        pass "Embeddings configured: mxbai-embed-large"
    else
        warn "Embeddings configured: $OLLAMA_EMBEDDINGS_MODEL (recommended: mxbai-embed-large)"
    fi
else
    fail ".env file not found (copy .env.example to .env)"
fi
echo ""

# 6. Quick Integration Test
echo "6️⃣  Quick Integration Test..."
if curl -s http://localhost:3001/health > /dev/null 2>&1 && [ "$DOC_COUNT" -gt 0 ]; then
    TEST_RESPONSE=$(curl -s -X POST http://localhost:3001/api/chat/query \
        -H "Content-Type: application/json" \
        -d '{"question":"test"}' 2>/dev/null)

    if echo "$TEST_RESPONSE" | grep -q "answer"; then
        pass "RAG pipeline responding (end-to-end working)"
    else
        fail "RAG pipeline not responding correctly"
    fi
else
    warn "Skipping integration test (backend or documents missing)"
fi
echo ""

# Summary
echo "=========================="
echo "📊 SUMMARY"
echo "=========================="
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All systems operational!${NC}"
    echo ""
    echo "Next steps:"
    echo "  • Upload documents: ./upload-docs.sh"
    echo "  • Test RAG system: ./test-rag-complete.sh"
    echo "  • Benchmark latency: ./benchmark-latency.sh"
    exit 0
else
    echo -e "${RED}✗ Some checks failed${NC}"
    echo ""
    echo "Fix the issues above and run again."
    exit 1
fi
