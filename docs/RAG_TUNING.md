# RAG Tuning Guide

Parámetros que deben ajustarse en función del volumen del corpus.
Valores actuales calibrados para **~1000 children** (8 documentos .md, ~200 parents).

---

## Retrieval

| Parámetro                        | Valor actual | Fórmula / Criterio                                        |
|----------------------------------|--------------|-----------------------------------------------------------|
| `SIMILARITY_SEARCH_MAX_RESULTS`  | 25           | ~2-3% del total de children                               |
| `BM25_WEIGHT`                    | 0.4          | Subir con más docs (más vocabulario = BM25 más útil)      |
| `VECTOR_WEIGHT`                  | 0.6          | Bajar proporcionalmente al BM25                           |

**Notas**:
- Con <2000 docs, vector pesa más porque BM25 tiene poco vocabulario para discriminar
- Con >5000 docs, considerar 0.5/0.5 o incluso BM25=0.6

---

## RRF (Reciprocal Rank Fusion)

| Parámetro   | Valor actual        | Cuándo cambiar                        |
|-------------|---------------------|---------------------------------------|
| Constante k | Sin constante (k=0) | Con >2000 docs, usar k=60 (estándar)  |

**Fórmula actual**: `score = weight / (rank + 1)`
**Fórmula estándar RRF**: `score = weight / (k + rank + 1)` con k=60

**Por qué**:
- k=60 normaliza mejor cuando hay muchos candidatos (aplana diferencias entre rankings)
- Con corpus pequeño (<2000 docs), k=60 aplana demasiado y empeora el hit rate (97% → 91% en nuestro test)
- Con corpus grande, los retriever devuelven listas más largas y k=60 evita que el top-1 domine

---

## Reranker

| Parámetro                | Valor actual | Fórmula / Criterio                                   |
|--------------------------|--------------|------------------------------------------------------|
| `RERANKER_RETRIEVAL_TOP_K`| 20         | ~2% del corpus. Mínimo 15, máximo 50                  |
| `RERANKER_FINAL_TOP_K`    | 5           | 3-7 según capacidad del LLM context window           |
| `RERANKER_TIMEOUT_MS`     | 30000       | Subir si el corpus crece y el reranker tarda         |

**Notas**:
- `RETRIEVAL_TOP_K` controla cuántos candidates entran al reranker. Más = mejor recall pero más lento
- `FINAL_TOP_K` controla cuántos docs van al LLM. Más = más contexto pero más ruido/tokens
- Con nuestro corpus (994 children → ~17 parents únicos), Top 5 pierde 1 hit (97%). Top 7 podría recuperarlo

---

## Parent-Child

| Parámetro              | Valor actual | Criterio                                         |
|------------------------|--------------|--------------------------------------------------|
| `CHILD_CHUNK_SIZE`     | 128 chars    | Chunks pequeños para búsqueda precisa            |
| `CHILD_CHUNK_OVERLAP`  | 25 chars     | ~20% del child size                              |
| `PARENT_CHUNK_SIZE`    | 512 chars    | Contexto suficiente para el LLM                  |
| `PARENT_CHUNK_OVERLAP` | 50 chars     | ~10% del parent size                             |

**Notas**:
- Child size NO depende del volumen — depende de la granularidad del contenido
- Parent size depende del context window del LLM: `FINAL_TOP_K * PARENT_SIZE < max_context * 0.3`
- Con 5 parents de 512 chars = ~2.5k chars (~800 tokens) — bien para modelos 4k-8k context

---

## Contextual Compression

| Parámetro              | Valor actual | Criterio                                         |
|------------------------|--------------|--------------------------------------------------|
| `COMPRESSION_THRESHOLD`| 0.30        | Coseno query↔frase. Bajar = más permisivo         |

**Notas**:
- No afecta al hit rate (actúa post-reranker, dentro de cada chunk)
- Afecta a la calidad de generación: elimina frases irrelevantes del contexto
- Con threshold muy alto (>0.5), puede eliminar frases útiles
- Evaluar con RAGAS (faithfulness/relevancy), no con hit rate

---

## Instruction Prefix

| Parámetro                    | Valor actual                                                    |
|------------------------------|-----------------------------------------------------------------|
| `EMBEDDING_QUERY_PREFIX`     | `Represent this sentence for searching relevant passages:`      |
| `EMBEDDING_DOCUMENT_PREFIX`  | (vacío)                                                         |

**Notas**:
- Específico del modelo de embeddings (mxbai-embed-large usa prefix asimétrico)
- NO depende del volumen del corpus
- Cambiar modelo de embeddings = cambiar prefixes + re-indexar todo

---

## Resumen de escalado

| Corpus size | Acción recomendada                                                       |
|-------------|--------------------------------------------------------------------------|
| <1000 docs  | Config actual. Sin RRF k. Vector 0.6 / BM25 0.4                          |
| 1000-5000   | Subir SEARCH_MAX_RESULTS a ~3%. Probar RRF k=60                          |
| 5000-20000  | RRF k=60. BM25 0.5 / Vector 0.5. RETRIEVAL_TOP_K=30-40                   |
| >20000      | RRF k=60. BM25 0.5-0.6. RETRIEVAL_TOP_K=50. Considerar FINAL_TOP_K=7     |
