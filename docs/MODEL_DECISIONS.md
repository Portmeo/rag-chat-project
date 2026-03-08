# Decisiones de Modelos y Configuración

Historial de decisiones sobre qué modelos y parámetros usar en cada capa del sistema RAG. Ver [RAG_SYSTEM_GUIDE.md](./RAG_SYSTEM_GUIDE.md) para la arquitectura.

---

## Embeddings: `mxbai-embed-large`

**Dimensión**: 1024 | **Distancia**: Cosine

**Por qué**:
- Modelo de embeddings de alta calidad para retrieval semántico.
- 1024 dims ofrece buena capacidad de representación sin ser excesivamente costoso.
- Soporta prefijos de instrucción asimétricos: el prefijo de query difiere del de documento, lo que mejora el matching en ~3.7% MRR.

**⚠️ No cambiar sin re-indexar**: cambiar de modelo de embeddings invalida toda la colección Qdrant.

---

## Reranker: `Xenova/bge-reranker-base`

**Tipo**: Cross-Encoder (ONNX via @xenova/transformers)

**Por qué bge-reranker-base**:
- Evaluado contra `mixedbread-ai/mxbai-rerank-base-v1` y `Xenova/ms-marco-MiniLM-L-6-v2` en benchmark interno (9 queries, corpus en español).
- **Hit rate** bge-base: 9/9 | mxbai: 9/9 | ms-marco: 8/9
- **Score discrimination** bge-base: [-8.70, 4.96] ← mejor discriminación
- mxbai scores: [-4.97, -1.95] ← rango comprimido, sin discriminación → ordering random → Context Precision baja 20pp en eval
- ms-marco: 8/9 hits + solo 385ms/query, válido para latencia pero peor hit rate

**BAAI/bge-reranker-v2-m3 descartado**: no tiene archivos ONNX disponibles ni en HuggingFace (BAAI ni Xenova) a fecha 2026-03-07.

**Scores son logits**: no acotar ni mostrar como porcentajes. El rango típico es [-10, +10].

**Fallback automático**: en modo dev (tsx, sin compilar), el Worker Thread falla; el sistema reranquea en el hilo principal. Mismo resultado, ligeramente más lento.

---

## LLM para generación RAG

### Config actual: Claude (Anthropic API)

```bash
USE_CLAUDE=true
CLAUDE_MODEL=claude-sonnet-4-6   # o claude-haiku-4-5-20251001
```

### Historial de evaluaciones (dataset v2.2, Comparativa+Multi-Hop)

| Run | Modelo RAG | Juez | Faith | Halluc | Relevancy | Precision | Recall |
|-----|-----------|------|-------|--------|-----------|-----------|--------|
| R1  | llama3.1:8b + reranker | Haiku | 0.51 | 0.68 | 0.61 | 0.31 | 0.90 |
| R2  | Claude Haiku sin reranker | Haiku | 0.55 | 0.80 | 0.74 | 0.17 | 0.94 |
| R3  | Claude Haiku + reranker | Haiku | 0.59 | 0.92 | 0.76 | 0.34 | 0.99 |
| R4  | Claude Haiku + reranker | **Sonnet** | ~0.28 | 0.60 | 0.72 | 0.10 | 0.94 |
| R5  | Claude Haiku + reranker + compression | **Sonnet** | 0.42 | 0.76 | 0.73 | 0.10-0.23 | 0.94 |
| R6  | llama3.1:8b + reranker + compression | Sonnet | 0.29 | 0.33 | 0.48 | 0.08 | 1.00 |
| R7  | qwen2.5:14b + reranker + compression | Sonnet | 0.32 | 0.54 | 0.60 | 0.35 | 0.94 |
| R8  | Claude Haiku + alignment | Sonnet | 0.36 | 0.65 | 0.74 | 0.35 | 0.92 |
| R9  | llama3.1:8b + BM25 fix + prompt estricto | llama (laxo) | 0.69* | 0.95* | 0.76 | 0.74 | 0.92 |
| R10 | llama3.1:8b + mxbai reranker | llama (laxo) | 0.78* | 0.91* | 0.78 | 0.54 | 0.92 |
| R11 | Claude Haiku, Multi-Hop only | Sonnet | 0.43 | 0.67 | 0.60 | 0.58 | 1.00 |

*Inflado por juez Ollama (más laxo que Sonnet). No comparar directamente con runs Sonnet.

### Por qué Claude Haiku sobre modelos locales

- **Faithfulness**: 0.42 vs 0.29 (llama) y 0.32 (qwen) con juez Sonnet — +13-10pp
- **Hallucination**: 0.76 vs 0.33 (llama) y 0.54 (qwen) — Claude inventa mucho menos
- **Answer Relevancy**: 0.73 vs 0.48 (llama) — Claude entiende mejor el español técnico
- **Coste**: Haiku es el modelo Claude más barato — viable para producción

### Por qué no Sonnet para generación

Sonnet es mejor calidad pero 5-10x más caro que Haiku. Haiku es suficiente para el dominio técnico específico de este corpus. Sonnet se reserva como **juez de evaluación** (más estricto, detecta alucinaciones que Haiku pasa por alto).

### Juez de evaluación: Sonnet siempre

- R4 demostró que Haiku como juez sobreestimaba Hallucination en 0.32 (0.92 vs real 0.60) y Faithfulness Multi-Hop en 0.35 (0.57 vs real 0.22).
- Usar `--judge sonnet` en todas las evaluaciones. `--judge ollama` solo para smoke tests rápidos con caveat explícito.

---

## Parámetros de Chunking

```bash
CHILD_CHUNK_SIZE=128    # pequeño → alta precisión en búsqueda semántica
CHILD_CHUNK_OVERLAP=25  # solapamiento mínimo para no partir frases
PARENT_CHUNK_SIZE=512   # suficiente contexto para el LLM sin exceder ventana
PARENT_CHUNK_OVERLAP=50 # solapamiento para no cortar en seco conceptos
```

**Por qué 128/512**: relación 1:4 validada empíricamente. Los hijos son lo suficientemente pequeños para que BM25 y vectores sean precisos; los padres lo suficientemente grandes para que el LLM tenga contexto completo.

## Parámetros de Retrieval

```bash
SIMILARITY_SEARCH_MAX_RESULTS=25  # ~2% de los 1199 docs indexados
RERANKER_RETRIEVAL_TOP_K=20       # candidatos para el reranker
RERANKER_FINAL_TOP_K=5            # parents al LLM (≈2.5k chars total)
BM25_WEIGHT=0.4
VECTOR_WEIGHT=0.6
```

**Por qué 60/40**: la semántica es más robusta ante parafraseo. BM25 aporta precisión léxica (nombres exactos de conceptos técnicos, siglas).

## Alignment Optimization

**Estado**: indexado pero desactivado en config recomendada.

**Resultado Run 8** (Claude Haiku + alignment, juez Sonnet, 13 casos):
- Faithfulness bajó: 0.36 vs 0.42 (R5 sin alignment)
- Hallucination bajó: 0.65 vs 0.76 (R5)
- Context Precision Comparativa: 21% — no mejoró vs sin alignment

**Por qué no ayuda**: el problema en preguntas Comparativa no es matching semántico (ya tenemos Context Recall 0.92-0.94) sino que los chunks recuperados no contienen la comparación explícita. Las preguntas hipotéticas indexadas añaden ruido que el LLM puede confundir con contexto real.

**El BM25 fix es lo que realmente importa**: BM25 debe excluir padres y alignment questions. Sin este fix, Context Precision era 0.08-0.10 (R6). Con el fix, sube a 0.35-0.74 (R9/R10).

---

## Punto Débil Actual: Multi-Hop Faithfulness

El sistema tiene Context Recall >94% consistentemente — el retrieval encuentra los documentos correctos. El problema es la **generación**: Claude (y todos los modelos probados) añade nombres de acciones NgRx, métodos, claves de localStorage y nombres de clases que no aparecen en el contexto.

Ejemplos de alucinaciones detectadas en Multi-Hop:
- `[Auth Page] Login` — nombre de acción NgRx inventado
- `[Auth API] Login Success` — idem
- `setSession()` — método inventado
- `'auth_token'` — clave localStorage inventada
- `JwtInterceptor` — clase inventada

**Causa probable**: Claude tiene conocimiento profundo de Angular/NgRx en su training data. En preguntas que requieren sintetizar múltiples documentos (multi-hop), el LLM "conecta los puntos" con su conocimiento previo cuando el contexto no tiene el dato exacto.

**Próximos pasos a evaluar**:
1. Query decomposition — descomponer multi-hop en sub-queries independientes antes de recuperar
2. Prompt más estricto con ejemplos de qué NO hacer
3. Modelos locales más grandes (qwen2.5:32b, llama3.3:70b) — cuando haya hardware disponible
