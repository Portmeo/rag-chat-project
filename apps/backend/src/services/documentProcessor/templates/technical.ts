import type { TechnicalMetadata } from './types';

// ============================================================================
// DETECCIÓN DE HEADERS
// ============================================================================

export function extractH1(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

export function extractH2(content: string): string | undefined {
  const match = content.match(/^##\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

export function extractH3(content: string): string | undefined {
  const match = content.match(/^###\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

export function buildSectionPath(h1?: string, h2?: string, h3?: string): string | undefined {
  const parts = [h1, h2, h3].filter(Boolean);
  return parts.length > 0 ? parts.join(' > ') : undefined;
}

// ============================================================================
// DETECCIÓN DE TIPO DE CONTENIDO
// ============================================================================

export function detectContentType(content: string): TechnicalMetadata['content_type'] {
  const hasCodeBlock = /```[\s\S]*?```/.test(content);
  const hasInlineCode = /`[^`]+`/.test(content);
  const hasTable = /\|[\s\S]*?\|/.test(content);
  const hasList = /^[\s]*[-*+]\s/m.test(content) || /^\d+\.\s/m.test(content);

  if (hasCodeBlock) {
    return content.trim().startsWith('```') ? 'code' : 'mixed';
  }

  if (hasTable) return 'table';
  if (hasList) return 'list';
  if (hasInlineCode) return 'mixed';

  return 'text';
}

export function hasCode(content: string): boolean {
  return /```[\s\S]*?```/.test(content) || /`[^`]+`/.test(content);
}

export function hasLinks(content: string): boolean {
  return /\[.+?\]\(.+?\)/.test(content) || /https?:\/\//.test(content);
}

// ============================================================================
// DETECCIÓN DE LENGUAJE DE PROGRAMACIÓN
// ============================================================================

const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  javascript: [
    /```javascript/i,
    /```js/i,
    /\bconst\s+\w+\s*=/,
    /\blet\s+\w+\s*=/,
    /\bfunction\s+\w+\s*\(/,
    /=>\s*{/,
  ],
  typescript: [
    /```typescript/i,
    /```ts/i,
    /:\s*(string|number|boolean|any)\b/,
    /interface\s+\w+/,
    /type\s+\w+\s*=/,
  ],
  python: [
    /```python/i,
    /```py/i,
    /\bdef\s+\w+\s*\(/,
    /\bclass\s+\w+/,
    /\bimport\s+\w+/,
    /\bfrom\s+\w+\s+import/,
  ],
  java: [
    /```java/i,
    /\bpublic\s+class\s+\w+/,
    /\bprivate\s+\w+\s+\w+/,
    /\bSystem\.out\.println/,
  ],
  go: [/```go/i, /\bfunc\s+\w+\s*\(/, /package\s+\w+/, /import\s+\(/],
  rust: [/```rust/i, /\bfn\s+\w+\s*\(/, /\blet\s+mut\s+/, /impl\s+\w+/],
  sql: [/```sql/i, /\bSELECT\s+.*\s+FROM\b/i, /\bINSERT\s+INTO\b/i, /\bCREATE\s+TABLE\b/i],
  bash: [/```bash/i, /```shell/i, /```sh/i, /\$\s+\w+/, /\b(cd|ls|mkdir|rm)\s+/],
  html: [/```html/i, /<[a-z]+.*>.*<\/[a-z]+>/i, /<div/, /<span/],
  css: [/```css/i, /\.[a-z-]+\s*{/, /#[a-z-]+\s*{/, /[a-z-]+:\s*[^;]+;/],
};

export function detectLanguage(content: string): string | undefined {
  for (const [language, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return language;
      }
    }
  }
  return undefined;
}

// ============================================================================
// DETECCIÓN DE FRAMEWORKS Y LIBRERÍAS
// ============================================================================

const FRAMEWORK_KEYWORDS: Record<string, string[]> = {
  React: ['React', 'useState', 'useEffect', 'useContext', 'JSX', 'Component'],
  'Vue.js': ['Vue', 'v-if', 'v-for', 'v-model', 'computed', 'watch'],
  Angular: ['@Component', '@Injectable', 'ngOnInit', 'ngFor', 'ngIf'],
  'Next.js': ['Next', 'getServerSideProps', 'getStaticProps', 'next/'],
  Express: ['express', 'app.get', 'app.post', 'req.body', 'res.send'],
  Django: ['django', 'models.Model', 'views.py', 'urls.py'],
  Flask: ['Flask', '@app.route', 'render_template', 'request.form'],
  'Spring Boot': ['@SpringBootApplication', '@RestController', '@Autowired'],
  TensorFlow: ['tensorflow', 'tf.', 'keras', 'model.fit'],
  PyTorch: ['torch', 'nn.Module', 'torch.tensor'],
  Docker: ['FROM', 'RUN', 'COPY', 'CMD', 'EXPOSE', 'docker-compose'],
  Kubernetes: ['kubectl', 'deployment', 'service', 'pod', 'namespace'],
};

export function detectFramework(content: string): string | undefined {
  for (const [framework, keywords] of Object.entries(FRAMEWORK_KEYWORDS)) {
    const matches = keywords.filter((keyword) => content.includes(keyword));
    if (matches.length >= 2) {
      return framework;
    }
  }
  return undefined;
}

const LIBRARY_KEYWORDS: Record<string, string[]> = {
  LangChain: ['langchain', 'vectorstore', 'embeddings', 'retriever', 'chain'],
  Qdrant: ['qdrant', 'QdrantClient', 'collection'],
  Ollama: ['ollama', 'llama', 'mistral'],
  axios: ['axios.get', 'axios.post', 'axios'],
  lodash: ['_.map', '_.filter', 'lodash'],
  moment: ['moment()', 'moment.js'],
  'date-fns': ['date-fns', 'parseISO', 'format'],
};

export function detectLibrary(content: string): string | undefined {
  for (const [library, keywords] of Object.entries(LIBRARY_KEYWORDS)) {
    const matches = keywords.filter((keyword) => content.includes(keyword));
    if (matches.length >= 1) {
      return library;
    }
  }
  return undefined;
}

// ============================================================================
// DETECCIÓN DE VERSIÓN
// ============================================================================

export function detectVersion(content: string): string | undefined {
  // Buscar patrones como: v1.2.3, version 1.2.3, React 18.2, etc.
  const patterns = [
    /v?(\d+\.\d+\.\d+)/,
    /version\s+(\d+\.\d+)/i,
    /\b(React|Vue|Angular|Python|Node)\s+(\d+(\.\d+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1] || match[2];
    }
  }

  return undefined;
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE EXTRACCIÓN
// ============================================================================

export function extractTechnicalMetadata(
  content: string,
  filename: string,
  uploadDate: string,
  chunkIndex: number
): TechnicalMetadata {
  const h1 = extractH1(content);
  const h2 = extractH2(content);
  const h3 = extractH3(content);

  return {
    filename,
    uploadDate,
    chunk_index: chunkIndex,

    // Estructura
    heading_h1: h1,
    heading_h2: h2,
    heading_h3: h3,
    section_path: buildSectionPath(h1, h2, h3),

    // Tipo de contenido
    content_type: detectContentType(content),
    language: detectLanguage(content),

    // Características
    has_code: hasCode(content),
    has_links: hasLinks(content),
    word_count: content.split(/\s+/).length,

    // Contexto técnico
    framework: detectFramework(content),
    library: detectLibrary(content),
    version: detectVersion(content),
  };
}
