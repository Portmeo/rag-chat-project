# Documentación del Sistema RAG

Documentación técnica del sistema de Retrieval-Augmented Generation.

## 📖 Documentos Disponibles

### 🎯 [RAG_SYSTEM_GUIDE.md](RAG_SYSTEM_GUIDE.md) - **EMPIEZA AQUÍ**
Guía conceptual de alto nivel del sistema RAG:
- Arquitectura completa del sistema
- Por qué elegimos cada componente (BM25, mxbai, reranking, llama3.1)
- Proceso de optimización y benchmarks
- Métricas de evaluación (MRR, Recall, RAGAS)
- Resultados finales
- **Recomendado para entender el "por qué" de cada decisión**

### ⚙️ [BM25_CONFIGURATION.md](BM25_CONFIGURATION.md)
Guía técnica de la configuración BM25:
- Qué es BM25 y cómo funciona
- Por qué usar búsqueda híbrida (BM25 + Vectores)
- Configuración de pesos
- Comparativa de rendimiento

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
1. RAG_SYSTEM_GUIDE.md → Conceptos y decisiones de arquitectura
2. DOCUMENT_PROCESSING.md → Cómo se procesan e indexan los documentos
3. BM25_CONFIGURATION.md → Detalle de búsqueda híbrida
4. RERANKING_SYSTEM.md → Detalle de reranking

**Para configurar el sistema:**
1. Ver sección "Configuración Final" en RAG_SYSTEM_GUIDE.md
2. Ajustar chunk size/overlap según DOCUMENT_PROCESSING.md
3. Ajustar pesos según BM25_CONFIGURATION.md
4. Configurar reranking según RERANKING_SYSTEM.md

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
