#!/bin/bash

# Latency Benchmark Script
# Mide tiempos de respuesta del sistema RAG con diferentes configuraciones

API_URL="http://localhost:3001/api/chat/query"

echo "⏱️  RAG LATENCY BENCHMARK"
echo "========================"
echo ""

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test queries (diferentes complejidades)
declare -a QUERIES=(
    "¿Qué versión de Angular se usa?"
    "¿Por qué se usa NgRx?"
    "diferencia entre container y presenter components"
)

# Helper function to measure latency
measure_latency() {
    local query="$1"
    local start=$(date +%s%3N)

    response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"question\":\"$query\"}" 2>/dev/null)

    local end=$(date +%s%3N)
    local latency=$((end - start))

    # Check if successful
    if echo "$response" | grep -q '"answer"'; then
        echo "$latency"
    else
        echo "ERROR"
    fi
}

# Run benchmark with current configuration
echo "📊 Testing with current configuration..."
echo ""

TOTAL_TIME=0
SUCCESSFUL=0
FAILED=0

for query in "${QUERIES[@]}"; do
    echo -e "${BLUE}Query:${NC} ${query:0:50}..."

    # Warm-up request
    curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"question\":\"$query\"}" > /dev/null 2>&1

    # Measure 3 times and get average
    sum=0
    count=0

    for i in {1..3}; do
        latency=$(measure_latency "$query")

        if [ "$latency" != "ERROR" ]; then
            sum=$((sum + latency))
            count=$((count + 1))
            echo "  Run $i: ${latency}ms"
        else
            echo "  Run $i: ERROR"
            ((FAILED++))
        fi
    done

    if [ $count -gt 0 ]; then
        avg=$((sum / count))
        echo -e "${GREEN}  Average: ${avg}ms${NC}"
        TOTAL_TIME=$((TOTAL_TIME + avg))
        ((SUCCESSFUL++))
    else
        echo -e "${YELLOW}  Average: FAILED${NC}"
    fi

    echo ""
done

# Calculate overall average
if [ $SUCCESSFUL -gt 0 ]; then
    OVERALL_AVG=$((TOTAL_TIME / SUCCESSFUL))
    echo "========================"
    echo -e "${GREEN}Overall Average Latency: ${OVERALL_AVG}ms${NC}"
    echo "Successful queries: $SUCCESSFUL/${#QUERIES[@]}"
    echo ""
fi

# Breakdown estimation (based on typical distribution)
echo "📈 Estimated Breakdown:"
echo "------------------------"
echo "  Multi-query generation: ~150-200ms"
echo "  Retrieval (BM25+Vector): ~100-150ms"
echo "  Reranking (if enabled):  ~500-800ms"
echo "  LLM generation:          ~800-1500ms"
echo ""
echo "Total expected: ~1550-2650ms"
echo ""

# Performance tips
echo "💡 Performance Tips:"
echo "------------------------"
if [ $OVERALL_AVG -gt 3000 ]; then
    echo "  ⚠️  Latency is high (>3s)"
    echo "     • Check if reranking is needed (disable with USE_RERANKER=false)"
    echo "     • Consider reducing RERANKER_RETRIEVAL_TOP_K from 20 to 10"
    echo "     • Check Ollama/Qdrant are running locally (not remote)"
elif [ $OVERALL_AVG -gt 2000 ]; then
    echo "  ✓ Latency is acceptable (2-3s)"
    echo "     • This is expected with reranking enabled"
    echo "     • Consider disabling reranking if speed is critical"
elif [ $OVERALL_AVG -gt 1000 ]; then
    echo "  ✓ Latency is good (1-2s)"
    echo "     • Typical for BM25+Vector without reranking"
    echo "     • Enable reranking for +10-15% accuracy at cost of +500ms"
else
    echo "  ✓✓ Latency is excellent (<1s)"
    echo "     • Vector-only mode or very simple queries"
fi
echo ""

# Compare with/without reranking (if reranking is enabled)
if grep -q "USE_RERANKER=true" apps/backend/.env 2>/dev/null; then
    echo "🔄 Reranking Impact:"
    echo "------------------------"
    echo "  Current (with reranking): ${OVERALL_AVG}ms"

    ESTIMATED_WITHOUT=$((OVERALL_AVG - 600))
    echo "  Estimated (without):      ~${ESTIMATED_WITHOUT}ms"
    echo ""
    echo "  Trade-off: +600ms for +10-15% accuracy"
    echo "  To disable: Set USE_RERANKER=false in .env"
fi

echo ""
echo "========================"
echo "✅ Benchmark completed"
echo ""
