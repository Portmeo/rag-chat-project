# RAG Chat Project

Sistema RAG (Retrieval-Augmented Generation) optimizado para consultas sobre documentación técnica en español.

## ✨ Características

- 🔍 **Búsqueda Híbrida**: Combina BM25 (70%) + embeddings vectoriales (30%)
- 🎯 **Reranking**: Cross-encoder para mejorar precisión (+10-12% MRR)
- 🤖 **LLM Local**: llama3.1:8b vía Ollama (sin costos de API)
- 📊 **Alta Precisión**: 85.7% accuracy, MRR 0.875, Recall@5 94%
- 🇪🇸 **Optimizado para Español**: Modelos y prompts ajustados

## 🚀 Quick Start

### Requisitos
- **Bun** (v1.3.2+)
- **Docker** (para Qdrant)
- **Ollama** (para modelos LLM)

### Instalación (3 pasos)

1. **Descargar modelos de Ollama**:
```bash
ollama pull llama3.1:8b           # LLM (~4.7GB)
ollama pull mxbai-embed-large     # Embeddings (~669MB)
```

2. **Instalar dependencias**:
```bash
bun install
```

3. **Iniciar servicios** (3 terminales):
```bash
# Terminal 1 - Qdrant
bun run docker:up

# Terminal 2 - Ollama
ollama serve

# Terminal 3 - Aplicación
bun run dev
```

### Verificar
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/health
- **Qdrant Dashboard**: http://localhost:6333/dashboard

## 🏗️ Arquitectura del Sistema

```
Pregunta del usuario
    ↓
1. Multi-Query Generation (3 variaciones)
    ↓
2. Búsqueda Híbrida
   - BM25 (70%): Keywords exactas
   - Vectores (30%): Semántica
   → Top 20 candidatos
    ↓
3. Reranking (bge-reranker-base)
   → Top 5 más relevantes
    ↓
4. LLM (llama3.1:8b)
   → Respuesta en español
```

## 📊 Resultados de Benchmarks

Tras benchmarks exhaustivos con 16 queries y 4 modelos:

| Componente | Modelo | MRR | Recall@5 |
|------------|--------|-----|----------|
| **Embeddings** | mxbai-embed-large | 0.875 | 94% |
| **Reranking** | bge-reranker-base | +0.10-0.12 | +15% P@3 |
| **LLM** | llama3.1:8b | - | - |

**Resultado final end-to-end**: 85.7% (6/7 queries correctas)

Ver `/benchmark` y `/docs` para detalles completos.

## 🔧 Configuración

### Backend (.env)
```bash
PORT=3001
UPLOAD_DIR=./uploads

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

# RAG
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

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3001
```

## 📁 Estructura del Proyecto

```
rag-chat-project/
├── apps/
│   ├── backend/           # Node.js + Express + LangChain
│   │   ├── src/
│   │   │   ├── services/
│   │   │   │   └── rag/
│   │   │   │       ├── index.ts           # Pipeline RAG principal
│   │   │   │       ├── bm25Retriever.ts   # BM25 implementation
│   │   │   │       ├── ensembleRetriever.ts  # Híbrido BM25+Vector
│   │   │   │       ├── reranker.ts        # Reranking orchestrator
│   │   │   │       └── reranker.worker.ts # Worker thread para reranking
│   │   │   └── routes/
│   │   └── .env
│   └── frontend/          # React + TypeScript + Vite
│       └── .env
├── benchmark/             # Scripts y resultados de benchmarks
│   ├── fair_benchmark.py
│   ├── round2_optimized_benchmark.py
│   └── README.md
├── docs/                  # Documentación técnica
│   ├── RAG_SYSTEM_GUIDE.md       # 👈 Empieza aquí
│   ├── BM25_CONFIGURATION.md
│   └── RERANKING_SYSTEM.md
├── scripts/               # Scripts de testing y benchmarks
│   ├── health-check.sh
│   ├── upload-docs.sh
│   ├── test-rag-complete.sh
│   ├── benchmark-latency.sh
│   ├── test-quality.sh
│   ├── compare-configs.sh
│   └── stress-test.sh
├── files/                 # Documentos .md para indexar
└── README.md
```

## 🛠️ Comandos Disponibles

```bash
# Desarrollo
bun run dev              # Backend + Frontend
bun run dev:backend      # Solo backend
bun run dev:frontend     # Solo frontend

# Docker (Qdrant)
bun run docker:up        # Iniciar Qdrant
bun run docker:down      # Parar Qdrant
bun run docker:logs      # Ver logs

# Build
bun run build            # Build todo
```

## 📚 API Endpoints

### POST /api/documents/upload
Sube y procesa un documento.

**Request**:
```bash
curl -X POST http://localhost:3001/api/documents/upload \
  -F "file=@documento.md"
```

**Response**:
```json
{
  "message": "Document processed successfully",
  "filename": "documento.md",
  "chunksCount": 15
}
```

### POST /api/chat/query
Realiza una consulta RAG.

**Request**:
```bash
curl -X POST http://localhost:3001/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"question": "¿Qué es NgRx?"}'
```

**Response**:
```json
{
  "answer": "NgRx es una biblioteca para gestión de estado...",
  "sources": [
    {
      "filename": "arquitectura.md",
      "chunk_index": 5,
      "uploadDate": "2024-01-31T..."
    }
  ]
}
```

## 🧪 Testing y Benchmarks

### Scripts de Test (carpeta /scripts)

```bash
# 1. Verificar que todo funciona
./scripts/health-check.sh

# 2. Subir documentos de ejemplo
./scripts/upload-docs.sh

# 3. Probar el RAG completo (7 queries)
./scripts/test-rag-complete.sh

# 4. Medir latencia y performance
./scripts/benchmark-latency.sh

# 5. Evaluar calidad de respuestas
./scripts/test-quality.sh

# 6. Comparar configuraciones
./scripts/compare-configs.sh

# 7. Stress test (carga concurrente)
./scripts/stress-test.sh [concurrent] [total]
# Ejemplo: ./scripts/stress-test.sh 10 50
```

### Benchmarks de Embeddings (carpeta /benchmark)

```bash
cd benchmark
python fair_benchmark.py              # Round 1
python round2_optimized_benchmark.py  # Round 2
```

## 📖 Documentación

- **[docs/RAG_SYSTEM_GUIDE.md](docs/RAG_SYSTEM_GUIDE.md)** - Guía conceptual (empieza aquí)
- **[docs/BM25_CONFIGURATION.md](docs/BM25_CONFIGURATION.md)** - Configuración de búsqueda híbrida
- **[docs/RERANKING_SYSTEM.md](docs/RERANKING_SYSTEM.md)** - Sistema de reranking
- **[benchmark/README.md](benchmark/README.md)** - Resultados de benchmarks

## 🔍 Troubleshooting

### Error: "Cannot connect to Qdrant"
```bash
docker ps | grep qdrant    # Verificar que esté corriendo
bun run docker:up          # Iniciar si no está
```

### Error: "Ollama model not found"
```bash
ollama list                         # Ver modelos instalados
ollama pull llama3.1:8b             # Descargar LLM
ollama pull mxbai-embed-large       # Descargar embeddings
```

### Error: "Ollama connection refused"
```bash
ollama serve               # Iniciar Ollama
```

### Backend no recarga automáticamente
```bash
# Reiniciar backend manualmente
cd apps/backend
bun --watch src/index.ts
```

## 🎯 Decisiones Clave de Arquitectura

1. **mxbai-embed-large** sobre nomic: 2x mejor precision (MRR 0.875 vs 0.608)
2. **Búsqueda híbrida** 70/30: BM25 para keywords + vectores para semántica
3. **Reranking**: +10-12% MRR con overhead mínimo (worker threads)
4. **llama3.1:8b** sobre qwen2.5: Mejor español, sin mezcla de idiomas

Ver [docs/RAG_SYSTEM_GUIDE.md](docs/RAG_SYSTEM_GUIDE.md) para el razonamiento completo.

## 🚧 Próximas Mejoras

- [ ] Agregar prefijo de instrucción oficial a mxbai (+3.7% MRR)
- [ ] Streaming de respuestas (mejor UX)
- [ ] Caché de embeddings frecuentes
- [ ] Soporte para PDF y DOCX
- [ ] Tests unitarios e integración
- [ ] UI mejorada con historial de chat

## 📄 Stack Tecnológico

**Backend**:
- Runtime: Bun
- Framework: Express
- LLM: Ollama (llama3.1:8b)
- Vector Store: Qdrant
- Embeddings: mxbai-embed-large
- Reranker: bge-reranker-base
- RAG: LangChain

**Frontend**:
- Framework: React 19.2
- Routing: React Router 7.13
- Build: Vite 7
- Language: TypeScript

## 📝 Licencia

ISC
