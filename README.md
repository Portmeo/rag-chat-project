# RAG Chat Project

Sistema RAG (Retrieval-Augmented Generation) para consultas sobre documentación técnica en español. Combina búsqueda híbrida (vectorial + keywords), reranking con cross-encoder y generación con LLM.

## Características principales

- **Búsqueda Híbrida**: BM25 (keywords) + embeddings vectoriales (semántica)
- **Multi-Query**: Genera variaciones de cada pregunta para mejorar el retrieval
- **Parent-Child Retrieval**: Busca en chunks pequeños, devuelve contexto amplio al LLM
- **Reranking**: Cross-encoder (bge-reranker-base) para reordenar resultados
- **Contextual Compression**: Filtra frases irrelevantes antes de enviar al LLM
- **Intent Classifier**: Detecta saludos/charla casual y responde sin usar el pipeline RAG
- **Streaming**: Respuestas en tiempo real vía SSE
- **Evaluación RAGAS**: Framework de evaluación con LLM-as-Judge

## Stack

| Componente | Tecnología |
|------------|------------|
| **Backend** | Node.js + Fastify + LangChain |
| **Frontend** | React 19 + React Router 7 + Vite + Tailwind CSS |
| **LLM** | Claude Haiku (Anthropic API) / Ollama (local) |
| **Embeddings** | mxbai-embed-large (Ollama, 1024 dims) |
| **Reranker** | bge-reranker-base (Transformers.js) |
| **Vector DB** | Qdrant |
| **Persistencia** | SQLite (parents, BM25 index, query log) |

## Requisitos

- Node.js v20+
- Docker (para Qdrant)
- Ollama (para embeddings y LLM local)
- API key de Anthropic (opcional, para usar Claude)

## Instalación

1. **Descargar modelo de embeddings**:
```bash
ollama pull mxbai-embed-large
```

2. **Instalar dependencias**:
```bash
npm install
```

3. **Configurar variables de entorno**:
```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
# Editar apps/backend/.env con tu ANTHROPIC_API_KEY si quieres usar Claude
```

## Arrancar el proyecto

Necesitas 3 terminales:

```bash
# Terminal 1 - Qdrant
npm run docker:up

# Terminal 2 - Ollama
ollama serve

# Terminal 3 - App
npm run dev:backend    # Backend en :3001
npm run dev:frontend   # Frontend en :5173
```

### Verificar

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001/health
- **Qdrant**: http://localhost:6333/dashboard

## Uso

1. Sube documentos (.md, .html) desde la interfaz
2. Haz preguntas sobre la documentación en el chat
3. El sistema busca, reordena y genera respuestas con contexto

## Configuración

Toda la configuración del pipeline RAG se gestiona via variables de entorno en `apps/backend/.env`. Ver `apps/backend/.env.example` para todas las opciones disponibles.

Principales toggles:
- `USE_CLAUDE` — usar Claude API (`true`) u Ollama local (`false`)
- `USE_RERANKER` — activar reranking con cross-encoder
- `USE_BM25_RETRIEVER` — activar búsqueda por keywords
- `USE_PARENT_RETRIEVER` — activar estrategia parent-child
- `USE_INTENT_CLASSIFIER` — detectar inputs casuales

## Estructura del proyecto

```
rag-chat-project/
├── apps/
│   ├── backend/        # API + pipeline RAG
│   ├── frontend/       # Interfaz de chat
│   └── evaluation/     # Framework RAGAS
├── docs/               # Documentación técnica
├── files/              # Documentos para indexar (gitignored)
└── scripts/            # Scripts de testing
```

## Licencia

[MIT](LICENSE)
