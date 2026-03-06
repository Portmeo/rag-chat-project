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
  - Stack: Fastify, LangChain, Qdrant, Ollama
  - Modo dev: `npm run dev` (usa tsx watch, NO compila)
  - Modo producción: `npm run build` && `npm start` (código compilado)

* **`apps/frontend/`** - Frontend de la aplicación

* **`apps/evaluation/`** - Sistema de evaluación RAGAS para RAG
  - Scripts: `npm run eval`, `npm run validate`
  - Genera resultados en `benchmark/evaluation/results/`

### Servicios Externos
* **Qdrant** - Vector database en `localhost:6333`
  - Collection: `documents`
  - ~1,199 documentos indexados

* **Ollama** - Servidor LLM local en `localhost:11434`
  - Modelos: llama3.1:8b (LLM), mxbai-embed-large (embeddings)

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

### Retrieval Pipeline
1. Multi-query generation (si está habilitado)
2. Ensemble retrieval (BM25 + Vector Search)
3. Parent-child resolution
4. Reranking (Top 20 → Top 3)
5. Filtrado por rerank score (threshold: 0.5)

---

## 🧪 Testing y Evaluación

### Scripts de Evaluación
```bash
# Ejecutar evaluación completa
cd apps/evaluation && npm run eval

# Validación manual de resultados
cd apps/evaluation && npm run validate

# Test manual de retrieval
cd apps/backend && npx tsx src/scripts/test-retrieval.ts
```

### Archivos de Resultados
* `benchmark/evaluation/results/ragas_*.json` - Resultados de evaluación
* `benchmark/evaluation/results/validations/` - Análisis de patrones

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