# Ideas Pendientes - RAG Chat

Sistema actual: BM25 (70%) + mxbai-embed-large (30%) + bge-reranker + llama3.1:8b

---

## 🎯 Prioridad Alta (Siguiente Sprint)

### 1. Migrar BM25 de Memoria a Qdrant ⭐ IMPORTANTE
- [ ] Implementar BM25 usando sparse vectors de Qdrant
  - **Problema Actual**: BM25Retriever mantiene TODOS los documentos en memoria
  - Actualmente: `bm25RetrieverCache` se reconstruye en cada upload
  - Memoria crece linealmente con número de documentos
  - No es escalable para grandes volúmenes (>10k documentos)
  - **Solución**: Usar Qdrant Sparse Vectors (BM42 algorithm)
  - Qdrant soporta búsqueda híbrida nativa (dense + sparse vectors)
  - Escalabilidad: millones de documentos sin problemas de memoria
  - **Impacto**: Sistema escalable, menor uso de RAM
  - **Tiempo**: 1-2 días
  - **Dificultad**: Media
  - **Referencias**:
    - [Qdrant Sparse Vectors](https://qdrant.tech/documentation/concepts/vectors/#sparse-vectors)
    - [Hybrid Search](https://qdrant.tech/articles/hybrid-search/)

### 2. Mejorar RAGAS (En Progreso)
- [ ] Optimizar prompts de evaluación para mayor consistencia
- [ ] Añadir más casos de prueba al golden dataset (actualmente 17)
- [ ] Implementar caché de evaluaciones para evitar re-evaluar queries idénticas
- [ ] Dashboard visual de métricas RAGAS en el tiempo
  - **Tiempo**: 1-2 días
  - **Dificultad**: Media

### 3. Persistir Historial de Conversaciones
- [ ] Guardar chats en SQLite/PostgreSQL
  - Sidebar con lista de chats pasados
  - Recuperar conversaciones anteriores
  - **Tiempo**: 1 día
  - **Dificultad**: Media

### 4. Gestión de Documentos - Mejorar
- [ ] Mostrar chunks y tamaño por documento
  - Actualmente solo muestra nombre y fecha
  - Agregar: número de chunks, tamaño KB/MB
  - **Tiempo**: 2 horas
  - **Dificultad**: Fácil

### 5. Dark Mode
- [ ] Toggle tema oscuro/claro
  - **Tiempo**: 2 horas
  - **Dificultad**: Fácil

---

## 🚀 Prioridad Media

### 6. Parent Document Retriever ⭐ MUY RECOMENDADO
- [ ] Implementar estrategia Small-to-Big
  - **Qué es**: Buscar con chunks pequeños (200 chars), retornar chunks grandes (1000 chars)
  - **Por qué**: Chunks pequeños = mejor retrieval, chunks grandes = mejor LLM
  - Al indexar: crear child chunks (200) + parent chunks (1000)
  - Indexar child chunks en Qdrant con `metadata.parent_id`
  - En retrieval: buscar child → retornar parent completo
  - **Impacto**: +15-20% precisión en retrieval, mejor contexto al LLM
  - **Ventaja**: Lo mejor de ambos mundos (precisión + contexto)
  - **Tiempo**: 4-6 horas
  - **Dificultad**: Media
  - **Referencias**: [LangChain Parent Document Retriever](https://python.langchain.com/docs/modules/data_connection/retrievers/parent_document_retriever)

### 7. Contextual Compression (Opcional)
- [ ] Comprimir contexto antes de enviar al LLM
  - Extraer solo frases relevantes de cada chunk
  - Usar modelo pequeño o lógica de código
  - **Impacto**: -30% tokens (menos relevante con Ollama local)
  - **Cuándo usar**: Si el LLM se confunde con chunks ruidosos
  - **Nota**: El reranker ya hace filtrado similar a nivel de documento
  - **Tiempo**: 3-4 horas
  - **Dificultad**: Media
  - **Prioridad**: Baja (solo si hay problemas de ruido)

### ❌ HyDE (NO Recomendado)
- [x] ~~Query Expansion con Hypothetical Document Embeddings~~
  - **Por qué NO implementar**:
    - ✅ Ya tenemos multi-query que genera 3 variaciones de la pregunta
    - ✅ Multi-query cubre el 80% del caso de uso de HyDE
    - ❌ HyDE añade latencia (llamada extra al LLM)
    - ❌ Para documentación técnica, las queries ya usan términos similares a los docs
    - ❌ HyDE es útil para "vocabulary mismatch" severo (no es nuestro caso)
  - **Cuándo SÍ valdría la pena**: Si usuarios hacen queries muy coloquiales vs docs técnicos formales
  - **Decisión**: SKIP - Multi-query ya resuelve este problema

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

### Sprint 1 (1 semana) ⭐ PRIORITARIO
1. Migrar BM25 a Qdrant Sparse Vectors
2. Mejorar RAGAS (más casos de prueba, dashboard visual)
3. Dark mode
4. Mostrar chunks/tamaño por documento

**Resultado**: Sistema escalable + mejor observabilidad

### Sprint 2 (1 semana)
1. **Parent Document Retriever** ⭐ (+15-20% precisión)
2. Persistir historial de chats
3. Panel de configuración avanzada
4. Mostrar chunks/tamaño por documento

**Resultado**: Sistema optimizado con mejor retrieval

### Sprint 3 (2 semanas)
1. Dashboard de analytics básico
2. Metadata enriquecida (secciones, tipo de contenido)
3. Feedback de respuestas
4. Contextual Compression (opcional, si es necesario)

**Resultado**: Sistema completo con observabilidad

### Largo Plazo
- Multi-usuario
- Tests + CI/CD
- Deploy cloud
- Import desde URLs

---

## 📊 Herramientas Útiles

### Para Implementar
- **RAGAS**: https://github.com/explodinggradients/ragas
- **Parent Document Retriever**: https://python.langchain.com/docs/modules/data_connection/retrievers/parent_document_retriever
- **Qdrant Sparse Vectors**: https://qdrant.tech/documentation/concepts/vectors/#sparse-vectors
- **LangChain Memory**: https://js.langchain.com/docs/modules/memory/
- **react-markdown**: https://github.com/remarkjs/react-markdown
- **Playwright**: https://playwright.dev/ (E2E tests)

### Papers de Referencia
- [Lost in the Middle](https://arxiv.org/abs/2307.03172) - Posición de docs importa
- [RAG Survey](https://arxiv.org/abs/2312.10997) - Estado del arte RAG
- [Precise Zero-Shot Dense Retrieval](https://arxiv.org/abs/2212.10496) - HyDE (decidimos NO implementar)

---

## 🎯 Métricas de Éxito

- **Latencia**: < 2s (sin reranking), < 3s (con reranking) ✅
- **Accuracy**: > 85% ✅ (actualmente 85.7%)
- **MRR**: > 0.85 ✅ (actualmente 0.875)
- **User Satisfaction**: > 80% (pendiente - necesita feedback UI)
- **Uptime**: > 99% (pendiente - monitoreo)

---

**Última actualización**: 1 de febrero de 2026
**Estado**: Sistema RAG optimizado funcional con streaming, historial básico, gestión de documentos, y evaluación RAGAS completa. Siguiente paso prioritario: Migrar BM25 a Qdrant Sparse Vectors (escalabilidad)
