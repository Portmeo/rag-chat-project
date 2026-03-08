# Capa de Persistencia SQLite

## Motivación

Antes de esta capa el sistema tenía tres problemas:

| Problema | Síntoma |
|---|---|
| **BM25 en memoria** | Se reconstruía desde Qdrant en cada reinicio (~segundos extra al arrancar) |
| **Parents en Qdrant con vector nulo** | Hack: Qdrant obliga a tener vector; los null-vectors contaminaban la colección y hacían el scroll lento |
| **Sin query logging** | Imposible saber qué preguntan los usuarios, qué chunks se recuperan o detectar degradación |

La solución es SQLite (zero-config, sin servidor) con inversión de dependencias: el pipeline RAG solo conoce interfaces, nunca las implementaciones concretas.

---

## Arquitectura

```
RAG Pipeline (index.ts)
    │
    ├── IParentStorage ──── SqliteParentStorage
    ├── IBM25Storage   ──── SqliteBM25Storage
    └── IQueryLogger   ──── SqliteQueryLogger
                               │
                           src/lib/database.ts (conexión SQLite singleton)
                               │
                           apps/backend/data/rag.db
```

El pipeline importa `parentStorage`, `bm25Storage` y `queryLogger` desde `src/repositories/index.ts` (factory). Para cambiar la implementación (ej. Redis, PostgreSQL) solo hay que editar ese factory.

---

## Esquema de la base de datos

```sql
-- Parents: contenido completo de los chunks padre (512 chars)
CREATE TABLE parents (
  id         TEXT PRIMARY KEY,  -- parent_doc_id del metadata
  filename   TEXT NOT NULL,
  content    TEXT NOT NULL,
  metadata   TEXT NOT NULL,     -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_parents_filename ON parents(filename);

-- BM25: documentos serializados para reconstruir el índice sin llamar a Qdrant
CREATE TABLE bm25_documents (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  content  TEXT NOT NULL,
  metadata TEXT NOT NULL        -- JSON
);

-- Query log: cada llamada al RAG genera una fila
CREATE TABLE query_log (
  id            TEXT PRIMARY KEY,
  timestamp     TEXT NOT NULL,
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  model         TEXT NOT NULL,
  latency_ms    INTEGER NOT NULL,
  sources       TEXT NOT NULL,  -- JSON: [{filename, chunk_index, rerank_score, section_path}]
  num_retrieved INTEGER NOT NULL,
  context_size  INTEGER NOT NULL
);
CREATE INDEX idx_query_log_timestamp ON query_log(timestamp);
```

---

## Comportamiento por operación

### Upload de documento
```
createParentChildChunks()
    ├── children → QdrantVectorStore.fromDocuments()   (con embedding)
    └── parents  → parentStorage.saveParents()          (SQLite, sin vector)
```

### Query (retrieval)
```
resolveParentChunks(childDocs)
    └── parentStorage.getParentsByIds(uniqueParentIds)  (1 query SQLite)
```
Antes: `qdrantClient.scroll()` con filtro múltiple. Ahora: SELECT WHERE id IN (?,...).

### Arranque del backend / BM25 rebuild
```
rebuildBM25Cache()
    1. bm25Storage.load()  → si hay datos en SQLite, carga directo
    2. Si vacío → getAllDocumentsFromQdrant() → filtra children → BM25Retriever
    3. bm25Storage.save()  → persiste para el próximo reinicio
```
Log en arranque: `BM25 loaded from SQLite (N documents)` si carga de caché.

### Borrado de documento
```
deleteDocumentFromVectorStore(filename)
    ├── qdrantClient.delete()           (children del Qdrant)
    ├── parentStorage.deleteByFilename() (parents del SQLite)
    ├── bm25Storage.clear()              (invalida cache BM25)
    └── rebuildBM25Cache()               (reconstruye desde Qdrant y persiste)
```

### Query logging
Al finalizar cada `queryRAG` / `queryRAGStream`:
```typescript
queryLogger.log({
  question, answer, model, latency_ms,
  sources: [{filename, chunk_index, rerank_score, section_path}],
  num_retrieved, context_size
})
```
La llamada es non-blocking (`.catch()` silencioso para no bloquear la respuesta).

---

## Consultar el query log

```bash
# Con sqlite3 CLI
sqlite3 apps/backend/data/rag.db \
  "SELECT timestamp, question, model, latency_ms, num_retrieved FROM query_log ORDER BY timestamp DESC LIMIT 20;"

# Ver sources de una query
sqlite3 apps/backend/data/rag.db \
  "SELECT question, sources FROM query_log ORDER BY timestamp DESC LIMIT 5;"

# Queries más lentas
sqlite3 apps/backend/data/rag.db \
  "SELECT question, latency_ms FROM query_log ORDER BY latency_ms DESC LIMIT 10;"
```

---

## Migración desde versión anterior

Los documentos indexados antes de esta capa tienen sus parents en Qdrant (con vector nulo). SQLite estará vacío, así que `resolveParentChunks` caerá al fallback (usa children directamente).

**Solución**: re-indexar todos los documentos. Al borrar y volver a subir cada documento los parents se guardan en SQLite y los null-vectors de Qdrant desaparecen.

---

## Cambiar la implementación (inversión de dependencias)

Solo hay que editar `src/repositories/index.ts`:

```typescript
// Cambiar SqliteParentStorage por RedisParentStorage:
export const parentStorage: IParentStorage = new RedisParentStorage(redisClient);
```

El pipeline en `index.ts` no necesita ningún cambio.
