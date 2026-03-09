# Ideas - RAG Chat

Ideas y mejoras pendientes de implementar.

---

## Prioridad Alta

### Educación al usuario en la UI
- Mensaje onboarding en el chat explicando qué tipo de preguntas puede hacer
- Ejemplos: "¿Cómo funciona X?", "¿Qué hace Y?", "¿Cómo se configura Z?"
- Dejar claro que es un asistente de documentación, no un chatbot general

### Upgrade reranker: bge-reranker-base → bge-reranker-v2-m3
- Multilingual, mejor soporte para español

### Mejorar Multi-Hop
- Preguntas que conectan información de múltiples docs
- Opciones: aumentar `RERANKER_FINAL_TOP_K`, prompt que permita conectar fuentes

### Persistir Historial de Conversaciones
- Guardar chats completos en SQLite
- Sidebar con lista de chats pasados

### Gestión de Documentos - Mejorar
- Mostrar chunks y tamaño por documento

### Dark Mode

---

## Prioridad Media

### Configuración Avanzada (UI)
- Panel de ajustes RAG (chunk size, top-k, weights)
- Selección de modelo LLM

### Analytics
- Dashboard de estadísticas (queries, latencia, docs)

### Fact-checking post-completion
- Verificación LLM que compara cada afirmación de la respuesta con el contexto original

### Hierarchical Index
- Dos niveles de índice: resúmenes de cada documento + chunks detallados. Útil para preguntas comparativas

### Smart Re-indexación
- Comparar si el contenido cambió antes de re-embedir
- Reutilizar embeddings si solo cambió metadata

### Dual Latency Metrics
- Medir `retrieval_ms` y `generation_ms` por separado para diagnosticar cuellos de botella

---

## Prioridad Baja / Futuro

### Funcionalidades
- Feedback 👍👎 por respuesta
- Sugerencias de preguntas automáticas
- Citas y referencias numeradas [1], [2], [3]
- Límite de longitud en respuestas del LLM
- Adaptive Threshold (se adapta a la calidad del mejor resultado)

### Import/Export
- Import desde URLs / GitHub
- Soporte PDF y DOCX
- Export de conversaciones

### Pipeline
- Dynamic Chunk Size (adaptar según ratio chars/tokens)
- Triple representación del contenido (texto limpio, Markdown, HTML)
- HTML Repair en bordes de chunk

### Multi-usuario
- Autenticación (JWT, OAuth)
- Documentos y chats por usuario

### Testing y CI/CD
- Unit tests, E2E (Playwright)
- GitHub Actions, deploy automático

### Deployment
- Docker Compose completo (Frontend + Backend + Qdrant + Ollama)
- Deploy cloud (AWS/Azure)
