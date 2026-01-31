#!/bin/bash

# Quality Test Script
# Evalúa calidad de respuestas del sistema RAG con métricas detalladas

API_URL="http://localhost:3001/api/chat/query"

echo "🎯 RAG QUALITY ASSESSMENT"
echo "========================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test cases with expected criteria
declare -A QUERIES
declare -A EXPECTED_KEYWORDS
declare -A EXPECTED_FILES

# Basic queries
QUERIES[1]="¿Qué versión de Angular se usa?"
EXPECTED_KEYWORDS[1]="15|Angular|version"
EXPECTED_FILES[1]="package.json|stack-tecnologico"

QUERIES[2]="Angular Ionic version"
EXPECTED_KEYWORDS[2]="15|Angular"
EXPECTED_FILES[2]="package.json|stack-tecnologico"

# Conceptual queries
QUERIES[3]="¿Por qué se usa NgRx para gestionar el estado?"
EXPECTED_KEYWORDS[3]="estado|state|NgRx|centralizado|predecible"
EXPECTED_FILES[3]="arquitectura|ngrx"

QUERIES[4]="¿Cuáles son las ventajas de usar microfrontends?"
EXPECTED_KEYWORDS[4]="microfrontend|independiente|escalab|autónom"
EXPECTED_FILES[4]="arquitectura|microfrontend"

# Process queries
QUERIES[5]="¿Cómo funciona el flujo de autenticación con JWT?"
EXPECTED_KEYWORDS[5]="JWT|token|login|autenticación|LocalStorage"
EXPECTED_FILES[5]="autenticacion|jwt|auth"

# Comparative queries
QUERIES[6]="diferencia entre container y presenter components"
EXPECTED_KEYWORDS[6]="container|presenter|component|lógica|smart|dumb"
EXPECTED_FILES[6]="arquitectura|component|patron"

# Metrics
TOTAL_QUERIES=${#QUERIES[@]}
CORRECT_ANSWERS=0
CORRECT_SOURCES=0
HALLUCINATIONS=0
TOTAL_LATENCY=0
NO_ANSWER=0

echo "Running $TOTAL_QUERIES quality tests..."
echo ""

# Test each query
for i in $(seq 1 $TOTAL_QUERIES); do
    query="${QUERIES[$i]}"
    keywords="${EXPECTED_KEYWORDS[$i]}"
    files="${EXPECTED_FILES[$i]}"

    echo -e "${BLUE}[$i/$TOTAL_QUERIES]${NC} $query"

    start=$(date +%s%3N)

    response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"question\":\"$query\"}" 2>/dev/null)

    end=$(date +%s%3N)
    latency=$((end - start))
    TOTAL_LATENCY=$((TOTAL_LATENCY + latency))

    # Extract answer and sources
    answer=$(echo "$response" | python3 -c "import sys, json; r=json.load(sys.stdin); print(r.get('answer', ''))" 2>/dev/null || echo "")
    sources=$(echo "$response" | python3 -c "import sys, json; r=json.load(sys.stdin); print(' '.join([s.get('filename', '') for s in r.get('sources', [])]))" 2>/dev/null || echo "")

    # Check 1: Has answer?
    if [ -z "$answer" ] || echo "$answer" | grep -qi "no encuentro"; then
        echo -e "  ${RED}✗ Answer:${NC} No relevant answer found"
        ((NO_ANSWER++))
    else
        # Check 2: Contains expected keywords?
        keyword_found=false
        IFS='|' read -ra KW_ARRAY <<< "$keywords"
        for kw in "${KW_ARRAY[@]}"; do
            if echo "$answer" | grep -qi "$kw"; then
                keyword_found=true
                break
            fi
        done

        if [ "$keyword_found" = true ]; then
            echo -e "  ${GREEN}✓ Answer:${NC} Contains expected keywords"
            ((CORRECT_ANSWERS++))
        else
            echo -e "  ${YELLOW}⚠ Answer:${NC} Missing expected keywords"
            echo -e "    Expected: $keywords"
            ((HALLUCINATIONS++))
        fi
    fi

    # Check 3: Sources are relevant?
    if [ -n "$sources" ]; then
        source_found=false
        IFS='|' read -ra FILE_ARRAY <<< "$files"
        for file_pattern in "${FILE_ARRAY[@]}"; do
            if echo "$sources" | grep -qi "$file_pattern"; then
                source_found=true
                break
            fi
        done

        if [ "$source_found" = true ]; then
            echo -e "  ${GREEN}✓ Sources:${NC} Relevant files found"
            ((CORRECT_SOURCES++))
        else
            echo -e "  ${YELLOW}⚠ Sources:${NC} Expected files not found"
            echo -e "    Expected: $files"
            echo -e "    Got: $sources"
        fi
    else
        echo -e "  ${RED}✗ Sources:${NC} No sources returned"
    fi

    # Check 4: Latency
    if [ $latency -lt 2000 ]; then
        echo -e "  ${GREEN}✓ Latency:${NC} ${latency}ms (good)"
    elif [ $latency -lt 3000 ]; then
        echo -e "  ${YELLOW}⚠ Latency:${NC} ${latency}ms (acceptable)"
    else
        echo -e "  ${RED}✗ Latency:${NC} ${latency}ms (slow)"
    fi

    echo ""
done

# Calculate metrics
ACCURACY=$((CORRECT_ANSWERS * 100 / TOTAL_QUERIES))
SOURCE_ACCURACY=$((CORRECT_SOURCES * 100 / TOTAL_QUERIES))
AVG_LATENCY=$((TOTAL_LATENCY / TOTAL_QUERIES))
HALLUCINATION_RATE=$((HALLUCINATIONS * 100 / TOTAL_QUERIES))

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 QUALITY METRICS SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Answer Quality:"
echo "───────────────"
printf "  Accuracy:           "
if [ $ACCURACY -ge 80 ]; then
    echo -e "${GREEN}${ACCURACY}%${NC} (${CORRECT_ANSWERS}/${TOTAL_QUERIES}) ✓ Excellent"
elif [ $ACCURACY -ge 60 ]; then
    echo -e "${YELLOW}${ACCURACY}%${NC} (${CORRECT_ANSWERS}/${TOTAL_QUERIES}) ⚠ Good"
else
    echo -e "${RED}${ACCURACY}%${NC} (${CORRECT_ANSWERS}/${TOTAL_QUERIES}) ✗ Needs improvement"
fi

printf "  Source Quality:     "
if [ $SOURCE_ACCURACY -ge 80 ]; then
    echo -e "${GREEN}${SOURCE_ACCURACY}%${NC} (${CORRECT_SOURCES}/${TOTAL_QUERIES}) ✓ Excellent"
elif [ $SOURCE_ACCURACY -ge 60 ]; then
    echo -e "${YELLOW}${SOURCE_ACCURACY}%${NC} (${CORRECT_SOURCES}/${TOTAL_QUERIES}) ⚠ Good"
else
    echo -e "${RED}${SOURCE_ACCURACY}%${NC} (${CORRECT_SOURCES}/${TOTAL_QUERIES}) ✗ Needs improvement"
fi

printf "  No Answer Rate:     "
NO_ANSWER_RATE=$((NO_ANSWER * 100 / TOTAL_QUERIES))
if [ $NO_ANSWER_RATE -eq 0 ]; then
    echo -e "${GREEN}${NO_ANSWER_RATE}%${NC} ✓ Perfect"
elif [ $NO_ANSWER_RATE -lt 20 ]; then
    echo -e "${YELLOW}${NO_ANSWER_RATE}%${NC} ⚠ Acceptable"
else
    echo -e "${RED}${NO_ANSWER_RATE}%${NC} ✗ Too high"
fi

printf "  Hallucination Rate: "
if [ $HALLUCINATION_RATE -eq 0 ]; then
    echo -e "${GREEN}${HALLUCINATION_RATE}%${NC} ✓ Perfect"
elif [ $HALLUCINATION_RATE -lt 20 ]; then
    echo -e "${YELLOW}${HALLUCINATION_RATE}%${NC} ⚠ Low"
else
    echo -e "${RED}${HALLUCINATION_RATE}%${NC} ✗ High"
fi

echo ""
echo "Performance:"
echo "────────────"
printf "  Avg Response Time:  "
if [ $AVG_LATENCY -lt 2000 ]; then
    echo -e "${GREEN}${AVG_LATENCY}ms${NC} ✓ Fast"
elif [ $AVG_LATENCY -lt 3000 ]; then
    echo -e "${YELLOW}${AVG_LATENCY}ms${NC} ⚠ Acceptable"
else
    echo -e "${RED}${AVG_LATENCY}ms${NC} ✗ Slow"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Overall grade
OVERALL_SCORE=$(( (ACCURACY + SOURCE_ACCURACY) / 2 ))

echo "🎓 Overall Grade:"
if [ $OVERALL_SCORE -ge 85 ]; then
    echo -e "   ${GREEN}A (${OVERALL_SCORE}%) - Excellent${NC}"
    echo "   System is production-ready"
elif [ $OVERALL_SCORE -ge 70 ]; then
    echo -e "   ${GREEN}B (${OVERALL_SCORE}%) - Good${NC}"
    echo "   System is working well"
elif [ $OVERALL_SCORE -ge 60 ]; then
    echo -e "   ${YELLOW}C (${OVERALL_SCORE}%) - Acceptable${NC}"
    echo "   Consider tuning configuration"
else
    echo -e "   ${RED}D (${OVERALL_SCORE}%) - Needs Work${NC}"
    echo "   Review embeddings model, weights, or documents"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $HALLUCINATION_RATE -gt 20 ]; then
    echo "💡 Recommendations:"
    echo "  • High hallucination rate detected"
    echo "  • Check prompt template (should emphasize staying grounded)"
    echo "  • Consider enabling/tuning reranking"
    echo "  • Verify document quality and coverage"
    echo ""
fi

if [ $NO_ANSWER_RATE -gt 20 ]; then
    echo "💡 Recommendations:"
    echo "  • High 'no answer' rate detected"
    echo "  • Check if documents cover these topics"
    echo "  • Adjust BM25/Vector weights (try 50/50 or 60/40)"
    echo "  • Consider increasing RERANKER_RETRIEVAL_TOP_K"
    echo ""
fi

echo "✅ Quality assessment complete"
echo ""
