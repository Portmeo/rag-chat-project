# RAGAS Evaluation System - Quick Start Guide

## ⚡ Comandos Rápidos

### Smoke Test (2 min)
```bash
npx tsx benchmark/evaluation/run_full_benchmark.ts --limit 2
```

### Evaluación Estándar (5-10 min)
```bash
npx tsx benchmark/evaluation/run_full_benchmark.ts --limit 5
```

### Benchmark Completo (60-80 min)
```bash
npx tsx benchmark/evaluation/run_full_benchmark.ts
```

### Optimización Multi-Config (2-3 horas)
```bash
npx tsx benchmark/evaluation/run_optimization_benchmark.ts --configs baseline,bm25,full
```

---

## 📋 Checklist Pre-Ejecución

```bash
# 1. ¿Backend ejecutándose?
curl http://localhost:3001/health

# 2. ¿Modelos Ollama disponibles?
ollama list | grep llama3.1:8b
ollama list | grep mxbai-embed-large

# 3. ¿Documentos presentes?
ls apps/backend/uploads/documents/

# 4. ¿Directorio de resultados existe?
mkdir -p benchmark/evaluation/results
```

---

## 📊 Datasets Disponibles

| Dataset | Casos | Tiempo | Uso |
|---------|-------|--------|-----|
| `basic_queries.json` | 5 | 5 min | Test rápido |
| `golden_qa.json` | 17 | 20 min | Original |
| `rag-optimization-benchmark.json` | 16 | 25 min | ⭐ Optimización rápida |
| `golden_qa_v2.json` | 52 | 80 min | ⭐ Evaluación completa |

---

## 🎯 Métricas Clave

| Métrica | Qué mide | Score bueno |
|---------|----------|-------------|
| **Faithfulness** | ¿Respuesta soportada por contextos? | ≥ 0.8 |
| **Answer Relevancy** | ¿Respuesta relevante a pregunta? | ≥ 0.8 |
| **Context Precision** | ¿Contextos recuperados relevantes? | ≥ 0.7 |
| **Context Recall** | ¿Se obtuvieron docs esperados? | ≥ 0.8 |
| **Answer Correctness** | Similitud semántica vs ground truth | ≥ 0.7 |

**Umbrales de Calidad:**
- **Excelente:** ≥ 80%
- **Bueno:** 70-80%
- **Mejorable:** 50-70%
- **Crítico:** < 50%

---

## 🚨 Solución de Problemas

### Backend no responde
```bash
cd apps/backend
npm run dev
```

### Documentos no encontrados
```bash
# Verificar path correcto
ls apps/backend/uploads/documents/
```

### Ollama no disponible
```bash
# Iniciar Ollama
ollama serve

# Descargar modelos si es necesario
ollama pull llama3.1:8b
ollama pull mxbai-embed-large
```

### Error "Cannot find module"
```bash
# Instalar dependencias
cd apps/evaluation
npm install
```

---

## 📖 Ver Resultados

### Último Reporte Markdown
```bash
ls -t benchmark/evaluation/results/*.md | head -1 | xargs cat
```

### Últimos Datos JSON
```bash
ls -t benchmark/evaluation/results/*.json | head -1 | xargs cat | jq
```

### Comparar Configuraciones
```bash
cat benchmark/evaluation/results/comparison-report.md
```

---

## 🔧 Perfiles de Configuración

### Baseline (Solo vector)
```env
USE_BM25_RETRIEVER=false
USE_RERANKER=false
USE_PARENT_RETRIEVER=false
```

### BM25 Mejorado
```env
USE_BM25_RETRIEVER=true
BM25_WEIGHT=0.7
VECTOR_WEIGHT=0.3
```

### Optimización Completa
```env
USE_BM25_RETRIEVER=true
USE_RERANKER=true
USE_PARENT_RETRIEVER=true
```

---

## 💡 Tips y Mejores Prácticas

1. **Empieza pequeño:** Usa `--limit 2` para smoke tests
2. **Dataset adecuado:** Usa `rag-optimization-benchmark.json` para runs rápidos
3. **Revisa logs:** Observa la consola para warnings
4. **Lee reportes:** Siempre revisa el archivo .md para insights
5. **Compara configs:** Ejecuta optimization benchmark para encontrar mejor setup

---

## 📊 Interpretación de Reportes

### Secciones del Reporte Markdown

1. **Resumen Ejecutivo**
   - Métricas core con status (✓ Excelente, ⚠️ Mejorable, ❌ Crítico)
   - Veredicto general del sistema

2. **Análisis de Errores**
   - Errores críticos (requieren atención inmediata)
   - Errores de prioridad alta/media/baja
   - Patrones identificados

3. **Métricas por Categoría**
   - Desglose por tipo de pregunta (Básica, Conceptual, etc.)
   - Identifica qué categorías necesitan mejora

4. **Performance**
   - Latencias (retrieval, reranking, generation)
   - Cuellos de botella identificados

5. **Recomendaciones Accionables**
   - Priorizadas por severidad
   - Sugerencias específicas de mejora

---

## 🔄 Workflow Típico

### Para Desarrollo Diario
```bash
# 1. Verificar que backend está corriendo
curl http://localhost:3001/health

# 2. Ejecutar evaluación rápida
npx tsx benchmark/evaluation/run_full_benchmark.ts --limit 5

# 3. Revisar métricas clave
cat benchmark/evaluation/results/ragas_*.md | grep "OVERALL METRICS" -A 5
```

### Para Testing de Cambios
```bash
# 1. Hacer baseline antes del cambio
npx tsx benchmark/evaluation/run_full_benchmark.ts --output ./results/before

# 2. Hacer tus cambios en el código

# 3. Evaluar después del cambio
npx tsx benchmark/evaluation/run_full_benchmark.ts --output ./results/after

# 4. Comparar resultados
diff results/before/*.md results/after/*.md
```

### Para Benchmark Completo
```bash
# 1. Asegurar tiempo suficiente (2-3 horas)
# 2. Ejecutar benchmark multi-config
npx tsx benchmark/evaluation/run_optimization_benchmark.ts

# 3. Revisar reporte comparativo
cat benchmark/evaluation/results/comparison-report.md

# 4. Identificar mejor configuración
# 5. Aplicar configuración ganadora en apps/backend/.env
```

---

## 📈 Opciones Avanzadas

### Limitar Categorías Específicas
Edita el dataset JSON para incluir solo categorías deseadas:
```json
{
  "test_cases": [
    // Solo incluir casos con "category": "Básica"
  ]
}
```

### Personalizar Output
```bash
# Directorio de salida personalizado
npx tsx benchmark/evaluation/run_full_benchmark.ts --output ./mis-resultados

# Dataset personalizado
npx tsx benchmark/evaluation/run_full_benchmark.ts --dataset mi-dataset.json
```

### Ejecutar Configuraciones Específicas
```bash
# Solo baseline y full
npx tsx benchmark/evaluation/run_optimization_benchmark.ts --configs baseline,full

# Sin generar reporte comparativo automático
npx tsx benchmark/evaluation/run_optimization_benchmark.ts --skip-comparison
```

---

## 🎓 Ejemplos de Uso

### Ejemplo 1: Debug de Alucinaciones
```bash
# 1. Ejecutar evaluación
npx tsx benchmark/evaluation/run_full_benchmark.ts --limit 10

# 2. Buscar casos con alucinaciones
grep -A 5 "Alucinaciones detectadas" benchmark/evaluation/results/ragas_*.md

# 3. Ajustar temperatura del LLM en backend
# 4. Re-evaluar
```

### Ejemplo 2: Optimizar Retrieval
```bash
# 1. Ejecutar con diferentes configs
npx tsx benchmark/evaluation/run_optimization_benchmark.ts --configs baseline,bm25,rerank

# 2. Comparar Context Precision entre configs
cat benchmark/evaluation/results/comparison-report.md | grep "Context Precision"

# 3. Aplicar mejor config
```

### Ejemplo 3: Testing de Dataset
```bash
# 1. Crear dataset pequeño de test
cat > benchmark/evaluation/datasets/test.json << 'EOF'
{
  "name": "Test Dataset",
  "version": "1.0",
  "test_cases": [
    {
      "id": "test_1",
      "category": "Test",
      "question": "Tu pregunta aquí",
      "ground_truth_answer": "Respuesta esperada",
      "expected_contexts": ["documento.md"]
    }
  ]
}
EOF

# 2. Ejecutar evaluación
npx tsx benchmark/evaluation/run_full_benchmark.ts --dataset test.json

# 3. Revisar resultados
cat benchmark/evaluation/results/ragas_*.md
```

---

## 📚 Referencias

- **Documentación Completa:** `docs/EVALUATION_SYSTEM.md`
- **Código Fuente:** `apps/evaluation/src/`
- **Scripts:** `benchmark/evaluation/`
- **Datasets:** `benchmark/evaluation/datasets/`
- **Resultados:** `benchmark/evaluation/results/`

---

## 🆘 Ayuda y Soporte

### Problemas Comunes

**Error: "ENOENT: no such file or directory"**
- Verificar que backend esté ejecutándose
- Verificar que documentos existan en `apps/backend/uploads/documents/`

**Error: "fetch failed"**
- Backend no está corriendo: `cd apps/backend && npm run dev`
- Verificar puerto 3001 disponible

**Métricas en 0**
- Contextos no se están cargando correctamente
- Verificar path de documentos en `ragasEvaluator.ts`

**Ollama timeout**
- Ollama no está ejecutándose: `ollama serve`
- Modelos no descargados: `ollama pull llama3.1:8b`

### Logs y Debug

```bash
# Ver logs de backend durante evaluación
tail -f apps/backend/logs/app.log

# Ejecutar con más verbose (ver requests)
DEBUG=* npx tsx benchmark/evaluation/run_full_benchmark.ts --limit 2

# Verificar estado del sistema
curl http://localhost:3001/health
ollama list
ps aux | grep ollama
```

---

**Última actualización:** 2026-02-02
**Versión:** 1.0
**Autor:** Sistema de Evaluación RAGAS
