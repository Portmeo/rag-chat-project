# Scripts de Testing y Benchmarks

Scripts para probar, evaluar y optimizar el sistema RAG.

## 🏥 Health Check

**`./health-check.sh`**

Verifica que todo el stack funciona:
- ✓ Qdrant corriendo
- ✓ Ollama corriendo y modelos descargados
- ✓ Backend respondiendo
- ✓ Documentos indexados
- ✓ Configuración correcta

**Úsalo antes de empezar a trabajar.**

## 📤 Upload Documents

**`./upload-docs.sh`**

Sube todos los archivos .md de `/files` al sistema RAG.

## 🧪 Test RAG Complete

**`./test-rag-complete.sh`**

Prueba el sistema con 7 queries de diferentes categorías:
- Básicas (keywords)
- Conceptuales
- Relacionales
- Proceso
- Comparativas

Muestra accuracy y respuestas completas.

## ⏱️ Benchmark Latency

**`./benchmark-latency.sh`**

Mide tiempos de respuesta:
- Promedio de 3 queries
- Desglose: retrieval, reranking, LLM
- Consejos de optimización

**Úsalo para optimizar performance.**

## 🎯 Test Quality

**`./test-quality.sh`**

Evalúa calidad con métricas:
- Accuracy (keywords esperados)
- Source quality (archivos relevantes)
- Hallucination rate
- No answer rate
- Overall grade (A-D)

**Úsalo antes de deploy.**

## 🔄 Compare Configs

**`./compare-configs.sh`**

Compara 5 configuraciones automáticamente:
1. BM25 70/30 + Reranking (actual)
2. BM25 80/20 + Reranking
3. BM25 50/50 + Reranking
4. Vector-only + Reranking
5. BM25 70/30 (sin reranking)

Restaura configuración original al terminar.

**Úsalo para experimentar sin riesgo.**

## 💪 Stress Test

**`./stress-test.sh [concurrent] [total]`**

Prueba bajo carga:
- Queries concurrentes (default: 10)
- Total queries (default: 50)
- Métricas: latencia p95, success rate, CPU/memoria
- Throughput (queries/sec)

Ejemplos:
```bash
./stress-test.sh           # 10 concurrent, 50 total
./stress-test.sh 20 100    # 20 concurrent, 100 total
```

**Úsalo antes de producción.**

## 📊 Flujo Recomendado

```bash
# 1. Verificar sistema
./health-check.sh

# 2. Subir documentos (si es necesario)
./upload-docs.sh

# 3. Test básico
./test-rag-complete.sh

# 4. Evaluar calidad
./test-quality.sh

# 5. Medir latencia
./benchmark-latency.sh

# 6. (Opcional) Comparar configs
./compare-configs.sh

# 7. (Opcional) Stress test
./stress-test.sh
```

## ⚙️ Configuración

Los scripts leen de `apps/backend/.env`:
- `USE_BM25_RETRIEVER`
- `BM25_WEIGHT` / `VECTOR_WEIGHT`
- `USE_RERANKER`
- `RERANKER_RETRIEVAL_TOP_K` / `RERANKER_FINAL_TOP_K`

## 📝 Notas

- Todos los scripts asumen servicios corriendo (Qdrant, Ollama, Backend)
- `compare-configs.sh` crea backup automático (.env.backup)
- `stress-test.sh` necesita documentos indexados
- Para ver logs del backend en tiempo real: `bun run dev:backend`
