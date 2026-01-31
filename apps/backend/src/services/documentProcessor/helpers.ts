import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import { FILE_ENCODING, CHEERIO_SELECTORS, SUPPORTED_EXTENSIONS } from './config';
import type { MarkdownExtension, HtmlExtension } from './types';

export function getFileExtension(filename: string): string {
  return filename.toLowerCase().split('.').pop() || '';
}

export function isMarkdownFile(extension: string): extension is MarkdownExtension {
  return (SUPPORTED_EXTENSIONS.MARKDOWN as readonly string[]).includes(extension);
}

export function isHtmlFile(extension: string): extension is HtmlExtension {
  return (SUPPORTED_EXTENSIONS.HTML as readonly string[]).includes(extension);
}

export async function processHTML(filePath: string): Promise<string> {
  const html = await fs.readFile(filePath, FILE_ENCODING);
  const $ = cheerio.load(html);

  $(CHEERIO_SELECTORS.REMOVE).remove();

  return $(CHEERIO_SELECTORS.BODY).text().trim() || $.text().trim();
}

export async function processMarkdown(filePath: string): Promise<string> {
  return await fs.readFile(filePath, FILE_ENCODING);
}
