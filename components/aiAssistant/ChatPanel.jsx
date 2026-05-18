import { useState, useRef, useEffect } from 'react';
import { X, Send, Trash2, Bot, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage from './ChatMessage';
import ToolCallIndicator from './ToolCallIndicator';
import useWsinfoStore from '@/stores/wsinfo';
import { v4 as uuidv4 } from 'uuid';

export default function ChatPanel({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [authStatus, setAuthStatus] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [sessionId] = useState(() => `app-${uuidv4()}`);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const scrollEl = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
    }
  }, [messages, activeTool]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    if (open && typeof window !== 'undefined' && window.electronAPI?.openAIAuthStatus) {
      window.electronAPI.openAIAuthStatus().then(setAuthStatus).catch(() => setAuthStatus(null));
    }
  }, [open]);

  const signInWithOpenAI = async () => {
    if (authBusy || typeof window === 'undefined' || !window.electronAPI?.openAIAuthLogin) return;
    setAuthBusy(true);
    try {
      const status = await window.electronAPI.openAIAuthLogin();
      setAuthStatus(status);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `OpenAI sign-in failed: ${error.message || error}`,
      }]);
    } finally {
      setAuthBusy(false);
    }
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || isLoading) return;

    if (authStatus && !authStatus.configured) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Please sign in with OpenAI before using Adeego AI.',
      }]);
      return;
    }

    const storeNo = wsinfo?.storeNo || '';

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);
    setActiveTool(null);

    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.aiAssistantChat(
        sessionId,
        text,
        storeNo,
        // onChunk — the full response comes in one chunk
        (chunk) => {
          setMessages(prev => [...prev, { role: 'assistant', content: chunk }]);
          setActiveTool(null);
        },
        // onToolCall
        (toolName) => {
          setActiveTool(toolName);
        },
        // onDone
        () => {
          setIsLoading(false);
          setActiveTool(null);
        },
        // onError
        (error) => {
          setIsLoading(false);
          setActiveTool(null);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Sorry, something went wrong: ${error}` 
          }]);
        }
      );
    }
  };

  const clearChat = async () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      await window.electronAPI.aiAssistantClear(sessionId);
    }
    setMessages([]);
    setActiveTool(null);
    setIsLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 w-[380px] h-[520px] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-emerald-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Adeego AI</h3>
            <p className="text-xs text-muted-foreground">Business Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearChat} title="Clear conversation">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {authStatus && !authStatus.configured && (
        <div className="border-b px-3 py-2 bg-background">
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2"
            onClick={signInWithOpenAI}
            disabled={authBusy}
          >
            {authBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {authBusy ? 'Signing in...' : 'Sign in with OpenAI'}
          </Button>
        </div>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-3">
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[340px] text-center text-muted-foreground">
              <Bot className="h-12 w-12 mb-3 text-emerald-300" />
              <p className="text-sm font-medium">How can I help?</p>
              <p className="text-xs mt-1">Ask about sales, stock, debts, expenses...</p>
              <div className="grid grid-cols-1 gap-1.5 mt-4 w-full max-w-[260px]">
                {[
                  "How are today's sales?",
                  "Which products need restocking?",
                  "Who owes the most?",
                  "Show me this week's profit",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="text-xs text-left px-3 py-2 rounded-md border bg-muted/50 hover:bg-muted transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))}

          {activeTool && <ToolCallIndicator toolName={activeTool} />}

          {isLoading && !activeTool && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1 px-3">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your store..."
            disabled={isLoading}
            className="text-sm"
          />
          <Button 
            size="icon" 
            onClick={sendMessage} 
            disabled={!input.trim() || isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
