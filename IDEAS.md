# Ideas Pendientes - RAG Chat

Sistema actual: BM25 (70%) + mxbai-embed-large (30%) + bge-reranker + llama3.1:8b

---

## 🎯 Prioridad Alta (Siguiente Sprint)

### 0. Query Logging para mejora continua del RAG ⭐ MUY IMPORTANTE
- [ ] Guardar log de todas las queries reales de los usuarios con sus respuestas y fuentes recuperadas
  - **Problema actual**: el alignment optimizer genera preguntas hipotéticas sin saber qué preguntan los usuarios reales → preguntas genéricas que no coinciden con el vocabulario real
  - **Solución**: log de queries reales → usar esas queries para:
    1. **Mejorar alignment questions**: re-generar preguntas por chunk usando las queries reales más frecuentes como referencia de vocabulario
    2. **Detectar gaps**: queries sin contexto relevante → documentación que falta
    3. **Afinar retrieval**: queries que fallan frecuentemente → ajustar pesos BM25/vector o chunk size
  - **Implementación**:
    - Guardar en fichero JSONL o DB: `{ query, answer, sources, latency, timestamp }`
    - Dashboard simple de queries frecuentes y fallidas
    - Script para re-generar alignment questions usando queries reales como seed
  - **Impacto**: el RAG mejora con el uso real en lugar de preguntas sintéticas — más cercano a un chatbot que aprende
  - **Tiempo**: 1 día (logging) + iteración continua
  - **Dificultad**: Baja (logging) / Media (mejora continua)

### RAG Dinámico y Auto-mejorante
- El sistema actual es **estático**: indexas docs y el retrieval no cambia hasta que re-indexas manualmente
- Con query logging, el RAG se vuelve **dinámico**:
  - Las alignment questions se regeneran automáticamente en base a queries reales frecuentes
  - El índice evoluciona sin intervención humana
  - Los gaps de documentación se detectan automáticamente (queries sin contexto relevante)
  - El vocabulario del índice converge hacia el vocabulario real de los usuarios
- **Analogía**: como un sistema de recomendación que aprende del comportamiento — no necesita reentrenar modelos, solo actualiza el índice
- **Diferencia clave con fine-tuning**: no tocas los pesos del modelo, solo el conocimiento indexado → más rápido, más barato, más controlable

### 1. Redis como capa de persistencia rápida ⭐ IMPORTANTE
- [ ] Usar Redis para BM25, parents y alignment status
  - **Problema actual**: BM25 se reconstruye en memoria en cada arranque, parents se guardan en Qdrant con vector nulo (hack), alignment status también en Qdrant
  - **Solución Redis**:
    - **BM25 index** → blob serializado en Redis, persist entre reinicios, reconstrucción instantánea
    - **Parents** → Redis Hash por `parent_doc_id` → contenido, lookup O(1) vs scroll Qdrant
    - **Alignment status** → Redis Hash por filename (`alignment:filename` → `{status, progress, total}`)
  - **Qdrant queda solo para búsqueda vectorial de children** — su uso natural
  - **Impacto**: arranque instantáneo del backend, hydration de parents mucho más rápida, arquitectura más limpia
  - **Tiempo**: 2-3 días
  - **Dificultad**: Media
  - **Por qué Redis y no MongoDB**: es key-value puro, O(1) lookups, sin schema, perfecto para BM25 blob y parent lookup. Mongo añadiría complejidad innecesaria.

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

### 6. Parent Document Retriever ✅ IMPLEMENTADO
- [x] Estrategia Small-to-Big activa (child=128, parent=512)
  - Child chunks para retrieval vectorial preciso
  - Parent chunks para contexto completo al LLM
  - Hydration automática: child → parent único
  - Validado: 100% hit rate en test de 35 preguntas
  - **Problema detectado**: Context Precision 0.34 — los parents (512 chars) incluyen contexto ruidoso alrededor del dato relevante. Candidato a prompt compression.

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

### ❌ HyDE — Ver análisis en sección Microsoft Advanced RAG

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

## 🔬 Técnicas Advanced RAG (Microsoft Learn)

Referencia: [Advanced RAG — Microsoft Azure](https://learn.microsoft.com/es-es/azure/developer/ai/advanced-retrieval-augmented-generation)

### Estado de implementación actual

| Técnica | Estado | Notas |
|---|---|---|
| Hybrid Search (BM25 + Vector) | ✅ Implementado | BM25 0.4 + Vector 0.6 |
| Reranking (Cross-Encoder) | ✅ Implementado | BGE-reranker-base, Top 20 → Top 5 |
| Small-to-Big (Parent-Child) | ✅ Implementado | Child 128 / Parent 512 |
| Multi-query | ✅ Implementado | 3 variantes por query vía LLM |
| Golden dataset + RAGAS | ✅ Implementado | 52 casos, métricas completas |
| Prompt Compression | ❌ No implementado | Candidato directo para +Faithfulness |
| Alignment Optimization | ❌ No implementado | Alto impacto, requiere re-indexar |
| Query Router | ❌ No implementado | Útil para categorías mixtas |
| Fact-checking post-completion | ❌ No implementado | Mitiga alucinaciones en generación |
| Hierarchical Index (summary) | ❌ No implementado | Útil para preguntas comparativas |
| HyDE | ⛔ Descartado | Multi-query ya cubre este caso |

---

### Técnicas no implementadas — detalle

#### A. Prompt Compression (Contextual Compression)
- **Qué es**: Antes de enviar el contexto al LLM, extraer solo las frases directamente relevantes a la pregunta (no el chunk entero).
- **Por qué importa**: Context Precision actual = **0.34**. Los parent chunks (512 chars) contienen el dato relevante rodeado de ruido. El LLM lo recibe todo y "razona más allá" (Faithfulness = 0.59).
- **Cómo implementar**: `ContextualCompressionRetriever` de LangChain con `LLMChainExtractor` o `EmbeddingsFilter`.
- **Variante ligera** (sin LLM extra): Dividir cada parent en frases, eliminar las que no superen similarity threshold con la query.
- **Impacto estimado**: +0.10-0.15 en Faithfulness, +0.10 en Context Precision
- **Coste**: Latencia extra (una pasada de filtrado por chunk). Con EmbeddingsFilter es rápido (solo coseno).
- **Dificultad**: Media
- **Tiempo**: 3-5 horas

#### B. Alignment Optimization (Preguntas por Chunk)
- **Qué es**: Durante la indexación, para cada chunk se generan N preguntas hipotéticas que ese chunk respondería. Esas preguntas se indexan junto al chunk.
- **Por qué importa**: Mejora el matching semántico query↔chunk porque los embeddings comparan pregunta con pregunta (mismo espacio) en lugar de pregunta con texto técnico.
- **Impacto estimado**: +5-10% en Context Recall para preguntas comparativas/multi-hop
- **Coste**: Requiere re-indexar todos los documentos con una llamada LLM por chunk (~1,200 chunks = caro pero one-time).
- **Dificultad**: Media-Alta
- **Tiempo**: 1-2 días

#### C. Query Router
- **Qué es**: Un clasificador que analiza la pregunta y decide qué estrategia de retrieval usar (vector puro, híbrido, búsqueda por metadata, respuesta directa sin RAG).
- **Por qué importa**: Las preguntas de tipo "Edge Case" y "Comparativa" tienen baja relevancy/precision. Un router podría enviarlas a estrategias específicas.
- **Ejemplo**: Preguntas tipo "¿Existe X en la documentación?" → búsqueda por keyword BM25; preguntas conceptuales → vector; preguntas comparativas → hierarchical index.
- **Dificultad**: Media
- **Tiempo**: 1 día

#### D. Hierarchical Index para preguntas comparativas
- **Qué es**: Dos niveles de índice: (1) resúmenes de cada documento completo, (2) chunks detallados. Para preguntas que comparan conceptos, buscar primero en resúmenes para obtener visión global antes de los chunks.
- **Por qué importa**: Categoría Comparativa tiene Faithfulness = **0.33** — el modelo no tiene contexto suficiente para comparar dos tecnologías cuando la info está fragmentada en chunks separados.
- **Dificultad**: Alta
- **Tiempo**: 2-3 días

#### E. Fact-checking post-completion
- **Qué es**: Después de generar la respuesta, pasar una verificación LLM que compara cada afirmación de la respuesta con el contexto original y rechaza/corrige las no soportadas.
- **Por qué importa**: Hallucination actual = **0.92** (ya bueno), pero Faithfulness = 0.59 — hay afirmaciones no directamente contradictorias pero sí inferidas que podrían filtrarse.
- **Coste**: Una llamada LLM extra por query (+latencia).
- **Alternativa más ligera**: Reforzar el prompt del sistema (ya se hizo parcialmente).
- **Dificultad**: Media
- **Tiempo**: 4-6 horas

---

### Recomendación de siguiente paso

**Problema principal identificado (sesión 2026-03-07):**
- Faithfulness plateau en ~0.59 incluso con Claude Haiku como LLM
- Comparativa Faithfulness = 0.33 (el modelo razona más allá del contexto)
- Context Precision = 0.34 (los parents tienen ruido)

**Acción recomendada (por orden de impacto/esfuerzo):**
1. **Prompt Compression** — mejor ratio impacto/tiempo. Probar `EmbeddingsFilter` primero (sin LLM extra).
2. **Aumentar `RERANKER_FINAL_TOP_K` a 7** — más contexto para preguntas comparativas sin cambiar arquitectura.
3. **Alignment Optimization** — mayor impacto pero requiere re-indexar. Planificar para sprint siguiente.

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

**Última actualización**: 7 de marzo de 2026
**Estado**: Sistema RAG optimizado funcional. Pipeline completo: BM25+Vector+Reranker+Parent-Child. Evaluación RAGAS con 52 casos y Claude Haiku como juez externo. Mejor config probada: Claude Haiku + Reranker (Faithfulness 0.59, Hallucination 0.92). Siguiente paso: Prompt Compression para reducir ruido en context y subir Faithfulness.
