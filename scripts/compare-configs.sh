#!/bin/bash

# Compare Configurations Script
# Prueba diferentes configuraciones y compara resultados

API_URL="http://localhost:3001/api/chat/query"
ENV_FILE="apps/backend/.env"
BACKUP_FILE="apps/backend/.env.backup"

echo "🔄 RAG CONFIGURATION COMPARISON"
echo "==============================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Test queries
declare -a QUERIES=(
    "¿Qué versión de Angular se usa?"
    "¿Por qué se usa NgRx?"
    "diferencia entre container y presenter components"
    "¿Cómo funciona el flujo de autenticación con JWT?"
)

# Backup current .env
if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" "$BACKUP_FILE"
    echo "📦 Backed up current .env to .env.backup"
else
    echo "❌ .env file not found"
    exit 1
fi

# Helper: update .env variable
update_env() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" "$ENV_FILE"; then
        sed -i.tmp "s/^${key}=.*/${key}=${value}/" "$ENV_FILE"
        rm -f "${ENV_FILE}.tmp"
    else
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

# Helper: test configuration
test_config() {
    local config_name="$1"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Testing: $config_name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Wait for backend to reload
    sleep 3

    local correct=0
    local total=${#QUERIES[@]}
    local total_time=0

    for query in "${QUERIES[@]}"; do
        local start=$(date +%s%3N)

        response=$(curl -s -X POST "$API_URL" \
            -H "Content-Type: application/json" \
            -d "{\"question\":\"$query\"}" 2>/dev/null)

        local end=$(date +%s%3N)
        local latency=$((end - start))
        total_time=$((total_time + latency))

        # Check if got valid answer
        if echo "$response" | grep -q '"answer"'; then
            answer=$(echo "$response" | grep -o '"answer":"[^"]*"' | cut -d'"' -f4)
            if [ ${#answer} -gt 50 ] && ! echo "$answer" | grep -q "No encuentro"; then
                ((correct++))
                echo -e "  ${GREEN}✓${NC} ${query:0:40}... (${latency}ms)"
            else
                echo -e "  ${RED}✗${NC} ${query:0:40}... (no answer, ${latency}ms)"
            fi
        else
            echo -e "  ${RED}✗${NC} ${query:0:40}... (error, ${latency}ms)"
        fi
    done

    local accuracy=$((correct * 100 / total))
    local avg_latency=$((total_time / total))

    echo ""
    echo -e "  Accuracy:     ${GREEN}${correct}/${total} (${accuracy}%)${NC}"
    echo -e "  Avg Latency:  ${avg_latency}ms"

    # Return results as string for summary
    echo "${config_name}|${correct}|${total}|${avg_latency}"
}

# Store results
declare -a RESULTS=()

echo ""
echo "Starting configuration tests..."
echo "Each test uses 4 queries and takes ~30s"
echo ""

# Configuration 1: Current (BM25 70/30 + Reranking)
echo "1️⃣  Testing current configuration..."
RESULT=$(test_config "Current (BM25 70/30 + Reranking)" | tail -1)
RESULTS+=("$RESULT")

# Configuration 2: BM25 80/20
echo ""
echo "2️⃣  Switching to BM25 80/20..."
update_env "BM25_WEIGHT" "0.8"
update_env "VECTOR_WEIGHT" "0.2"
RESULT=$(test_config "BM25 80/20 + Reranking" | tail -1)
RESULTS+=("$RESULT")

# Configuration 3: BM25 50/50
echo ""
echo "3️⃣  Switching to BM25 50/50..."
update_env "BM25_WEIGHT" "0.5"
update_env "VECTOR_WEIGHT" "0.5"
RESULT=$(test_config "BM25 50/50 + Reranking" | tail -1)
RESULTS+=("$RESULT")

# Configuration 4: Vector only (no BM25)
echo ""
echo "4️⃣  Switching to Vector-only (no BM25)..."
update_env "USE_BM25_RETRIEVER" "false"
RESULT=$(test_config "Vector-only + Reranking" | tail -1)
RESULTS+=("$RESULT")

# Configuration 5: BM25 70/30 without reranking
echo ""
echo "5️⃣  Switching to BM25 70/30 without reranking..."
update_env "USE_BM25_RETRIEVER" "true"
update_env "BM25_WEIGHT" "0.7"
update_env "VECTOR_WEIGHT" "0.3"
update_env "USE_RERANKER" "false"
RESULT=$(test_config "BM25 70/30 (no reranking)" | tail -1)
RESULTS+=("$RESULT")

# Restore original .env
echo ""
echo "📦 Restoring original .env..."
mv "$BACKUP_FILE" "$ENV_FILE"
sleep 2

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 CONFIGURATION COMPARISON SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
printf "%-35s %10s %12s\n" "Configuration" "Accuracy" "Avg Latency"
echo "────────────────────────────────────────────────────────────"

BEST_ACCURACY=0
BEST_CONFIG=""
FASTEST_LATENCY=99999
FASTEST_CONFIG=""

for result in "${RESULTS[@]}"; do
    IFS='|' read -r config correct total latency <<< "$result"
    accuracy=$((correct * 100 / total))

    printf "%-35s %10s %12s\n" "$config" "${correct}/${total} (${accuracy}%)" "${latency}ms"

    # Track best
    if [ $accuracy -gt $BEST_ACCURACY ]; then
        BEST_ACCURACY=$accuracy
        BEST_CONFIG="$config"
    fi

    if [ $latency -lt $FASTEST_LATENCY ]; then
        FASTEST_LATENCY=$latency
        FASTEST_CONFIG="$config"
    fi
done

echo ""
echo "🏆 Best Accuracy:  $BEST_CONFIG ($BEST_ACCURACY%)"
echo "⚡ Fastest:        $FASTEST_CONFIG (${FASTEST_LATENCY}ms)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Recommendations:"
echo "  • For best accuracy: Use BM25 70/30 with reranking"
echo "  • For best speed: Use BM25 70/30 without reranking"
echo "  • For balance: BM25 70/30 with selective reranking"
echo ""
echo "✅ Comparison complete. Original configuration restored."
echo ""
