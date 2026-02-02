#!/bin/bash

# Script helper para ejecutar una configuración específica
# Uso: ./run-config.sh <config-name>
# Ejemplo: ./run-config.sh baseline

CONFIG=$1

if [ -z "$CONFIG" ]; then
  echo "❌ Error: Debes especificar la configuración"
  echo "Uso: ./run-config.sh <config>"
  echo ""
  echo "Configuraciones disponibles:"
  echo "  - baseline"
  echo "  - bm25"
  echo "  - rerank"
  echo "  - parent"
  echo "  - bm25-rerank"
  echo "  - bm25-parent"
  echo "  - rerank-parent"
  echo "  - full"
  exit 1
fi

echo "======================================================================="
echo "🎯 EJECUTANDO CONFIGURACIÓN: $CONFIG"
echo "======================================================================="

# 1. Mostrar .env actual
echo ""
echo "1️⃣  Configuración actual del .env:"
echo "-----------------------------------------------------------------------"
grep "^USE_" apps/backend/.env
echo "-----------------------------------------------------------------------"
echo ""
echo "⚠️  IMPORTANTE: Verifica que el .env tiene la configuración correcta para '$CONFIG'"
echo "   Si NO es correcta, edita el archivo ahora:"
echo "   nano apps/backend/.env"
echo ""
read -p "¿La configuración es correcta? (y/n): " confirm

if [ "$confirm" != "y" ]; then
  echo "❌ Abortado. Edita el .env y vuelve a ejecutar."
  exit 1
fi

# 2. Reiniciar backend
echo ""
echo "2️⃣  Reiniciando backend..."
pkill -9 -f "npm run dev" 2>/dev/null
sleep 2

npm run dev:backend > benchmark/evaluation/results/backend.log 2>&1 &
echo "   Backend iniciando..."
sleep 10

# Verificar health
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo "   ✅ Backend está corriendo"
else
  echo "   ❌ ERROR: Backend no respondió"
  echo "   Revisa el log: tail -f benchmark/evaluation/results/backend.log"
  exit 1
fi

# 3. Ejecutar benchmark
echo ""
echo "3️⃣  Ejecutando benchmark (esto tomará ~8-10 minutos)..."
echo "   Puedes monitorear el progreso en otra terminal con:"
echo "   tail -f benchmark/evaluation/results/backend.log"
echo ""

npx tsx benchmark/evaluation/run_full_benchmark.ts \
  --dataset rag-optimization-benchmark.json \
  --output benchmark/evaluation/results/temp

# Verificar que se generaron archivos
if [ ! -f benchmark/evaluation/results/temp/ragas_*.json ]; then
  echo "❌ ERROR: No se generaron archivos de resultados"
  exit 1
fi

# 4. Mover resultados
echo ""
echo "4️⃣  Guardando resultados..."
TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)

mv benchmark/evaluation/results/temp/ragas_*.json benchmark/evaluation/results/${CONFIG}_${TIMESTAMP}.json
mv benchmark/evaluation/results/temp/ragas_*.md benchmark/evaluation/results/${CONFIG}_${TIMESTAMP}.md

echo "   ✅ Resultados guardados:"
echo "   📄 ${CONFIG}_${TIMESTAMP}.json"
echo "   📄 ${CONFIG}_${TIMESTAMP}.md"

# 5. Mostrar resumen
echo ""
echo "5️⃣  Resumen de resultados:"
echo "-----------------------------------------------------------------------"
cat benchmark/evaluation/results/${CONFIG}_${TIMESTAMP}.json | jq '.summary | {
  total_cases,
  successful,
  avg_answer_relevancy,
  avg_answer_correctness,
  avg_latency_ms
}'

echo ""
echo "======================================================================="
echo "✅ CONFIGURACIÓN $CONFIG COMPLETADA"
echo "======================================================================="
echo ""
echo "💡 Siguiente paso:"
echo "   1. Revisa que los resultados tienen sentido"
echo "   2. Edita apps/backend/.env con la siguiente configuración"
echo "   3. Ejecuta: ./run-config.sh <siguiente-config>"
echo ""
