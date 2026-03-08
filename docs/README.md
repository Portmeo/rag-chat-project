# Documentación del Sistema RAG

Documentación técnica del sistema de Retrieval-Augmented Generation.

## 📖 Documentos Disponibles

### 🎯 [RAG_SYSTEM_GUIDE.md](RAG_SYSTEM_GUIDE.md) - **EMPIEZA AQUÍ**
Guía de arquitectura del sistema RAG:
- Flujo completo del pipeline (Multi-Query → Híbrida → Parent-Child → Reranker → Compression → LLM)
- Descripción de cada componente y por qué existe
- Variables de entorno de referencia
- Lecciones de arquitectura

### 🧠 [MODEL_DECISIONS.md](MODEL_DECISIONS.md)
Decisiones de modelos y configuración:
- Por qué mxbai-embed-large para embeddings
- Por qué bge-reranker-base (benchmark comparativo de rerankers)
- Historial de evaluaciones RAGAS por modelo (R1-R11)
- Por qué Claude Haiku sobre llama/qwen para generación
- Análisis del punto débil actual (Multi-Hop Faithfulness)

### 🔄 [RERANKING_SYSTEM.md](RERANKING_SYSTEM.md)
Documentación del sistema de reranking:
- Cross-Encoder vs Bi-Encoder
- Arquitectura con worker threads
- Configuración y parámetros
- Impacto en métricas (+10-12% MRR)

### 📄 [DOCUMENT_PROCESSING.md](DOCUMENT_PROCESSING.md)
Sistema de procesamiento de documentos y embeddings:
- Text splitting inteligente (MarkdownTextSplitter, RecursiveCharacterTextSplitter)
- Sistema de templates para extracción automática de metadata
- Generación de embeddings con instruction prefixes
- Almacenamiento en Qdrant con metadata estructurada
- Ejemplos prácticos y troubleshooting

### 🧪 [../benchmark/evaluation/README.md](../benchmark/evaluation/README.md)
Sistema de evaluación RAGAS:
- 9 métricas automáticas de calidad
- Detección de alucinaciones
- Golden dataset con 17 casos de prueba
- Cómo ejecutar evaluaciones y interpretar resultados

## 🎯 Flujo de Lectura Recomendado

**Para entender el sistema completo:**
1. RAG_SYSTEM_GUIDE.md → Arquitectura y componentes
2. MODEL_DECISIONS.md → Por qué cada modelo y parámetro
3. DOCUMENT_PROCESSING.md → Cómo se procesan e indexan los documentos
4. RERANKING_SYSTEM.md → Detalle del reranker

**Para configurar el sistema:**
1. Ver sección "Variables de Entorno" en RAG_SYSTEM_GUIDE.md
2. Ver justificación de parámetros en MODEL_DECISIONS.md
3. Ajustar chunk size/overlap según DOCUMENT_PROCESSING.md

**Para implementar ingesta de documentos:**
1. DOCUMENT_PROCESSING.md → Pipeline completo de ingesta
2. Ver ejemplos prácticos y troubleshooting

## 📊 Resultados Finales

El sistema alcanzó:
- **MRR**: 0.875 (87.5% precisión en ranking)
- **Recall@5**: 94% (encuentra respuesta en top 5)
- **Exactitud end-to-end**: 85.7% (6/7 queries correctas)

## 🔧 Configuración en Producción

```bash
# apps/backend/.env

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
CHUNK_SIZE=1000
CHUNK_OVERLAP=200

# Búsqueda Híbrida
USE_BM25_RETRIEVER=true
BM25_WEIGHT=0.7
VECTOR_WEIGHT=0.3
SIMILARITY_SEARCH_MAX_RESULTS=4

# Reranking
USE_RERANKER=true
RERANKER_RETRIEVAL_TOP_K=20
RERANKER_FINAL_TOP_K=5
RERANKER_TIMEOUT_MS=30000
```

## 📁 Estructura de Carpetas

- `/benchmark` - Scripts de benchmarking y resultados
- `/files` - Documentos fuente (.md) indexados en el sistema
- `/apps/backend` - Código del sistema RAG
- `/apps/frontend` - Interfaz de usuario
