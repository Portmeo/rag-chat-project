# 📄 Explicación del Sistema de Chunking

## 🎯 Flujo Completo: De Documento a Vector

```
Archivo .md
    ↓
processDocument() → Convierte a texto plano
    ↓
addDocumentToVectorStore()
    ↓
MarkdownTextSplitter → Divide en chunks
    ↓
extractTechnicalMetadata() → Añade metadata a cada chunk
    ↓
embeddings.embedDocuments() → Convierte a vectores
    ↓
Qdrant → Almacena vectores + metadata
```

---

## 1️⃣ Estrategia de Chunking para Markdown

### Código Clave (helpers.ts)

```typescript
export function createTextSplitter(extension: string) {
  const baseConfig = {
    chunkSize: CHUNK_CONFIG.SIZE,        // 1000 caracteres
    chunkOverlap: CHUNK_CONFIG.OVERLAP,  // 200 caracteres
  };

  if (isMarkdownFile(extension)) {
    // ESPECIALIZADO PARA MARKDOWN
    return MarkdownTextSplitter.fromLanguage('markdown', baseConfig);
  }

  // Para otros archivos: RecursiveCharacterTextSplitter
}
```

### ¿Cómo funciona MarkdownTextSplitter?

**El MarkdownTextSplitter de LangChain usa separadores jerárquicos:**

```markdown
Prioridad de separación (de mayor a menor):

1. "\n## "     → Nivel H2 (secciones principales)
2. "\n### "    → Nivel H3 (subsecciones)
3. "\n#### "   → Nivel H4
4. "\n\n"      → Párrafos
5. "\n"        → Líneas
6. " "         → Palabras
7. ""          → Caracteres (último recurso)
```

**Algoritmo:**
1. Intenta dividir por H2 primero
2. Si el chunk es > 1000 chars, divide por H3
3. Si aún es grande, divide por párrafos
4. Y así sucesivamente...

**Resultado:** Chunks que respetan la estructura semántica del documento

---

## 2️⃣ Configuración de Chunking

### Variables de Entorno

```bash
# .env
CHUNK_SIZE=1000        # Tamaño máximo del chunk
CHUNK_OVERLAP=200      # Overlap entre chunks consecutivos
```

### ¿Por qué overlap de 200?

```
Chunk 1: [caracteres 0-1000]
           └─ overlap 200 ─┐
Chunk 2:              [800-1800]
                       └─ overlap 200 ─┐
Chunk 3:                          [1600-2600]
```

**Ventaja:** Evita perder contexto en los bordes. Si una frase importante está en el límite del chunk, aparecerá completa en el chunk siguiente.

---

## 3️⃣ Extracción de Metadata (technical.ts)

### Para CADA chunk, se extrae:

```typescript
{
  // 🗂️ Estructura del documento
  heading_h1: "Gestión de Estado con NgRx",
  heading_h2: "Introducción",
  heading_h3: "¿Por qué NgRx?",
  section_path: "Gestión de Estado con NgRx > Introducción > ¿Por qué NgRx?",

  // 📝 Tipo de contenido
  content_type: "list",        // text | code | list | table | mixed
  language: "typescript",      // Si tiene código

  // 🔍 Características
  has_code: true,
  has_links: false,
  word_count: 74,

  // 🛠️ Contexto técnico
  framework: "Angular",
  library: "NgRx",
  version: "15.4.0",

  // 📊 Tracking
  filename: "02-gestion-estado-ngrx.md",
  chunk_index: 0,
  total_chunks: 25,
  uploadDate: "2026-01-31T10:20:45.143Z"
}
```

### Funciones de Detección

#### 1. Headers (h1, h2, h3)
```typescript
export function extractH1(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}
// Mismo patrón para h2 (##) y h3 (###)
```

#### 2. Tipo de Contenido
```typescript
export function detectContentType(content: string) {
  const hasCodeBlock = /```[\s\S]*?```/.test(content);
  const hasTable = /\|[\s\S]*?\|/.test(content);
  const hasList = /^[\s]*[-*+]\s/m.test(content);

  if (hasCodeBlock) return content.startsWith('```') ? 'code' : 'mixed';
  if (hasTable) return 'table';
  if (hasList) return 'list';
  return 'text';
}
```

#### 3. Lenguaje de Programación
```typescript
const LANGUAGE_PATTERNS = {
  typescript: [
    /```typescript/i,
    /:\s*(string|number|boolean)/,
    /interface\s+\w+/,
  ],
  javascript: [
    /```javascript/i,
    /\bconst\s+\w+\s*=/,
    /=>\s*{/,
  ],
  // ... más lenguajes
}

export function detectLanguage(content: string) {
  for (const [language, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) return language;
    }
  }
}
```

#### 4. Framework/Librería
```typescript
const FRAMEWORK_KEYWORDS = {
  React: ['React', 'useState', 'useEffect', 'Component'],
  Angular: ['@Component', '@Injectable', 'ngOnInit'],
  'Next.js': ['getServerSideProps', 'getStaticProps'],
  // ... más frameworks
}

export function detectFramework(content: string) {
  for (const [framework, keywords] of Object.entries(FRAMEWORK_KEYWORDS)) {
    const matches = keywords.filter(kw => content.includes(kw));
    if (matches.length >= 2) return framework;  // Requiere 2+ keywords
  }
}
```

#### 5. Versión
```typescript
export function detectVersion(content: string) {
  const patterns = [
    /v?(\d+\.\d+\.\d+)/,              // v1.2.3
    /version\s+(\d+\.\d+)/i,          // version 1.2
    /\b(React|Vue|Angular)\s+(\d+)/i  // Angular 15
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1] || match[2];
  }
}
```

---

## 4️⃣ Ejemplo Real: Chunking de 02-gestion-estado-ngrx.md

### Documento Original (13 KB)

```markdown
# Gestión de Estado con NgRx

## Introducción

### ¿Por qué NgRx?

- **Estado Centralizado:** Una única fuente de verdad
- **Flujo Unidireccional:** Predecible y fácil de debuggear
- **Trazabilidad:** Historial completo de cambios

### Versión Utilizada

- NgRx: `^15.4.0`

## Conceptos Clave

### Store
[... continúa ...]
```

### Resultado del Chunking: 25 chunks

**Chunk 0:**
```
Contenido:
  # Gestión de Estado con NgRx
  ## Introducción
  ### ¿Por qué NgRx?
  - **Estado Centralizado:** Una única fuente de verdad
  ...

Metadata:
  heading_h1: "Gestión de Estado con NgRx"
  heading_h2: "Introducción"
  heading_h3: "¿Por qué NgRx?"
  section_path: "Gestión de Estado con NgRx > Introducción > ¿Por qué NgRx?"
  content_type: "list"
  library: "NgRx"
  version: "15.4.0"
  chunk_index: 0
  total_chunks: 25
```

**Chunk 1:**
```
Contenido:
  ### Versión Utilizada
  - NgRx: `^15.4.0`

  ## Conceptos Clave
  ### Store
  [...]

Metadata:
  heading_h1: "Gestión de Estado con NgRx"
  heading_h2: "Conceptos Clave"
  heading_h3: "Store"
  section_path: "Gestión de Estado con NgRx > Conceptos Clave > Store"
  content_type: "mixed"
  has_code: true
  chunk_index: 1
  total_chunks: 25
```

---

## 5️⃣ Ventajas de Este Sistema

### ✅ Chunking Inteligente
- **Respeta estructura semántica:** No corta en medio de una sección
- **Mantiene contexto:** Headers preservados en metadata
- **Overlap:** Evita perder información en bordes

### ✅ Metadata Rica
- **Búsqueda por estructura:** "documentos de la sección Introducción"
- **Filtrado por tipo:** "solo chunks con código TypeScript"
- **Tracking:** Saber qué chunk de qué documento

### ✅ Mejora el Retrieval
```
Query: "¿Por qué se usa NgRx?"

Retrieval busca:
1. Vector similarity (embeddings)
2. Metadata match: section_path contains "¿Por qué NgRx?"
3. Metadata match: library = "NgRx"

Resultado: Mayor precisión
```

---

## 6️⃣ Configuración Recomendada

### Para documentación técnica (tu caso)

```bash
CHUNK_SIZE=1000      # Bueno para secciones coherentes
CHUNK_OVERLAP=200    # 20% overlap preserva contexto
```

### ¿Cuándo ajustar?

**Aumentar CHUNK_SIZE a 1500-2000:**
- Documentos con explicaciones largas
- Necesitas más contexto por chunk
- Trade-off: Chunks menos precisos

**Reducir CHUNK_SIZE a 500-750:**
- Documentos muy densos
- Quieres chunks muy específicos
- Trade-off: Puede fragmentar demasiado

**Aumentar OVERLAP a 300-400:**
- Documentos donde el contexto entre secciones es crítico
- Trade-off: Más tokens procesados, más costo

---

## 7️⃣ Flujo Completo Resumido

```
1. Usuario sube: 02-gestion-estado-ngrx.md (13 KB)
   ↓
2. processDocument() → Convierte a texto plano
   ↓
3. MarkdownTextSplitter
   - chunkSize: 1000
   - chunkOverlap: 200
   - Separadores: ## > ### > \n\n > \n
   ↓
4. Resultado: 25 chunks
   ↓
5. Para cada chunk:
   - extractTechnicalMetadata()
     • h1, h2, h3
     • content_type, language
     • framework, library, version
   ↓
6. embeddings.embedDocuments()
   - Con prefijos asimétricos si enabled
   - Sin prefijo para documentos
   ↓
7. Qdrant almacena:
   - Vector (1024 dims con mxbai-embed-large)
   - Metadata completa
   - pageContent (texto del chunk)
```

---

## 🎯 Resultado Final

**De este documento:**
```
02-gestion-estado-ngrx.md (13 KB)
```

**Obtienes en Qdrant:**
```
25 puntos vectoriales, cada uno con:
  - Vector embedding (1024 dimensiones)
  - pageContent (texto del chunk ~1000 chars)
  - 15+ campos de metadata
```

**Y puedes buscar:**
```typescript
// Por similitud semántica
"¿Qué es el Store en NgRx?"

// Por metadata
filter: { library: "NgRx", content_type: "code" }

// Combinado (híbrido)
"ejemplos de código NgRx" + filter: { has_code: true }
```

---

## 📚 Archivos Clave

```
apps/backend/src/services/rag/
├── helpers.ts                    # createTextSplitter()
├── index.ts                      # addDocumentToVectorStore()
└── config.ts                     # CHUNK_CONFIG

apps/backend/src/services/documentProcessor/
├── templates/technical.ts        # extractTechnicalMetadata()
└── helpers.ts                    # processMarkdown()
```

---

**🎉 Sistema de chunking completo, semánticamente aware y rico en metadata!**
