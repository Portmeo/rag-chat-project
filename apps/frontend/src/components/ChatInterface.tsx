import { useState, useEffect, useRef } from 'react';
import { useStreamingRAG } from '../hooks/useStreamingRAG';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Source {
  filename: string;
  [key: string]: unknown;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { isStreaming, streamedContent, streamQuery, reset } = useStreamingRAG();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const MarkdownComponents = {
    code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    p({ children }: { children?: React.ReactNode }) {
      return <span style={{ display: 'inline' }}>{children}</span>;
    },
  };

  const RegularMarkdownComponents = {
    code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

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
    } catch (err) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'An unknown error occurred'}`,
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
              <div className="message-content">
                {msg.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={RegularMarkdownComponents}>
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
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
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                {`${streamedContent || 'Thinking...'}`}
              </ReactMarkdown>
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
