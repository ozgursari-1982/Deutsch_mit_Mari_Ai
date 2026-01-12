
import React, { useState, useEffect, useRef } from 'react';
import { Session, LessonDocument } from '../types';
import { Icons } from '../constants';

interface Props {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  currentDocuments?: LessonDocument[];
}

const HistorySidebar: React.FC<Props> = ({ 
  sessions, 
  activeSessionId, 
  onSelectSession, 
  onNewSession, 
  onRenameSession, 
  currentDocuments 
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Edit moduna geç
  const startEditing = (e: React.SyntheticEvent, session: Session) => {
    e.stopPropagation();
    setEditingId(session.id);
    setTempTitle(session.title);
  };

  // İsim kaydet
  const saveEdit = (id: string) => {
    const finalTitle = tempTitle.trim() || 'Neue Sitzung';
    onRenameSession(id, finalTitle);
    setEditingId(null);
  };

  // Edit inputuna odaklan
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Format Date Helper
  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('de-DE', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    }).format(new Date(timestamp));
  };

  return (
    <div className="h-full bg-[#f8fafc] flex flex-col border-r border-slate-100/50">
      {/* HEADER */}
      <div className="p-6 pb-4 bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Deine Reisen</h2>
          <button 
            onClick={onNewSession}
            className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all active:scale-95"
            title="Neue Sitzung"
          >
            <Icons.Plus className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-400 font-medium">Alle Lernfortschritte & Dokumente</p>
      </div>

      {/* LIST */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <div className="p-4 bg-white rounded-full shadow-sm mb-3">
              <Icons.History className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Noch keine Reise begonnen</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Starte eine neue Sitzung und lade dein erstes Dokument hoch.</p>
            <button 
              onClick={onNewSession} 
              className="mt-4 text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              Jetzt starten
            </button>
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = activeSessionId === session.id;
            
            // --- ROBUST COUNTER LOGIC ---
            // If active and we have loaded documents, use that count.
            // If active but documents are loading (0), fallback to session.documentCount to prevent "0" flash.
            // If inactive, always use session.documentCount.
            const hasLiveDocs = isActive && currentDocuments && currentDocuments.length > 0;
            
            const displayDocCount = hasLiveDocs 
              ? currentDocuments.length 
              : (session.documentCount || 0);

            const displayMsgCount = (hasLiveDocs)
              ? currentDocuments!.reduce((acc, doc) => acc + doc.messages.length, 0)
              : (session.messageCount || 0);

            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group relative w-full text-left rounded-2xl transition-all duration-300 border overflow-hidden ${
                  isActive 
                    ? 'bg-white border-indigo-200 shadow-xl shadow-indigo-100/50 scale-[1.02] z-10' 
                    : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {/* Active Indicator Strip */}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />
                )}

                <div className="p-4 pl-5">
                  {/* Title Row */}
                  <div className="flex justify-between items-start mb-2">
                    {editingId === session.id ? (
                      <div className="flex-1 mr-2" onClick={e => e.stopPropagation()}>
                        <input 
                          ref={inputRef}
                          className="w-full text-sm font-bold text-indigo-900 bg-indigo-50 border-b-2 border-indigo-500 outline-none px-1 py-0.5"
                          value={tempTitle}
                          onChange={(e) => setTempTitle(e.target.value)}
                          onBlur={() => saveEdit(session.id)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(session.id)}
                        />
                      </div>
                    ) : (
                      <h3 className={`text-sm font-bold truncate pr-2 ${isActive ? 'text-slate-800' : 'text-slate-600 group-hover:text-slate-800'}`}>
                        {session.title}
                      </h3>
                    )}
                    
                    {!editingId && (
                      <button 
                        onClick={(e) => startEditing(e, session)}
                        className={`text-slate-300 hover:text-indigo-500 transition-colors p-1 -mr-2 -mt-1 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                           <path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
                         </svg>
                      </button>
                    )}
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-3">
                    <span>{formatDate(session.lastActive)}</span>
                  </div>

                  {/* Stats Badges */}
                  <div className="flex items-center gap-2">
                    <div className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-500'}`}>
                      <Icons.Document className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">{displayDocCount}</span>
                    </div>
                    <div className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-500'}`}>
                      <Icons.Chat className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">{displayMsgCount}</span>
                    </div>
                  </div>
                </div>

                {/* --- ACTIVE DOCUMENT LIST --- */}
                {isActive && (
                  <div className="bg-slate-50/80 border-t border-indigo-100 px-4 py-3 animate-fade-in">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">Aktive Dateien</p>
                    
                    {(!currentDocuments || currentDocuments.length === 0) ? (
                       <div className="text-[10px] text-slate-400 italic pl-1">
                          {session.documentCount && session.documentCount > 0 ? "Lade Dokumente..." : "Keine Dokumente hochgeladen."}
                       </div>
                    ) : (
                      <div className="space-y-1.5">
                        {currentDocuments.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-2 text-xs text-slate-700 bg-white p-2 rounded-lg shadow-sm border border-slate-100/50">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"></div>
                            <Icons.Document className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate font-medium">{doc.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* FOOTER */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 mt-auto">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
           <div className="p-2 bg-indigo-50 rounded-lg shrink-0">
             <Icons.History className="w-4 h-4 text-indigo-600" />
           </div>
           <div>
             <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Mari's Memory</h4>
             <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
               Mari merkt sich den Kontext aller Dokumente in dieser Liste für zukünftige Gespräche.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default HistorySidebar;
