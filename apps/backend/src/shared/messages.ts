export const MESSAGES = {
  HEALTH_OK: 'Backend is running',
  DOCUMENT_SUCCESS: 'Document processed successfully',
  DOCUMENTS_CLEARED: 'All documents cleared successfully',
  DOCUMENT_DELETED: 'Document deleted successfully',
  NO_FILE: 'No file uploaded',
  QUESTION_REQUIRED: 'Question is required',
  ERROR_PROCESSING_DOC: 'Error processing document:',
  ERROR_GETTING_DOCS: 'Error getting documents:',
  ERROR_CLEARING_DOCS: 'Error clearing documents:',
  ERROR_DELETING_DOC: 'Error deleting document:',
} as const;

export const STATUS = {
  OK: 'ok',
  ERROR: 'error',
} as const;
