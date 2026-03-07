# Instructions for Claude (claude.md)

## 📋 Reglas de Documentación y Gestión de Archivos

Para asegurar la limpieza del repositorio y evitar la dispersión de información, se deben seguir estas directrices estrictas:

---

### 1. 🚫 Prohibición de Archivos de Sumario y Control de Git
* **No realizar Commits sin autorización explícita:** Queda terminantemente prohibido ejecutar comandos de git commit o push **a menos que el usuario lo solicite de forma explícita y directa**. La gestión del historial de versiones es responsabilidad exclusiva del usuario.
* **Pedir confirmación antes de commits:** Si una tarea implica realizar commits, siempre preguntar al usuario antes de ejecutar cualquier comando git.
* **No crear ficheros de planes:** Queda estrictamente prohibido generar archivos de "resumen de plan" o "estado del proyecto" (ej. `summary.md`, `plan_summary.md`, `checkpoints.md`).
* **El chat es para el proceso:** Los pasos intermedios y resúmenes de ejecución se comunican por el chat, no en archivos temporales.

### 2. 📖 Centralización y Uso de /docs
* **README.md como Eje:** El `README.md` es el punto de entrada principal. Cualquier cambio en la visión general o el plan de trabajo actual debe **editarse directamente** en este archivo.
* **Documentación Técnica en `/docs`:** * Si una funcionalidad requiere una explicación técnica extensa que saturaría el README, se debe crear un archivo específico dentro de la carpeta `docs/`.
    * **Regla de Oro:** Siempre que se cree un archivo en `docs/`, se debe añadir obligatoriamente un **enlace directo** a este en el `README.md`.
* **Prioridad de Edición:** Antes de crear un nuevo archivo en `docs/`, verificar si la información puede añadirse a uno existente para evitar la fragmentación.

### 3. 🛠️ Flujo de Operación
1.  **Evaluación:** Leer el `README.md` y los archivos vinculados en `docs/`.
2.  **Documentación del Plan:** Actualizar el `README.md` con los pasos a seguir.
3.  **Creación/Edición:** * Editar el código y/o el `README.md`.
    * Si es necesario un manual profundo, crear/editar el `.md` en `docs/` y enlazarlo desde el README.
4.  **Limpieza:** Asegurarse de que no queden archivos de "sumario" o "planes" sueltos por el repositorio.

---

## 🏗️ Estructura del Proyecto

Este es un **monorepo** con la siguiente estructura:

### Apps
* **`apps/backend/`** - Backend Fastify con RAG (Retrieval Augmented Generation)
  - Puerto: 3001
  - Stack: Fastify, LangChain, Qdrant, Ollama/Claude
  - Modo dev: `npm run dev` (tsx watch + --env-file=.env, NO compila)
  - Modo producción: `npm run build` && `npm start`
  - Logger: `RAG_LOGS=true` activa logs verbose por capa (PIPELINE, QDRANT, PARENT, RERANKER, LLM, COMPRESS)

* **`apps/frontend/`** - Frontend React 19 + React Router 7 + Radix UI + Tailwind
  - Stack: React 19, react-router-dom 7, Radix UI, sonner, react-markdown

* **`apps/evaluation/`** - Sistema de evaluación RAGAS para RAG
  - Scripts: `npm run eval -- --judge sonnet|claude|ollama --categories X --limit N`
  - Juez recomendado: siempre `--judge sonnet` (Haiku es demasiado benévolo)
  - Genera resultados en `benchmark/evaluation/results/`
  - Dataset: `benchmark/evaluation/datasets/golden_qa_v2.json` (v2.2, 58 casos)

### Servicios Externos
* **Qdrant** - Vector database en `localhost:6333`
  - Collection: `documents`
  - ~1,199 documentos indexados (children + parents con vector nulo)

* **Ollama** - Servidor LLM local en `localhost:11434`
  - Embeddings: `mxbai-embed-large` (1024 dims) — NO cambiar sin re-indexar
  - LLM local: configurable via `OLLAMA_MODEL` en .env
  - Modelos probados: llama3.1:8b (baseline), qwen2.5:14b (candidato)

* **Anthropic API** - Claude via API
  - Activar: `USE_CLAUDE=true` en .env
  - Modelo actual: `claude-haiku-4-5-20251001` (mejor Faithfulness y Hallucination)

---

## ⚙️ Contexto Técnico Importante

### Backend Development vs Production
* **tsx watch (dev)**: NO compila TypeScript, ejecuta directamente
  - ⚠️ Los Workers (.ts) NO funcionan (reranker fallará)
  - Fallback gracioso: retorna documentos sin rerank scores

* **npm run build + npm start**: Código compilado a JavaScript
  - ✅ Los Workers (.js) funcionan correctamente
  - ✅ Reranker funciona con scores válidos

### Performance y Timeouts
* **Multi-query generation**: Genera 3 variantes por query usando LLM
  - Puede causar latencia alta (60+ segundos)
  - Se puede deshabilitar temporalmente para evaluaciones

* **Reranker**: Usa worker threads con timeout de 30s
  - Procesa Top 20 candidates → Top 3 parents
  - Si falla, retorna top K sin scoring

* **Evaluación**: Timeouts configurados
  - RAG API: 60s por query
  - Test case: 180s total (query + métricas LLM)
  - Métricas LLM: 90s por métrica con fallback

### Retrieval Pipeline (orden exacto en index.ts)
1. Multi-query generation (3 variantes via LLM)
2. Ensemble retrieval (Vector 60% + BM25 40%) sobre child chunks (128 chars)
3. Parent-child hydration (children → parents únicos, 512 chars, 1 query Qdrant)
4. Reranking bge-reranker-base (Top 20 → Top 5) via Worker Thread
5. Contextual Compression (filtrado por coseno 0.30 con mxbai-embed-large)
6. LLM generation (Claude Haiku o modelo Ollama, temperature 0.0)

### Convenciones de Código Backend
* **Logger**: usar siempre `createLogger('NOMBRE_CAPA')` de `lib/logger.ts`. Activar con `RAG_LOGS=true`
* **Configuración**: toda config desde `services/rag/config.ts` vía `process.env`. Nunca hardcodear valores
* **Reranker Worker**: en dev (tsx) el worker .ts falla — hay fallback automático al hilo principal
* **BGE Reranker scores**: son logits no acotados (pueden ser negativos). NO usar como porcentajes ni aplicar threshold absoluto
* **Embeddings**: `mxbai-embed-large` con prefijos asimétricos (query prefix ≠ document prefix). Ver `instructionPrefixedEmbeddings.ts`
* **BM25**: indexa SOLO children cuando Parent-Child está activo. Si indexa parents también habrá duplicados
* **Sources deduplicación**: `docsToSources()` en index.ts deduplica por filename con Set. Mantener esta lógica
* **Contextual Compression**: filtra frases de cada parent por similitud coseno vs query. Threshold 0.30 por defecto. Cuidado: puede eliminar líneas de código que tienen baja similitud semántica pero son relevantes

### Errores Frecuentes a Evitar
* NO mostrar `rerankScore * 100` como porcentaje — BGE usa logits no acotados
* NO re-indexar sin avisar al usuario — borra toda la base vectorial existente
* NO cambiar `mxbai-embed-large` sin re-indexar (dimension/modelo mismatch)
* NO lanzar `npm run eval` desde el directorio backend — ejecutar desde `apps/evaluation/`
* El puerto 3001 puede quedar ocupado tras Ctrl+C — usar `lsof -i :3001 -sTCP:LISTEN -t | xargs kill -9`

---

## 🧪 Testing y Evaluación

### Scripts de Evaluación
```bash
# Eval completo (juez Sonnet recomendado)
cd apps/evaluation && npm run eval -- --judge sonnet

# Eval rápido (5 casos, para verificar que funciona)
cd apps/evaluation && npm run eval -- --judge sonnet --limit 5

# Eval por categorías problemáticas
cd apps/evaluation && npm run eval -- --judge sonnet --categories "Comparativa,Multi-Hop"

# Tests de retrieval por capas
cd apps/backend && npm run test:base
cd apps/backend && npm run test:ensemble
cd apps/backend && npm run test:parent-child
cd apps/backend && npm run test:reranker
```

### Archivos Clave de Evaluación
* `benchmark/evaluation/datasets/golden_qa_v2.json` — Dataset v2.2 (58 casos)
* `benchmark/evaluation/results/ragas_*.json` — Resultados de evaluación
* `benchmark/evaluation/COMPARATIVA_SESION.md` — Histórico de runs y comparativas
* `benchmark/evaluation/COMPARATIVA_SESION_v2.md` — Runs post dataset v2.2

### Cambiar Modelo LLM
```bash
# Usar Claude Haiku (mejor calidad, requiere API key)
USE_CLAUDE=true
CLAUDE_MODEL=claude-haiku-4-5-20251001

# Usar modelo local Ollama
USE_CLAUDE=false
OLLAMA_MODEL=qwen2.5:14b   # o llama3.1:8b, phi4:14b, etc.
```

---

## 🔧 Debugging y Diagnóstico

### Verificar Estado de Servicios
```bash
# Backend health
curl http://localhost:3001/health

# Qdrant collection info
curl http://localhost:6333/collections/documents

# Ollama modelos disponibles
curl http://localhost:11434/api/tags

# Test rápido de RAG
curl -X POST 'http://localhost:3001/api/chat/query' \
  -H 'Content-Type: application/json' \
  -d '{"question": "Test"}'
```

### Logs Importantes
* Backend logs: Ver terminal donde corre `npm run dev`
* Buscar: "BM25 cache", "Filtered X/Y sources", "Reranking failed"

---

*Nota: Solo existen el README y la documentación técnica detallada en /docs. No hay documentación intermedia.*