import { useState, useEffect, useRef } from 'react';
import { useStreamingRAG } from '@/hooks/useStreamingRAG';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Send, FileText, Square, Trash2, Copy, Check, ArrowDown, Filter, X } from 'lucide-react';
import WelcomeMessage from '@/components/WelcomeMessage';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getCategories, type Category } from '@/services/api';

interface Source {
  filename: string;
  [key: string]: unknown;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 rounded-md bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity border border-border hover:bg-accent"
        title="Copy code"
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </button>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedFilenames, setSelectedFilenames] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const { isStreaming, streamedContent, streamQuery, stopStreaming, reset } = useStreamingRAG();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  const MarkdownComponents = {
    code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
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
        <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const threshold = 100; // pixels from bottom
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
    setShowScrollButton(!isNearBottom);
  };

  useEffect(() => {
    // Auto-scroll only if user is near bottom (not manually scrolled up)
    if (!showScrollButton || isStreaming) {
      scrollToBottom('auto');
    }
  }, [messages, streamedContent, showScrollButton, isStreaming]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: Clear chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (messages.length > 0 && !isStreaming) {
          setShowClearDialog(true);
        }
      }

      // Escape: Stop streaming or close dialogs
      if (e.key === 'Escape') {
        if (isStreaming) {
          stopStreaming();
        } else if (showClearDialog) {
          setShowClearDialog(false);
        }
      }

      // Ctrl/Cmd + L: Focus input
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [messages.length, isStreaming, showClearDialog, stopStreaming]);

  const toggleCategory = (filename: string) => {
    setSelectedFilenames(prev =>
      prev.includes(filename)
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  };

  const filenameFilter = selectedFilenames.length > 0 ? selectedFilenames : undefined;

  const handleClearChat = () => {
    setMessages([]);
    setShowClearDialog(false);
    toast.success('Chat cleared', {
      description: 'Conversation history has been reset',
    });
  };

  const handleSendFromWelcome = async (question: string, welcomeFilter?: string[]) => {
    const filter = welcomeFilter || filenameFilter;
    const userMessage: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);
    reset();
    setIsThinking(true);
    try {
      const result = await streamQuery(question, [], filter);
      setIsThinking(false);
      const assistantMessage: Message = {
        role: 'assistant',
        content: result.content,
        sources: result.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setIsThinking(false);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'An unknown error occurred'}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);

    const questionText = input;
    setInput('');
    reset();

    // Show thinking indicator
    setIsThinking(true);

    try {
      // Construir historial (excluyendo el mensaje actual)
      const history = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Enviar pregunta con historial y filtro de categorías
      const result = await streamQuery(questionText, history, filenameFilter);

      // Hide thinking when streaming completes
      setIsThinking(false);

      const assistantMessage: Message = {
        role: 'assistant',
        content: result.content,
        sources: result.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setIsThinking(false);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'An unknown error occurred'}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4"
      >
        <div className="space-y-4">
          {messages.length === 0 ? (
            <WelcomeMessage onSendQuestion={handleSendFromWelcome} />
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'user' ? (
                  <Card className="max-w-[85%] bg-primary text-primary-foreground">
                    <CardContent>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="max-w-[85%]">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={RegularMarkdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border">
                        <p className="text-sm font-semibold mb-2">Sources:</p>
                        <div className="flex flex-wrap gap-2">
                          {Array.from(new Set(msg.sources.map((src) => src.filename))).map((filename, i) => (
                            <a
                              key={i}
                              href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/documents/${encodeURIComponent(filename)}`}
                              download={filename}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                                <FileText className="h-3 w-3 mr-1" />
                                {filename}
                              </Badge>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {isThinking && !isStreaming && (
            <div className="flex items-center gap-2 p-4 bg-card rounded-lg border">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-muted-foreground">Claude is thinking...</span>
            </div>
          )}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%]">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                    {`${streamedContent || 'Thinking...'}`}
                  </ReactMarkdown>
                  <span
                    className="inline-block w-0.5 h-4 bg-current ml-1 align-middle"
                    style={{ animation: 'blink 1s infinite' }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          onClick={() => scrollToBottom()}
          size="icon"
          className="fixed bottom-24 right-8 rounded-full shadow-lg z-10"
          variant="secondary"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}

      <div className="p-4 border-t bg-background space-y-2">
        {categories.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Filter className="h-3 w-3" />
              Filter by category
              {selectedFilenames.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {selectedFilenames.length}
                </Badge>
              )}
            </button>
            {showFilters && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => {
                  const isSelected = selectedFilenames.includes(cat.filename);
                  return (
                    <button
                      key={cat.filename}
                      type="button"
                      onClick={() => toggleCategory(cat.filename)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground'
                      )}
                    >
                      {cat.name}
                      {isSelected && <X className="h-3 w-3" />}
                    </button>
                  );
                })}
                {selectedFilenames.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFilenames([])}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            placeholder="Ask a question about your documents..."
            disabled={isStreaming}
            className="flex-1 min-h-[60px] max-h-[200px]"
          />
          <div className="flex flex-col gap-2">
            {isStreaming ? (
              <Button type="button" onClick={stopStreaming} variant="destructive" size="icon">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowClearDialog(true)}
              disabled={messages.length === 0 || isStreaming}
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line, Ctrl+K to clear, Esc to stop
        </p>
      </div>

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Chat History</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all messages? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearChat}>
              Clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
