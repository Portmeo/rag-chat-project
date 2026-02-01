export interface StreamCallbacks {
  onToken: (chunk: string) => void;
  onSources: (sources: any[]) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export async function queryRAGStream(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  callbacks: StreamCallbacks
): Promise<void> {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const response = await fetch(`${API_URL}/api/chat/query-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      const eventMatch = line.match(/^event: (.+)$/m);
      const dataMatch = line.match(/^data: (.+)$/m);

      if (!eventMatch || !dataMatch) continue;

      const event = eventMatch[1];
      const data = JSON.parse(dataMatch[1]);

      switch (event) {
        case 'token':
          callbacks.onToken(data.chunk);
          break;
        case 'sources':
          callbacks.onSources(data.sources);
          break;
        case 'done':
          callbacks.onComplete();
          break;
        case 'error':
          callbacks.onError(data.error);
          break;
      }
    }
  }
}
