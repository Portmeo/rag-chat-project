import { useState, useCallback, useRef } from 'react';
import { queryRAGStream } from '../services/streaming';

export function useStreamingRAG() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamQuery = useCallback(async (
    question: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<{ content: string; sources: any[] }> => {
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    setIsStreaming(true);
    setStreamedContent('');
    setSources([]);
    setError(null);

    let accumulatedContent = '';
    let finalSources: any[] = [];

    try {
      await queryRAGStream(question, history, {
        onToken: (chunk) => {
          accumulatedContent += chunk;
          setStreamedContent(accumulatedContent);
        },
        onSources: (newSources) => {
          finalSources = newSources;
          setSources(newSources);
        },
        onComplete: () => setIsStreaming(false),
        onError: (errorMsg) => {
          setError(errorMsg);
          setIsStreaming(false);
        },
      }, abortControllerRef.current.signal);

      return { content: accumulatedContent, sources: finalSources };
    } catch (err: any) {
      setError(err.message);
      setIsStreaming(false);
      throw err;
    }
  }, []);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  const reset = useCallback(() => {
    setStreamedContent('');
    setSources([]);
    setError(null);
  }, []);

  return { isStreaming, streamedContent, sources, error, streamQuery, stopStreaming, reset };
}
