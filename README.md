# RAG Chat Project

Sistema RAG (Retrieval-Augmented Generation) optimizado para consultas sobre documentación técnica en español.

## ✨ Características

### Core RAG
- 🔍 **Búsqueda Híbrida**: Combina BM25 (70%) + embeddings vectoriales (30%)
- 🔄 **Multi-Query**: Genera 3 variaciones de cada pregunta para mejor retrieval
- 🎯 **Reranking**: Cross-encoder (bge-reranker-base) para mejorar precisión (+10-12% MRR)
- 🤖 **LLM Local**: llama3.1:8b vía Ollama (sin costos de API)
- 📊 **Alta Precisión**: 85.7% accuracy, MRR 0.875, Recall@5 94%
- 🇪🇸 **Optimizado para Español**: Modelos y prompts ajustados

### Interfaz y UX
- ⚡ **Streaming**: Respuestas en tiempo real (SSE)
- 💬 **Historial Conversacional**: Memoria de últimos 5-10 mensajes
- 📝 **Markdown Rendering**: Syntax highlighting para código
- 📋 **Copy to Clipboard**: Copiar código con un click
- 🗂️ **Gestión de Documentos**: Buscar, ordenar, eliminar documentos individuales

### Evaluación y Calidad
- 🧪 **RAGAS Evaluation**: 9 métricas automáticas (Faithfulness, Answer Relevancy, Context Precision/Recall, etc.)
- 🔍 **Detección de Alucinaciones**: Identificación automática de afirmaciones no soportadas
- 📊 **Golden Dataset**: 17 casos de prueba con ground truth
- 🎯 **LLM-as-Judge**: Evaluación con llama3.1:8b (temperatura=0.1 para consistencia)

## 🚀 Quick Start

### Requisitos
- **Node.js** (v20+)
- **npm** (v10+)
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
npm install
```

3. **Iniciar servicios** (3 terminales):
```bash
# Terminal 1 - Qdrant
npm run docker:up

# Terminal 2 - Ollama
ollama serve

# Terminal 3 - Aplicación
npm run dev:frontend
npm run dev:backend
```

### Verificar
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/health
- **Qdrant Dashboard**: http://localhost:6333/dashboard

## 🏗️ Arquitectura del Sistema

### Pipeline de Consulta (Query)

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

### Pipeline de Ingesta (Document Upload)

```
Documento (.md, .html)
    ↓
1. Procesamiento Inicial
   - HTML: Extracción de texto (cheerio)
   - Markdown: Lectura directa
    ↓
2. Text Splitting Inteligente
   - MarkdownTextSplitter para .md (respeta estructura)
   - RecursiveCharacterTextSplitter para HTML
   - Chunks: 1000 chars, overlap: 200
    ↓
3. Extracción de Metadata con Template
   Para cada chunk se detecta automáticamente:
   ✓ Headers (H1, H2, H3) y section_path
   ✓ Tipo de contenido (text/code/table/list/mixed)
   ✓ Lenguaje de programación (js, py, ts, etc.)
   ✓ Framework (React, Angular, Vue, etc.)
   ✓ Librería (LangChain, Qdrant, etc.)
   ✓ Características (has_code, has_links, word_count)
    ↓
4. Generación de Embeddings
   - Modelo: mxbai-embed-large (1024 dims)
   - Query prefix: "Represent this sentence..." (+3.7% MRR)
   - Embedding vectorial por chunk
    ↓
5. Almacenamiento en Qdrant
   - Vector (embedding)
   - Payload (texto + metadata estructurada)
   → BM25 cache rebuild automático
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
CHUNK_SIZE=1000                    # Tamaño de cada chunk (caracteres)
CHUNK_OVERLAP=200                  # Solapamiento entre chunks (previene pérdida de contexto)

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

# Historial Conversacional
CONVERSATIONAL_HISTORY_ENABLED=true
MAX_HISTORY_MESSAGES=5

# Instruction Prefix (mejora +3.7% MRR según benchmarks)
USE_INSTRUCTION_PREFIX=true        # Usar prefijos en embeddings
EMBEDDING_QUERY_PREFIX=Represent this sentence for searching relevant passages:  # Prefijo para queries
EMBEDDING_DOCUMENT_PREFIX=         # Prefijo para documentos (vacío por defecto)
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3001
```

## 🎯 Sistema de Templates y Metadata

### Extracción Automática de Metadata

El sistema usa un **template técnico** que analiza cada chunk y extrae metadata estructurada automáticamente:

**Estructura del documento:**
- `heading_h1`, `heading_h2`, `heading_h3`: Headers extraídos del Markdown
- `section_path`: Ruta jerárquica completa (ej: "Arquitectura > NgRx Store > Actions")

**Detección de contenido:**
- `content_type`: text | code | table | list | mixed (basado en patrones)
- `language`: javascript, typescript, python, java, go, rust, sql, bash, etc.

**Características:**
- `has_code`: Detecta bloques de código o inline code
- `has_links`: Detecta URLs o links markdown
- `word_count`: Contador de palabras

**Contexto técnico (por keywords):**
- `framework`: React, Vue, Angular, Next.js, Express, Django, Flask, Spring Boot, etc.
- `library`: LangChain, Qdrant, Ollama, axios, lodash, moment, date-fns, etc.
- `version`: Detecta versiones (v1.2.3, React 18.2, etc.)

**Ejemplo de metadata generada:**
```typescript
{
  filename: "arquitectura.md",
  uploadDate: "2024-02-01T10:30:00.000Z",
  chunk_index: 5,
  total_chunks: 23,
  heading_h1: "Arquitectura del Sistema",
  heading_h2: "State Management",
  heading_h3: "NgRx Store",
  section_path: "Arquitectura del Sistema > State Management > NgRx Store",
  content_type: "code",
  language: "typescript",
  framework: "Angular",
  library: "NgRx",
  has_code: true,
  has_links: false,
  word_count: 234
}
```

Ver `apps/backend/src/services/documentProcessor/templates/technical.ts` para detalles de implementación.

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
npm run dev:backend      # Solo backend
npm run dev:frontend     # Solo frontend

# Docker (Qdrant)
npm run docker:up        # Iniciar Qdrant
npm run docker:down      # Parar Qdrant
npm run docker:logs      # Ver logs

# Build
npm run build            # Build todo
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

### Evaluación RAGAS (calidad del RAG)

```bash
# Evaluar el sistema completo con 17 casos de prueba
npx tsx benchmark/evaluation/run_ragas_eval.ts

# O usar el API endpoint
curl -X POST http://localhost:3001/api/evaluation/ragas \
  -H "Content-Type: application/json" \
  -d '{"saveResults": true}'
```

**Métricas evaluadas**:
- Faithfulness (0-1): ¿La respuesta está soportada por el contexto?
- Answer Relevancy (0-1): ¿La respuesta es relevante a la pregunta?
- Context Precision (0-1): ¿Los documentos recuperados son relevantes?
- Context Recall (0-1): ¿Se recuperaron todos los documentos necesarios?
- + 5 métricas adicionales (Context Relevancy, Answer Correctness, etc.)

**Tiempo**: ~5-10 minutos para 17 casos

Ver [benchmark/evaluation/README.md](benchmark/evaluation/README.md) para detalles.

## 📖 Documentación

- **[docs/RAG_SYSTEM_GUIDE.md](docs/RAG_SYSTEM_GUIDE.md)** - Guía conceptual (empieza aquí)
- **[docs/DOCUMENT_PROCESSING.md](docs/DOCUMENT_PROCESSING.md)** - Procesamiento de documentos, templates y embeddings
- **[docs/BM25_CONFIGURATION.md](docs/BM25_CONFIGURATION.md)** - Configuración de búsqueda híbrida
- **[docs/RERANKING_SYSTEM.md](docs/RERANKING_SYSTEM.md)** - Sistema de reranking
- **[benchmark/README.md](benchmark/README.md)** - Resultados de benchmarks
- **[benchmark/evaluation/README.md](benchmark/evaluation/README.md)** - Sistema RAGAS de evaluación

## 🔍 Troubleshooting

### Error: "Cannot connect to Qdrant"
```bash
docker ps | grep qdrant    # Verificar que esté corriendo
npm run docker:up          # Iniciar si no está
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
npm run dev:backend
```

## 🎯 Decisiones Clave de Arquitectura

1. **mxbai-embed-large** sobre nomic: 2x mejor precision (MRR 0.875 vs 0.608)
2. **Búsqueda híbrida** 70/30: BM25 para keywords + vectores para semántica
3. **Reranking**: +10-12% MRR con overhead mínimo (worker threads)
4. **llama3.1:8b** sobre qwen2.5: Mejor español, sin mezcla de idiomas

Ver [docs/RAG_SYSTEM_GUIDE.md](docs/RAG_SYSTEM_GUIDE.md) para el razonamiento completo.

## 🚧 Próximas Mejoras Prioritarias

### Sprint 1 (Alta Prioridad)
- [ ] **Migrar BM25 a Qdrant Sparse Vectors** ⭐ (escalabilidad crítica)
- [ ] **Parent Document Retriever** ⭐ (Small-to-Big: +15-20% precisión esperada)
- [ ] Mejorar RAGAS: más casos de prueba, dashboard visual
- [ ] Dark mode

### Sprint 2 (Media Prioridad)
- [ ] Persistir historial de chats (SQLite/PostgreSQL)
- [ ] Panel de configuración avanzada
- [ ] Mostrar chunks/tamaño por documento
- [ ] Metadata enriquecida (secciones, tipo de contenido)

### Futuro
- [ ] Soporte para PDF y DOCX
- [ ] Tests unitarios e integración
- [ ] Contextual Compression (opcional)

Ver [IDEAS.md](IDEAS.md) para roadmap completo y justificaciones.

## 📄 Stack Tecnológico

**Backend**:
- Runtime: Node.js
- Framework: Fastify
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
