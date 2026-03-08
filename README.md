# RAG Chat Project

Sistema RAG (Retrieval-Augmented Generation) optimizado para consultas sobre documentación técnica en español.

## ✨ Características

### Core RAG
- 🔍 **Búsqueda Híbrida**: Combina BM25 + embeddings vectoriales (ensemble retriever)
- 🔄 **Multi-Query**: Genera 3 variaciones de cada pregunta para mejor retrieval
- 🎯 **Reranking**: Cross-encoder (bge-reranker-base) para mejorar precisión
- 🤖 **LLM**: Claude Haiku (`claude-haiku-4-5-20251001`) — mejor Faithfulness y Hallucination según evaluaciones RAGAS con juez externo (Sonnet 4.6)
- 📊 **Base vectorial sólida**: 100% hit rate (35/35) en ensemble retrieval
- 🗜️ **Contextual Compression**: Filtra frases ruidosas de cada chunk (threshold coseno 0.30) antes de enviar al LLM
- 🇪🇸 **Optimizado para Español**: Modelos y prompts ajustados

### Interfaz y UX
- ⚡ **Streaming**: Respuestas en tiempo real (SSE)
- 💬 **Historial Conversacional**: Memoria de últimos 5-10 mensajes
- 📝 **Markdown Rendering**: Syntax highlighting para código
- 📋 **Copy to Clipboard**: Copiar código con un click
- 🗂️ **Gestión de Documentos**: Buscar, ordenar, eliminar documentos individuales

### Evaluación y Calidad
- 🧪 **RAGAS Evaluation**: Faithfulness, Answer Relevancy, Context Precision/Recall, Hallucination
- 🔍 **Detección de Alucinaciones**: Identificación automática de afirmaciones no soportadas
- 📊 **Golden Dataset**: 58 casos de prueba con ground truth (v2.2), 7 categorías
- 🎯 **LLM-as-Judge**: Evaluación con Claude Sonnet 4.6 como juez externo (imparcial)

## 🚀 Quick Start

### Requisitos
- **Node.js** (v20+)
- **npm** (v10+)
- **Docker** (para Qdrant)
- **Ollama** (para modelos LLM)

### Instalación (3 pasos)

1. **Descargar modelo de embeddings (Ollama)**:
```bash
ollama pull mxbai-embed-large     # Embeddings (~669MB)
# Opcional: LLM local como fallback
ollama pull llama3.1:8b           # LLM (~4.7GB)
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
   - Vectores (60%): Semántica (mxbai-embed-large)
   - BM25 (40%): Keywords exactas
   → Top 20 candidatos (child chunks de 128 chars)
    ↓
3. Parent-Child Hydration
   → Resolución child → parent (512 chars) en 1 query a SQLite
    ↓
4. Reranking (bge-reranker-base)
   → Top 5 parents más relevantes
    ↓
5. Contextual Compression
   → Filtrado de frases por similitud semántica (threshold 0.30)
   → Reduce ruido antes de enviar al LLM
    ↓
6. LLM (Claude Haiku, temperature 0.0)
   → Respuesta en español estrictamente desde el contexto
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
   - Modelo: mxbai-embed-large (1024 dims, Cosine)
   - Embedding vectorial por chunk
    ↓
5. Almacenamiento
   - Children → Qdrant (vector + payload)
   - Parents → SQLite (content + metadata, acceso por ID)
   → BM25 index rebuild automático + persistido en SQLite
```

## 📊 Resultados de Benchmarks

### Retrieval por capas (35 queries con ground truth)

| Etapa | Hit Rate | Notas |
|-------|----------|-------|
| Vector only | 34/35 (97%) | Pure vector search |
| BM25 only | 32/35 (91%) | Keyword search |
| Ensemble (vector+BM25) | **35/35 (100%)** | Vector 0.6 + BM25 0.4 |
| Parents post-hydration | **35/35 (100%)** | Child→Parent resolution |
| Reranker Top 5 | 34/35 (97%) | 1 pérdida: query muy específica |

### RAGAS (sesión 2026-03-07, 13 casos, juez Sonnet 4.6)

| Métrica | Score | Config activa |
|---------|-------|---------------|
| Faithfulness | **0.42** | Claude Haiku + Compression + temp 0.0 |
| Answer Relevancy | **0.74** | |
| Context Precision | **0.35** | |
| Context Recall | **0.92** | |
| Hallucination | **0.76** | |

Ver `benchmark/evaluation/COMPARATIVA_SESION.md` para el histórico completo (8 runs).

### Stack de componentes

| Componente | Modelo / Config |
|------------|-----------------|
| **Embeddings** | mxbai-embed-large (1024 dims, Cosine) |
| **Reranking** | bge-reranker-base (Top 20 → Top 5) |
| **LLM** | Claude Haiku (claude-haiku-4-5-20251001, temp 0.0) |
| **Compression** | EmbeddingsFilter (cosine threshold 0.30) |
| **Chunks** | Child: 128 chars / Parent: 512 chars |

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
│   ├── backend/           # Node.js + Fastify + LangChain
│   │   ├── data/              # SQLite (generado, excluido de git)
│   │   │   └── rag.db         # parents, bm25_documents, query_log
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── logger.ts
│   │   │   │   └── database.ts        # Singleton SQLite + migraciones
│   │   │   ├── repositories/
│   │   │   │   ├── interfaces.ts      # IParentStorage, IBM25Storage, IQueryLogger
│   │   │   │   ├── sqliteParentStorage.ts
│   │   │   │   ├── sqliteBM25Storage.ts
│   │   │   │   ├── sqliteQueryLogger.ts
│   │   │   │   ├── index.ts           # Factory de instancias concretas
│   │   │   │   └── qdrantRepository.ts
│   │   │   ├── services/
│   │   │   │   └── rag/
│   │   │   │       ├── index.ts           # Pipeline RAG principal
│   │   │   │       ├── bm25Retriever.ts   # BM25 implementation
│   │   │   │       ├── ensembleRetriever.ts  # Híbrido BM25+Vector
│   │   │   │       ├── reranker.ts        # Reranking orchestrator
│   │   │   │       └── reranker.worker.ts # Worker thread para reranking
│   │   │   └── controllers/
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

```bash
curl -X POST http://localhost:3001/api/documents/upload \
  -F "file=@documento.md"
```

### POST /api/chat/query
Realiza una consulta RAG.

```bash
curl -X POST http://localhost:3001/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"question": "¿Qué es NgRx?"}'
```

### Alignment Optimization (background job)

```bash
# Optimizar todos los documentos (genera preguntas hipotéticas por chunk)
curl -X POST http://localhost:3001/api/documents/optimize-all

# Optimizar un documento concreto
curl -X POST http://localhost:3001/api/documents/optimize-one/mi-doc.md

# Limpiar optimización
curl -X DELETE http://localhost:3001/api/documents/clear-optimization
curl -X DELETE http://localhost:3001/api/documents/clear-optimization/mi-doc.md
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
- **[docs/PERSISTENCE_LAYER.md](docs/PERSISTENCE_LAYER.md)** - Capa de persistencia SQLite (parents, BM25, query log)
- **[CHANGELOG.md](CHANGELOG.md)** - Diario de sesiones y decisiones de arquitectura
- **[benchmark/evaluation/README.md](benchmark/evaluation/README.md)** - Sistema RAGAS de evaluación
- **[benchmark/evaluation/COMPARATIVA_SESION.md](benchmark/evaluation/COMPARATIVA_SESION.md)** - Histórico de 8 runs con métricas comparadas

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

1. **mxbai-embed-large** para embeddings: 95% hit rate en base vectorial pura (19/20 preguntas, cosine similarity)
2. **Búsqueda híbrida** BM25 + vectores: BM25 cubre queries con términos exactos, vectores capturan semántica
3. **Reranking** con bge-reranker-base: ordena candidatos evaluando el par (query, chunk) directamente
4. **llama3.1:8b** sobre qwen2.5: Mejor español, sin mezcla de idiomas
5. **SQLite como capa de persistencia** (inversión de dependencias): parents y BM25 index en SQLite en lugar de Qdrant con null-vectors; interfaces intercambiables sin tocar el pipeline

Ver [docs/RAG_SYSTEM_GUIDE.md](docs/RAG_SYSTEM_GUIDE.md) para el razonamiento completo.

## 🚧 Próximas Mejoras Prioritarias

### Implementado
- [x] **Búsqueda Híbrida BM25 + Vector** — 100% hit rate (35/35)
- [x] **Parent Document Retriever** — Small-to-Big: child 128 chars para retrieval, parent 512 chars para LLM
- [x] **Reranking** — bge-reranker-base, Top 20 → Top 5
- [x] **Contextual Compression** — filtra frases ruidosas (threshold coseno 0.30)
- [x] **Claude Haiku como LLM** — mejor Faithfulness y Hallucination que llama/qwen
- [x] **Temperature 0.0** — LLM más conservador, reduce alucinaciones
- [x] **Alignment Optimization** — preguntas hipotéticas por chunk (experimental, evaluado en Run 8)
- [x] **Capa de persistencia SQLite** — parents en SQLite (sin vectores nulos en Qdrant), BM25 persistido entre reinicios, query logging automático

### Pendiente (próximo sprint)
- [ ] **Query decomposition** para preguntas comparativas — el retrieval trae docs poco específicos cuando la query compara dos conceptos
- [ ] Soporte para PDF y DOCX

## 📄 Stack Tecnológico

**Backend**:
- Runtime: Node.js
- Framework: Fastify
- LLM: Claude Haiku (`claude-haiku-4-5-20251001`) via Anthropic API
- Vector Store: Qdrant
- Embeddings: mxbai-embed-large (Ollama)
- Reranker: bge-reranker-base
- RAG: LangChain

**Frontend**:
- Framework: React 19.2
- Routing: React Router 7.13
- Build: Vite 7
- Language: TypeScript

## 📝 Licencia

ISC
