
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';

interface Props {
  messages: Message[];
  onSend: (text: string) => void;
  currentDocName?: string;
  isLiveActive: boolean;
}

const ChatInterface: React.FC<Props> = ({ messages, onSend, currentDocName, isLiveActive }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {currentDocName && (
        <div className="px-6 py-3 border-b bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Studienmaterial: {currentDocName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-medium italic">Online</span>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
          </div>
        </div>
      )}
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-[#fdfdfd]"
      >
        {!currentDocName ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-center px-12">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-slate-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
                 </svg>
              </div>
              <p className="font-medium text-slate-500">Lade eine Lektion hoch, um mit Mari zu lernen.</p>
              <p className="text-sm text-slate-400">Jedes Dokument hat seinen eigenen Lernverlauf.</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-center">
             <p className="text-sm italic opacity-60">Bereite Fragen zu {currentDocName} vor...</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${msg.role === 'user' ? 'text-indigo-400' : 'text-slate-400'}`}>
                {msg.role === 'user' ? 'Student' : 'Lehrerin Mari'}
              </span>
              <div className={`max-w-[90%] px-5 py-4 rounded-2xl text-sm shadow-sm border ${
                msg.role === 'user' 
                  ? 'bg-white text-slate-700 border-indigo-100 rounded-tr-none' 
                  : 'bg-indigo-50/50 text-slate-800 border-indigo-100/50 rounded-tl-none'
              } leading-relaxed font-normal whitespace-pre-wrap`}>
                {msg.text}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t bg-white shrink-0">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input 
            type="text"
            disabled={!currentDocName}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={currentDocName ? "Frage Mari etwas zur Lektion..." : "Warten auf Dokument..."}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300 pr-14 transition-all disabled:opacity-50 font-medium placeholder:text-slate-400"
          />
          <button 
            type="submit"
            disabled={!currentDocName || !input.trim()}
            className="absolute right-2 p-3 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-20 active:scale-90"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
