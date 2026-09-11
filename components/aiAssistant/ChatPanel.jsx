import { useState, useRef, useEffect } from 'react';
import { X, Send, Trash2, Bot, Loader2, KeyRound, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ChatMessage from './ChatMessage';
import ToolCallIndicator from './ToolCallIndicator';
import useWsinfoStore from '@/stores/wsinfo';
import { v4 as uuidv4 } from 'uuid';

const MODEL_OPTIONS = [
  { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
  { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
  { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
];

const EFFORT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'max', label: 'Maximum' },
];

const AI_SETTINGS_KEY = 'adeego-ai-settings';

export default function ChatPanel({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [authStatus, setAuthStatus] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [model, setModel] = useState('gpt-5.6-terra');
  const [reasoningEffort, setReasoningEffort] = useState('none');
  const [sessionId] = useState(() => `app-${uuidv4()}`);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(AI_SETTINGS_KEY) || '{}');
      if (MODEL_OPTIONS.some((option) => option.value === saved.model)) setModel(saved.model);
      if (EFFORT_OPTIONS.some((option) => option.value === saved.reasoningEffort)) {
        setReasoningEffort(saved.reasoningEffort);
      }
    } catch (error) {
      // Ignore unavailable storage or malformed settings and keep safe defaults.
    }
  }, []);

  const saveAiSettings = (nextModel, nextEffort) => {
    try {
      window.localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify({
        model: nextModel,
        reasoningEffort: nextEffort,
      }));
    } catch (error) {
      // The active selection still works even when local storage is unavailable.
    }
  };

  const changeModel = (value) => {
    setModel(value);
    saveAiSettings(value, reasoningEffort);
  };

  const changeReasoningEffort = (value) => {
    setReasoningEffort(value);
    saveAiSettings(model, value);
  };

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

  const signOutOfOpenAI = async () => {
    if (authBusy || isLoading || typeof window === 'undefined' || !window.electronAPI?.openAIAuthLogout) return;
    setAuthBusy(true);
    try {
      const status = await window.electronAPI.openAIAuthLogout();
      await window.electronAPI.aiAssistantClear?.(sessionId);
      setAuthStatus(status);
      setMessages([]);
      setActiveTool(null);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `OpenAI sign-out failed: ${error.message || error}`,
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
    const storeContext = {
      storeNo,
      name: wsinfo?.name || '',
      phone: wsinfo?.phone || '',
      location: wsinfo?.location || '',
      defaultCustId: wsinfo?.defaultCustId || '',
      plan: wsinfo?.plan || '',
    };

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
        storeContext,
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
        },
        { model, reasoningEffort }
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

      {authStatus && (
        <div className="border-b px-3 py-2 bg-background">
          {authStatus.configured ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span className="truncate">Signed in with OpenAI</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 flex-shrink-0 gap-1.5 text-xs"
                  onClick={signOutOfOpenAI}
                  disabled={authBusy || isLoading}
                >
                  {authBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                  {authBusy ? 'Signing out...' : 'Sign out'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Model</label>
                  <Select value={model} onValueChange={changeModel} disabled={isLoading}>
                    <SelectTrigger className="h-8 text-xs" aria-label="AI model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Reasoning effort</label>
                  <Select value={reasoningEffort} onValueChange={changeReasoningEffort} disabled={isLoading}>
                    <SelectTrigger className="h-8 text-xs" aria-label="Reasoning effort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EFFORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
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
          )}
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
