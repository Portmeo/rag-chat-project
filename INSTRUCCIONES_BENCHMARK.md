# Instrucciones para Ejecutar Benchmark Manual

## Configuraciones a Probar (8 total)

Ejecutaremos 8 configuraciones en orden. Para cada una:
1. Modificar `.env`
2. Reiniciar backend
3. Ejecutar benchmark
4. Repetir

**Tiempo estimado:** 10-15 minutos por configuración = ~2 horas total

---

## ⚙️ CONFIGURACIÓN 1: BASELINE (vector search solo)

### 1. Editar `.env` del backend

```bash
nano apps/backend/.env
```

**Configurar:**
```env
USE_BM25_RETRIEVER=false
USE_RERANKER=false
USE_PARENT_RETRIEVER=false
```

### 2. Reiniciar backend

```bash
# Matar procesos viejos
pkill -9 -f "npm run dev"

# Iniciar backend
npm run dev:backend > benchmark/evaluation/results/backend.log 2>&1 &

# Esperar 10 segundos
sleep 10

# Verificar que está corriendo
curl http://localhost:3001/health
```

### 3. Ejecutar benchmark

```bash
npx tsx benchmark/evaluation/run_full_benchmark.ts \
  --dataset rag-optimization-benchmark.json \
  --output benchmark/evaluation/results/temp
```

### 4. Mover resultados

```bash
mv benchmark/evaluation/results/temp/ragas_*.json benchmark/evaluation/results/baseline_$(date +%Y-%m-%dT%H-%M-%S).json
mv benchmark/evaluation/results/temp/ragas_*.md benchmark/evaluation/results/baseline_$(date +%Y-%m-%dT%H-%M-%S).md
```

---

## ⚙️ CONFIGURACIÓN 2: BM25 (ensemble retrieval)

### 1. Editar `.env`

```env
USE_BM25_RETRIEVER=true
BM25_WEIGHT=0.7
VECTOR_WEIGHT=0.3
USE_RERANKER=false
USE_PARENT_RETRIEVER=false
```

### 2. Reiniciar backend

```bash
pkill -9 -f "npm run dev"
npm run dev:backend > benchmark/evaluation/results/backend.log 2>&1 &
sleep 10
curl http://localhost:3001/health
```

### 3. Ejecutar benchmark

```bash
npx tsx benchmark/evaluation/run_full_benchmark.ts \
  --dataset rag-optimization-benchmark.json \
  --output benchmark/evaluation/results/temp
```

### 4. Mover resultados

```bash
mv benchmark/evaluation/results/temp/ragas_*.json benchmark/evaluation/results/bm25_$(date +%Y-%m-%dT%H-%M-%S).json
mv benchmark/evaluation/results/temp/ragas_*.md benchmark/evaluation/results/bm25_$(date +%Y-%m-%dT%H-%M-%S).md
```

---

## ⚙️ CONFIGURACIÓN 3: RERANK (cross-encoder reranking)

### 1. Editar `.env`

```env
USE_BM25_RETRIEVER=false
USE_RERANKER=true
RERANKER_RETRIEVAL_TOP_K=20
RERANKER_FINAL_TOP_K=5
USE_PARENT_RETRIEVER=false
```

### 2. Reiniciar backend

```bash
pkill -9 -f "npm run dev"
npm run dev:backend > benchmark/evaluation/results/backend.log 2>&1 &
sleep 10
curl http://localhost:3001/health
```

### 3. Ejecutar benchmark

```bash
npx tsx benchmark/evaluation/run_full_benchmark.ts \
  --dataset rag-optimization-benchmark.json \
  --output benchmark/evaluation/results/temp
```

### 4. Mover resultados

```bash
mv benchmark/evaluation/results/temp/ragas_*.json benchmark/evaluation/results/rerank_$(date +%Y-%m-%dT%H-%M-%S).json
mv benchmark/evaluation/results/temp/ragas_*.md benchmark/evaluation/results/rerank_$(date +%Y-%m-%dT%H-%M-%S).md
```

---

## ⚙️ CONFIGURACIÓN 4: PARENT (parent document retriever)

### 1. Editar `.env`

```env
USE_BM25_RETRIEVER=false
USE_RERANKER=false
USE_PARENT_RETRIEVER=true
PARENT_CHUNK_SIZE=1000
CHILD_CHUNK_SIZE=200
CHILD_CHUNK_OVERLAP=50
PARENT_CHUNK_OVERLAP=200
```

### 2. Reiniciar backend

```bash
pkill -9 -f "npm run dev"
npm run dev:backend > benchmark/evaluation/results/backend.log 2>&1 &
sleep 10
curl http://localhost:3001/health
```

### 3. Ejecutar benchmark

```bash
npx tsx benchmark/evaluation/run_full_benchmark.ts \
  --dataset rag-optimization-benchmark.json \
  --output benchmark/evaluation/results/temp
```

### 4. Mover resultados

```bash
mv benchmark/evaluation/results/temp/ragas_*.json benchmark/evaluation/results/parent_$(date +%Y-%m-%dT%H-%M-%S).json
mv benchmark/evaluation/results/temp/ragas_*.md benchmark/evaluation/results/parent_$(date +%Y-%m-%dT%H-%M-%S).md
```

---

## ⚙️ CONFIGURACIÓN 5: BM25-RERANK (combinación)

### 1. Editar `.env`

```env
USE_BM25_RETRIEVER=true
BM25_WEIGHT=0.7
VECTOR_WEIGHT=0.3
USE_RERANKER=true
RERANKER_RETRIEVAL_TOP_K=20
RERANKER_FINAL_TOP_K=5
USE_PARENT_RETRIEVER=false
```

### 2-4. Repetir reinicio, benchmark y mover con prefijo `bm25-rerank_`

---

## ⚙️ CONFIGURACIÓN 6: BM25-PARENT (combinación)

### 1. Editar `.env`

```env
USE_BM25_RETRIEVER=true
BM25_WEIGHT=0.7
VECTOR_WEIGHT=0.3
USE_RERANKER=false
USE_PARENT_RETRIEVER=true
PARENT_CHUNK_SIZE=1000
CHILD_CHUNK_SIZE=200
```

### 2-4. Repetir reinicio, benchmark y mover con prefijo `bm25-parent_`

---

## ⚙️ CONFIGURACIÓN 7: RERANK-PARENT (combinación)

### 1. Editar `.env`

```env
USE_BM25_RETRIEVER=false
USE_RERANKER=true
RERANKER_RETRIEVAL_TOP_K=20
RERANKER_FINAL_TOP_K=5
USE_PARENT_RETRIEVER=true
PARENT_CHUNK_SIZE=1000
CHILD_CHUNK_SIZE=200
```

### 2-4. Repetir reinicio, benchmark y mover con prefijo `rerank-parent_`

---

## ⚙️ CONFIGURACIÓN 8: FULL (todas las optimizaciones)

### 1. Editar `.env`

```env
USE_BM25_RETRIEVER=true
BM25_WEIGHT=0.7
VECTOR_WEIGHT=0.3
USE_RERANKER=true
RERANKER_RETRIEVAL_TOP_K=20
RERANKER_FINAL_TOP_K=5
USE_PARENT_RETRIEVER=true
PARENT_CHUNK_SIZE=1000
CHILD_CHUNK_SIZE=200
```

### 2-4. Repetir reinicio, benchmark y mover con prefijo `full_`

---

## 🎯 DESPUÉS DE LAS 8 CONFIGURACIONES

### Generar reporte comparativo

```bash
npx tsx benchmark/evaluation/generateComparisonReport.ts
```

### Ver resultados

```bash
cat benchmark/evaluation/results/comparison-report.md
```

---

## ✅ Checklist de Verificación

Para cada configuración, verificar:
- [ ] `.env` modificado correctamente
- [ ] Backend reiniciado (health check OK)
- [ ] Benchmark completado (16/16 queries)
- [ ] Archivos movidos con prefijo correcto
- [ ] Backend logs no tienen errores

---

## 🔍 Comandos Útiles

**Ver progreso del benchmark:**
```bash
tail -f benchmark/evaluation/results/backend.log
```

**Verificar archivos generados:**
```bash
ls -lh benchmark/evaluation/results/*.json
```

**Ver métricas de un resultado:**
```bash
cat benchmark/evaluation/results/baseline_*.json | jq '.summary'
```
