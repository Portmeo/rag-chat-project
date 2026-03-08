# Procesamiento de Documentos y Pipeline de Ingesta

Explica cómo se procesan e indexan los documentos: splitting, extracción de metadata y estrategia Parent-Child.

---

## Flujo Completo

```
      archivo.md / .pdf / .docx
              ↓
   [1. Parsing (texto plano)]
              ↓
   [2. Doble Splitting]
       ↙              ↘
Hijos (128 chars)   Padres (512 chars)
       ↓              ↓
   [3. Extracción de Metadata (technical.ts)]
       ↓              ↓
   [4. Indexación en Qdrant]
       ↓              ↓
  Con vector real   Vector NULO (storage only)
```

---

## Text Splitting

El sistema usa `MarkdownTextSplitter` para respetar headers, tablas y bloques de código, y `RecursiveCharacterTextSplitter` para HTML y otros formatos.

Parámetros actuales (configurables en `.env`):
```
CHILD_CHUNK_SIZE=128    CHILD_CHUNK_OVERLAP=25
PARENT_CHUNK_SIZE=512   PARENT_CHUNK_OVERLAP=50
```

---

## Estrategia Parent-Child (Small-to-Big)

Separa la **unidad de búsqueda** (hijo pequeño) de la **unidad de generación** (padre completo).

- **Hijos (128 chars)**: indexados con vectores reales. Son los que responden a búsqueda semántica y BM25.
- **Padres (512 chars)**: almacenados con **vector nulo** — invisibles para búsqueda vectorial. Solo se recuperan por filtro de metadata (`match any parent_doc_id`) cuando sus hijos son seleccionados.
- **Deduplicación**: si varios hijos apuntan al mismo padre, se recupera una sola vez.

---

## Metadata Extraída (technical.ts)

Para cada chunk se extraen los siguientes campos. Solo se almacena lo que aporta valor al pipeline.

### Siempre presentes
| Campo | Descripción | Dónde se usa |
|-------|-------------|--------------|
| `filename` | Nombre del archivo fuente | Header LLM, API response, dedup BM25 |
| `uploadDate` | Timestamp de subida | Almacenado (UI futura) |
| `chunk_index` | Índice secuencial en el documento | Logging/debug |
| `total_chunks` | Total de chunks del documento | Almacenado (UI futura) |

### Estructura jerárquica
| Campo | Descripción | Dónde se usa |
|-------|-------------|--------------|
| `section_path` | Ruta del heading: `H1 > H2 > H3` | Header LLM |

> Los headers individuales (`heading_h1/h2/h3`) se computan internamente para construir `section_path` pero **no se almacenan** en Qdrant.

### Tipo de contenido
| Campo | Descripción | Dónde se usa |
|-------|-------------|--------------|
| `content_type` | `text`, `code`, `table`, `list`, `mixed` | Header LLM (cuando es código) |

### Contexto técnico (solo si se detecta)
| Campo | Descripción | Dónde se usa |
|-------|-------------|--------------|
| `framework` | Framework detectado (Angular, React, Docker...) — requiere ≥2 keywords | Header LLM |
| `version` | Versión detectada (`18.2`, `1.2.3`) | Header LLM |

### Parent-Child
| Campo | Descripción | Dónde se usa |
|-------|-------------|--------------|
| `parent_child.parent_doc_id` | ID del padre | Hydration: hijos → padres |
| `parent_child.is_parent` | `true` padres / `false` hijos | Filtro BM25 + query hydration |
| `parent_child.child_index` | Índice del hijo dentro del padre | Almacenado |
| `parent_child.child_chunk_size` | Config usada al crear hijos | Almacenado |
| `parent_child.parent_chunk_size` | Config usada al crear padres | Almacenado |
| `parent_child.is_alignment_question` | `true` si es pregunta hipotética | Filtro BM25 |

---

## Header del Contexto Enviado al LLM

Cada documento llega al LLM con un encabezado que combina los campos disponibles:

```
[DOCUMENTO 1 | Fuente: 04-autenticacion-guards.md | Sección: Sesión Persistente | Framework: Angular | Lenguaje: typescript | Tipo: código]
```

Solo se incluyen los campos que existen (los opcionales se omiten si no se detectaron).

---

## Estructura Real en Qdrant

### Hijo (child)
```json
{
  "id": "uuid",
  "vector": [0.12, -0.45, ...],
  "payload": {
    "content": "## Performance Tips\n\nUsa memoization...",
    "metadata": {
      "filename": "02-gestion-estado-ngrx.md",
      "uploadDate": "2026-03-07T07:25:41.689Z",
      "chunk_index": 270,
      "total_chunks": 330,
      "section_path": "Performance Tips",
      "content_type": "text",
      "parent_child": {
        "parent_doc_id": "02-gestion-estado-ngrx.md_parent_27",
        "is_parent": false,
        "child_index": 0,
        "child_chunk_size": 128,
        "parent_chunk_size": 512
      }
    }
  }
}
```

### Padre (parent)
```json
{
  "id": "uuid",
  "vector": [0, 0, 0, ...],
  "payload": {
    "text": "## Sesión Persistente\n\n```typescript\n@Injectable...",
    "metadata": {
      "filename": "04-autenticacion-guards.md",
      "uploadDate": "2026-03-07T07:25:41.709Z",
      "chunk_index": 30,
      "total_chunks": 36,
      "section_path": "Sesión Persistente",
      "content_type": "mixed",
      "framework": "Angular",
      "parent_child": {
        "parent_doc_id": "04-autenticacion-guards.md_parent_30",
        "is_parent": true,
        "child_chunk_size": 128,
        "parent_chunk_size": 512
      }
    }
  }
}
```

> Los hijos usan el campo `content`, los padres usan `text`. Artefacto de cómo LangChain almacena `pageContent` vs cómo se insertan los padres manualmente vía Qdrant client.
