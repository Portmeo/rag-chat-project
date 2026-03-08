import type { TechnicalMetadata } from './types';

// ============================================================================
// DETECCIÓN DE HEADERS (solo para construir section_path)
// ============================================================================

function extractH1(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

function extractH2(content: string): string | undefined {
  const match = content.match(/^##\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

function extractH3(content: string): string | undefined {
  const match = content.match(/^###\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

function buildSectionPath(h1?: string, h2?: string, h3?: string): string | undefined {
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

    // Estructura del documento
    section_path: buildSectionPath(h1, h2, h3),

    // Tipo de contenido
    content_type: detectContentType(content),
  };
}
