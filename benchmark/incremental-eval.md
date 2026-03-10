# Evaluación Incremental de Features — RAG Chat

Evaluación feature-by-feature del pipeline de retrieval.
Cada paso activa una feature y mide el impacto con 35 queries de test.

**Modelo embeddings**: mxbai-embed-large (1024 dims, Cosine)
**Documentos**: 8 archivos .md técnicos
**Fecha**: 2026-03-10
**Preguntas**: 35 (9 simple, 12 complex, 4 paraphrase, 5 vague, 5 specific)

---

## Paso 0 — Baseline vectorial puro

**Config**: Todo desactivado. Chunks planos (1000 chars, overlap 200). Sin BM25, sin reranker, sin parent-child, sin instruction prefix, sin alignment.

| Categoría    | Hit Rate      |
|--------------|---------------|
| simple       | 8/9 (89%)     |
| complex      | 12/12 (100%)  |
| paraphrase   | 3/4 (75%)     |
| vague        | 4/5 (80%)     |
| specific     | 5/5 (100%)    |
| **TOTAL**    | **32/35 (91%)**|

**Observaciones**:
- Paraphrase es el punto débil (75%) — el vector puro no aguanta bien reformulaciones
- Complex 100% y Specific 100% — la semántica resuelve bien

---

## Paso 1 — + BM25 híbrido

**Config**: `USE_BM25_RETRIEVER=true`, weights BM25=0.4 / Vector=0.6.
**Re-indexar**: No

### Test con RRF k=60

| Retriever      | Hit Rate       |
|----------------|----------------|
| Vector only    | 33/35 (94%)    |
| BM25 only      | 34/35 (97%)    |
| **Ensemble**   | **32/35 (91%)**|

| Categoría    | Ensemble      |
|--------------|---------------|
| simple       | 8/9 (89%)     |
| complex      | 12/12 (100%)  |
| paraphrase   | 3/4 (75%)     |
| vague        | 4/5 (80%)     |
| specific     | 5/5 (100%)    |

**MISSES (3)**:
- `[simple]` "¿Qué tipo de autenticación se usa?" — vector MISS, BM25 HIT → ensemble MISS
- `[paraphrase]` "¿Cómo se protegen las rutas privadas?" — vector HIT, BM25 MISS → ensemble MISS
- `[vague]` "¿Cómo funciona la aplicación en el móvil?" — vector MISS, BM25 MISS → ensemble MISS

### Test sin constante k (versión original)

| Variante               | Ensemble Hit Rate |
|------------------------|-------------------|
| RRF k=60               | 32/35 (91%)       |
| **Sin k (original)**   | **34/35 (97%)**   |

**Observaciones**:
- RRF k=60 EMPEORA el resultado (91% vs 97%) — aplana demasiado los scores con corpus pequeño
- Sin k, el ensemble iguala a BM25 solo (97%) y supera al vector solo (94%)
- **Decisión**: revertir RRF k=60, mantener versión original sin constante
- Solo 1 miss: paraphrase "¿Cómo se protegen las rutas privadas?" (vector HIT, BM25 MISS, ensemble MISS)

---

## Paso 2 — + Instruction Prefix

**Config**: `USE_INSTRUCTION_PREFIX=true` (prefix asimétrico para mxbai-embed-large)
**Re-indexar**: Sí (cambia embeddings)

| Retriever      | Hit Rate        |
|----------------|-----------------|
| Vector only    | 33/35 (94%)     |
| BM25 only      | 34/35 (97%)     |
| **Ensemble**   | **35/35 (100%)**|

| Categoría    | Ensemble       |
|--------------|----------------|
| simple       | 9/9 (100%)     |
| complex      | 12/12 (100%)   |
| paraphrase   | 4/4 (100%)     |
| vague        | 5/5 (100%)     |
| specific     | 5/5 (100%)     |

**Observaciones**:
- 100% hit rate — el prefix asimétrico resuelve el último miss de paraphrase
- Vector solo sigue en 94% (el prefix ayuda pero no basta solo)
- La combinación BM25 + Vector + Prefix logra cobertura total

---

## Paso 3 — + Parent-Child

**Config**: `USE_PARENT_RETRIEVER=true` (child 128 chars → parent 512 chars)
**Re-indexar**: Sí (children + parents)

| Retriever      | Hit Rate        |
|----------------|-----------------|
| Vector only    | 34/35 (97%)     |
| BM25 only      | 34/35 (97%)     |
| **Ensemble**   | **35/35 (100%)**|

| Categoría    | Ensemble       |
|--------------|----------------|
| simple       | 9/9 (100%)     |
| complex      | 12/12 (100%)   |
| paraphrase   | 4/4 (100%)     |
| vague        | 5/5 (100%)     |
| specific     | 5/5 (100%)     |

**Observaciones**:
- 100% hit rate mantenido — Parent-Child no pierde cobertura
- 994 children (128 chars) + 205 parents (512 chars) en SQLite
- 0 orphans — todos los children resuelven a su parent correctamente
- El contexto al LLM ahora es más rico (parents de 512 chars vs chunks planos de 1000)

---

## Paso 4 — + Reranker

**Config**: `USE_RERANKER=true` (bge-reranker-base, Top 20 → Top 5)
**Re-indexar**: No

| Métrica              | Hit Rate        |
|----------------------|-----------------|
| Children (K=20)      | 35/35 (100%)    |
| Parents hydrated     | 35/35 (100%)    |
| **After Reranker**   | **34/35 (97%)** |

| Categoría    | After Reranker |
|--------------|----------------|
| simple       | 8/9 (89%)      |
| complex      | 12/12 (100%)   |
| paraphrase   | 4/4 (100%)     |
| vague        | 5/5 (100%)     |
| specific     | 5/5 (100%)     |

**MISSES (1)**:
- `[simple]` "¿Qué tipo de autenticación se usa?" — presente en parents (17 docs) pero descartado por reranker al filtrar a Top 5

**Observaciones**:
- El reranker PIERDE 1 hit al comprimir de ~17 parents a Top 5
- BGE-reranker-base no prioriza bien documentos de autenticación para esta query genérica
- Posible mejora: subir `RERANKER_FINAL_TOP_K` de 5 a 7

---

## Paso 5 — + Contextual Compression

**Config**: `USE_CONTEXTUAL_COMPRESSION=true` (threshold coseno 0.30)
**Re-indexar**: No

| Métrica              | Hit Rate        |
|----------------------|-----------------|
| **After Reranker**   | **34/35 (97%)** |

| Categoría    | After Reranker |
|--------------|----------------|
| simple       | 8/9 (89%)      |
| complex      | 12/12 (100%)   |
| paraphrase   | 4/4 (100%)     |
| vague        | 5/5 (100%)     |
| specific     | 5/5 (100%)     |

**Observaciones**:
- Sin cambio vs Paso 4 — la compression no afecta al hit rate
- Actúa post-reranker: filtra frases dentro de cada chunk, no cambia qué documentos se seleccionan
- Su impacto se mide en calidad de generación (RAGAS), no en retrieval

---

## Paso 6 — + Alignment Optimization

**Config**: `USE_ALIGNMENT_OPTIMIZATION=true` (3 preguntas/chunk)
**Re-indexar**: Sí (genera preguntas hipotéticas)

_Saltado_ — requiere re-indexar con generación LLM de preguntas hipotéticas (lento)

---

## Resumen comparativo

| Paso | Feature                | Total           | simple | complex | paraphrase | vague | specific |
|------|------------------------|-----------------|--------|---------|------------|-------|----------|
| 0    | Baseline vectorial     | 32/35 (91%)     | 8/9    | 12/12   | 3/4        | 4/5   | 5/5      |
| 1    | + BM25 (sin RRF k)     | 34/35 (97%)     | 9/9    | 12/12   | 3/4        | 5/5   | 5/5      |
| 2    | + Instruction Prefix   | 35/35 (100%)    | 9/9    | 12/12   | 4/4        | 5/5   | 5/5      |
| 3    | + Parent-Child         | 35/35 (100%)    | 9/9    | 12/12   | 4/4        | 5/5   | 5/5      |
| 4    | + Reranker (Top 5)     | 34/35 (97%)     | 8/9    | 12/12   | 4/4        | 5/5   | 5/5      |
| 5    | + Compression          | 34/35 (97%)     | 8/9    | 12/12   | 4/4        | 5/5   | 5/5      |
| 6    | + Alignment            | —  (saltado)    | —      | —       | —          | —     | —        |
