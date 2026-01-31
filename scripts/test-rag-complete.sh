#!/bin/bash

# Test completo del sistema RAG con BM25 + Reranking
# =====================================================

echo "🧪 Testing RAG System (BM25 + mxbai-embed-large + Reranking)"
echo "=============================================================="
echo ""

# Configuración
API_URL="http://localhost:3001/api/chat/query"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para probar una query
test_query() {
    local query="$1"
    local category="$2"

    echo -e "${BLUE}[$category]${NC} Query: $query"

    response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"question\":\"$query\"}")

    # Extraer answer (simplificado)
    answer=$(echo "$response" | grep -o '"answer":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -n "$answer" ]; then
        echo -e "${GREEN}✅ Respuesta:${NC} ${answer:0:200}..."
    else
        echo -e "${RED}❌ No response${NC}"
    fi
    echo ""
}

echo "=== QUERIES BÁSICAS (Keywords) ==="
echo ""
test_query "¿Qué versión de Angular se usa?" "BÁSICA"
test_query "Angular Ionic version" "BÁSICA"
test_query "stack tecnológico del proyecto" "BÁSICA"

echo ""
echo "=== QUERIES CONCEPTUALES (Semántica profunda) ==="
echo ""
test_query "¿Por qué se usa NgRx para gestionar el estado?" "CONCEPTUAL"
test_query "¿Cuáles son las ventajas de usar microfrontends?" "CONCEPTUAL"
test_query "¿Qué beneficios tiene el patrón container-presenter?" "CONCEPTUAL"

echo ""
echo "=== QUERIES DE RELACIÓN (Conectar conceptos) ==="
echo ""
test_query "¿Cómo se integran los web components en Angular?" "RELACIÓN"
test_query "¿Qué relación hay entre NgRx y la arquitectura de la app?" "RELACIÓN"

echo ""
echo "=== QUERIES DE PROCESO (Flujos) ==="
echo ""
test_query "¿Cómo funciona el flujo de autenticación con JWT?" "PROCESO"
test_query "¿Qué pasa cuando un usuario hace login?" "PROCESO"

echo ""
echo "=== QUERIES COMPARATIVAS ==="
echo ""
test_query "diferencia entre container y presenter components" "COMPARATIVA"
test_query "ventajas de JWT vs sesiones tradicionales" "COMPARATIVA"

echo ""
echo "=============================================================="
echo "✅ Test completado"
echo ""
