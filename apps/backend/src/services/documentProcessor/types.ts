import { SUPPORTED_EXTENSIONS } from './config';

export type MarkdownExtension = typeof SUPPORTED_EXTENSIONS.MARKDOWN[number];
export type HtmlExtension = typeof SUPPORTED_EXTENSIONS.HTML[number];
export type SupportedExtension = MarkdownExtension | HtmlExtension;
