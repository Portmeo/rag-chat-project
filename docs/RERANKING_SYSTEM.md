# Sistema de Reranking con Cross-Encoder

**Fecha:** 2026-01-31
**Estado:** ✅ Implementado

---

## 📖 ¿Qué es el Reranking?

El **reranking** es una técnica de dos etapas que mejora la precisión del retrieval:

1. **Etapa 1 - Retrieval Amplio (Recall):**
   - Buscar Top 20-25 documentos candidatos
   - Objetivo: Asegurar que el documento correcto esté en el conjunto
   - Usa: Vector Search + BM25 (Hybrid)

2. **Etapa 2 - Reranking (Precision):**
   - Usar Cross-Encoder para puntuar cada candidato
   - Ordenar por puntuación de relevancia
   - Tomar solo los Top 5 mejores
   - Objetivo: Eliminar ruido y mejorar orden

---

## 🏗️ Arquitectura

```
User Query
    ↓
┌─────────────────────────────────────────┐
│ 1. RETRIEVAL AMPLIO (Top 20)           │
│    - 70% BM25 (keywords)                │
│    - 30% mxbai-embed-large (semantic)   │
└─────────────────────────────────────────┘
    ↓ 20 documentos candidatos
┌─────────────────────────────────────────┐
│ 2. RERANKING (Worker Thread)           │
│    - bge-reranker-base (Cross-Encoder)       │
│    - Scoring: Query ↔ Documento         │
│    - Sort por score                     │
└─────────────────────────────────────────┘
    ↓ Top 5 documentos rerankeados
┌─────────────────────────────────────────┐
│ 3. LLM GENERATION                       │
│    - Ollama (qwen2.5:7b)                │
│    - Contexto: Top 5 docs               │
└─────────────────────────────────────────┘
    ↓
Final Answer
```

---

## 🧠 Cross-Encoder vs Bi-Encoder

### Bi-Encoder (Vector Search - Actual)
```
Query  → [Embedding] → [0.1, 0.5, 0.3, ...]
                             ↓
                      Cosine Similarity
                             ↓
Doc    → [Embedding] → [0.2, 0.4, 0.4, ...]
```

**Ventaja:** Muy rápido (embeddings pre-calculados)
**Desventaja:** No ve la relación directa query↔doc

### Cross-Encoder (Reranking - Nuevo)
```
[Query + [SEP] + Document] → Neural Network → Relevance Score (0-1)
```

**Ventaja:** Entiende la relación completa query↔doc
**Desventaja:** Más lento (debe procesar cada par)

---

## ⚙️ Configuración

### Variables de Entorno (.env)

```bash
# Habilitar reranking
USE_RERANKER=true

# Cuántos documentos recuperar inicialmente (20-25 recomendado)
RERANKER_RETRIEVAL_TOP_K=20

# Cuántos documentos finales enviar al LLM (3-5 recomendado)
RERANKER_FINAL_TOP_K=5
```

### Configuraciones Recomendadas

#### Máxima Precisión (Recomendado)
```bash
USE_RERANKER=true
RERANKER_RETRIEVAL_TOP_K=25
RERANKER_FINAL_TOP_K=3
```
- Mejor precisión
- Contexto más enfocado al LLM
- +1-2s latencia

#### Balanceado (Default)
```bash
USE_RERANKER=true
RERANKER_RETRIEVAL_TOP_K=20
RERANKER_FINAL_TOP_K=5
```
- Buen balance precisión/latencia
- Contexto completo al LLM
- +0.5-1s latencia

#### Máxima Velocidad
```bash
USE_RERANKER=false
```
- Sin reranking
- Usa solo vector search + BM25
- Latencia mínima

---

## 📊 Mejora Esperada

Basado en el benchmark actual con **mxbai-embed-large**:

| Métrica | Sin Reranker | Con Reranker | Mejora |
|---------|-------------|--------------|--------|
| **MRR** | 0.844 | ~0.92-0.95 | **+10-12%** |
| **Precision@3** | ~80% | ~95% | **+15%** |
| **Recall@5** | 94% | 94% | Sin cambio |
| **LLM Correctness** | ~85% | ~95% | **+10%** |
| **Latency** | ~500ms | ~1.5s | +1s |

### ¿Por qué mejora?

1. **Mejor Ranking:** El documento correcto sube posiciones
2. **Menos Ruido:** Se eliminan documentos irrelevantes
3. **LLM más Efectivo:** Ve primero la información relevante

---

## 🔧 Implementación Técnica

### Modelo Usado

**bge-reranker-base** (Xenova/bge-reranker-base)
- Tamaño: ~278 MB
- Velocidad: ~500ms para 20 documentos
- Precisión: State-of-the-art en MTEB Reranking

> **Alternativa pendiente de probar:** `Xenova/bge-reranker-v2-m3` (versión multilingüe mejorada, mejor soporte español)

### Worker Thread

El reranking se ejecuta en un **Worker Thread** separado para:
- ✅ No bloquear el Event Loop de Node.js
- ✅ Aislar procesamiento intensivo
- ✅ Permitir timeout (30s)

```typescript
// Uso desde el código
import { rerankDocuments } from './services/rag/reranker';

const reranked = await rerankDocuments(
  query,
  candidateDocs,  // Top 20 from retrieval
  5               // Return Top 5
);
```

---

## 📈 Casos de Uso

### ✅ Cuándo usar Reranking

1. **Queries complejas o ambiguas**
   - "diferencia entre container y presenter"
   - "ventajas de JWT vs sesiones tradicionales"

2. **Documentos largos o técnicos**
   - Documentación técnica
   - Manuales de usuario
   - Código con comentarios

3. **Precisión crítica**
   - Aplicaciones médicas
   - Legal
   - Financiero

### ❌ Cuándo NO usar Reranking

1. **Queries simples con keywords exactos**
   - "versión de Angular"
   - "stack tecnológico"
   - BM25 solo ya funciona bien

2. **Latencia crítica**
   - Chat en tiempo real
   - Autocompletado
   - Búsqueda mientras escribes

3. **Documentos muy cortos**
   - Tweets
   - Mensajes cortos
   - FAQs simples

---

## 🧪 Testing

### Probar con Query del Benchmark

```bash
curl -X POST http://localhost:3001/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "diferencia entre container y presenter components"
  }'
```

**Sin Reranker:**
- Documento correcto en posición 3-5
- LLM puede confundirse con docs irrelevantes

**Con Reranker:**
- Documento correcto en posición 1-2
- LLM responde con más precisión

### Ver Logs del Reranking

Busca en los logs del backend:

```
📄 Retrieved 20 candidate documents
🔄 Reranking 20 documents to Top 5...
🔄 Loading bge-reranker-base model...
✅ Reranker model loaded
📊 Reranking 20 documents...
✅ Reranking completed in 523ms
   Top score: 0.9845
   Bottom score: 0.7234
✅ Reranking completed, got 5 top documents

📄 Final documents for LLM:
--- Document 1 ---
File: 08-patron-container-presenter.md
Chunk: 0
Rerank Score: 0.9845
```

---

## 🐛 Troubleshooting

### Error: "Reranking timeout (30s)"

**Causa:** El modelo tardó demasiado
**Solución:**
- Reducir `RERANKER_RETRIEVAL_TOP_K` (de 20 a 15)
- Verificar recursos del sistema

### Error: "Cannot find module '@xenova/transformers'"

**Causa:** Dependencia no instalada
**Solución:**
```bash
cd apps/backend
npm install @xenova/transformers
```

### Warning: "Reranking failed, falling back to original retrieval"

**Causa:** Error en el worker thread
**Solución:**
- Ver logs completos para detalles
- El sistema automáticamente usa retrieval sin reranking
- No afecta la disponibilidad

---

## 📚 Referencias

- **Paper:** [bge-reranker](https://arxiv.org/abs/2309.07597)
- **Transformers.js:** [xenova/transformers.js](https://github.com/xenova/transformers.js)
- **MTEB Leaderboard:** [Reranking Tasks](https://huggingface.co/spaces/mteb/leaderboard)

---

## 🎯 Próximos Pasos

### Mejoras Futuras

1. **Cache de Reranking**
   - Guardar scores para queries repetidas
   - Redis cache layer

2. **Batch Reranking**
   - Procesar múltiples queries en paralelo
   - Mejor throughput

3. **A/B Testing**
   - Comparar con/sin reranking
   - Métricas reales de usuarios

4. **Modelo más rápido**
   - Probar `ms-marco-MiniLM` (más rápido, menos preciso)
   - Quantización del modelo

---

*Creado: 2026-01-31*
*Última actualización: 2026-01-31*
