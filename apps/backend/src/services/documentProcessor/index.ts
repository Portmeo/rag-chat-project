import { getFileExtension, isHtmlFile, isMarkdownFile, processHTML, processMarkdown } from './helpers';
import { ERROR_MESSAGES } from './config';

export async function processDocument(
  filePath: string,
  filename: string
): Promise<string> {
  const extension = getFileExtension(filename);

  if (isHtmlFile(extension)) {
    return await processHTML(filePath);
  }

  if (isMarkdownFile(extension)) {
    return await processMarkdown(filePath);
  }

  throw new Error(ERROR_MESSAGES.UNSUPPORTED_TYPE(extension));
}
