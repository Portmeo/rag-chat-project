#!/bin/bash

# Stress Test Script
# Prueba el sistema RAG bajo carga con queries concurrentes

API_URL="http://localhost:3001/api/chat/query"

echo "💪 RAG STRESS TEST"
echo "=================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
CONCURRENT_QUERIES=${1:-10}  # Default: 10 concurrent
TOTAL_QUERIES=${2:-50}       # Default: 50 total
RESULTS_FILE="/tmp/rag_stress_results.txt"

# Test queries pool
declare -a QUERY_POOL=(
    "¿Qué versión de Angular se usa?"
    "¿Por qué se usa NgRx?"
    "¿Cuáles son las ventajas de usar microfrontends?"
    "diferencia entre container y presenter components"
    "¿Cómo funciona el flujo de autenticación con JWT?"
    "¿Qué versión de Ionic se usa?"
    "stack tecnológico del proyecto"
    "¿Cómo se integran los web components en Angular?"
)

echo "Configuration:"
echo "  Concurrent requests: $CONCURRENT_QUERIES"
echo "  Total requests:      $TOTAL_QUERIES"
echo "  Test duration:       ~$(( (TOTAL_QUERIES / CONCURRENT_QUERIES) * 3 ))s"
echo ""

# Clean previous results
> "$RESULTS_FILE"

# Helper: single query request
run_query() {
    local query_id=$1
    local query="${QUERY_POOL[$((RANDOM % ${#QUERY_POOL[@]}))]}"

    local start=$(date +%s%3N)

    response=$(curl -s -m 30 -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"question\":\"$query\"}" 2>/dev/null)

    local end=$(date +%s%3N)
    local latency=$((end - start))

    # Check result
    if echo "$response" | grep -q '"answer"'; then
        echo "SUCCESS|$latency|$query_id" >> "$RESULTS_FILE"
    else
        echo "FAILURE|$latency|$query_id" >> "$RESULTS_FILE"
    fi
}

# Monitor system resources
monitor_resources() {
    while true; do
        # CPU and Memory for backend process
        backend_pid=$(pgrep -f "bun.*backend" | head -1)

        if [ -n "$backend_pid" ]; then
            cpu=$(ps -p "$backend_pid" -o %cpu= 2>/dev/null | tr -d ' ')
            mem=$(ps -p "$backend_pid" -o %mem= 2>/dev/null | tr -d ' ')
            echo "$(date +%s)|$cpu|$mem" >> /tmp/rag_stress_monitor.txt
        fi

        sleep 1
    done
}

# Start monitoring in background
> /tmp/rag_stress_monitor.txt
monitor_resources &
MONITOR_PID=$!

echo "🚀 Starting stress test..."
echo ""

# Progress bar helper
show_progress() {
    local current=$1
    local total=$2
    local width=50
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))

    printf "\r["
    for ((i=0; i<filled; i++)); do printf "="; done
    printf ">"
    for ((i=filled; i<width; i++)); do printf " "; done
    printf "] %3d%% (%d/%d)" $percentage $current $total
}

# Run queries in batches
completed=0
batch_num=0

while [ $completed -lt $TOTAL_QUERIES ]; do
    ((batch_num++))

    # Calculate how many queries in this batch
    remaining=$((TOTAL_QUERIES - completed))
    batch_size=$CONCURRENT_QUERIES
    if [ $remaining -lt $batch_size ]; then
        batch_size=$remaining
    fi

    # Launch batch concurrently
    for i in $(seq 1 $batch_size); do
        query_id=$((completed + i))
        run_query $query_id &
    done

    # Wait for batch to complete
    wait

    completed=$((completed + batch_size))
    show_progress $completed $TOTAL_QUERIES
done

echo ""
echo ""

# Stop monitoring
kill $MONITOR_PID 2>/dev/null
wait $MONITOR_PID 2>/dev/null

echo "📊 Analyzing results..."
echo ""

# Parse results
SUCCESSFUL=$(grep -c "^SUCCESS" "$RESULTS_FILE")
FAILED=$(grep -c "^FAILURE" "$RESULTS_FILE")
SUCCESS_RATE=$((SUCCESSFUL * 100 / TOTAL_QUERIES))

# Calculate latency stats
LATENCIES=$(grep "^SUCCESS" "$RESULTS_FILE" | cut -d'|' -f2)
if [ -n "$LATENCIES" ]; then
    MIN_LATENCY=$(echo "$LATENCIES" | sort -n | head -1)
    MAX_LATENCY=$(echo "$LATENCIES" | sort -n | tail -1)

    # Calculate average
    SUM=0
    COUNT=0
    for lat in $LATENCIES; do
        SUM=$((SUM + lat))
        ((COUNT++))
    done
    AVG_LATENCY=$((SUM / COUNT))

    # Calculate median
    MEDIAN_LATENCY=$(echo "$LATENCIES" | sort -n | awk '{a[NR]=$0} END {print (NR%2==1)?a[(NR+1)/2]:(a[NR/2]+a[NR/2+1])/2}')

    # Calculate p95
    P95_INDEX=$((COUNT * 95 / 100))
    P95_LATENCY=$(echo "$LATENCIES" | sort -n | sed -n "${P95_INDEX}p")
fi

# Resource usage stats
if [ -f /tmp/rag_stress_monitor.txt ]; then
    MAX_CPU=$(cat /tmp/rag_stress_monitor.txt | cut -d'|' -f2 | sort -n | tail -1)
    MAX_MEM=$(cat /tmp/rag_stress_monitor.txt | cut -d'|' -f3 | sort -n | tail -1)
    AVG_CPU=$(cat /tmp/rag_stress_monitor.txt | cut -d'|' -f2 | awk '{s+=$1; c++} END {if(c>0) print s/c; else print 0}')
    AVG_MEM=$(cat /tmp/rag_stress_monitor.txt | cut -d'|' -f3 | awk '{s+=$1; c++} END {if(c>0) print s/c; else print 0}')
fi

# Display results
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 STRESS TEST RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Request Success:"
echo "────────────────"
printf "  Successful:   "
if [ $SUCCESS_RATE -ge 95 ]; then
    echo -e "${GREEN}${SUCCESSFUL}/${TOTAL_QUERIES} (${SUCCESS_RATE}%)${NC} ✓ Excellent"
elif [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${YELLOW}${SUCCESSFUL}/${TOTAL_QUERIES} (${SUCCESS_RATE}%)${NC} ⚠ Good"
else
    echo -e "${RED}${SUCCESSFUL}/${TOTAL_QUERIES} (${SUCCESS_RATE}%)${NC} ✗ Poor"
fi

printf "  Failed:       "
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}${FAILED}${NC} ✓"
else
    echo -e "${RED}${FAILED}${NC} ⚠"
fi

echo ""
echo "Latency Statistics (ms):"
echo "────────────────────────"
echo "  Min:          ${MIN_LATENCY}ms"
echo "  Median:       ${MEDIAN_LATENCY}ms"
echo "  Average:      ${AVG_LATENCY}ms"
echo "  P95:          ${P95_LATENCY}ms"

printf "  Max:          "
if [ $MAX_LATENCY -lt 5000 ]; then
    echo -e "${GREEN}${MAX_LATENCY}ms${NC} ✓"
elif [ $MAX_LATENCY -lt 10000 ]; then
    echo -e "${YELLOW}${MAX_LATENCY}ms${NC} ⚠"
else
    echo -e "${RED}${MAX_LATENCY}ms${NC} ✗ Very slow"
fi

echo ""
echo "Resource Usage:"
echo "───────────────"

if [ -n "$MAX_CPU" ]; then
    printf "  CPU Peak:     "
    MAX_CPU_INT=${MAX_CPU%.*}
    if [ "$MAX_CPU_INT" -lt 80 ]; then
        echo -e "${GREEN}${MAX_CPU}%${NC} ✓"
    elif [ "$MAX_CPU_INT" -lt 95 ]; then
        echo -e "${YELLOW}${MAX_CPU}%${NC} ⚠"
    else
        echo -e "${RED}${MAX_CPU}%${NC} ✗ High"
    fi

    echo "  CPU Average:  ${AVG_CPU}%"
fi

if [ -n "$MAX_MEM" ]; then
    printf "  Memory Peak:  "
    MAX_MEM_INT=${MAX_MEM%.*}
    if [ "$MAX_MEM_INT" -lt 5 ]; then
        echo -e "${GREEN}${MAX_MEM}%${NC} ✓"
    elif [ "$MAX_MEM_INT" -lt 10 ]; then
        echo -e "${YELLOW}${MAX_MEM}%${NC} ⚠"
    else
        echo -e "${RED}${MAX_MEM}%${NC} ✗ High"
    fi

    echo "  Memory Avg:   ${AVG_MEM}%"
fi

echo ""
echo "Throughput:"
echo "───────────"

# Calculate queries per second
TOTAL_DURATION=$(cat /tmp/rag_stress_monitor.txt | wc -l | tr -d ' ')
if [ $TOTAL_DURATION -gt 0 ]; then
    QPS=$((TOTAL_QUERIES / TOTAL_DURATION))
    echo "  Queries/sec:  ${QPS} q/s"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Recommendations
if [ $SUCCESS_RATE -lt 95 ]; then
    echo "⚠️  Warnings:"
    echo "  • Success rate below 95%"
    echo "  • System may be overloaded"
    echo "  • Consider:"
    echo "    - Reducing concurrent requests"
    echo "    - Increasing system resources"
    echo "    - Optimizing query processing"
    echo ""
fi

if [ $MAX_LATENCY -gt 10000 ]; then
    echo "⚠️  High latency detected:"
    echo "  • Some queries took >10s"
    echo "  • Consider:"
    echo "    - Disabling reranking for high load scenarios"
    echo "    - Reducing RERANKER_TIMEOUT_MS"
    echo "    - Scaling horizontally"
    echo ""
fi

if [ -n "$MAX_CPU" ] && [ "${MAX_CPU%.*}" -gt 90 ]; then
    echo "⚠️  High CPU usage:"
    echo "  • Peak CPU: ${MAX_CPU}%"
    echo "  • Consider:"
    echo "    - Using more efficient models"
    echo "    - Reducing concurrent load"
    echo "    - Worker thread optimization"
    echo ""
fi

# Overall assessment
echo "🎯 Overall Assessment:"
if [ $SUCCESS_RATE -ge 95 ] && [ $MAX_LATENCY -lt 5000 ]; then
    echo -e "   ${GREEN}✓ System handles load well${NC}"
    echo "   Ready for production with current concurrency level"
elif [ $SUCCESS_RATE -ge 80 ] && [ $MAX_LATENCY -lt 10000 ]; then
    echo -e "   ${YELLOW}⚠ System handles load acceptably${NC}"
    echo "   Monitor performance under sustained load"
else
    echo -e "   ${RED}✗ System struggles under load${NC}"
    echo "   Optimization needed before scaling"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 To run with different settings:"
echo "   ./stress-test.sh <concurrent> <total>"
echo "   Example: ./stress-test.sh 20 100"
echo ""
echo "✅ Stress test complete"
echo ""

# Cleanup
rm -f "$RESULTS_FILE" /tmp/rag_stress_monitor.txt
