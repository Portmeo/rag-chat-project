import { useState, useCallback } from 'react';
import { queryRAGStream } from '../services/streaming';

export function useStreamingRAG() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const streamQuery = useCallback(async (question: string): Promise<{ content: string; sources: any[] }> => {
    setIsStreaming(true);
    setStreamedContent('');
    setSources([]);
    setError(null);

    let accumulatedContent = '';
    let finalSources: any[] = [];

    try {
      await queryRAGStream(question, {
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
      });

      return { content: accumulatedContent, sources: finalSources };
    } catch (err: any) {
      setError(err.message);
      setIsStreaming(false);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setStreamedContent('');
    setSources([]);
    setError(null);
  }, []);

  return { isStreaming, streamedContent, sources, error, streamQuery, reset };
}
