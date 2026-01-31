# Ideas Pendientes - RAG Chat

Sistema actual: BM25 (70%) + mxbai-embed-large (30%) + bge-reranker + llama3.1:8b

---

## 🎯 Prioridad Alta (Siguiente Sprint)

### 1. Evaluación Automática con RAGAS ⭐ RECOMENDADO
- [ ] Implementar RAGAS para métricas automáticas
  - Faithfulness (detectar alucinaciones)
  - Answer Relevancy (relevancia de respuesta)
  - Context Precision/Recall (calidad de retrieval)
  - **Impacto**: Validación continua de calidad
  - **Tiempo**: 3-4 horas
  - **Dificultad**: Fácil

### 2. Streaming de Respuestas
- [ ] Implementar Server-Sent Events (SSE)
  - Ver texto generándose en tiempo real (como ChatGPT)
  - Mejor UX, percepción de velocidad
  - **Impacto**: Experiencia mucho mejor
  - **Tiempo**: 1 día
  - **Dificultado**: Media

### 3. Historial de Conversaciones
- [ ] Memoria de conversación (corto plazo)
  - Recordar últimos 5-10 mensajes
  - ConversationBufferWindowMemory de LangChain
  - **Impacto**: Conversaciones coherentes
  - **Tiempo**: 4 horas
  - **Dificultad**: Media

- [ ] Persistir chats en SQLite/PostgreSQL
  - Guardar conversaciones
  - Sidebar con lista de chats
  - **Tiempo**: 1 día
  - **Dificultad**: Media

### 4. Gestión de Documentos (Mejorar)
- [ ] Mostrar chunks y tamaño por documento
  - Actualmente solo muestra nombre y fecha
  - Agregar: número de chunks, tamaño KB/MB
  - **Tiempo**: 2 horas
  - **Dificultad**: Fácil

- [ ] Eliminar documentos individuales
  - Actualmente solo "Clear All"
  - Botón delete por fila de documento
  - Limpiar chunks específicos de Qdrant
  - **Tiempo**: 2-3 horas
  - **Dificultad**: Fácil

### 5. Mejor UI/UX
- [ ] Markdown rendering en respuestas
  - react-markdown con syntax highlighting
  - Código, listas, negritas
  - **Tiempo**: 2-3 horas
  - **Dificultad**: Fácil

- [ ] Copy to clipboard
  - Copiar respuestas y código
  - **Tiempo**: 30 min
  - **Dificultad**: Muy fácil

- [ ] Dark mode
  - Toggle tema oscuro/claro
  - **Tiempo**: 2 horas
  - **Dificultad**: Fácil

---

## 🚀 Prioridad Media

### 6. Optimizaciones RAG
- [ ] Contextual Compression
  - Comprimir contexto antes de enviar al LLM
  - Solo fragmentos relevantes
  - **Impacto**: -30% tokens, +15% calidad
  - **Tiempo**: 3-4 horas
  - **Dificultad**: Media

- [ ] Parent Document Retriever
  - Buscar en chunks pequeños (200 tokens)
  - Retornar chunks grandes (1000 tokens)
  - Mejor balance precisión/contexto
  - **Impacto**: +15-20% mejor contexto
  - **Tiempo**: 3-4 horas
  - **Dificultad**: Media

- [ ] Metadata enriquecida
  - Secciones (h1, h2, h3)
  - Tipo de contenido (código, texto, tabla)
  - Filtros de búsqueda por metadata
  - **Impacto**: +10-15% precisión
  - **Tiempo**: 2-3 horas
  - **Dificultad**: Media

### 7. Configuración Avanzada (UI)
- [ ] Panel de ajustes RAG
  - Chunk size (1000, 1500, 2000)
  - Chunk overlap (100, 200, 300)
  - Top-k retrieval (4, 8, 16)
  - BM25/Vector weights
  - **Tiempo**: 1 día
  - **Dificultad**: Media

- [ ] Selección de modelo LLM
  - Dropdown de modelos Ollama disponibles
  - **Tiempo**: 3 horas
  - **Dificultad**: Fácil

### 8. Analytics
- [ ] Dashboard de estadísticas
  - Documentos subidos
  - Queries realizadas
  - Tiempo promedio de respuesta
  - **Tiempo**: 1 día
  - **Dificultad**: Media

- [ ] Métricas por query
  - Latencia
  - Tokens usados
  - Similarity scores
  - **Tiempo**: 4 horas
  - **Dificultad**: Fácil

---

## 💡 Prioridad Baja / Futuro

### 9. Funcionalidades Avanzadas
- [ ] Feedback de respuestas
  - 👍 👎 para cada respuesta
  - Guardar para análisis
  - **Tiempo**: 4 horas
  - **Dificultad**: Fácil

- [ ] Sugerencias de preguntas
  - "También puedes preguntar..."
  - Generar automáticamente desde docs
  - **Tiempo**: 1 día
  - **Dificultad**: Media

- [ ] Citas y referencias numeradas
  - Fuentes [1], [2], [3]
  - Links a secciones exactas
  - **Tiempo**: 1 día
  - **Dificultad**: Media

### 10. Import/Export
- [ ] Import desde URLs
  - Scrapear webs
  - Import desde GitHub (README, docs)
  - **Tiempo**: 2 días
  - **Dificultad**: Media-Alta

- [ ] Soporte PDF y DOCX
  - pdf-parse, mammoth
  - **Tiempo**: 1 día
  - **Dificultad**: Media

- [ ] Export de conversaciones
  - JSON, PDF
  - **Tiempo**: 4 horas
  - **Dificultad**: Fácil

### 11. Multi-usuario (Largo Plazo)
- [ ] Autenticación (JWT, OAuth)
  - Login/Registro
  - **Tiempo**: 2-3 días
  - **Dificultad**: Media-Alta

- [ ] Documentos y chats por usuario
  - Aislamiento de datos
  - **Tiempo**: 1 semana
  - **Dificultad**: Alta

### 12. Testing
- [ ] Tests automatizados
  - Unit tests (backend)
  - E2E tests (Playwright)
  - **Tiempo**: 1 semana
  - **Dificultad**: Media

- [ ] CI/CD
  - GitHub Actions
  - Deploy automático
  - **Tiempo**: 2 días
  - **Dificultad**: Media

### 13. Deployment
- [ ] Docker Compose completo
  - Frontend + Backend + Qdrant + Ollama
  - **Tiempo**: 1 día
  - **Dificultad**: Media

- [ ] Deploy cloud
  - AWS/Azure scripts
  - **Tiempo**: 1 semana
  - **Dificultad**: Alta

---

## 🗺️ Roadmap Sugerido

### Sprint 1 (1 semana)
1. RAGAS para evaluación automática
2. Streaming de respuestas
3. Historial de conversaciones básico
4. Markdown rendering + copy to clipboard

**Resultado**: UX profesional + validación de calidad

### Sprint 2 (1 semana)
1. Gestión de documentos (listar + eliminar)
2. Dark mode
3. Contextual Compression
4. Dashboard de analytics básico

**Resultado**: Sistema completo y usable

### Sprint 3 (2 semanas)
1. Parent Document Retriever
2. Panel de configuración avanzada
3. Metadata enriquecida
4. Feedback de respuestas

**Resultado**: Sistema optimizado

### Largo Plazo
- Multi-usuario
- Tests + CI/CD
- Deploy cloud
- Import desde URLs

---

## 📊 Herramientas Útiles

### Para Implementar
- **RAGAS**: https://github.com/explodinggradients/ragas
- **LangChain Memory**: https://js.langchain.com/docs/modules/memory/
- **react-markdown**: https://github.com/remarkjs/react-markdown
- **Playwright**: https://playwright.dev/ (E2E tests)

### Papers de Referencia
- [Lost in the Middle](https://arxiv.org/abs/2307.03172) - Posición de docs importa
- [RAG Survey](https://arxiv.org/abs/2312.10997) - Estado del arte RAG

---

## 🎯 Métricas de Éxito

- **Latencia**: < 2s (sin reranking), < 3s (con reranking) ✅
- **Accuracy**: > 85% ✅ (actualmente 85.7%)
- **MRR**: > 0.85 ✅ (actualmente 0.875)
- **User Satisfaction**: > 80% (pendiente - necesita feedback UI)
- **Uptime**: > 99% (pendiente - monitoreo)

---

**Última actualización**: 31 de enero de 2026
**Estado**: Sistema RAG optimizado funcional. Siguiente paso: RAGAS + Streaming + Historial
