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

## Run 7 — qwen2.5:14b + Compression + temp 0.0 (dataset v2.2)

**Config RAG**: qwen2.5:14b (Ollama local) + Reranker + Contextual Compression + temp 0.0
**Dataset**: golden_qa_v2.json v2.2 — 13 casos (Comparativa 7 + Multi-Hop 6)
**Juez**: claude-sonnet-4-6
**Resultados**: `ragas_2026-03-07T06-48-01.json`

| Métrica                       | Claude Haiku R5 | qwen2.5:14b R7 | Δ          |
|-------------------------------|-----------------|----------------|------------|
| Faithfulness global           | 0.42            | 0.32           | -0.10      |
| Faithfulness Comparativa      | 0.53            | 0.32           | -0.21      |
| Faithfulness Multi-Hop        | 0.22            | 0.32           | +0.10 ↑   |
| Context Precision Comparativa | 0.10            | 0.30           | +0.20 ↑   |
| Context Precision Multi-Hop   | 0.50            | 0.42           | -0.08      |
| Context Recall                | 0.94 / 0.83     | 1.00 / 0.83    | ≈          |
| Hallucination                 | 0.76            | 0.54           | -0.22      |
| Answer Relevancy              | 0.73            | 0.60           | -0.13      |
| Answer Correctness            | 0.81            | 0.77           | -0.04      |

**Conclusiones:**
- Claude Haiku sigue siendo mejor en Faithfulness global y Hallucination
- qwen mejora Context Precision en Comparativa (0.30 vs 0.10) — recupera docs más relevantes
- qwen mejora Faithfulness Multi-Hop (0.32 vs 0.22) — maneja mejor preguntas de razonamiento encadenado
- Hallucination de qwen peor (0.54 vs 0.76) — inventa más que Claude
- No responde en chino con el prompt actual — comportamiento correcto
- **Mejor caso qwen**: multihop_4 (JWT flow, 86% promedio), comparativa_1 (Container-Presenter, 76%)

---

## Comparativa global de modelos RAG (dataset v2.2, juez Sonnet)

| Métrica              | llama3.1:8b | qwen2.5:14b | Claude Haiku | Mejor       |
|----------------------|-------------|-------------|--------------|-------------|
| Faithfulness         | 0.29        | 0.32        | 0.42         | Claude ↑    |
| Hallucination        | 0.33        | 0.54        | 0.76         | Claude ↑    |
| Answer Relevancy     | 0.48        | 0.60        | 0.73         | Claude ↑    |
| Context Precision    | 0.08        | 0.35        | 0.30         | qwen ↑      |
| Context Recall       | 1.00        | 0.94        | 0.94         | llama ≈     |
| Answer Correctness   | 0.72        | 0.77        | 0.81         | Claude ↑    |

**Pendiente**: phi4:14b

---

## Run 8 — Claude Haiku + Alignment Optimization

**Config:**
- LLM RAG: `claude-haiku-4-5-20251001` (Anthropic API)
- Reranker: `true` — Top 20 → Top 5
- BM25: `true` (weight 0.4) | Vector: `true` (weight 0.6)
- Parent-Child: `true` (child 128 / parent 512)
- Alignment Optimization: `true` — preguntas hipotéticas por parent chunk en metadata
- Contextual Compression: `true` (threshold 0.30) | temp 0.0

**Juez:** claude-sonnet-4-6
**Dataset:** golden_qa_v2.json v2.2 — 13 casos (Comparativa 7 + Multi-Hop 6)
**Resultados:** `ragas_2026-03-07T08-47-34.json`

| Métrica            | Score |
|--------------------|-------|
| Faithfulness       | 0.36  |
| Answer Relevancy   | 0.74  |
| Context Precision  | 0.35  |
| Context Recall     | 0.92  |
| Hallucination      | 0.65  |
| Completados        | 13/13 |

**Por categoría:**

| Categoría        | Faithfulness | Relevancy | Precision | Recall |
|------------------|-------------|-----------|-----------|--------|
| Comparativa (7)  | 0.30        | 0.79      | 0.21      | 0.93   |
| Multi-Hop (6)    | 0.42        | 0.69      | 0.50      | 0.92   |

**Conclusiones:**
- Alignment **no mejora** Comparativa — Context Precision 21% (vs 30% de qwen R7 sin alignment). Las preguntas hipotéticas no ayudan cuando la query requiere sintetizar dos conceptos de chunks distintos.
- Alignment es **neutro en Multi-Hop** — Precision 50%, idéntico a R7. No empeora pero tampoco resuelve faithfulness (0.42).
- **Faithfulness bajó** vs R5 (0.36 vs 0.42): las preguntas hipotéticas en el contexto pueden distraer al LLM del texto original.
- **Hallucination bajó** vs R5 (0.65 vs 0.76): el alignment añade ruido que el juez Sonnet detecta como alucinación.
- **Conclusión**: alignment optimization no es la palanca correcta aquí. El problema en Comparativa no es el matching semántico sino que el contexto recuperado no contiene la comparación explícita. Próximo paso: query decomposition.

---

## Comparativa global actualizada (dataset v2.2, juez Sonnet)

| Métrica              | llama3.1:8b (R6) | qwen2.5:14b (R7) | Claude Haiku R5 | Claude + Alignment R8 | Mejor       |
|----------------------|------------------|------------------|-----------------|----------------------|-------------|
| Faithfulness         | 0.29             | 0.32             | **0.42**        | 0.36                 | R5 Claude   |
| Hallucination        | 0.33             | 0.54             | **0.76**        | 0.65                 | R5 Claude   |
| Answer Relevancy     | 0.48             | 0.60             | **0.73**        | 0.74                 | R8 ≈        |
| Context Precision    | 0.08             | **0.35**         | 0.10-0.23       | 0.35                 | R7/R8 ≈     |
| Context Recall       | 1.00             | 0.94             | 0.94            | **0.92**             | llama ≈     |

**Config activa recomendada:** Claude Haiku + Reranker + Contextual Compression + temp 0.0 (R5 base, sin alignment).

---

## Run 9 — llama3.1:8b + BM25 fix + Prompt estricto

**Config:**
- LLM RAG: `llama3.1:8b` (Ollama local)
- Reranker: `true` — Top 20 → Top 5
- BM25: `true` (weight 0.4) — **sin alignment questions** (fix aplicado)
- Contextual Compression: `true` (threshold 0.30) | temp 0.0
- Prompt: reforzado anti-alucinaciones (no usar conocimiento externo)

**Juez:** llama3.1:8b (Ollama local) — ⚠️ más laxo que Sonnet, comparar con cautela
**Dataset:** golden_qa_v2.json v2.2 — 13 casos (Comparativa 7 + Multi-Hop 6)
**Resultados:** `ragas_2026-03-07T13-01-19.json`

| Métrica            | Score |
|--------------------|-------|
| Faithfulness       | 0.69  |
| Answer Relevancy   | 0.76  |
| Context Precision  | 0.74  |
| Context Recall     | 0.92  |
| Hallucination      | 0.95  |
| Completados        | 13/13 |

**Por categoría:**

| Categoría        | Faithfulness | Relevancy | Precision | Recall |
|------------------|-------------|-----------|-----------|--------|
| Comparativa (7)  | 0.61        | 0.70      | 0.69      | 0.93   |
| Multi-Hop (6)    | 0.78        | 0.83      | 0.80      | 0.92   |

**Conclusiones:**
- **Context Precision 0.74** (vs 0.31 en R1, 0.35 en R8) — el BM25 fix es el responsable. Las alignment questions ya no contaminan el retrieval.
- **Multi-Hop mejoró significativamente**: Faithfulness 0.78, Precision 0.80 — el retrieval limpio + prompt estricto funciona bien para preguntas encadenadas.
- **Comparativa sigue siendo el punto débil** (Faithfulness 0.61) — confirmado que es un problema de contenido, no de retrieval.
- **Hallucination 0.95**: inflado por el juez Ollama (más laxo que Sonnet). El valor real es probablemente 0.65-0.75.
- **Caveat**: juez diferente a runs anteriores (Ollama vs Sonnet/Haiku), no comparación directa en métricas de generación. Context Precision sí es comparable (más objetiva).

---

## Run 10 — llama3.1:8b + mxbai-rerank-base-v1 (nuevo reranker)

**Config:**
- LLM RAG: `llama3.1:8b` (Ollama local)
- Reranker: `mixedbread-ai/mxbai-rerank-base-v1` — Top 20 → Top 5 ← **cambio vs R9**
- BM25: `true` (weight 0.4) — sin alignment questions
- Contextual Compression: `true` (threshold 0.30) | temp 0.0
- Prompt: reforzado anti-alucinaciones

**Juez:** llama3.1:8b (Ollama local) — ⚠️ más laxo que Sonnet
**Dataset:** golden_qa_v2.json v2.2 — 13 casos (Comparativa 7 + Multi-Hop 6)
**Resultados:** `ragas_2026-03-07T13-28-47.json`

| Métrica            | Score | vs R9   |
|--------------------|-------|---------|
| Faithfulness       | 0.78  | +0.09 ↑ |
| Answer Relevancy   | 0.78  | +0.02 ↑ |
| Context Precision  | 0.54  | -0.20 ↓ |
| Context Recall     | 0.92  | =       |
| Hallucination      | 0.91  | -0.04 ↓ |
| Completados        | 13/13 | =       |

**Por categoría:**

| Categoría        | Faithfulness | Relevancy | Precision | Recall |
|------------------|-------------|-----------|-----------|--------|
| Comparativa (7)  | 0.76        | 0.67      | 0.50      | 0.93   |
| Multi-Hop (6)    | 0.80        | 0.90      | 0.58      | 0.92   |

**Conclusiones:**
- **mxbai-rerank-base-v1 peor en Precision** (-20pp vs bge-reranker-base): el modelo reordena docs de forma diferente y no siempre sube el doc del golden al top. `bge-reranker-base` era mejor para este corpus en español.
- **Faithfulness sube +9pp** pero con juez laxo — puede ser ruido del juez, no mejora real.
- **Decisión**: **revertir a `Xenova/bge-reranker-base`**. La caída en Precision (-20pp) es objetiva y supera cualquier ganancia en Faithfulness con juez laxo.
- La búsqueda de un reranker multilingual superior queda pendiente para cuando haya juez Sonnet disponible.

---

## Run 11 — Claude Haiku + Multi-Hop only (verificación faithfulness)

**Config:**
- LLM RAG: `claude-haiku-4-5-20251001` (Anthropic API)
- Reranker: `Xenova/bge-reranker-base` — Top 20 → Top 5
- BM25: `true` (weight 0.4) — BM25 fix aplicado
- Contextual Compression: `true` (threshold 0.30) | temp 0.0

**Juez:** claude-sonnet-4-6
**Dataset:** golden_qa_v2.json — 6 casos (Multi-Hop only)
**Resultados:** `ragas_2026-03-08T07-01-21.json`

| Métrica            | Score |
|--------------------|-------|
| Faithfulness       | 0.43  |
| Answer Relevancy   | 0.60  |
| Context Precision  | 0.58  |
| Context Recall     | 1.00  |
| Hallucination      | 0.67  |
| Completados        | 6/6   |

**Conclusiones:**
- Multi-Hop sigue siendo el punto débil en Faithfulness (0.43) — alucinaciones de nombres de acciones NgRx, métodos y clases que no están en el contexto.
- Context Recall 100% confirma que el retrieval encuentra los docs correctos. El problema es 100% generación.
- Run de verificación, dataset demasiado pequeño para conclusiones globales.

---

## Run 12 — Claude Sonnet + Full eval (51 casos, primer baseline completo)

**Config:**
- LLM RAG: `claude-sonnet-4-6` (Anthropic API) ← **primer run con Sonnet como RAG**
- Reranker: `Xenova/bge-reranker-base` — Top 20 → Top 5
- BM25: `true` (weight 0.4) — BM25 fix aplicado
- Contextual Compression: `true` (threshold 0.30) | temp 0.0
- Alignment: indexado en Qdrant pero BM25 lo excluye

**Juez:** claude-sonnet-4-6
**Dataset:** golden_qa_v2.json — 51 casos (Comparativa desactivada excepto 2)
**Resultados:** `ragas_2026-03-08T08-39-43.json`

| Métrica            | Score |
|--------------------|-------|
| Faithfulness       | 0.51  |
| Answer Relevancy   | 0.55  |
| Context Precision  | 0.36  |
| Context Recall     | 0.98  |
| Answer Correctness | 0.73  |
| Hallucination      | 0.42  |
| Completados        | 51/51 |

**Por categoría:**

| Categoría        | Faithfulness | Relevancy | Precision | Recall |
|------------------|-------------|-----------|-----------|--------|
| Básica (10)      | 0.65        | 0.75      | 0.38      | 1.00   |
| Conceptual (10)  | 0.70        | 0.42      | 0.29      | 1.00   |
| Relación (8)     | 0.27        | 0.46      | 0.41      | 0.94   |
| Proceso (10)     | 0.34        | 0.54      | 0.48      | 1.00   |
| Multi-Hop (6)    | 0.33        | 0.61      | 0.42      | 0.92   |
| Edge Cases (5)   | 0.73        | 0.66      | 0.30      | 1.00   |

> Comparativa desactivada del dataset (7 casos con `enabled: false`). Los 2 casos que aparecen en el resultado son residuales — ignorar.

**Conclusiones:**
- **Hallucination 0.42** — el peor de todos los runs con juez Sonnet. Sonnet como LLM conoce Angular/NgRx tan bien que rellena huecos con conocimiento propio cuando el contexto recuperado no tiene la respuesta exacta.
- **Context Recall 0.98** — el retrieval funciona perfectamente. El problema no es encontrar los docs.
- **Faithfulness más alta que Haiku (0.51 vs 0.42 en R5)** pero los datasets son diferentes (51 vs 9 casos), no es comparable directamente.
- **Comprensión contextual**: la compresión no filtra nada (100% frases kept), el threshold 0.30 es demasiado bajo.
- **Reranker con ~47 candidatos**: el multi-query genera 4 variantes × 20 docs → ~60 children → ~47 parents únicos. El reranker tiene demasiados candidatos para discriminar bien → Context Precision baja.
- **Peor categoría**: Relación (0.27 Faith) y Proceso (0.34 Faith) — preguntas que requieren conectar múltiples conceptos.
- ⚠️ **Comparación directa Haiku vs Sonnet pendiente**: necesitamos el mismo dataset de 51 casos con Haiku + juez Sonnet para concluir cuál es mejor.

---

## Comparativa global actualizada (juez Sonnet)

| Métrica              | llama R6 | qwen R7 | Haiku R5* | Haiku R11** | Sonnet R12 |
|----------------------|----------|---------|-----------|-------------|------------|
| Faithfulness         | 0.29     | 0.32    | 0.42      | 0.43        | 0.51       |
| Hallucination        | 0.33     | 0.54    | 0.76      | 0.67        | **0.42**   |
| Answer Relevancy     | 0.48     | 0.60    | 0.73      | 0.60        | 0.55       |
| Context Precision    | 0.08     | 0.35    | 0.10-0.23 | 0.58        | 0.36       |
| Context Recall       | 1.00     | 0.94    | 0.94      | 1.00        | **0.98**   |
| Casos                | 13       | 13      | 9         | 6           | **51**     |

*R5: 9 casos Comparativa+MultiHop | **R11: 6 casos MultiHop only

**Pendiente**: full eval Claude Haiku (51 casos, juez Sonnet) para comparativa directa con R12.

---

## Cambios aplicados en esta sesión (2026-03-08)

### Pipeline (sesión 2026-03-06/07)
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

### Sesión 2026-03-08
- Benchmark comparativo de rerankers: bge-reranker-base (9/9 hits) gana sobre mxbai y ms-marco
- BM25 fix confirmado: excluye padres y alignment questions — Context Precision sube de 0.08 a 0.35+
- Metadata de chunks limpiada: eliminados `heading_h1/h2/h3`, `has_code`, `has_links`, `word_count`, `library`, `language`, `framework`, `version` — solo queda lo que se usa
- Header LLM simplificado: `[DOCUMENTO N | Fuente: filename | Sección: path | Tipo: código]`
- Docs limpiadas: eliminados BM25_CONFIGURATION.md, RERANKING_SYSTEM.md, EVALUATION_QUICK_START.md
- Run 12: primer full eval Sonnet RAG (51 casos) — Hallucination 0.42 peor que Haiku. Pendiente comparativa directa.
