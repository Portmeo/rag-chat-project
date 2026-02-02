# Procesamiento de Documentos y Sistema de Templates

Este documento explica en detalle cómo funciona el pipeline de ingesta de documentos, incluyendo el splitting inteligente, el sistema de templates para metadata y la generación de embeddings.

## 📋 Índice

1. [Flujo Completo](#flujo-completo)
2. [Text Splitting Inteligente](#text-splitting-inteligente)
3. [Sistema de Templates](#sistema-de-templates)
4. [Generación de Embeddings](#generación-de-embeddings)
5. [Almacenamiento en Qdrant](#almacenamiento-en-qdrant)
6. [Ejemplos Prácticos](#ejemplos-prácticos)

## Flujo Completo

```
archivo.md
    ↓
[1. Procesamiento Inicial]
    ↓
Texto extraído
    ↓
[2. Text Splitting Inteligente]
    ↓
Chunks (1000 chars, overlap 200)
    ↓
[3. Extracción de Metadata con Template]
    ↓
Chunks + Metadata estructurada
    ↓
[4. Generación de Embeddings]
    ↓
Vectores (1024 dims)
    ↓
[5. Almacenamiento en Qdrant]
    ↓
Vector Store + BM25 Cache
```

## Text Splitting Inteligente

### Configuración

```typescript
// apps/backend/src/services/rag/config.ts
export const CHUNK_CONFIG = {
  SIZE: 1000,      // Tamaño de cada chunk en caracteres
  OVERLAP: 200,    // Solapamiento entre chunks
}
```

**¿Por qué 200 de overlap?**
- Previene pérdida de contexto entre chunks
- Permite capturar oraciones que cruzan límites de chunks
- Mejora la recuperación cuando la información está fragmentada

### Splitters Especializados

El sistema usa diferentes splitters según el tipo de documento:

#### 1. MarkdownTextSplitter (para archivos .md, .markdown)

```typescript
// apps/backend/src/services/rag/helpers.ts:13-14
MarkdownTextSplitter.fromLanguage('markdown', {
  chunkSize: 1000,
  chunkOverlap: 200
})
```

**Ventajas:**
- ✅ Respeta la estructura de Markdown
- ✅ No rompe bloques de código
- ✅ Mantiene headers con su contenido
- ✅ Preserva tablas completas
- ✅ Respeta listas

**Jerarquía de separadores:**
```
1. Secciones    →  \n\n\n
2. Párrafos     →  \n\n
3. Líneas       →  \n
4. Oraciones    →  .
5. Palabras     →  (espacio)
6. Caracteres   →  (char por char)
```

#### 2. RecursiveCharacterTextSplitter (para HTML)

```typescript
// apps/backend/src/services/rag/helpers.ts:17-18
RecursiveCharacterTextSplitter.fromLanguage('html', {
  chunkSize: 1000,
  chunkOverlap: 200
})
```

**Proceso para HTML:**
1. Cheerio extrae texto limpio (sin tags)
2. Elimina scripts, styles, nav, footer
3. Aplica splitting inteligente respetando estructura

## Sistema de Templates

### ¿Qué es el Template Técnico?

Es una función que **analiza cada chunk** y extrae metadata estructurada de forma automática. Esto enriquece cada chunk con información semántica que mejora el retrieval.

**Ubicación:** `apps/backend/src/services/documentProcessor/templates/technical.ts`

### Metadata Extraída

```typescript
export interface TechnicalMetadata {
  // Información básica
  filename: string;
  uploadDate: string;
  chunk_index: number;
  total_chunks?: number;

  // Estructura del documento
  heading_h1?: string;
  heading_h2?: string;
  heading_h3?: string;
  section_path?: string;       // Ej: "Arquitectura > NgRx > Actions"

  // Tipo de contenido
  content_type?: 'text' | 'code' | 'table' | 'list' | 'mixed';
  language?: string;           // javascript, python, typescript, etc.

  // Características
  has_code?: boolean;
  has_links?: boolean;
  word_count?: number;

  // Contexto técnico (detectado automáticamente)
  framework?: string;          // React, Angular, Django, etc.
  library?: string;            // LangChain, Qdrant, axios, etc.
  version?: string;            // v1.2.3, React 18.2, etc.
}
```

### Detección Automática

#### 1. Estructura del Documento

```typescript
// Extrae headers de Markdown
extractH1(content)  // Busca: /^# (.+)$/m
extractH2(content)  // Busca: /^## (.+)$/m
extractH3(content)  // Busca: /^### (.+)$/m

// Construye ruta jerárquica
buildSectionPath(h1, h2, h3)
// → "Arquitectura > State Management > NgRx Store"
```

**Ejemplo:**
```markdown
# Arquitectura del Sistema

## State Management

### NgRx Store

El NgRx Store es...
```

**Metadata generada:**
```json
{
  "heading_h1": "Arquitectura del Sistema",
  "heading_h2": "State Management",
  "heading_h3": "NgRx Store",
  "section_path": "Arquitectura del Sistema > State Management > NgRx Store"
}
```

#### 2. Tipo de Contenido

```typescript
function detectContentType(content: string): ContentType {
  const hasCodeBlock = /```[\s\S]*?```/.test(content);
  const hasInlineCode = /`[^`]+`/.test(content);
  const hasTable = /\|[\s\S]*?\|/.test(content);
  const hasList = /^[\s]*[-*+]\s/m.test(content);

  if (hasCodeBlock) return 'code' | 'mixed';
  if (hasTable) return 'table';
  if (hasList) return 'list';
  if (hasInlineCode) return 'mixed';
  return 'text';
}
```

#### 3. Lenguaje de Programación

Detecta por patrones de código:

```typescript
const LANGUAGE_PATTERNS = {
  javascript: [/```javascript/i, /\bconst\s+\w+\s*=/, /function\s+\w+/],
  typescript: [/```typescript/i, /:\s*(string|number|boolean)/, /interface\s+\w+/],
  python: [/```python/i, /\bdef\s+\w+\(/, /\bclass\s+\w+/],
  java: [/```java/i, /\bpublic\s+class/, /System\.out\.println/],
  // ... más lenguajes
}
```

#### 4. Framework y Librerías

Detecta por keywords (necesita ≥2 matches para frameworks, ≥1 para librerías):

```typescript
const FRAMEWORK_KEYWORDS = {
  React: ['React', 'useState', 'useEffect', 'useContext', 'JSX', 'Component'],
  Angular: ['@Component', '@Injectable', 'ngOnInit', 'ngFor', 'ngIf'],
  Vue: ['Vue', 'v-if', 'v-for', 'v-model', 'computed', 'watch'],
  Express: ['express', 'app.get', 'app.post', 'req.body', 'res.send'],
  Django: ['django', 'models.Model', 'views.py', 'urls.py'],
  // ... más frameworks
}

const LIBRARY_KEYWORDS = {
  LangChain: ['langchain', 'vectorstore', 'embeddings', 'retriever', 'chain'],
  Qdrant: ['qdrant', 'QdrantClient', 'collection'],
  Ollama: ['ollama', 'llama', 'mistral'],
  // ... más librerías
}
```

### Aplicación del Template

```typescript
// apps/backend/src/services/rag/index.ts:51-58
const docs: Document[] = chunks.map((chunk, index) => {
  const metadata = extractTechnicalMetadata(
    chunk,      // Contenido del chunk
    filename,   // Nombre del archivo
    uploadDate, // Fecha de subida
    index       // Índice del chunk
  );

  metadata.total_chunks = chunks.length;

  return {
    pageContent: chunk,
    metadata,
  };
});
```

## Generación de Embeddings

### Configuración con Prefijos

```typescript
// apps/backend/src/services/rag/config.ts:62-78
export const EMBEDDINGS_CONFIG = {
  enabled: true,  // USE_INSTRUCTION_PREFIX=true
  queryPrefix: 'Represent this sentence for searching relevant passages: ',
  documentPrefix: '',  // Vacío por defecto
}
```

### ¿Por qué usar prefijos?

**Mejora del +3.7% MRR** según benchmarks propios.

El modelo `mxbai-embed-large` fue entrenado con instruction prefixes. Usar el prefijo correcto:
- ✅ Mejora la calidad del embedding
- ✅ Diferencia queries de documentos
- ✅ Optimiza el similarity search

**Ejemplo:**

```python
# SIN prefix
query_embedding = embed("¿Qué es NgRx?")

# CON prefix
query_embedding = embed(
  "Represent this sentence for searching relevant passages: ¿Qué es NgRx?"
)
```

### Modelo de Embeddings

```typescript
// apps/backend/src/services/rag/config.ts:69-78
const embeddings = new InstructionPrefixedEmbeddings({
  model: 'mxbai-embed-large',      // 1024 dimensiones
  baseUrl: 'http://localhost:11434',
  queryPrefix: EMBEDDINGS_CONFIG.queryPrefix,
  documentPrefix: EMBEDDINGS_CONFIG.documentPrefix,
});
```

**Características:**
- **Dimensiones:** 1024
- **Contexto:** 512 tokens
- **Idioma:** Multilingüe (optimizado español)
- **Rendimiento:** MRR 0.875, Recall@5 94%

Ver `apps/backend/src/services/rag/instructionPrefixedEmbeddings.ts` para implementación.

## Almacenamiento en Qdrant

### Estructura de Puntos

Cada chunk se almacena como un punto en Qdrant:

```json
{
  "id": "uuid-auto-generado",
  "vector": [0.123, -0.456, 0.789, ...],  // 1024 dimensiones
  "payload": {
    "text": "Contenido completo del chunk...",
    "metadata": {
      "filename": "arquitectura.md",
      "uploadDate": "2024-02-01T10:30:00.000Z",
      "chunk_index": 5,
      "total_chunks": 23,
      "heading_h1": "Arquitectura del Sistema",
      "heading_h2": "State Management",
      "heading_h3": "NgRx Store",
      "section_path": "Arquitectura del Sistema > State Management > NgRx Store",
      "content_type": "code",
      "language": "typescript",
      "framework": "Angular",
      "library": "NgRx",
      "has_code": true,
      "has_links": false,
      "word_count": 234
    }
  }
}
```

### Proceso de Inserción

```typescript
// apps/backend/src/services/rag/index.ts:61-64
await QdrantVectorStore.fromDocuments(
  docs,        // Array de Document[] con pageContent + metadata
  embeddings,  // InstructionPrefixedEmbeddings
  {
    client: qdrantClient,
    collectionName: 'documents',
  }
);
```

**Flujo interno:**
1. LangChain genera embeddings para cada chunk
2. Aplica query/document prefix según configuración
3. Crea puntos en Qdrant con vector + payload
4. Rebuild de BM25 cache automático

### Configuración de Colección

```bash
# .env
QDRANT_COLLECTION_NAME=documents
QDRANT_VECTOR_DIMENSION=1024
QDRANT_DISTANCE_METRIC=Cosine  # Cosine similarity
```

## Ejemplos Prácticos

### Ejemplo 1: Documento de React

**Input: `react-hooks.md`**
```markdown
# React Hooks

## useState Hook

El hook useState permite usar estado en componentes funcionales:

```javascript
const [count, setCount] = useState(0);
```
```

**Output: Chunks generados**

```json
[
  {
    "pageContent": "# React Hooks\n\n## useState Hook\n\nEl hook useState permite usar estado en componentes funcionales:\n\n```javascript\nconst [count, setCount] = useState(0);\n```",
    "metadata": {
      "filename": "react-hooks.md",
      "chunk_index": 0,
      "total_chunks": 1,
      "heading_h1": "React Hooks",
      "heading_h2": "useState Hook",
      "section_path": "React Hooks > useState Hook",
      "content_type": "code",
      "language": "javascript",
      "framework": "React",
      "has_code": true,
      "has_links": false,
      "word_count": 18
    }
  }
]
```

### Ejemplo 2: Documento Largo con Overlap

**Input: Documento de 2500 caracteres**

```
Configuración:
- CHUNK_SIZE=1000
- CHUNK_OVERLAP=200
```

**Chunks generados:**

```
Chunk 0: chars 0-1000
Chunk 1: chars 800-1800    (overlap de 200 con chunk 0)
Chunk 2: chars 1600-2500   (overlap de 200 con chunk 1)
```

**Ventaja:** Si una información importante está en chars 950-1050, estará completa en chunk 1.

### Ejemplo 3: Detección de Múltiples Tecnologías

**Input:**
```markdown
# Arquitectura Backend

Usamos Express.js con TypeScript y Qdrant para el vector store.
LangChain maneja el RAG pipeline.

```typescript
const vectorStore = await QdrantVectorStore.fromDocuments(
  docs,
  embeddings
);
```
```

**Metadata generada:**
```json
{
  "content_type": "code",
  "language": "typescript",
  "framework": "Express",
  "library": "LangChain",  // También detectaría Qdrant
  "has_code": true
}
```

## Configuración Avanzada

### Variables de Entorno

```bash
# Document Processing
CHUNK_SIZE=1000                    # Tamaño de chunk
CHUNK_OVERLAP=200                  # Overlap entre chunks

# Embeddings
USE_INSTRUCTION_PREFIX=true        # Usar prefijos (+3.7% MRR)
EMBEDDING_QUERY_PREFIX=Represent this sentence for searching relevant passages:
EMBEDDING_DOCUMENT_PREFIX=         # Vacío por defecto

# Ollama
OLLAMA_EMBEDDINGS_MODEL=mxbai-embed-large  # Modelo de embeddings
```

### Ajustar Chunk Size

**Para documentos técnicos con código:**
- ✅ **CHUNK_SIZE=1000** (recomendado)
- ✅ **CHUNK_OVERLAP=200** (20%)

**Para documentos narrativos:**
- Podrías usar CHUNK_SIZE=1500, OVERLAP=300

**Para documentos muy estructurados (APIs):**
- Podrías usar CHUNK_SIZE=500, OVERLAP=100

**Trade-offs:**
- ⬆️ Chunk más grande: Más contexto, pero menos precisión
- ⬇️ Chunk más pequeño: Más precisión, pero fragmentación
- ⬆️ Overlap más alto: Mejor continuidad, pero más chunks duplicados

## Troubleshooting

### 1. Metadata no se extrae correctamente

**Problema:** `framework: undefined` en chunks que claramente usan React

**Solución:**
- Verifica que el contenido tenga ≥2 keywords del framework
- Añade más keywords en `templates/technical.ts`:
```typescript
const FRAMEWORK_KEYWORDS = {
  React: ['React', 'useState', 'useEffect', 'useContext', 'JSX', 'Component', 'ReactDOM'],
  // Añadir más keywords específicos
}
```

### 2. Chunks muy pequeños o muy grandes

**Problema:** Algunos chunks tienen 100 chars, otros 1500

**Causa:** MarkdownTextSplitter respeta estructura, puede generar chunks irregulares

**Solución:**
- Ajusta `CHUNK_SIZE` según tus documentos
- Considera usar `RecursiveCharacterTextSplitter` para más consistencia

### 3. Prefijos no mejoran rendimiento

**Problema:** No ves mejora con `USE_INSTRUCTION_PREFIX=true`

**Posibles causas:**
- Modelo de embeddings no soporta prefijos (solo funciona con mxbai-embed-large)
- Prefix incorrecto para el modelo
- Dataset demasiado pequeño para medir diferencia

**Solución:**
- Verifica que usas `mxbai-embed-large`
- Ejecuta benchmarks con/sin prefix: `npx tsx benchmark/evaluation/run_ragas_eval.ts`

## Referencias

- **Código fuente:**
  - `apps/backend/src/services/documentProcessor/` - Procesamiento de documentos
  - `apps/backend/src/services/documentProcessor/templates/` - Sistema de templates
  - `apps/backend/src/services/rag/index.ts` - Pipeline de ingesta
  - `apps/backend/src/services/rag/helpers.ts` - Text splitting
  - `apps/backend/src/services/rag/instructionPrefixedEmbeddings.ts` - Embeddings con prefijos

- **Documentación relacionada:**
  - [RAG_SYSTEM_GUIDE.md](RAG_SYSTEM_GUIDE.md) - Guía conceptual del RAG
  - [BM25_CONFIGURATION.md](BM25_CONFIGURATION.md) - Búsqueda híbrida
  - [RERANKING_SYSTEM.md](RERANKING_SYSTEM.md) - Sistema de reranking

- **LangChain:**
  - [Text Splitters](https://js.langchain.com/docs/modules/data_connection/document_transformers/)
  - [MarkdownTextSplitter](https://js.langchain.com/docs/modules/data_connection/document_transformers/markdown)
