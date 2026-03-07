# Comparativa de Evaluaciones RAGAS — Sesión 2026-03-06/07

Juez externo: **Claude Haiku 4.5** (independiente del modelo RAG)
Dataset: `golden_qa_v2.json` — 52 casos

---

## Retrieval por capas (35 preguntas, scripts de test)

| Etapa | Hit Rate | Notas |
|---|---|---|
| Vector only | 34/35 (97%) | Pure vector search, sin nada más |
| BM25 only | 32/35 (91%) | Keyword search solo |
| Ensemble (vector+BM25) | 35/35 (100%) | Vector 0.6 + BM25 0.4 |
| Parents post-hydration | 35/35 (100%) | Child→Parent resolution |
| Reranker Top 5 | 34/35 (97%) | 1 pérdida: "API mínima Android" (dato muy específico) |

**Conclusión retrieval:** el pipeline encuentra el documento correcto en el 97-100% de los casos. El problema no es la retrieval sino la generación.

---

## Run 1 — llama3.1:8b + Reranker activo

**Config:**
- LLM RAG: `llama3.1:8b` (Ollama local)
- Reranker: `Xenova/bge-reranker-base` — Top 20 → Top 5
- BM25: `true` (weight 0.4) | Vector: `true` (weight 0.6)
- Parent-Child: `true` (child 128 / parent 512)

**Resultados:** `ragas_2026-03-06T21-04-55.json`

| Métrica            | Score |
|--------------------|-------|
| Faithfulness       | 0.51  |
| Answer Relevancy   | 0.61  |
| Context Precision  | 0.31  |
| Context Recall     | 0.90  |
| Answer Correctness | 0.71  |
| Hallucination      | 0.68  |
| Completados        | 47/52 |

**Por categoría:**

| Categoría   | Faithfulness | Relevancy | Precision | Recall |
|-------------|-------------|-----------|-----------|--------|
| Básica      | 0.73        | 0.89      | 0.36      | 1.00   |
| Conceptual  | 0.68        | 0.58      | 0.30      | 1.00   |
| Relación    | 0.30        | 0.53      | 0.28      | 0.75   |
| Proceso     | 0.28        | 0.54      | 0.33      | 0.80   |
| Comparativa | 0.30        | 0.72      | 0.23      | 1.00   |
| Edge Cases  | 0.69        | 0.27      | 0.20      | 0.80   |
| Multi-Hop   | 0.65        | 0.66      | 0.53      | 1.00   |

**Observaciones:**
- Faithfulness muy baja en Relación y Proceso — el modelo razona más allá del contexto
- Edge Cases con Relevancy 0.27 — el modelo no gestiona bien preguntas vagas o trampa
- Alucinaciones de subversiones (e.g. "Angular 15.2.8" inventado) → corregido con prompt

---

## Run 2 — Claude Haiku 4.5 + Sin Reranker

**Config:**
- LLM RAG: `claude-haiku-4-5-20251001` (Anthropic API)
- Reranker: `false`
- BM25: `true` (weight 0.4) | Vector: `true` (weight 0.6)
- Parent-Child: `true` (child 128 / parent 512)

**Resultados:** `ragas_2026-03-06T21-43-08.json`

| Métrica            | Score |
|--------------------|-------|
| Faithfulness       | 0.55  |
| Answer Relevancy   | 0.74  |
| Context Precision  | 0.17  |
| Context Recall     | 0.94  |
| Answer Correctness | 0.83  |
| Hallucination      | 0.80  |
| Completados        | 49/52 |

**Por categoría:**

| Categoría   | Faithfulness | Relevancy | Precision | Recall |
|-------------|-------------|-----------|-----------|--------|
| Básica      | 0.71        | 0.84      | 0.09      | 0.90   |
| Conceptual  | 0.68        | 0.59      | 0.08      | 0.90   |
| Relación    | 0.46        | 0.84      | 0.26      | 1.00   |
| Proceso     | 0.31        | 0.80      | 0.16      | 0.90   |
| Comparativa | 0.47        | 0.59      | 0.20      | 1.00   |
| Edge Cases  | 0.72        | 0.63      | 0.24      | 1.00   |
| Multi-Hop   | 0.52        | 0.86      | 0.33      | 1.00   |

---

## Comparativa Run 1 vs Run 2

| Métrica            | Run 1 (llama+reranker) | Run 2 (Claude+sin reranker) | Δ      |
|--------------------|------------------------|------------------------------|--------|
| Faithfulness       | 0.51                   | 0.55                         | +0.04  |
| Answer Relevancy   | 0.61                   | 0.74                         | +0.13 ↑|
| Context Precision  | 0.31                   | 0.17                         | -0.14 ↓|
| Context Recall     | 0.90                   | 0.94                         | +0.04  |
| Answer Correctness | 0.71                   | 0.83                         | +0.12 ↑|
| Hallucination      | 0.68                   | 0.80                         | +0.12 ↑|
| Completados        | 47/52                  | 49/52                        | +2     |

**Conclusiones:**
- Claude mejora relevancy, correctness y hallucination de forma significativa
- Context Precision baja al quitar el reranker — llegan más docs irrelevantes al LLM
- Faithfulness sigue siendo el punto débil en ambos — Claude también razona más allá del contexto en preguntas de Relación/Proceso

---

## Run 3 — Claude Haiku 4.5 + Reranker activo

**Config:**
- LLM RAG: `claude-haiku-4-5-20251001` (Anthropic API)
- Reranker: `true` — Top 20 → Top 5
- BM25: `true` (weight 0.4) | Vector: `true` (weight 0.6)
- Parent-Child: `true` (child 128 / parent 512)

**Resultados:** `ragas_2026-03-06T22-06-14.json`

| Métrica            | Score |
|--------------------|-------|
| Faithfulness       | 0.59  |
| Answer Relevancy   | 0.76  |
| Context Precision  | 0.34  |
| Context Recall     | 0.99  |
| Answer Correctness | 0.83  |
| Hallucination      | 0.92  |
| Completados        | 52/52 |

**Por categoría:**

| Categoría   | Faithfulness | Relevancy | Precision | Recall |
|-------------|-------------|-----------|-----------|--------|
| Básica      | 0.72        | 0.79      | 0.33      | 1.00   |
| Conceptual  | 0.71        | 0.71      | 0.33      | 1.00   |
| Relación    | 0.55        | 0.85      | 0.44      | 1.00   |
| Proceso     | 0.51        | 0.82      | 0.41      | 1.00   |
| Comparativa | 0.33        | 0.76      | 0.15      | 1.00   |
| Edge Cases  | 0.60        | 0.57      | 0.25      | 1.00   |
| Multi-Hop   | 0.57        | 0.81      | 0.50      | 0.83   |

---

## Comparativa global

| Métrica            | R1 llama+reranker | R2 Claude sin reranker | R3 Claude+reranker | Mejor |
|--------------------|-------------------|------------------------|--------------------|-------|
| Faithfulness       | 0.51              | 0.55                   | **0.59**           | R3    |
| Answer Relevancy   | 0.61              | 0.74                   | **0.76**           | R3    |
| Context Precision  | 0.31              | 0.17                   | **0.34**           | R3    |
| Context Recall     | 0.90              | 0.94                   | **0.99**           | R3    |
| Answer Correctness | 0.71              | 0.83                   | **0.83**           | R3=   |
| Hallucination      | 0.68              | 0.80                   | **0.92**           | R3    |
| Completados        | 47/52             | 49/52                  | **52/52**          | R3    |

**Conclusiones finales:**
- R3 gana en todas las métricas — Claude Haiku + reranker es la mejor combinación probada
- El reranker aporta +0.17 en Precision y +0.05 en Recall vs sin reranker
- Hallucination 0.92 en R3 — casi sin alucinaciones con Claude
- **Punto débil pendiente: Faithfulness (0.59) y Comparativa (0.33)** — preguntas de comparar conceptos siguen siendo las más problemáticas. El modelo razona más allá del contexto en estos casos.

---

## Run 4 — Sonnet como juez (validación de Haiku)

**Objetivo**: Verificar si Haiku como juez era demasiado benévolo. Solo Comparativa + Multi-Hop (9 casos).
**Config RAG**: Igual que Run 3 (Claude Haiku LLM + Reranker)
**Resultados**: `ragas_2026-03-07T05-41-58.json`

| Métrica                       | Haiku juez (R3) | Sonnet juez (R4) | Δ          |
|-------------------------------|-----------------|------------------|------------|
| Faithfulness Comparativa      | 0.33            | 0.31             | -0.02      |
| Faithfulness Multi-Hop        | 0.57            | 0.22             | -0.35 ↓   |
| Relevancy Comparativa         | 0.76            | 0.63             | -0.13      |
| Relevancy Multi-Hop           | 0.81            | 0.90             | +0.09      |
| Context Precision Comparativa | 0.15            | 0.10             | -0.05      |
| Context Recall                | 1.00 / 0.83     | 1.00 / 0.83      | Idéntico   |
| Hallucination (global)        | 0.92            | 0.60             | -0.32 ↓   |

**Conclusiones:**
- Haiku era significativamente benévolo en Multi-Hop Faithfulness (0.57 → 0.22 real)
- Hallucination real: 0.60, no 0.92 — Sonnet detecta alucinaciones que Haiku ignoraba
- El recall es idéntico → la retrieval está bien. El problema es 100% en generación/faithfulness
- Alucinaciones concretas detectadas por Sonnet: sintaxis de `store.select()`, memoización, `createAction()` — Claude Haiku añade conocimiento de Angular/NgRx que no está en el contexto
- **Faithfulness Multi-Hop 0.22 es el nuevo baseline real** — el problema es más grave que lo estimado con Haiku

**Recomendación confirmada**: Prompt Compression es la mejora más urgente. El LLM tiene conocimiento previo de Angular/NgRx y lo usa aunque el contexto sea insuficiente.

---

## Run 5 — Compression + Temperature 0.0 (validación de mejoras)

**Objetivo**: Medir impacto de Contextual Compression + temperature 0.0. Mismos 9 casos que R4.
**Config RAG**: Claude Haiku + Reranker + Contextual Compression (threshold 0.30) + temp 0.0
**Resultados**: `ragas_2026-03-07T05-58-11.json`

| Métrica                       | R4 sin mejoras | R5 compression+temp0 | Δ          |
|-------------------------------|----------------|----------------------|------------|
| Faithfulness global           | 0.28           | 0.42                 | +0.14 ↑   |
| Faithfulness Comparativa      | 0.31           | 0.53                 | +0.22 ↑   |
| Faithfulness Multi-Hop        | 0.22           | 0.22                 | =          |
| Hallucination                 | 0.60           | 0.76                 | +0.16 ↑   |
| Answer Relevancy              | 0.72           | 0.73                 | =          |
| Context Precision Comparativa | 0.10           | 0.10                 | =          |
| Context Recall                | 0.94           | 0.94                 | =          |
| Answer Correctness            | 0.87           | 0.81                 | -0.06      |

**Conclusiones:**
- Contextual Compression + temp 0.0 funcionó — Faithfulness Comparativa sube de 0.31 a **0.53** (+22 puntos)
- Hallucination mejora: 0.60 → **0.76** — el modelo inventa menos con chunks más limpios
- Multi-Hop Faithfulness no mejora (0.22) — el problema aquí no es ruido sino falta de información específica en el contexto
- Context Precision Comparativa sigue en 0.10 — el retrieval trae docs poco específicos para preguntas de comparación
- Answer Correctness baja levemente (-0.06) — con temp 0.0 las respuestas son más secas/literales

**Próximo paso identificado**: Alignment Optimization — generar preguntas hipotéticas por chunk durante la indexación para mejorar matching semántico en preguntas comparativas y multi-hop.

---

## Run 6 — llama3.1:8b + Compression + temp 0.0 (comparativa con Claude)

**Objetivo**: Comparar llama vs Claude con las mismas mejoras activas (compression + temp 0.0).
**Config RAG**: llama3.1:8b + Reranker + Contextual Compression + temp 0.0
**Resultados**: `ragas_2026-03-07T06-12-10.json`

| Métrica                  | R5 Claude Haiku | R6 llama3.1:8b | Δ          |
|--------------------------|-----------------|----------------|------------|
| Faithfulness global      | 0.42            | 0.29           | -0.13      |
| Faithfulness Comparativa | 0.53            | 0.32           | -0.21      |
| Faithfulness Multi-Hop   | 0.22            | 0.23           | ≈          |
| Hallucination            | 0.76            | 0.33           | -0.43 ↓↓  |
| Answer Relevancy         | 0.73            | 0.48           | -0.25      |
| Answer Correctness       | 0.81            | 0.72           | -0.09      |
| Context Recall           | 0.94            | 0.94           | =          |

**Conclusiones:**
- Claude Haiku gana en todas las métricas. Diferencia más crítica: Hallucination 0.76 vs 0.33 — llama inventa el doble.
- Retrieval idéntico (Context Recall 0.94) — el pipeline de recuperación es agnóstico al LLM.
- **Config final confirmada**: Claude Haiku + Reranker + Compression + temp 0.0

---

## Cambios aplicados en esta sesión

### Pipeline
- Eliminado `Relevancia: -760%` del header de contexto (logits BGE no son porcentajes)
- Deduplicación de sources por filename en `filterSourcesByRelevance`

### Prompt del sistema
- Añadida prohibición de copiar headers `[DOCUMENTO X | Fuente: ...]` en respuestas
- Añadida instrucción para corregir preguntas con premisas incorrectas
- Añadida prohibición de añadir más detalle del que aparece en el contexto

### Evaluador RAGAS
- Integrado Claude Haiku como juez externo (`--judge claude`)
- Flag `--judge ollama|claude` para alternar juez
- Logger `EVAL_LOGS=true` para verbose mode
