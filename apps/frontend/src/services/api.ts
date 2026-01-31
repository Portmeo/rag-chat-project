const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/api/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  return response.json();
}

export async function queryRAG(question: string) {
  const response = await fetch(`${API_URL}/api/chat/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Query failed');
  }

  return response.json();
}

export async function getDocuments() {
  const response = await fetch(`${API_URL}/api/documents`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch documents');
  }

  return response.json();
}

export async function clearDocuments() {
  const response = await fetch(`${API_URL}/api/documents`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to clear documents');
  }

  return response.json();
}
