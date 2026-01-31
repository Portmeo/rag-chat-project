import { useState, useEffect, useRef } from 'react';
import { useStreamingRAG } from '../hooks/useStreamingRAG';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { isStreaming, streamedContent, sources, streamQuery, reset } = useStreamingRAG();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamedContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);

    const questionText = input;
    setInput('');
    reset();

    try {
      const result = await streamQuery(questionText);

      const assistantMessage: Message = {
        role: 'assistant',
        content: result.content,
        sources: result.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${err.message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <div className="chat-interface">
      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>Upload documents and start asking questions</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="sources">
                  <strong>Sources:</strong>
                  <ul>
                    {Array.from(new Set(msg.sources.map((src) => src.filename))).map((filename, i) => (
                      <li key={i}>
                        <a
                          href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/documents/${encodeURIComponent(filename)}`}
                          download={filename}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          📄 {filename}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))
        )}
        {isStreaming && (
          <div className="message assistant streaming">
            <div className="message-content">
              {streamedContent || 'Thinking...'}
              <span className="streaming-indicator">▋</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your documents..."
          disabled={isStreaming}
        />
        <button type="submit" disabled={isStreaming || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
