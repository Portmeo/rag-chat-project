# CHANGELOG — RAG Chat Project

Diario cronológico de sesiones de desarrollo. Cada entrada recoge las decisiones tomadas, los cambios implementados y los resultados obtenidos.

---

## Sesión 2026-03-07 — Alignment Optimization + Run 8

### Implementado

**Alignment Optimization (background job)**
- Nuevo servicio que genera preguntas hipotéticas por cada parent chunk durante la indexación (`hypothetical_questions` en metadata de Qdrant)
- La idea: si cada chunk "sabe" qué preguntas responde, el matching semántico con queries de usuario mejora para preguntas de comparación y razonamiento encadenado
- El proceso corre en background via `POST /api/documents/optimize-all` — no bloquea el indexado inicial
- Estado de optimización persistido en Qdrant (campo `optimization_status`: `idle | processing | done`)

**Endpoints de optimización**
- `POST /api/documents/optimize-all` — lanza batch de optimización para todos los documentos pendientes
- `POST /api/documents/optimize-one/:filename` — optimiza un documento concreto
- `DELETE /api/documents/clear-optimization` — limpia todas las preguntas hipotéticas (global)
- `DELETE /api/documents/clear-optimization/:filename` — limpia optimización de un documento

**Frontend: UploadPage**
- Botones optimize/clear por fila de documento
- Polling inteligente: solo activo cuando hay documentos en estado `processing`
- Silent fetch: el polling no resetea el estado de carga visible
- Contador de alignment questions por documento (cuando está en `done`)
- Ordenación por filename ascendente por defecto
- Ajuste de tamaño del botón "Clear All"

**Fixes y mejoras**
- Indexado de alignment questions en batches de 5 (no acumula en memoria antes de escribir a Qdrant)
- Limpiar alignment questions existentes antes de regenerar (evita duplicados tras re-optimizar)
- `RAG_LOGS=true` ahora muestra progreso de indexación de alineamiento
- Timeout del evaluador extendido de 60s a 180s por test case (evita falsos timeouts en runs con multi-query)
- Query logging activo: las queries del usuario se registran para análisis posterior
- BM25 migrado a Redis para persistencia entre reinicios y mejor rendimiento

**Evaluaciones**

| Run | Config | Dataset | Faith | Relevancy | Precision | Recall | Halluc |
|-----|--------|---------|-------|-----------|-----------|--------|--------|
| R8  | Claude Haiku + Alignment + Reranker | v2.2, 13 casos, Sonnet juez | 0.36 | 0.74 | 0.35 | 0.92 | 0.65 |

**Run 8 por categoría:**

| Categoría | Faithfulness | Relevancy | Precision | Recall |
|-----------|-------------|-----------|-----------|--------|
| Comparativa (7) | 0.30 | 0.79 | 0.21 | 0.93 |
| Multi-Hop (6)   | 0.42 | 0.69 | 0.50 | 0.92 |

### Decisiones y conclusiones

- **Alignment no mejora Comparativa** (Precision 21%, vs 30% de qwen en R7 sin alignment). El matching semántico de las preguntas hipotéticas no ayuda cuando la query del usuario requiere sintetizar dos conceptos que están en chunks distintos.
- **Alignment es neutro/ligeramente positivo en Multi-Hop** (Precision 50%, igual que R7). No empeora pero tampoco resuelve el problema de faithfulness (0.42).
- **Faithfulness bajó vs R5** (0.36 vs 0.42): las preguntas hipotéticas en el contexto pueden distraer al LLM y provocar más desvíos del texto original.
- **Hallucination bajó vs R5** (0.65 vs 0.76): el alignment añade ruido al contexto que Sonnet detecta como alucinación.
- **Conclusión**: alignment optimization no es la palanca correcta para mejorar Faithfulness en Comparativa. El problema es que el contexto recuperado no contiene la información de comparación explícita — se necesitan mejoras en el pipeline de retrieval o en el prompt (query decomposition).

### Ideas generadas (en IDEAS.md)
- RAG dinámico auto-mejorante: el sistema aprende de sus propias queries
- Redis para BM25 persistente (implementado)
- Query logging para análisis offline (implementado)

### Decisión de dirección — foco del RAG (2026-03-07)
Un RAG de documentación técnica sirve para hacer accesible el conocimiento escrito. El usuario busca entender qué hay, cómo funciona, cómo configurar algo — no sintetizar comparaciones que no están escritas en los docs.

Las queries Comparativas tienen Faithfulness 0.30 porque el LLM inventa comparaciones que ningún chunk contiene. Eso es el LLM haciendo lo que no debe, no un problema de retrieval. La solución correcta no es optimizar el RAG para esto sino **educar al usuario** sobre qué tipo de preguntas puede hacer, y **hacer el prompt más estricto** para que el sistema diga "no tengo esa información" en lugar de inventar.

**Consecuencia**: descartada query decomposition para Comparativa. Foco del siguiente sprint:
1. UI onboarding — qué puede preguntar el usuario
2. Prompt estricto anti-alucinaciones
3. Upgrade reranker (bge-reranker-v2-m3, multilingual)
4. Multi-Hop sí es un caso de uso legítimo — mejorarlo tiene sentido

---

## Sesión 2026-03-07 (continuación) — Fix BM25 + Diagnóstico Reranker

### Diagnóstico reranker
Creado script `test-reranker-inspect.ts` (`npm run test:reranker-inspect`) que muestra para cada query:
- Pre-rerank: parents que entran con su posición ensemble
- Post-rerank: posición nueva, score BGE y delta de movimiento (↑/↓/=)

**Hallazgos:**
- BM25 estaba indexando alignment questions (`is_alignment_question: true`) — se matchaban por estructura de pregunta ("¿Cuáles son...?") contra queries del usuario, desplazando docs relevantes
- El reranker SÍ funciona: en 4/5 queries movió docs, en microfrontends subió el correcto de pos 3→1
- Scores BGE muy comprimidos (-10 a -8) salvo matches claros → confirma que bge-reranker-base discrimina poco en español
- Un reranker loss confirmado (autenticación): doc correcto en pos 2 pre-rerank, caía fuera del top-5

### Fix aplicado
`apps/backend/src/services/rag/index.ts` línea 160: añadido `&& !meta.parent_child.is_alignment_question` al filtro BM25.
Mismo fix en `test-reranker.ts` y `test-reranker-inspect.ts`.

**Resultado post-fix: 5/5 HIT** en las mismas 5 queries. El reranker loss de autenticación se resolvió — el doc correcto sube a posición 1 (score -3.35).

### Prompt estricto anti-alucinaciones
Problema: "NUNCA inventes" es ambiguo — el LLM no considera que "completa" o "elabora" sea inventar.

Cambios en `apps/backend/src/services/rag/config.ts` (PROMPT_TEMPLATE.SYSTEM):
- Instrucción 2 reformulada: "Si algo no aparece escrito en el contexto, NO lo incluyas aunque lo sepas por tu conocimiento previo"
- Añadido explícitamente: "no inferras, deduzcas ni completes información no escrita"
- Mención explícita a Angular/NgRx/Ionic para evitar que el LLM use training data de esos frameworks
- Prohibición añadida: "NO uses tu conocimiento previo de frameworks para ampliar más allá del contexto"

---

## Sesión 2026-03-06/07 (noche) — Optimizaciones Core + Runs 1-7

### Implementado

**Pipeline RAG**
- Arquitectura Parent-Child (Small-to-Big): children 128 chars para retrieval, parents 512 chars para LLM
- Búsqueda híbrida: Vector 60% + BM25 40% (EnsembleRetriever)
- Multi-query generation: 3 variaciones por query usando Claude Haiku
- Reranker: bge-reranker-base, Top 20 → Top 5, via Worker Thread con fallback gracioso
- Contextual Compression: filtra frases de cada parent por similitud coseno (threshold 0.30, mxbai-embed-large)
- Temperature 0.0 en generación — más conservador, menos alucinaciones
- Eliminado header `[DOCUMENTO X | Fuente: ...]` del contexto — confundía al LLM
- Deduplicación de sources por filename (Set en `docsToSources()`)
- Eliminado `Relevancia: -760%` del header (logits BGE no son porcentajes)

**Evaluación**
- RAGAS evaluator con soporte para juez externo: `--judge sonnet|haiku|ollama`
- Dataset golden_qa_v2 actualizado a v2.2 (58 casos totales, categorías Comparativa y Multi-Hop ampliadas)
- Filtrado por categorías: `--categories "Comparativa,Multi-Hop"`
- Logger `EVAL_LOGS=true` para modo verbose
- Scripts de test por capas: `test:base`, `test:ensemble`, `test:parent-child`, `test:reranker`

**Prompt del sistema**
- Prohibición de copiar headers de documentos en respuestas
- Instrucción para corregir preguntas con premisas incorrectas
- Prohibición de añadir más detalle del que aparece en el contexto

**Evaluaciones**

| Run | Config | Faith | Relevancy | Precision | Recall | Halluc | Completados |
|-----|--------|-------|-----------|-----------|--------|--------|-------------|
| R1 | llama3.1:8b + Reranker | 0.51 | 0.61 | 0.31 | 0.90 | 0.68 | 47/52 |
| R2 | Claude Haiku sin Reranker | 0.55 | 0.74 | 0.17 | 0.94 | 0.80 | 49/52 |
| R3 | Claude Haiku + Reranker | 0.59 | 0.76 | 0.34 | 0.99 | 0.92 | 52/52 |
| R4 | Sonnet juez (validación R3, 9 casos) | — | — | — | — | 0.60 | 9/9 |
| R5 | Claude Haiku + Compression + temp 0.0 | 0.42 | 0.73 | 0.10-0.23 | 0.94 | 0.76 | 9/9 |
| R6 | llama3.1:8b + Compression + temp 0.0 | 0.29 | 0.48 | — | 0.94 | 0.33 | 9/9 |
| R7 | qwen2.5:14b + Compression + temp 0.0 | 0.32 | 0.60 | 0.30/0.42 | 1.00/0.83 | 0.54 | 13/13 |

### Decisiones

- **R4 reveló que Haiku juez era benévolo**: Multi-Hop Faithfulness real 0.22 (no 0.57). Desde R5, juez siempre Sonnet.
- **R5 confirmó Contextual Compression**: Faithfulness Comparativa sube de 0.31 → 0.53 (+22pp). Hallucination 0.60 → 0.76.
- **R6 descartó llama como opción**: Hallucination 0.33 vs 0.76 de Claude. Claude es la elección definitiva.
- **R7 descartó qwen2.5:14b**: Hallucination 0.54 vs 0.76 de Claude. qwen tiene mejor Precision en Comparativa pero pierde en todo lo demás.
- **Config final confirmada tras R3**: Claude Haiku + Reranker + Compression + temp 0.0

---

## Sesión 2026-03-02 — Re-evaluaciones y ajustes

Evaluaciones de seguimiento sobre el sistema base (antes de Contextual Compression).
Archivos: `ragas_2026-03-02T07-20-28`, `ragas_2026-03-02T07-34-01`.

---

## Sesión 2026-02-28 — Retoma del proyecto

Primer run tras pausa. Sistema con BM25 + Vector + Reranker pero sin Contextual Compression.
Archivo: `ragas_2026-02-28T06-05-29`.

---

## Sesión 2026-02-02/03 — Desarrollo inicial y primeras evaluaciones

### Implementado
- Setup inicial del sistema RAG: Qdrant, Ollama, Fastify, LangChain
- Embeddings: mxbai-embed-large (1024 dims, Cosine)
- BM25 + Vector search (ensemble retriever primera versión)
- Pipeline básico sin Parent-Child ni Reranker
- Sistema de evaluación RAGAS primera versión
- Primeras evaluaciones exploratorias (pre-tracking formal)
- Dataset inicial con 17 queries (luego `QUERIES_PROFUNDAS.md`, integrado en golden_qa_v2)

> Nota: los archivos de resultado de esta sesión (Feb 2-3) fueron eliminados en la limpieza de Mar 7 por estar fuera del tracking formal. Los aprendizajes quedaron capturados en `benchmark/evaluation/COMPARATIVA_SESION.md`.

---

*Archivo creado: 2026-03-07. Actualizar con cada sesión de trabajo.*
