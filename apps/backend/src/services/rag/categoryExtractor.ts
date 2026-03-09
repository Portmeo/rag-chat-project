/**
 * Extracts a human-readable category name from a filename.
 *
 * Examples:
 *   "07-ci-cd-deployment.md"        → "CI CD Deployment"
 *   "01-arquitectura-general.md"    → "Arquitectura General"
 *   "my-document.txt"               → "My Document"
 *   "report_2024.pdf"               → "Report 2024"
 */
export function extractCategoryFromFilename(filename: string): string {
  return filename
    // Remove extension
    .replace(/\.[^.]+$/, '')
    // Remove leading numbers and separator (e.g., "07-", "01_")
    .replace(/^\d+[-_]\s*/, '')
    // Replace separators with spaces
    .replace(/[-_]+/g, ' ')
    // Capitalize first letter of each word
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}
