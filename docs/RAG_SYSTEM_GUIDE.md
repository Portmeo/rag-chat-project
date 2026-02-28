# Guía del Sistema RAG - Conceptos y Decisiones

## ¿Qué es este sistema?

Un sistema RAG (Retrieval-Augmented Generation) optimizado para consultas sobre documentación técnica en español. El sistema busca información relevante en los documentos y genera respuestas precisas usando IA, empleando una estrategia de recuperación jerárquica (Parent-Child).

## Arquitectura del Sistema (Flujo Optimizado)

```
      Pregunta del usuario
              ↓
1. Multi-Query Generation (3-4 variaciones)
              ↓
2. Búsqueda Híbrida (BM25 + Vectores) sobre CHILDREN
              ↓
3. Hydration: Resolución de Children a PARENTS únicos (Qdrant Filter)
              ↓
4. Reranking (Cross-Encoder) sobre PARENTS
              ↓
5. Generación (LLM) con Encabezados Enriquecidos
```

## Componentes Principales

### 1. Recuperación Jerárquica: Parent-Child (Small-to-Big)

**¿Qué hace?**
Separa la unidad de búsqueda de la unidad de generación. El sistema busca en fragmentos pequeños y específicos (Children) pero entrega al LLM fragmentos grandes y contextualizados (Parents).

**Implementación Custom (No estándar LangChain)**:
Para optimizar el rendimiento y tener control total, el sistema implementa su propia lógica de Parent-Child:
- **Hijos (128-200 chars)**: Indexados con vectores para una búsqueda semántica y léxica ultra-precisa.
- **Padres (512-1500 chars)**: Almacenados en Qdrant con **vectores nulos** (puntos invisibles para la búsqueda vectorial) pero con IDs vinculados.
- **Deduplicación**: Si varios hijos pertenecen al mismo padre, el sistema los unifica y recupera el padre una sola vez, maximizando la ventana de contexto útil del LLM.

**Almacenamiento**: Todo reside en Qdrant. Los padres actúan como un almacén de documentos integrado, recuperados mediante filtros de metadatos en una sola consulta (`match any`).

### 2. Búsqueda Híbrida (50% BM25 + 50% Vectores)

**¿Qué hace?**
Combina la precisión léxica de BM25 con la potencia semántica de los embeddings.

- **BM25 (Filtrado)**: El motor BM25 ha sido optimizado para **ignorar los documentos Parent**. Esto evita ruido semántico y duplicidad en los resultados iniciales, asegurando que solo se recuperen fragmentos Children.
- **Vectores Semánticos**: Usa `mxbai-embed-large` con prefijos de instrucción asimétricos.

### 3. Reranking Resiliente: bge-reranker-base

**¿Qué hace?**
Evalúa y reordena los candidatos recuperados. A diferencia de otros sistemas, aquí el reranking se realiza sobre el **Parent Document** (el bloque completo).

**Beneficios**:
- **Visión Real**: El reranker evalúa exactamente lo mismo que va a leer el LLM.
- **Fallback Automático**: El sistema incluye una lógica de seguridad: si el Worker Thread falla (común en entornos TS no compilados), el reranking se ejecuta automáticamente en el **hilo principal**, garantizando que el LLM siempre reciba los mejores documentos.

### 4. Generación: LLM con Contexto Enriquecido

**¿Qué hace?**
Sintetiza la respuesta basándose en el contexto. El prompt ha sido generalizado para usar **razonamiento técnico** en lugar de ejemplos estáticos.

**Metadatos en el Prompt**:
Cada fragmento enviado al LLM incluye un encabezado enriquecido con metadatos extraídos manualmente:
`[DOCUMENTO 1 | Fuente: setup.md | Sección: Instalación > Requisitos | Framework: Angular | Versión: 15.2.8 | Relevancia: 95%]`

Esto permite que el modelo (Llama 3.1:8b) identifique versiones y tecnologías incluso si el fragmento de texto es muy escueto o puramente técnico (como un JSON).

## Configuración Recomendada (.env)

```bash
# Búsqueda Híbrida
USE_BM25_RETRIEVER=true
BM25_WEIGHT=0.5
VECTOR_WEIGHT=0.5
SIMILARITY_SEARCH_MAX_RESULTS=25 # Recall ampliado para multi-query

# Reranking
USE_RERANKER=true
RERANKER_RETRIEVAL_TOP_K=20      # Candidatos para rerank
RERANKER_FINAL_TOP_K=5           # Fragmentos finales para LLM

# Parent-Child
USE_PARENT_RETRIEVER=true
CHILD_CHUNK_SIZE=128
PARENT_CHUNK_SIZE=1000           # Ajustable hasta 1500 para más contexto
```

## Métricas RAGAS (Calidad)

- **Faithfulness**: Target >0.85 (Evaluado con temperatura 0.0 para mayor fidelidad).
- **Answer Relevancy**: Target >0.80.
- **Context Recall**: Target 100% (Garantizado por la estrategia Parent-Child).

## Lecciones de Arquitectura

1. **Rerank sobre el Padre**: Evaluar el bloque de 1000 caracteres es más preciso que evaluar la línea de 128.
2. **Filtrar BM25**: Nunca dejes que BM25 indexe a los padres si usas una arquitectura de vectores nulos; el ruido léxico arruina el reranking.
3. **Metadatos > Texto**: Pasar metadatos estructurados en el encabezado del fragmento reduce alucinaciones en modelos de tamaño medio (8b).
