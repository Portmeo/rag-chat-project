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

export async function uploadDocumentWithProgress(
  file: File,
  onProgress: (progress: number) => void
): Promise<{ filename: string; chunksCount: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        resolve(response);
      } else {
        const error = JSON.parse(xhr.responseText);
        reject(new Error(error.error || 'Upload failed'));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.open('POST', `${API_URL}/api/documents/upload`);
    xhr.send(formData);
  });
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

export async function deleteDocument(filename: string) {
  const response = await fetch(`${API_URL}/api/documents/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete document');
  }

  return response.json();
}

export async function optimizeAllDocuments() {
  const response = await fetch(`${API_URL}/api/documents/optimize-all`, { method: 'POST' });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start optimization');
  }
  return response.json();
}

export async function optimizeDocument(filename: string) {
  const response = await fetch(`${API_URL}/api/documents/${encodeURIComponent(filename)}/optimize`, { method: 'POST' });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start optimization');
  }
  return response.json();
}

export async function clearOptimization() {
  const response = await fetch(`${API_URL}/api/documents/optimization`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to clear optimization');
  }
  return response.json();
}

export async function clearDocumentOptimization(filename: string) {
  const response = await fetch(`${API_URL}/api/documents/${encodeURIComponent(filename)}/optimization`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to clear optimization');
  }
  return response.json();
}

export interface Category {
  name: string;
  filename: string;
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${API_URL}/api/chat/categories`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch categories');
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
