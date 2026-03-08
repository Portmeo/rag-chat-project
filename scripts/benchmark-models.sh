#!/bin/bash
# benchmark-models.sh
# Ejecuta el eval RAGAS con cada modelo LLM local y guarda la comparativa.
#
# Uso:
#   ./scripts/benchmark-models.sh
#   ./scripts/benchmark-models.sh --categories "Comparativa,Multi-Hop" --limit 13
#   ./scripts/benchmark-models.sh --full   # dataset completo (58 casos)

set -e

# ─── Configuración ────────────────────────────────────────────────────────────
MODELS=("llama3.1:8b" "qwen2.5:14b" "phi4:14b")
BACKEND_DIR="apps/backend"
EVAL_DIR="apps/evaluation"
ENV_FILE="apps/backend/.env"
BACKEND_URL="http://localhost:3001"
BACKEND_STARTUP_WAIT=15   # segundos para que arranque + reconstruya BM25
JUDGE="ollama"

# Parsear args
EVAL_ARGS="--judge $JUDGE"
if [[ "$*" == *"--full"* ]]; then
  EVAL_ARGS="$EVAL_ARGS"
else
  # Por defecto: solo Comparativa + Multi-Hop
  EXTRA=$(echo "$@" | sed 's/--full//')
  if [[ "$EXTRA" == "" ]]; then
    EVAL_ARGS="$EVAL_ARGS --categories Comparativa,Multi-Hop --limit 13"
  else
    EVAL_ARGS="$EVAL_ARGS $EXTRA"
  fi
fi

# ─── Helpers ─────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
sep()  { echo ""; echo "────────────────────────────────────────────────"; }

kill_backend() {
  local pid
  pid=$(lsof -i :3001 -sTCP:LISTEN -t 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    kill -9 "$pid" 2>/dev/null || true
    sleep 1
    log "Backend parado (PID $pid)"
  fi
}

start_backend() {
  log "Arrancando backend con modelo: $1"
  cd "$BACKEND_DIR"
  npm run dev > /tmp/rag-backend.log 2>&1 &
  BACKEND_PID=$!
  cd - > /dev/null

  log "Esperando ${BACKEND_STARTUP_WAIT}s para que arranque + reconstruya BM25..."
  sleep "$BACKEND_STARTUP_WAIT"

  # Verificar health
  local attempts=0
  until curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [[ $attempts -ge 10 ]]; then
      log "ERROR: Backend no responde tras ${attempts} intentos. Revisa /tmp/rag-backend.log"
      exit 1
    fi
    sleep 3
  done
  log "Backend listo ✓"
}

set_model() {
  local model="$1"
  # Actualizar OLLAMA_MODEL en .env
  sed -i '' "s/^OLLAMA_MODEL=.*/OLLAMA_MODEL=$model/" "$ENV_FILE"
  # Asegurar que USE_CLAUDE está desactivado
  sed -i '' "s/^USE_CLAUDE=.*/USE_CLAUDE=false/" "$ENV_FILE"
  log "Modelo configurado: $model"
}

# ─── Main ────────────────────────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SUMMARY_FILE="/tmp/benchmark-models-summary.txt"
echo "" > "$SUMMARY_FILE"

sep
log "BENCHMARK MULTI-MODELO"
log "Modelos: ${MODELS[*]}"
log "Eval args: $EVAL_ARGS"
log "Juez: $JUDGE"
sep

for MODEL in "${MODELS[@]}"; do
  sep
  log "━━━ MODELO: $MODEL ━━━"
  sep

  kill_backend
  set_model "$MODEL"
  start_backend "$MODEL"

  log "Lanzando eval para $MODEL..."
  EVAL_START=$(date +%s)

  cd "$EVAL_DIR"
  npm run eval -- $EVAL_ARGS 2>&1 | tee /tmp/eval-"${MODEL//[:\/]/-}".log
  EVAL_STATUS=$?
  cd "$ROOT_DIR"

  EVAL_END=$(date +%s)
  EVAL_DURATION=$(( (EVAL_END - EVAL_START) / 60 ))

  if [[ $EVAL_STATUS -eq 0 ]]; then
    # Obtener el fichero de resultados más reciente
    RESULT_FILE=$(ls -t benchmark/evaluation/results/ragas_*.md 2>/dev/null | head -1)
    log "Eval completado en ${EVAL_DURATION}min → $RESULT_FILE"

    # Extraer métricas del md
    FAITH=$(grep -o 'Faithfulness\*\* | [0-9]*%' "$RESULT_FILE" | grep -o '[0-9]*' | head -1 || echo "?")
    RELEV=$(grep -o 'Answer Relevancy\*\* | [0-9]*%' "$RESULT_FILE" | grep -o '[0-9]*' | head -1 || echo "?")
    PREC=$(grep -o 'Context Precision\*\* | [0-9]*%' "$RESULT_FILE" | grep -o '[0-9]*' | head -1 || echo "?")
    RECAL=$(grep -o 'Context Recall\*\* | [0-9]*%' "$RESULT_FILE" | grep -o '[0-9]*' | head -1 || echo "?")
    HALLUC=$(grep -o 'Hallucination Detection\*\* | [0-9]*%' "$RESULT_FILE" | grep -o '[0-9]*' | head -1 || echo "?")

    echo "| $MODEL | ${FAITH}% | ${RELEV}% | ${PREC}% | ${RECAL}% | ${HALLUC}% | ${EVAL_DURATION}min |" >> "$SUMMARY_FILE"
  else
    log "ERROR en eval de $MODEL (exit $EVAL_STATUS)"
    echo "| $MODEL | ERROR | ERROR | ERROR | ERROR | ERROR | ${EVAL_DURATION}min |" >> "$SUMMARY_FILE"
  fi
done

kill_backend

# ─── Resumen final ───────────────────────────────────────────────────────────
sep
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                    COMPARATIVA FINAL DE MODELOS                     ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  Juez: $JUDGE | $(date '+%Y-%m-%d')                                          ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "| Modelo        | Faith | Relev | Prec  | Recall | Halluc | Tiempo |"
echo "|---------------|-------|-------|-------|--------|--------|--------|"
cat "$SUMMARY_FILE"
echo ""
log "Resultados individuales en benchmark/evaluation/results/"
log "Logs de eval en /tmp/eval-*.log"
