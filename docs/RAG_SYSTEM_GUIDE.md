# Guía del Sistema RAG - Conceptos y Decisiones

## ¿Qué es este sistema?

Un sistema RAG (Retrieval-Augmented Generation) que permite hacer preguntas sobre documentación técnica en español. El sistema busca información relevante en los documentos y genera respuestas precisas usando IA.

## Arquitectura del Sistema

```
Pregunta del usuario
    ↓
1. Multi-Query Generation (3 variaciones de la pregunta)
    ↓
2. Búsqueda Híbrida (BM25 + Vectores) → Top 20 candidatos
    ↓
3. Reranking (Cross-Encoder) → Top 5 más relevantes
    ↓
4. Generación (LLM) → Respuesta en español
```

## Componentes Principales

### 1. Búsqueda Híbrida (70% BM25 + 30% Vectores)

**¿Qué hace?**
Combina dos tipos de búsqueda complementarias para encontrar los documentos más relevantes.

**¿Por qué híbrida?**

- **BM25 (70%)**: Búsqueda por palabras clave exactas
  - Excelente para términos técnicos específicos ("Angular", "NgRx", "JWT")
  - Rápido y preciso para coincidencias exactas
  - No requiere entrenamiento

- **Vectores semánticos (30%)**: Búsqueda por significado
  - Encuentra conceptos similares aunque no usen las mismas palabras
  - Entiende preguntas complejas y relaciones entre conceptos
  - Funciona bien con sinónimos y paráfrasis

**Resultado**: Lo mejor de ambos mundos - precisión + comprensión semántica

### 2. Embeddings: mxbai-embed-large

**¿Qué hace?**
Convierte texto en vectores numéricos que representan su significado.

**¿Por qué este modelo?**

Probamos 4 modelos diferentes en benchmarks exhaustivos:

| Modelo | MRR | Recall@5 | Veredicto |
|--------|-----|----------|-----------|
| **mxbai-embed-large** | 0.875 | 94% | ✅ Ganador |
| nomic-embed-text | 0.608 | 81% | Bueno pero inferior |
| bge-m3 | 0.625 | 81% | Similar a nomic |
| snowflake-arctic | 0.392 | 69% | No suficiente |

**mxbai-embed-large destacó porque:**
- 81% de precisión en primera posición (vs 50% de nomic)
- Excelente comprensión semántica en español
- 1024 dimensiones (más información capturada)
- Configuración optimizada con instrucción oficial

### 3. Reranking: bge-reranker-base

**¿Qué hace?**
Evalúa y reordena los candidatos recuperados para quedarse solo con los más relevantes.

**¿Por qué necesitamos reranking?**

Los embeddings son rápidos pero aproximados. El reranker:
- Analiza cada par (query, documento) individualmente
- Usa un modelo Cross-Encoder más potente pero lento
- Solo procesa 20 candidatos (eficiente)
- Mejora +10-12% MRR, +15% Precision@3

**Flujo**:
```
Búsqueda híbrida → Top 20 candidatos (rápido)
    ↓
Reranking → Top 5 más relevantes (preciso)
    ↓
LLM solo ve los 5 mejores
```

**Beneficio**: Contexto de alta calidad para el LLM = mejores respuestas

### 4. LLM: llama3.1:8b

**¿Qué hace?**
Lee el contexto recuperado y genera una respuesta coherente en español.

**¿Por qué este modelo?**

Inicialmente usábamos qwen2.5:7b pero tenía un problema:
- ❌ Mezclaba español con chino (es un modelo chino)
- ❌ No seguía bien las instrucciones de idioma

Cambiamos a llama3.1:8b:
- ✅ Excelente comprensión de español
- ✅ Sigue instrucciones fielmente
- ✅ Síntesis clara y concisa
- ✅ No necesita conocimiento específico (ya está en el contexto)

**Nota importante**: En RAG, el LLM NO necesita ser especializado en el dominio. Su trabajo es solo sintetizar la información que ya le pasamos en el contexto.

## Proceso de Optimización

### Round 1: Fair Benchmark
Descubrimos que los modelos tienen requisitos específicos:
- nomic necesita prefijos: `"search_query: "` y `"search_document: "`
- mxbai necesita instrucción oficial

**Resultados**: mxbai ganó con MRR 0.844

### Round 2: Optimized Benchmark
Aplicamos configuraciones óptimas por modelo.

**Mejora**: mxbai subió a MRR 0.875 (+3.7%)

### Queries de prueba
Diseñamos 16 queries en 5 categorías:
- Básicas (keywords): "Angular Ionic version"
- Conceptuales: "¿Por qué se usa NgRx?"
- Relacionales: "¿Cómo se integran web components?"
- Proceso: "¿Cómo funciona el flujo de autenticación?"
- Comparativas: "diferencia entre container y presenter"

**Resultado final del sistema completo**: 85.7% de respuestas correctas

## Configuración Final

```bash
# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_NAME=documents
QDRANT_VECTOR_DIMENSION=1024
QDRANT_DISTANCE_METRIC=Cosine

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_EMBEDDINGS_MODEL=mxbai-embed-large

# Document Processing
CHUNK_SIZE=1000              # 1000 chars per chunk
CHUNK_OVERLAP=200            # 20% overlap for context continuity

# Búsqueda Híbrida
USE_BM25_RETRIEVER=true
BM25_WEIGHT=0.7
VECTOR_WEIGHT=0.3
SIMILARITY_SEARCH_MAX_RESULTS=4

# Reranking
USE_RERANKER=true
RERANKER_RETRIEVAL_TOP_K=20      # Retrieve 20 candidates
RERANKER_FINAL_TOP_K=5           # Return top 5 after reranking
RERANKER_TIMEOUT_MS=30000        # 30s timeout
```

## Métricas de Evaluación

### Métricas de Retrieval (Benchmarks)
- **MRR (Mean Reciprocal Rank)**: Qué tan alto aparece la respuesta correcta
  - 0.875 = En promedio, la respuesta correcta está en posición 1.14

- **Recall@K**: Probabilidad de encontrar la respuesta en top K
  - Recall@5 = 94% → 94% de probabilidad de que la respuesta esté en top 5

- **Precision@K**: De los K resultados, cuántos son relevantes
  - El reranking mejora esto significativamente

### Métricas RAGAS (Calidad End-to-End)
Evaluación automática del sistema completo usando LLM-as-judge:

- **Faithfulness (0-1)**: ¿La respuesta está soportada por el contexto recuperado?
  - Detecta alucinaciones (información inventada)
  - Target: >0.85

- **Answer Relevancy (0-1)**: ¿La respuesta es relevante para la pregunta?
  - Detecta respuestas fuera de tema
  - Target: >0.80

- **Context Precision (0-1)**: ¿Los documentos recuperados son relevantes?
  - Mide calidad del retrieval (BM25 + Vector + Reranking)
  - Target: >0.75

- **Context Recall (0-1)**: ¿Se recuperaron todos los documentos necesarios?
  - Detecta documentos faltantes importantes
  - Target: >0.85

**Cómo ejecutar**: `bun run benchmark/evaluation/run_ragas_eval.ts`
**Dataset**: 17 casos de prueba con ground truth en `benchmark/evaluation/datasets/golden_qa.json`

## Lecciones Aprendidas

1. **Híbrido > Puro**: BM25 + Vectores supera a cada uno por separado
2. **Configuración importa**: Cada modelo tiene requisitos específicos
3. **LLM para síntesis**: No necesita conocimiento del dominio
4. **Reranking vale la pena**: +10-15% mejora con poco overhead
5. **Testing riguroso**: Los benchmarks revelaron problemas ocultos

## Limitaciones Actuales

### BM25 en Memoria
- **Problema**: BM25Retriever mantiene TODOS los documentos en memoria
- El cache se reconstruye completamente en cada upload
- Memoria crece linealmente con el número de documentos
- **No escalable** para >10k documentos
- **Solución recomendada**: Migrar a Qdrant Sparse Vectors (BM42)
  - Qdrant soporta búsqueda híbrida nativa (dense + sparse)
  - Escalabilidad a millones de documentos
  - Referencias: [Qdrant Sparse Vectors](https://qdrant.tech/documentation/concepts/vectors/#sparse-vectors)

## Próximos Pasos Prioritarios

1. **Migrar BM25 a Qdrant Sparse Vectors** (escalabilidad crítica)
   - Problema: BM25 en memoria no escala >10k documentos
   - Solución: Usar Qdrant sparse vectors nativos

2. **Parent Document Retriever (Small-to-Big)** (+15-20% precisión esperada)
   - Problema actual: Chunks de 1000 chars son buenos para LLM pero subóptimos para retrieval
   - Solución: Buscar con chunks pequeños (200 chars), retornar chunks grandes (1000 chars)
   - Beneficio: Lo mejor de ambos mundos (precisión en búsqueda + contexto para LLM)
   - Implementación:
     1. Al indexar: crear child chunks (200) + parent chunks (1000)
     2. Indexar child chunks con metadata.parent_id
     3. En retrieval: buscar child → retornar parent

3. Experimentar con diferentes pesos BM25/Vector
4. Mejorar RAGAS: más casos de prueba, dashboard visual
5. Evaluar modelos de reranking más grandes
