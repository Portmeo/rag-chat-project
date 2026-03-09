# Guía del Sistema RAG - Arquitectura y Componentes

## ¿Qué es este sistema?

Un sistema RAG (Retrieval-Augmented Generation) optimizado para consultas sobre documentación técnica en español. El sistema busca información relevante en los documentos y genera respuestas precisas usando IA, empleando una estrategia de recuperación jerárquica (Parent-Child).

## Arquitectura del Sistema (Flujo Optimizado)

```
      Pregunta del usuario
              ↓
0. Intent Classifier (regex / hybrid / llm)
   → Detecta saludos y charla casual → respuesta directa, salta el pipeline
              ↓
1. Multi-Query Generation (3-4 variaciones)
              ↓
1.5. Metadata Filtering (Qdrant nativo, si el usuario seleccionó categorías)
              ↓
2. Búsqueda Híbrida (BM25 40% + Vectores 60%) sobre CHILDREN
              ↓
3. Hydration: Resolución de Children a PARENTS únicos (SQLite por ID)
              ↓
4. Reranking (Cross-Encoder) sobre PARENTS → Top K
              ↓
4.5. Similarity Drop-off
   → Descarta docs cuyo score cae >20% del mejor resultado
   → Adaptativo: mantiene más docs cuando muchos son buenos, menos cuando pocos lo son
   → Siempre mantiene mínimo N docs (configurable)
              ↓
5. Contextual Compression
   → Cada parent se divide en frases
   → Se descartan frases con similitud coseno < umbral vs la query
   → Reduce ruido y previene que el LLM rellene huecos con conocimiento propio
              ↓
6. Generación (LLM configurable, temperature 0.0)
   → Respuesta estrictamente desde el contexto comprimido
```

## Componentes Principales

### 0. Intent Classifier

**¿Qué hace?**
Clasifica la intención del usuario antes de entrar al pipeline RAG. Si detecta un saludo, agradecimiento, despedida o charla casual, responde directamente sin ejecutar el pipeline completo (multi-query, retrieval, reranker, compression, LLM).

**3 modos de operación** (`INTENT_CLASSIFIER_MODE`):
- **`regex`**: Solo patrones regex. Cero latencia, cero coste de tokens. Cubre saludos obvios ("hola", "gracias", "adiós") pero puede fallar en frases mixtas o ambiguas.
- **`hybrid`** (default): Regex primero. Si no hay match, pasa al LLM para clasificar. Buen balance entre velocidad y cobertura.
- **`llm`**: Todo pasa por el LLM. Máxima cobertura (+0.5s latencia por query). Entiende contexto, ironía y frases complejas.

**Activación**: `USE_INTENT_CLASSIFIER=true` / `false` para desactivar completamente.

**Archivos**: `services/rag/intentClassifier.ts`, config en `services/rag/config.ts`.

### 1.5. Metadata Filtering (Filtrado por Categoría)

**¿Qué hace?**
Permite al usuario filtrar documentos por categoría antes de la búsqueda vectorial. El filtro se aplica a nivel de Qdrant (nativo, pre-retrieval), reduciendo el espacio de búsqueda y eliminando ruido.

**Cómo funciona:**
- Las categorías se derivan automáticamente del nombre del archivo al indexar (ej: `07-ci-cd-deployment.md` → "CI CD Deployment")
- Se almacenan en SQLite (tabla `categories`) con auto-backfill al arrancar el backend
- El frontend muestra chips seleccionables sobre el input de texto (`GET /api/chat/categories`)
- Cuando el usuario selecciona categorías, se pasa `filenameFilter` en el body del query
- Qdrant aplica un filtro `match: { any: [...] }` sobre `metadata.filename` antes de la búsqueda vectorial

**Flujo:**
1. Frontend carga categorías al montar el componente chat
2. Usuario selecciona una o más categorías (o ninguna para buscar en todo)
3. `filenameFilter` viaja en el body de `/api/chat/query-stream`
4. Qdrant restringe la búsqueda vectorial a los documentos seleccionados
5. BM25 no se filtra (busca en todo el índice) — el filtro es solo vectorial

**Archivos**: `services/rag/categoryExtractor.ts`, `repositories/sqliteCategoryStorage.ts`, filtro en `services/rag/index.ts` (`retrieveRelevantDocuments`).

### 1. Recuperación Jerárquica: Parent-Child (Small-to-Big)

**¿Qué hace?**
Separa la unidad de búsqueda de la unidad de generación. El sistema busca en fragmentos pequeños y específicos (Children) pero entrega al LLM fragmentos grandes y contextualizados (Parents).

**Implementación Custom (No estándar LangChain)**:
Para optimizar el rendimiento y tener control total, el sistema implementa su propia lógica de Parent-Child:
- **Hijos (128-200 chars)**: Indexados con vectores para una búsqueda semántica y léxica ultra-precisa.
- **Padres (512-1500 chars)**: Almacenados en Qdrant con **vectores nulos** (puntos invisibles para la búsqueda vectorial) pero con IDs vinculados.
- **Deduplicación**: Si varios hijos pertenecen al mismo padre, el sistema los unifica y recupera el padre una sola vez, maximizando la ventana de contexto útil del LLM.

**Almacenamiento**: Todo reside en Qdrant. Los padres actúan como un almacén de documentos integrado, recuperados mediante filtros de metadatos en una sola consulta (`match any`).

### 2. Búsqueda Híbrida (BM25 + Vectores)

**¿Qué hace?**
Combina la precisión léxica de BM25 con la potencia semántica de los embeddings.

- **BM25 (Filtrado)**: El motor BM25 ha sido optimizado para **ignorar los documentos Parent**. Esto evita ruido semántico y duplicidad en los resultados iniciales, asegurando que solo se recuperen fragmentos Children. También excluye las alignment questions si están indexadas.
- **Vectores Semánticos**: Embeddings con prefijos de instrucción asimétricos (query prefix ≠ document prefix) para mejorar el matching semántico.

**Pesos configurables**: Ver `.env` (`BM25_WEIGHT`, `VECTOR_WEIGHT`).

### 2.5. Similarity Drop-off

**¿Qué hace?**
En vez de usar un top-K fijo (siempre devolver 5 docs), filtra dinámicamente según la calidad relativa de los resultados. Descarta documentos cuyo score cae más de un porcentaje configurable respecto al mejor resultado.

**¿Por qué?**
Un top-K fijo tiene dos problemas: (1) si solo 2 docs son buenos, los otros 3 son ruido que confunde al LLM; (2) si hay 7 docs buenos, un top-5 descarta 2 relevantes. El drop-off se adapta a cada query.

**Cómo funciona:**
- Fórmula: `drop = 1 - (score / bestScore)`. Si `drop > maxDrop` → descartar.
- Los scores del reranker son logits (pueden ser negativos). Se desplazan a espacio positivo antes de calcular.
- Siempre mantiene un mínimo de docs configurable (`SIMILARITY_DROPOFF_MIN_DOCS`).

**Ejemplo** con `maxDrop=0.20` y scores `[8.2, 7.9, 3.1, 1.2, -0.5]`:
- Shifted: `[8.7, 8.4, 3.6, 1.7, 0]` → Drops: `[0%, 3.4%, 58.6%, 80.5%, 100%]`
- Resultado: mantiene los 2 primeros (drop <20%) + mínimo garantizado.

**Config**: `USE_SIMILARITY_DROPOFF=true`, `SIMILARITY_DROPOFF_MAX_DROP=0.20`, `SIMILARITY_DROPOFF_MIN_DOCS=2`

**Archivo**: `services/rag/similarityDropoff.ts`

### 3. Reranking con Cross-Encoder

**¿Qué hace?**
Evalúa y reordena los candidatos recuperados. A diferencia de otros sistemas, aquí el reranking se realiza sobre el **Parent Document** (el bloque completo).

**Beneficios**:
- **Visión Real**: El reranker evalúa exactamente lo mismo que va a leer el LLM.
- **Fallback Automático**: El sistema incluye una lógica de seguridad: si el Worker Thread falla (común en entornos TS no compilados), el reranking se ejecuta automáticamente en el **hilo principal**, garantizando que el LLM siempre reciba los mejores documentos.

**Nota sobre los scores**: Los cross-encoders típicos devuelven logits no acotados (pueden ser negativos). NO son porcentajes.

### 4. Contextual Compression

**¿Qué hace?**
Antes de enviar el contexto al LLM, filtra las frases de cada parent chunk que no son relevantes para la query. Solo las frases con similitud coseno ≥ umbral configurado llegan al LLM.

**Por qué es necesario**:
Los parent chunks (512 chars) contienen el dato relevante rodeado de texto relacionado pero no directamente útil. Sin compresión, el LLM "rellena huecos" con su conocimiento previo → Faithfulness baja.

**Implementación**: Custom (~60 líneas), no depende de LangChain. Usa el mismo modelo de embeddings que el retrieval para máxima coherencia semántica.

**Configuración**:
```bash
USE_CONTEXTUAL_COMPRESSION=true
COMPRESSION_THRESHOLD=0.30
```

### 5. Generación con temperatura 0.0

**¿Qué hace?**
Sintetiza la respuesta basándose exclusivamente en el contexto comprimido. Temperatura 0.0 hace al modelo más conservador — menos tendencia a añadir información de su training data.

**LLM configurable**: soporta Claude (vía API Anthropic) o cualquier modelo Ollama local. Ver `.env` para la configuración activa (`USE_CLAUDE`, `CLAUDE_MODEL`, `OLLAMA_MODEL`). Ver [MODEL_DECISIONS.md](./MODEL_DECISIONS.md) para el razonamiento de selección de modelos.

## Variables de Entorno (Referencia)

```bash
# LLM (ver MODEL_DECISIONS.md para justificación)
USE_CLAUDE=true|false
CLAUDE_MODEL=<model-id>
OLLAMA_MODEL=<model-name>

# Búsqueda Híbrida
USE_BM25_RETRIEVER=true
BM25_WEIGHT=0.4
VECTOR_WEIGHT=0.6
SIMILARITY_SEARCH_MAX_RESULTS=25

# Reranking
USE_RERANKER=true
RERANKER_MODEL=<model-name>
RERANKER_RETRIEVAL_TOP_K=20
RERANKER_FINAL_TOP_K=5

# Parent-Child
USE_PARENT_RETRIEVER=true
CHILD_CHUNK_SIZE=128
CHILD_CHUNK_OVERLAP=25
PARENT_CHUNK_SIZE=512
PARENT_CHUNK_OVERLAP=50

# Contextual Compression
USE_CONTEXTUAL_COMPRESSION=true
COMPRESSION_THRESHOLD=0.30

# Intent Classifier
USE_INTENT_CLASSIFIER=true
INTENT_CLASSIFIER_MODE=hybrid    # regex | hybrid | llm

# Similarity Drop-off
USE_SIMILARITY_DROPOFF=true
SIMILARITY_DROPOFF_MAX_DROP=0.20
SIMILARITY_DROPOFF_MIN_DOCS=2
```

## Alignment Optimization (feature experimental)

Genera preguntas hipotéticas por cada parent chunk durante la indexación y las almacena en la metadata de Qdrant (`hypothetical_questions`). La idea: si cada chunk "sabe" qué preguntas puede responder, el matching semántico mejora para queries de comparación y razonamiento encadenado.

**Cómo activar (background job tras indexar):**
```bash
# Optimizar todos los documentos
POST /api/documents/optimize-all

# Optimizar un documento concreto
POST /api/documents/optimize-one/:filename

# Limpiar optimización (global o por documento)
DELETE /api/documents/clear-optimization
DELETE /api/documents/clear-optimization/:filename
```

**Variables de entorno:**
```bash
USE_ALIGNMENT_OPTIMIZATION=true   # activa la generación de preguntas hipotéticas
ALIGNMENT_BATCH_SIZE=5            # chunks procesados en paralelo
```

**Estado actual**: Indexadas en Qdrant pero con impacto neutro o negativo en evaluaciones. El BM25 las excluye correctamente. La búsqueda vectorial puede retornarlas pero hidratan al parent correcto (no llegan al LLM). Ver resultados detallados en [MODEL_DECISIONS.md](./MODEL_DECISIONS.md).

---

## Lecciones de Arquitectura

1. **Rerank sobre el Padre**: Evaluar el bloque de 512 caracteres es más preciso que evaluar la línea de 128. El reranker y el LLM leen exactamente el mismo texto.
2. **Filtrar BM25**: Nunca dejes que BM25 indexe a los padres ni las alignment questions si usas una arquitectura de vectores nulos; el ruido léxico arruina la precisión del reranking.
3. **Metadatos > Texto**: Pasar metadatos estructurados en el encabezado del fragmento reduce alucinaciones en modelos de tamaño medio.
4. **Compression antes de LLM**: El filtrado de frases por coseno mejora Faithfulness y Hallucination a coste de Answer Correctness mínimo (respuestas más literales).
5. **El retrieval no es el problema**: En evaluaciones con dataset controlado, Context Recall supera el 90% consistentemente. La Faithfulness baja en preguntas Multi-Hop es un problema de generación, no de retrieval.
