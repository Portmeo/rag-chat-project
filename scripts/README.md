# Scripts de Testing y Benchmarks

Scripts para probar, evaluar y optimizar el sistema RAG.

## 📤 Upload Documents

**`./upload-docs.sh`**

Sube todos los archivos .md de `/files` al sistema RAG.

## 🔄 Reindex Documents

**`./reindex-documents.sh`**

Reindexar documentos cuando cambias configuración de embeddings o chunking.

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

## 📊 Sistema de Benchmarking con RAGAS

Para evaluación exhaustiva con métricas RAGAS, usa el módulo de evaluación:

```bash
# Ejecutar benchmark completo (todas las configuraciones)
npm run benchmark:optimization

# Ejecutar benchmark en configuración actual
npm run benchmark:single

# Generar reporte comparativo de resultados existentes
npm run benchmark:compare
```

Ver documentación completa en `/apps/evaluation/README.md`.

## 📊 Flujo Recomendado

```bash
# 1. Subir documentos (si es necesario)
./upload-docs.sh

# 2. Ejecutar benchmarks RAGAS
npm run benchmark:optimization  # Evalúa todas las configuraciones

# 3. (Opcional) Stress test
./stress-test.sh
```

## ⚙️ Configuración

Los scripts leen de `apps/backend/.env`:
- `USE_BM25_RETRIEVER`
- `BM25_WEIGHT` / `VECTOR_WEIGHT`
- `USE_RERANKER`
- `RERANKER_RETRIEVAL_TOP_K` / `RERANKER_FINAL_TOP_K`
- `USE_PARENT_RETRIEVER`
- `PARENT_CHUNK_SIZE` / `CHILD_CHUNK_SIZE`

## 📝 Notas

- Todos los scripts asumen servicios corriendo (Qdrant, Ollama, Backend)
- `benchmark:optimization` reinicia el backend automáticamente para cada configuración
- Para ver logs del backend en tiempo real: `bun run dev:backend`
