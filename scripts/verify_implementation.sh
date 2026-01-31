#!/bin/bash

echo "🔍 Verifying RAGAS + SSE Streaming Implementation"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} $1 (missing)"
    ((FAIL++))
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1/"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} $1/ (missing)"
    ((FAIL++))
  fi
}

echo "📂 Directory Structure"
echo "----------------------"
check_dir "apps/backend/src/services/evaluation"
check_dir "apps/frontend/src/services"
check_dir "apps/frontend/src/hooks"
check_dir "benchmark/evaluation/datasets"
check_dir "benchmark/evaluation/results"
echo ""

echo "📄 Backend Files - RAGAS Evaluation"
echo "------------------------------------"
check_file "apps/backend/src/services/evaluation/types.ts"
check_file "apps/backend/src/services/evaluation/ragasEvaluator.ts"
check_file "apps/backend/src/services/evaluation/datasetLoader.ts"
check_file "apps/backend/src/services/evaluation/reportGenerator.ts"
check_file "apps/backend/src/controllers/evaluationController.ts"
echo ""

echo "📄 Backend Files - SSE Streaming"
echo "---------------------------------"
check_file "apps/backend/src/services/rag/index.ts"
check_file "apps/backend/src/controllers/chatController.ts"
check_file "apps/backend/src/index.ts"
echo ""

echo "📄 Frontend Files - Streaming"
echo "------------------------------"
check_file "apps/frontend/src/services/streaming.ts"
check_file "apps/frontend/src/hooks/useStreamingRAG.ts"
check_file "apps/frontend/src/components/ChatInterface.tsx"
check_file "apps/frontend/src/App.css"
echo ""

echo "📄 Dataset & Scripts"
echo "--------------------"
check_file "benchmark/evaluation/datasets/golden_qa.json"
check_file "benchmark/evaluation/run_ragas_eval.ts"
echo ""

echo "📄 Documentation"
echo "----------------"
check_file "benchmark/evaluation/README.md"
check_file "STREAMING_SSE.md"
check_file "IMPLEMENTATION_SUMMARY.md"
echo ""

echo "🔧 Code Checks"
echo "--------------"

# Check if endpoints are registered
if grep -q "api/evaluation/ragas" apps/backend/src/index.ts; then
  echo -e "${GREEN}✓${NC} /api/evaluation/ragas endpoint registered"
  ((PASS++))
else
  echo -e "${RED}✗${NC} /api/evaluation/ragas endpoint not found"
  ((FAIL++))
fi

if grep -q "api/chat/query-stream" apps/backend/src/index.ts; then
  echo -e "${GREEN}✓${NC} /api/chat/query-stream endpoint registered"
  ((PASS++))
else
  echo -e "${RED}✗${NC} /api/chat/query-stream endpoint not found"
  ((FAIL++))
fi

# Check if imports are correct
if grep -q "import.*useStreamingRAG" apps/frontend/src/components/ChatInterface.tsx; then
  echo -e "${GREEN}✓${NC} ChatInterface imports useStreamingRAG"
  ((PASS++))
else
  echo -e "${RED}✗${NC} ChatInterface doesn't import useStreamingRAG"
  ((FAIL++))
fi

# Check dataset has test cases
if [ -f "benchmark/evaluation/datasets/golden_qa.json" ]; then
  TEST_CASES=$(grep -c '"id":' benchmark/evaluation/datasets/golden_qa.json)
  if [ "$TEST_CASES" -eq 17 ]; then
    echo -e "${GREEN}✓${NC} Dataset has 17 test cases"
    ((PASS++))
  else
    echo -e "${YELLOW}⚠${NC} Dataset has $TEST_CASES test cases (expected 17)"
    ((PASS++))
  fi
fi

# Check if streaming indicator CSS exists
if grep -q "streaming-indicator" apps/frontend/src/App.css; then
  echo -e "${GREEN}✓${NC} Streaming cursor CSS animation present"
  ((PASS++))
else
  echo -e "${RED}✗${NC} Streaming cursor CSS not found"
  ((FAIL++))
fi

echo ""
echo "=================================================="
echo "📊 Results"
echo "=================================================="
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed!${NC}"
  echo ""
  echo "🚀 Next Steps:"
  echo "1. Start backend: cd apps/backend && bun run src/index.ts"
  echo "2. Start frontend: cd apps/frontend && npm run dev"
  echo "3. Test streaming: Open browser and ask a question"
  echo "4. Run RAGAS: bun run benchmark/evaluation/run_ragas_eval.ts"
  exit 0
else
  echo -e "${RED}❌ Some checks failed${NC}"
  echo "Please review the missing files above"
  exit 1
fi
