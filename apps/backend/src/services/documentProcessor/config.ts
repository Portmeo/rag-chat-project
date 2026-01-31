export const SUPPORTED_EXTENSIONS = {
  MARKDOWN: ['md', 'markdown'] as const,
  HTML: ['html', 'htm'] as const,
} as const;

export const FILE_ENCODING = 'utf-8' as const;

export const CHEERIO_SELECTORS = {
  REMOVE: 'script, style',
  BODY: 'body',
} as const;

export const ERROR_MESSAGES = {
  UNSUPPORTED_TYPE: (ext: string) =>
    `Unsupported file type: ${ext}. Only HTML and Markdown are supported.`,
} as const;
