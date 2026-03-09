# Ideas Pendientes - RAG Chat

Sistema actual: BM25 (40%) + mxbai-embed-large (60%) + bge-reranker + Claude Haiku + Contextual Compression + Alignment Optimization + SQLite persistence

---

## 🎯 Prioridad Alta (Siguiente Sprint)

> **Decisión de dirección (2026-03-07)**: Un RAG de documentación técnica sirve para hacer accesible el conocimiento escrito — no para sintetizar comparaciones que no están en los docs. El usuario busca entender qué hay, cómo funciona, qué pasos sigue. Foco: que el RAG responda bien Básica, Conceptual, Proceso, Relación y Multi-Hop. Las Comparativas no son el objetivo de optimización — un RAG propietario no tendrá esa información sintetizada.

---

### 1. Educación al usuario en la UI ⭐ ALTA PRIORIDAD
- [ ] Mensaje onboarding en el chat explicando qué tipo de preguntas puede hacer
  - Ejemplos: "¿Cómo funciona X?", "¿Qué hace Y?", "¿Cómo se configura Z?", "¿Qué pasos sigue el flujo de autenticación?"
  - Dejar claro que es un asistente de documentación, no un chatbot general
  - **Por qué**: Antes de optimizar el RAG para casos edge, tiene más ROI que el usuario entienda qué esperar
  - **Impacto**: Reduce frustración, mejora percepción de calidad sin tocar el pipeline
  - **Coste**: Mínimo — solo UI
  - **Tiempo**: 2-3 horas

### 2. Prompt más estricto anti-alucinaciones ⭐ ALTA PRIORIDAD
- [ ] Añadir instrucción explícita: *"Si la información no aparece en los contextos, responde que no tienes esa información. No uses conocimiento externo."*
  - **Problema**: Faithfulness 36% en Run 8 — el LLM rellena gaps con conocimiento de entrenamiento (Angular/NgRx)
  - **Impacto esperado**: +10-15% Faithfulness en todas las categorías
  - **Coste**: Mínimo — solo el prompt
  - **Riesgo**: Respuestas más secas en preguntas básicas. Aceptable — es el comportamiento correcto.
  - **Tiempo**: 1 hora + Run 9 de evaluación

### 3. Upgrade reranker: bge-reranker-base → bge-reranker-v2-m3
- [ ] Cambiar `RERANKER_MODEL` en `.env`
  - **Problema**: Reranker actual es monolingual, rendimiento subóptimo con texto en español
  - **Solución**: `Xenova/bge-reranker-v2-m3` — multilingual, mejor soporte español
  - **Impacto esperado**: Context Precision +5-10% en todas las categorías
  - **Coste**: Bajo — solo cambiar variable de entorno
  - **Tiempo**: 30 min + test

### 4. Analizar queries reales de usuarios ⭐ IMPORTANTE (cuando haya uso real)
- [x] Query logging implementado (SQLite `query_log`) — se guardan question, answer, model, latency_ms, sources, num_retrieved, context_size
- [ ] Revisión periódica de los logs para detectar:
  - Queries que fallan frecuentemente → gaps en la documentación
  - Vocabulario real de los usuarios → ajustar chunking/indexado
  - Queries comparativas — analizar si son preguntas legítimas para este RAG o si el usuario espera algo que no aplica
  - **Tiempo**: recurrente (no es una tarea única)

### 5. Mejorar Multi-Hop (caso de uso legítimo complejo)
- [ ] Las preguntas Multi-Hop SÍ aplican en documentación técnica — "¿cómo llega el JWT del login hasta las peticiones HTTP?" requiere conectar información de múltiples docs
  - **Problema actual**: Faithfulness Multi-Hop 0.42, Precision 0.50
  - **Opciones a evaluar**:
    - Aumentar `RERANKER_FINAL_TOP_K` de 5 a 7 (más contexto sin cambiar arquitectura)
    - Prompt que indique explícitamente que puede conectar información de varias fuentes cuando sea necesario
  - **Tiempo**: 1 día + evaluación

### 3. Persistir Historial de Conversaciones
- [ ] Guardar chats completos en SQLite (tabla separada de `query_log`)
  - Sidebar con lista de chats pasados
  - Recuperar conversaciones anteriores
  - **Nota**: `query_log` ya persiste cada query individual, pero no el hilo conversacional completo
  - **Tiempo**: 1 día
  - **Dificultad**: Media

### 4. Gestión de Documentos - Mejorar
- [ ] Mostrar chunks y tamaño por documento
  - Actualmente solo muestra nombre y fecha
  - Agregar: número de chunks, tamaño KB/MB
  - **Tiempo**: 2 horas
  - **Dificultad**: Fácil

### 5. Dark Mode
- [ ] Toggle tema oscuro/claro
  - **Tiempo**: 2 horas
  - **Dificultad**: Fácil

---

## 🚀 Prioridad Media

### 6. Parent Document Retriever ✅ IMPLEMENTADO
- [x] Estrategia Small-to-Big activa (child=128, parent=512)
  - Child chunks para retrieval vectorial preciso
  - Parent chunks para contexto completo al LLM
  - Hydration automática: child → parent único
  - Validado: 100% hit rate en test de 35 preguntas
  - **Problema detectado**: Context Precision 0.34 — los parents (512 chars) incluyen contexto ruidoso alrededor del dato relevante. Candidato a prompt compression.

### 7. Contextual Compression (Opcional)
- [ ] Comprimir contexto antes de enviar al LLM
  - Extraer solo frases relevantes de cada chunk
  - Usar modelo pequeño o lógica de código
  - **Impacto**: -30% tokens (menos relevante con Ollama local)
  - **Cuándo usar**: Si el LLM se confunde con chunks ruidosos
  - **Nota**: El reranker ya hace filtrado similar a nivel de documento
  - **Tiempo**: 3-4 horas
  - **Dificultad**: Media
  - **Prioridad**: Baja (solo si hay problemas de ruido)

### ❌ HyDE — Ver análisis en sección Microsoft Advanced RAG

### ❌ HyDE (NO Recomendado)
- [x] ~~Query Expansion con Hypothetical Document Embeddings~~
  - **Por qué NO implementar**:
    - ✅ Ya tenemos multi-query que genera 3 variaciones de la pregunta
    - ✅ Multi-query cubre el 80% del caso de uso de HyDE
    - ❌ HyDE añade latencia (llamada extra al LLM)
    - ❌ Para documentación técnica, las queries ya usan términos similares a los docs
    - ❌ HyDE es útil para "vocabulary mismatch" severo (no es nuestro caso)
  - **Cuándo SÍ valdría la pena**: Si usuarios hacen queries muy coloquiales vs docs técnicos formales
  - **Decisión**: SKIP - Multi-query ya resuelve este problema

- [ ] Metadata enriquecida
  - Secciones (h1, h2, h3)
  - Tipo de contenido (código, texto, tabla)
  - Filtros de búsqueda por metadata
  - **Impacto**: +10-15% precisión
  - **Tiempo**: 2-3 horas
  - **Dificultad**: Media

### 7. Configuración Avanzada (UI)
- [ ] Panel de ajustes RAG
  - Chunk size (1000, 1500, 2000)
  - Chunk overlap (100, 200, 300)
  - Top-k retrieval (4, 8, 16)
  - BM25/Vector weights
  - **Tiempo**: 1 día
  - **Dificultad**: Media

- [ ] Selección de modelo LLM
  - Dropdown de modelos Ollama disponibles
  - **Tiempo**: 3 horas
  - **Dificultad**: Fácil

### 8. Analytics
- [ ] Dashboard de estadísticas
  - Documentos subidos
  - Queries realizadas
  - Tiempo promedio de respuesta
  - **Tiempo**: 1 día
  - **Dificultad**: Media

- [ ] Métricas por query
  - Latencia
  - Tokens usados
  - Similarity scores
  - **Tiempo**: 4 horas
  - **Dificultad**: Fácil

---

## 💡 Prioridad Baja / Futuro

### 9. Funcionalidades Avanzadas
- [ ] Feedback de respuestas
  - 👍 👎 para cada respuesta
  - Guardar para análisis
  - **Tiempo**: 4 horas
  - **Dificultad**: Fácil

- [ ] Sugerencias de preguntas
  - "También puedes preguntar..."
  - Generar automáticamente desde docs
  - **Tiempo**: 1 día
  - **Dificultad**: Media

- [ ] Citas y referencias numeradas
  - Fuentes [1], [2], [3]
  - Links a secciones exactas
  - **Tiempo**: 1 día
  - **Dificultad**: Media

### 10. Import/Export
- [ ] Import desde URLs
  - Scrapear webs
  - Import desde GitHub (README, docs)
  - **Tiempo**: 2 días
  - **Dificultad**: Media-Alta

- [ ] Soporte PDF y DOCX
  - pdf-parse, mammoth
  - **Tiempo**: 1 día
  - **Dificultad**: Media

- [ ] Export de conversaciones
  - JSON, PDF
  - **Tiempo**: 4 horas
  - **Dificultad**: Fácil

### 11. Multi-usuario (Largo Plazo)
- [ ] Autenticación (JWT, OAuth)
  - Login/Registro
  - **Tiempo**: 2-3 días
  - **Dificultad**: Media-Alta

- [ ] Documentos y chats por usuario
  - Aislamiento de datos
  - **Tiempo**: 1 semana
  - **Dificultad**: Alta

### 12. Testing
- [ ] Tests automatizados
  - Unit tests (backend)
  - E2E tests (Playwright)
  - **Tiempo**: 1 semana
  - **Dificultad**: Media

- [ ] CI/CD
  - GitHub Actions
  - Deploy automático
  - **Tiempo**: 2 días
  - **Dificultad**: Media

### 13. Deployment
- [ ] Docker Compose completo
  - Frontend + Backend + Qdrant + Ollama
  - **Tiempo**: 1 día
  - **Dificultad**: Media

- [ ] Deploy cloud
  - AWS/Azure scripts
  - **Tiempo**: 1 semana
  - **Dificultad**: Alta

---

## 🗺️ Roadmap Sugerido

### Sprint 1 (próximo) — Calidad y UX básica
1. **UI onboarding** — mensaje educativo de para qué sirve el RAG (2-3h)
2. **Prompt estricto** — instrucción anti-alucinaciones + run eval para medir (1h)
3. **Upgrade reranker** a bge-reranker-v2-m3 multilingual (30min)
4. **Mostrar chunks/tamaño por documento** en UploadPage (2h)

**Resultado**: RAG con mejor Faithfulness y usuarios con expectativas correctas

### Sprint 2 — Producto
1. Persistir historial de chats (SQLite, sidebar) — la infraestructura ya existe
2. Feedback 👍👎 por respuesta — empezar a recopilar señal de calidad real
3. Dashboard básico de query_log (queries frecuentes, latencia media)

**Resultado**: Producto más completo con observabilidad

### Sprint 3 — Expansión
1. Soporte PDF y DOCX (dependencias ya instaladas: pdf-parse, mammoth)
2. Import desde URLs / GitHub
3. Multi-usuario / autenticación

**Resultado**: Sistema usable por equipos

### Largo Plazo
- Soporte PDF/DOCX
- Multi-usuario / autenticación
- Tests + CI/CD

---

## 🔬 Técnicas Advanced RAG (Microsoft Learn)

Referencia: [Advanced RAG — Microsoft Azure](https://learn.microsoft.com/es-es/azure/developer/ai/advanced-retrieval-augmented-generation)

### Estado de implementación actual

| Técnica | Estado | Notas |
|---|---|---|
| Hybrid Search (BM25 + Vector) | ✅ Implementado | BM25 0.4 + Vector 0.6 |
| Reranking (Cross-Encoder) | ✅ Implementado | BGE-reranker-base, Top 20 → Top 5 |
| Small-to-Big (Parent-Child) | ✅ Implementado | Child 128 / Parent 512 |
| Multi-query | ✅ Implementado | 3 variantes por query vía LLM |
| Golden dataset + RAGAS | ✅ Implementado | 52 casos, métricas completas |
| Prompt Compression | ✅ Implementado | EmbeddingsFilter coseno threshold 0.40 |
| Alignment Optimization | ✅ Implementado | 3 preguntas/chunk, indexadas en Qdrant |
| Query Router | ❌ No implementado | Útil para categorías mixtas |
| Fact-checking post-completion | ❌ No implementado | Mitiga alucinaciones en generación |
| Hierarchical Index (summary) | ❌ No implementado | Útil para preguntas comparativas |
| HyDE | ⛔ Descartado | Multi-query ya cubre este caso |

---

### Técnicas no implementadas — detalle

#### A. Prompt Compression (Contextual Compression) ✅ IMPLEMENTADO
- Divide cada parent en frases y descarta las que no superen similitud coseno vs query (threshold 0.40)
- Activado via `USE_CONTEXTUAL_COMPRESSION=true`
- Cuidado: puede eliminar líneas de código con baja similitud semántica pero relevantes

#### B. Alignment Optimization (Preguntas por Chunk) ✅ IMPLEMENTADO
- Genera 3 preguntas hipotéticas por parent chunk y las indexa en Qdrant con embedding
- Activado via `USE_ALIGNMENT_OPTIMIZATION=true` + botón en UI
- Pendiente: medir impacto real en evaluación RAGAS post-optimización

#### C. Query Router
- **Qué es**: Un clasificador que analiza la pregunta y decide qué estrategia de retrieval usar (vector puro, híbrido, búsqueda por metadata, respuesta directa sin RAG).
- **Por qué importa**: Las preguntas de tipo "Edge Case" y "Comparativa" tienen baja relevancy/precision. Un router podría enviarlas a estrategias específicas.
- **Ejemplo**: Preguntas tipo "¿Existe X en la documentación?" → búsqueda por keyword BM25; preguntas conceptuales → vector; preguntas comparativas → hierarchical index.
- **Dificultad**: Media
- **Tiempo**: 1 día

#### D. Hierarchical Index para preguntas comparativas
- **Qué es**: Dos niveles de índice: (1) resúmenes de cada documento completo, (2) chunks detallados. Para preguntas que comparan conceptos, buscar primero en resúmenes para obtener visión global antes de los chunks.
- **Por qué importa**: Categoría Comparativa tiene Faithfulness = **0.33** — el modelo no tiene contexto suficiente para comparar dos tecnologías cuando la info está fragmentada en chunks separados.
- **Dificultad**: Alta
- **Tiempo**: 2-3 días

#### E. Fact-checking post-completion
- **Qué es**: Después de generar la respuesta, pasar una verificación LLM que compara cada afirmación de la respuesta con el contexto original y rechaza/corrige las no soportadas.
- **Por qué importa**: Hallucination actual = **0.92** (ya bueno), pero Faithfulness = 0.59 — hay afirmaciones no directamente contradictorias pero sí inferidas que podrían filtrarse.
- **Coste**: Una llamada LLM extra por query (+latencia).
- **Alternativa más ligera**: Reforzar el prompt del sistema (ya se hizo parcialmente).
- **Dificultad**: Media
- **Tiempo**: 4-6 horas

---

### Recomendación de siguiente paso

**Problema principal identificado (sesión 2026-03-07):**
- Faithfulness plateau en ~0.59 incluso con Claude Haiku como LLM
- Comparativa Faithfulness = 0.33 (el modelo razona más allá del contexto)
- Context Precision = 0.34 (los parents tienen ruido)

**Acción recomendada (por orden de impacto/esfuerzo):**
1. **Prompt Compression** — mejor ratio impacto/tiempo. Probar `EmbeddingsFilter` primero (sin LLM extra).
2. **Aumentar `RERANKER_FINAL_TOP_K` a 7** — más contexto para preguntas comparativas sin cambiar arquitectura.
3. **Alignment Optimization** — mayor impacto pero requiere re-indexar. Planificar para sprint siguiente.

---

## 📊 Herramientas Útiles

### Para Implementar
- **RAGAS**: https://github.com/explodinggradients/ragas
- **Parent Document Retriever**: https://python.langchain.com/docs/modules/data_connection/retrievers/parent_document_retriever
- **Qdrant Sparse Vectors**: https://qdrant.tech/documentation/concepts/vectors/#sparse-vectors
- **LangChain Memory**: https://js.langchain.com/docs/modules/memory/
- **react-markdown**: https://github.com/remarkjs/react-markdown
- **Playwright**: https://playwright.dev/ (E2E tests)

### Papers de Referencia
- [Lost in the Middle](https://arxiv.org/abs/2307.03172) - Posición de docs importa
- [RAG Survey](https://arxiv.org/abs/2312.10997) - Estado del arte RAG
- [Precise Zero-Shot Dense Retrieval](https://arxiv.org/abs/2212.10496) - HyDE (decidimos NO implementar)

---

## 🎯 Métricas de Éxito

- **Latencia**: < 2s (sin reranking), < 3s (con reranking) ✅
- **Accuracy**: > 85% ✅ (actualmente 85.7%)
- **MRR**: > 0.85 ✅ (actualmente 0.875)
- **User Satisfaction**: > 80% (pendiente - necesita feedback UI)
- **Uptime**: > 99% (pendiente - monitoreo)

---

---

## 🔍 Análisis de RAG corporativo de referencia — Marzo 2026

Revisión de un sistema RAG en producción usado internamente en Contact Centers. Pipeline Python/FastAPI con Azure OpenAI.

### Stack comparativo

| Componente | RAG referencia | Nuestro RAG |
|---|---|---|
| **Lenguaje** | Python (FastAPI) | TypeScript (Express) |
| **LLM** | GPT-4.1 (Azure OpenAI) | Claude Haiku (Anthropic) |
| **Embeddings** | text-embedding-ada-002 (1536d, Azure) | mxbai-embed-large (1024d, local Ollama) |
| **Vector Store** | Azure Cognitive Search (HNSW) | Qdrant (HNSW) |
| **BBDD** | PostgreSQL | SQLite |
| **Reranker** | Azure Cognitive Search built-in | bge-reranker-base (local, Worker thread) |
| **BM25** | No (solo vector + semántico) | Sí (Ensemble 40/60) |
| **Streaming** | SSE (FastAPI + sse-starlette) | SSE (Express) |
| **Framework RAG** | Sin framework (código propio) | LangChain (parcial) |

### Pipeline de referencia (detalle)

1. **Query cleaning** — Limpieza de caracteres especiales, normalización
2. **Query reformulation** — LLM reformula la pregunta según historial (pregunta autocontenida para retrieval)
3. **Intent classification** — Agente LLM que detecta saludos/charla → responde directo sin RAG
4. **Input validation** — Mínimo 4 palabras
5. **Category detection** — Fuzzy matching + LLM para identificar categoría/tema de la query
6. **6 capas de metadata filtering** — canal, tipo de cliente, grupos especiales, categoría, perfil, tipo de registro
7. **Vector search** — Búsqueda semántica, top 35 chunks (500 chars)
8. **Dedup + Similarity drop-off** — Elimina duplicados y chunks con >20% caída de similitud → top 2 docs
9. **Expansión de secciones** — Recupera 3 secciones antes y 1 después de cada chunk (similar a parent-child pero con ventana fija)
10. **RAG generation** — LLM temp 0.2, max 2000 tokens, docs como mensajes user/assistant alternados
11. **Post-answer doc reranking** — Fuzzy match entre respuesta y docs para reordenar fuentes mostradas
12. **Logging** — Todo a PostgreSQL (questions, chats, events)

### Features a adoptar

#### Prioridad 1: Intent Classifier (`USE_INTENT_CLASSIFIER`)
- **Qué**: Detectar saludos/charla casual antes de entrar al pipeline RAG
- **Por qué**: Ahora "hola" ejecuta multi-query + ensemble + reranker + compression para nada
- **Cómo**: Regex rápido para patrones obvios (hola, gracias, adiós) + LLM fallback para inputs ambiguos cortos (1-3 palabras). Inputs de 4+ palabras van directo al RAG
- **Referencia**: El sistema de referencia usa un agente LLM para TODAS las queries (ineficiente). Nuestra versión es híbrida: regex primero, LLM solo en edge cases
- **Impacto**: Ahorra ~2-3s de latencia + tokens en inputs casuales
- **Config**: `USE_INTENT_CLASSIFIER=true`, `INTENT_CLASSIFIER_USE_LLM=true`
- **Archivo**: `services/rag/intentClassifier.ts`

#### Prioridad 2: Similarity Drop-off (`USE_SIMILARITY_DROPOFF`)
- **Qué**: En vez de top-K fijo, descartar docs cuyo score cae >X% respecto al mejor resultado
- **Por qué**: Top-K fijo puede incluir docs irrelevantes cuando hay pocos buenos resultados, o dejar fuera docs relevantes cuando hay muchos buenos
- **Cómo**: `drop = 1 - (score / bestScore)`. Si drop > maxDrop → descartar. Shift a positivo para manejar logits negativos del reranker. Siempre mantener mínimo N docs
- **Referencia**: El sistema de referencia usa max_similarity_diff=0.2 y first_n_results=2
- **Impacto**: Contexto más limpio para el LLM → mejor Faithfulness
- **Config**: `USE_SIMILARITY_DROPOFF=true`, `SIMILARITY_DROPOFF_MAX_DROP=0.20`, `SIMILARITY_DROPOFF_MIN_DOCS=2`
- **Archivo**: `services/rag/similarityDropoff.ts`
- **Dónde en pipeline**: Después del reranker (PASO 2), antes de contextual compression (PASO 3)

#### Prioridad 3: Metadata Filtering en Retrieval ✅ IMPLEMENTADO
- **Qué**: Filtrar documentos por categoría antes de la búsqueda vectorial
- **Implementación**: Categorías derivadas del nombre del archivo (ej: `07-ci-cd-deployment.md` → "CI CD Deployment"). Almacenadas en SQLite (`categories` table) con auto-backfill al arrancar. Frontend muestra chips seleccionables. Qdrant aplica filtro nativo `match: { any: filenameFilter }` sobre `metadata.filename`
- **Referencia**: El sistema de referencia tiene 6 capas de filtrado por metadata. Nuestra versión es más simple (1 capa por filename) pero extensible
- **Archivos**: `categoryExtractor.ts`, `sqliteCategoryStorage.ts`, `GET /api/chat/categories`, filtro en `retrieveRelevantDocuments`
- **Frontend**: Chips de categoría sobre el input, toggle "Filter by category", clear all

### Features adicionales identificadas (segunda revisión)

#### Prioridad 4: Smart Re-indexación — Change Detection
- **Qué**: Antes de re-embedir un documento, comparar si el contenido realmente cambió. Si solo cambió metadata, reutilizar los embeddings existentes y solo actualizar el payload
- **Por qué**: Ahora re-indexamos todo cada vez que se sube un documento. Generar embeddings es la operación más cara del pipeline de ingesta (llamada a Ollama por cada chunk)
- **Cómo**: Clasificar cada documento en 4 categorías al re-subir:
  - **Nuevo** → embeddings nuevos (obligatorio)
  - **Mismo nº de chunks pero contenido diferente** → embeddings nuevos
  - **Mismo contenido, diferente metadata** → reutilizar embeddings, solo actualizar payload en Qdrant
  - **Idéntico** → skip total (no-op)
- **Impacto**: Reduce drásticamente el tiempo de re-indexación en actualizaciones parciales. Especialmente útil cuando crece el corpus
- **Config**: `USE_SMART_REINDEX=true`
- **Complejidad**: Media — necesita hash del contenido por chunk para comparar

#### Prioridad 5: Dual Latency Metrics
- **Qué**: Medir dos tiempos separados en lugar de uno:
  - `retrieval_ms` — tiempo desde inicio hasta que tenemos los docs relevantes (ensemble + reranker + compression)
  - `generation_ms` — tiempo desde que el LLM empieza hasta el último token
- **Por qué**: Ahora solo medimos `latency_ms` total. Si hay un problema de rendimiento no sabemos si es el retrieval o el LLM
- **Cómo**: Añadir un `Date.now()` entre la fase de retrieval y la de generación. Loguear ambos en `query_log`
- **Impacto**: Diagnóstico preciso de cuellos de botella. El sistema de referencia detectó que el 70% de su latencia era retrieval, no LLM
- **Config**: No necesita toggle — siempre activo
- **Complejidad**: Baja — solo medir y loguear

#### Prioridad 6: Límite de longitud en respuestas
- **Qué**: Forzar en el prompt un máximo de palabras/tokens en la respuesta del LLM
- **Por qué**: A veces el LLM genera respuestas excesivamente largas que incluyen información no pedida. El sistema de referencia limita a 300 palabras
- **Cómo**: Añadir instrucción en el system prompt: "La respuesta no debe superar las 300 palabras. Si la información es extensa, prioriza lo más relevante."
- **Impacto**: Respuestas más concisas → menos alucinaciones por extensión + mejor UX
- **Config**: `MAX_RESPONSE_WORDS=300` (configurable)
- **Complejidad**: Mínima — solo prompt

#### Prioridad 7: Dynamic Chunk Size
- **Qué**: Adaptar el tamaño de chunk según el ratio caracteres/tokens del texto, en lugar de usar un tamaño fijo
- **Por qué**: Diferentes idiomas y tipos de contenido (código vs prosa) tienen ratios char/token muy distintos. Un chunk de 200 chars puede ser 50 tokens en código o 80 en texto español
- **Cómo**: Calcular `ratio = chars / tokens` del documento y ajustar: `chars_to_split = chunk_size_tokens * ratio`. Así cada chunk tiene un número consistente de tokens reales
- **Impacto**: Chunks más uniformes en contenido semántico → retrieval más consistente
- **Config**: `USE_DYNAMIC_CHUNK_SIZE=true`
- **Complejidad**: Media — requiere tokenización previa (tiktoken o similar)

#### Prioridad 8: Adaptive Threshold (para fuzzy matching / scores)
- **Qué**: En vez de un threshold fijo para filtrar resultados, usar un threshold que se adapta a la calidad del mejor resultado
- **Por qué**: Un threshold fijo descarta demasiado cuando no hay matches perfectos, o deja pasar ruido cuando los hay
- **Cómo**: Fórmula: `min_score = best_score - ((max_possible - best_score) * weight)`. Cuando el mejor score es mediocre (50/100), el threshold baja proporcionalmente (acepta >40). Cuando es alto (99/100), se vuelve estricto (acepta >98.8)
- **Impacto**: Más robusto que thresholds fijos en contextual compression y similarity drop-off
- **Config**: `ADAPTIVE_THRESHOLD_WEIGHT=0.20`
- **Complejidad**: Baja — una fórmula en el filtrado existente

#### Prioridad 9: Triple representación del contenido
- **Qué**: Almacenar 3 versiones de cada documento:
  - **Texto limpio** → para indexación vectorial y BM25 (sin HTML, sin markdown)
  - **Markdown** → para el contexto del LLM (formato legible, preserva estructura)
  - **HTML** → para mostrar en el frontend con highlighting de las partes relevantes
- **Por qué**: Ahora usamos una sola representación para todo. El texto que indexamos es el mismo que le damos al LLM y que mostramos al usuario. Esto genera compromisos: si limpiamos HTML para indexar mejor, perdemos formato para mostrar
- **Impacto**: Mejor calidad de embeddings (texto limpio), mejor contexto para el LLM (markdown), mejor UX (HTML con highlighting)
- **Config**: Sin toggle — cambio en el pipeline de ingesta
- **Complejidad**: Alta — requiere modificar ingesta, almacenamiento y frontend

#### Prioridad 10: HTML Repair en bordes de chunk
- **Qué**: Al dividir documentos HTML en chunks, los tags pueden quedar cortados (ej: `<div class="fo` al final de un chunk, `o">content</div>` al inicio del siguiente)
- **Por qué**: Tags HTML rotos generan ruido en embeddings y confunden al LLM
- **Cómo**: Regex post-split: eliminar tags abiertos sin cerrar al final (`<[^>]*$`) y cierres huérfanos al inicio (`^[^<]*>`) de cada chunk
- **Impacto**: Chunks más limpios cuando la fuente es HTML
- **Config**: Sin toggle — siempre activo en el splitter
- **Complejidad**: Baja — dos regex en `createParentChildChunks`

#### Prioridad 11: Query Reformulation pre-retrieval (`USE_QUERY_REFORMULATION`)
- **Qué**: Usar el LLM para reformular la pregunta del usuario incorporando el contexto del historial ANTES del retrieval, no solo para el prompt final
- **Por qué**: Ahora el historial se pasa al LLM final pero la búsqueda se hace con la pregunta original. Si el usuario pregunta "¿tiene cobertura dental?" y luego "¿y en viaje?", buscamos literalmente "¿y en viaje?" en Qdrant — que no tiene contexto suficiente para un buen retrieval
- **Cómo**: Antes de `generateMultipleQueries()`, pasar la pregunta + historial al LLM para obtener una pregunta autocontenida. "¿y en viaje?" → "¿tiene cobertura de asistencia en viaje?". Esa pregunta reformulada es la que entra al multi-query y al retrieval
- **Diferencia con lo que ya tenemos**: `CONVERSATIONAL_HISTORY_ENABLED` pasa el historial al prompt del LLM final (generación). Esto mejoraría el **retrieval** — que es donde realmente importa tener la query correcta
- **Referencia**: El sistema de referencia tiene un agente dedicado (`QuestionAgent`) que siempre reformula antes de buscar
- **Impacto**: Mejora significativa en conversaciones multi-turno. Sin esto, el segundo mensaje de una conversación casi siempre recupera docs irrelevantes
- **Config**: `USE_QUERY_REFORMULATION=true`
- **Archivo**: `services/rag/queryReformulator.ts`
- **Complejidad**: Baja-Media — una llamada LLM extra antes del retrieval. Añade ~0.5-1s de latencia

### Features descartadas (por ahora)

| Feature | Por qué no |
|---|---|
| **Múltiples agentes LLM en pipeline** | Demasiada latencia. Nuestro pipeline es más eficiente |
| **Solo 2 docs finales** | Muy arriesgado. Nuestro top 5 con reranker es más robusto |
| **Sin BM25** | Nuestra búsqueda híbrida es superior a solo vectores |
| **Post-answer doc reranking** | Nice to have pero no prioritario. Las fuentes ya van ordenadas por rerank score |
| **Category detection con fuzzy matching** | No tenemos taxonomía de categorías. Evaluar cuando crezca el corpus |
| **Token-level HTML streaming** | Complejidad alta para poco beneficio visual. Nuestro streaming funciona bien |
| **Docs como mensajes user/assistant alternados** | Formato poco estándar. Nuestro contexto concatenado funciona |
| **Recursive content truncation** | Nuestros parents ya están limitados en tamaño. No necesitamos truncar |

---

**Última actualización**: 9 de marzo de 2026
**Estado**: Pipeline completo — BM25+Vector+Reranker+Parent-Child+Contextual Compression+Alignment Optimization+Claude Haiku+SQLite persistence. Comparativas descartadas como objetivo (RAG propietario no tiene esa info). Próximas features: Intent Classifier + Similarity Drop-off + Metadata Filtering + Smart Re-indexación + Dual Latency + más (inspirado en análisis de RAG corporativo de referencia).
