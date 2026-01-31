import { useState } from 'react';
import { queryRAG } from '../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await queryRAG(input);
      const assistantMessage: Message = {
        role: 'assistant',
        content: result.answer,
        sources: result.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${err.message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
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
        {loading && (
          <div className="message assistant loading">
            <div className="message-content">Thinking...</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your documents..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
