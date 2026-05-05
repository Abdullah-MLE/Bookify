import { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface TwinProps {
  onClose?: () => void;
}

const TWIN_API_URL =
  process.env.NEXT_PUBLIC_TWIN_API_URL || 'https://urwnupwmdf.execute-api.us-east-1.amazonaws.com';

export default function Twin({ onClose }: TwinProps) {
  const { user, isLoaded } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversation history when user loads
  useEffect(() => {
    if (isLoaded && user) {
      const currentSessionId = user.id;
      setSessionId(currentSessionId);
      
      // Fetch existing conversation
      fetch(`${TWIN_API_URL}/conversation/${currentSessionId}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load history');
          return res.json();
        })
        .then(data => {
          if (data.messages && Array.isArray(data.messages)) {
            const loadedMessages = data.messages.map((m: any, i: number) => ({
              id: `history-${i}`,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
            }));
            setMessages(loadedMessages);
          }
        })
        .catch(err => console.error('Could not load history:', err));
    }
  }, [isLoaded, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const text = input;
    setInput('');
    setIsLoading(true);

    try {
      const currentSessionId = sessionId || (user?.id) || undefined;
      const res = await fetch(`${TWIN_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: currentSessionId }),
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      
      if (!sessionId && data.session_id) {
        setSessionId(data.session_id);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'ERROR: CONNECTION FAILED. RETRY.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="px-6 py-8 border-b-2 border-black flex-shrink-0 bg-white flex justify-between items-center relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-black" />
          <p className="text-xs font-black tracking-[0.3em] uppercase">Digital Twin</p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors border-2 border-transparent hover:border-black group"
            title="Close Chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-black transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 bg-white custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center mt-20 select-none">
            <p className="text-xs font-black tracking-[0.2em] uppercase text-black">Awaiting input...</p>
            <p className="text-[10px] text-neutral-400 mt-2 uppercase tracking-widest">
              Digital assistant initialized.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] px-4 py-3 text-xs leading-tight font-bold uppercase tracking-tight ${
                msg.role === 'user'
                  ? 'bg-black text-white'
                  : 'bg-white text-black border-2 border-black'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className={`text-[9px] mt-2 font-black ${msg.role === 'user' ? 'text-neutral-400' : 'text-neutral-400'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="border-2 border-black px-4 py-3 bg-white">
              <div className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-black animate-pulse" />
                <div className="w-1.5 h-1.5 bg-black animate-pulse delay-75" />
                <div className="w-1.5 h-1.5 bg-black animate-pulse delay-150" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t-2 border-black px-4 py-6 flex-shrink-0 bg-white">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ENTER COMMAND..."
            disabled={isLoading}
            className="flex-1 text-xs font-black px-4 py-3 border-2 border-black focus:outline-none focus:bg-neutral-100 text-black placeholder-neutral-300 disabled:opacity-50 uppercase tracking-widest"
          />
          <button
            onClick={send}
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-black text-white hover:bg-neutral-800 disabled:opacity-40 transition-colors focus:outline-none border-2 border-black flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
