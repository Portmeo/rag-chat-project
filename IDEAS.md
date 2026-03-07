# Ideas Pendientes - RAG Chat

Sistema actual: BM25 (40%) + mxbai-embed-large (60%) + bge-reranker + Claude Haiku + Contextual Compression

---

## 🎯 Prioridad Alta (Siguiente Sprint)

> **Decisión de dirección (2026-03-07)**: Un RAG de documentación técnica sirve para hacer accesible el conocimiento escrito — no para sintetizar comparaciones que no están en los docs. El usuario busca entender qué hay, cómo funciona, qué pasos sigue. Foco: que el RAG responda bien Básica, Conceptual, Proceso, Relación y Multi-Hop. Las Comparativas se mantienen en el dataset pero no son el objetivo de optimización.

---

### 1. Educación al usuario en la UI ⭐ ALTA PRIORIDAD
- [ ] Mensaje onboarding en el chat explicando qué tipo de preguntas puede hacer
  - Ejemplos: "¿Cómo funciona X?", "¿Qué hace Y?", "¿Cómo se configura Z?", "¿Qué pasos sigue el flujo de autenticación?"
  - Dejar claro que es un asistente de documentación, no un chatbot general
  - **Por qué**: Antes de optimizar el RAG para casos edge, tiene más ROI que el usuario entienda qué esperar
  - **Impacto**: Reduce frustración, mejora percepción de calidad sin tocar el pipeline
  - **Coste**: Mínimo — solo UI
  - **Tiempo**: 2-3 horas

### 2. Prompt más estricto anti-alucinaciones ⭐ ALTA PRIORIDAD
- [ ] Añadir instrucción explícita: *"Si la información no aparece en los contextos, responde que no tienes esa información. No uses conocimiento externo."*
  - **Problema**: Faithfulness 36% en Run 8 — el LLM rellena gaps con conocimiento de entrenamiento (Angular/NgRx)
  - **Impacto esperado**: +10-15% Faithfulness en todas las categorías
  - **Coste**: Mínimo — solo el prompt
  - **Riesgo**: Respuestas más secas en preguntas básicas. Aceptable — es el comportamiento correcto.
  - **Tiempo**: 1 hora + Run 9 de evaluación

### 3. Upgrade reranker: bge-reranker-base → bge-reranker-v2-m3
- [ ] Cambiar `RERANKER_MODEL` en `.env`
  - **Problema**: Reranker actual es monolingual, rendimiento subóptimo con texto en español
  - **Solución**: `Xenova/bge-reranker-v2-m3` — multilingual, mejor soporte español
  - **Impacto esperado**: Context Precision +5-10% en todas las categorías
  - **Coste**: Bajo — solo cambiar variable de entorno
  - **Tiempo**: 30 min + test

### 4. Analizar queries reales de usuarios ⭐ IMPORTANTE (cuando haya uso real)
- [x] Query logging implementado (`d741187`) — se guardan queries con respuesta, sources y latencia
- [ ] Revisión periódica de los logs para detectar:
  - Queries que fallan frecuentemente → gaps en la documentación
  - Vocabulario real de los usuarios → ajustar chunking/indexado
  - Queries comparativas — analizar si son preguntas legítimas para este RAG o si el usuario espera algo que no aplica
  - **Tiempo**: recurrente (no es una tarea única)

### 5. Mejorar Multi-Hop (caso de uso legítimo complejo)
- [ ] Las preguntas Multi-Hop SÍ aplican en documentación técnica — "¿cómo llega el JWT del login hasta las peticiones HTTP?" requiere conectar información de múltiples docs
  - **Problema actual**: Faithfulness Multi-Hop 0.42, Precision 0.50
  - **Opciones a evaluar**:
    - Aumentar `RERANKER_FINAL_TOP_K` de 5 a 7 (más contexto sin cambiar arquitectura)
    - Prompt que indique explícitamente que puede conectar información de varias fuentes cuando sea necesario
  - **Tiempo**: 1 día + evaluación

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

### Sprint 1 (próximo) — Calidad y UX básica
1. **UI onboarding** — mensaje educativo de para qué sirve el RAG (2-3h)
2. **Prompt estricto** — instrucción anti-alucinaciones + Run 9 para medir (1h)
3. **Upgrade reranker** a bge-reranker-v2-m3 (30min)
4. **Mostrar chunks/tamaño por documento** en UploadPage (2h)

**Resultado**: RAG con mejor Faithfulness y usuarios con expectativas correctas

### Sprint 2 — Producto
1. Persistir historial de chats (SQLite, sidebar)
2. Feedback 👍👎 por respuesta — empezar a recopilar señal de calidad real
3. Panel de configuración RAG básico en UI

**Resultado**: Producto más completo

### Sprint 3 — Observabilidad
1. Dashboard de queries frecuentes y fallidas (usando query logging)
2. Métricas RAGAS en el tiempo (visual)
3. Detección automática de gaps de documentación

**Resultado**: Sistema que mejora con el uso real

### Largo Plazo
- Soporte PDF/DOCX
- Multi-usuario / autenticación
- Tests + CI/CD

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
**Estado**: Pipeline completo y validado — BM25+Vector+Reranker+Parent-Child+Contextual Compression+Claude Haiku. 8 runs de evaluación completados. Decisión de dirección: foco en casos de uso reales de documentación (Básica, Conceptual, Proceso, Multi-Hop). Comparativas no son el objetivo de optimización. Siguiente sprint: prompt estricto + UI onboarding + upgrade reranker.
