
import React, { useState, useEffect, useRef } from 'react';
import { ViewMode, Session, Message, LessonDocument } from './types';
import { Icons } from './constants';
import DocumentViewer from './components/DocumentViewer';
import ChatInterface from './components/ChatInterface';
import AuthPage from './components/AuthPage';
import TestView from './components/TestView'; 
import LibraryView from './components/LibraryView';
import SentenceGame from './components/SentenceGame'; // NEW IMPORT
import { gemini, decodeAudioData, createPcmBlob, decode } from './services/geminiService';
import { 
  auth, 
  subscribeToSessions, 
  subscribeToCourses, 
  createNewSessionInDb, 
  uploadDocumentToDb,
  updateDocumentMessages,
  urlToBase64,
  logoutUser,
  ensureUserInLeaderboard, // NEW
  ADMIN_EMAIL 
} from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { LiveServerMessage } from '@google/genai';

type LiveStatus = 'idle' | 'connecting' | 'active' | 'speaking';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App State
  const [view, setView] = useState<ViewMode>(ViewMode.CHAT);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // Active Session Data
  const [currentDocuments, setCurrentDocuments] = useState<LessonDocument[]>([]);
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  
  // Ref for the GLOBAL file input (admin only, uncategorized)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs for logic (stale closure prevention)
  const activeSessionIdRef = useRef(activeSessionId);
  const currentDocumentsRef = useRef(currentDocuments);

  // Check if user is admin (Case Insensitive & Trimmed)
  const isAdmin = user?.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

  // Update Refs
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    currentDocumentsRef.current = currentDocuments;
  }, [currentDocuments]);

  // Live API Refs
  const audioContextRef = useRef<{
    input: AudioContext;
    output: AudioContext;
    nextStartTime: number;
    sources: Set<AudioBufferSourceNode>;
  } | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const liveSessionRef = useRef<any>(null);
  const speakingTimeoutRef = useRef<number | null>(null);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      // AUTO ADD TO LEADERBOARD (0 points)
      if (currentUser) {
          ensureUserInLeaderboard(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Sessions Listener
  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }
    const unsubscribe = subscribeToSessions(user.uid, (fetchedSessions) => {
      // Client-side sort
      const sortedSessions = fetchedSessions.sort((a, b) => b.lastActive - a.lastActive);
      setSessions(sortedSessions);
      
      const currentActiveId = activeSessionIdRef.current;
      
      // Auto-select logic
      if (currentActiveId && !sortedSessions.find(s => s.id === currentActiveId)) {
        setActiveSessionId(null);
      } else if (!currentActiveId && sortedSessions.length > 0) {
        setActiveSessionId(sortedSessions[0].id);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Real-time Courses Listener (Global)
  useEffect(() => {
    if (!user) return; 

    // subscribeToCourses is global, doesn't need sessionId
    const unsubscribe = subscribeToCourses((docs) => {
      // Merge with existing docs to preserve local base64 data if present (optimization)
      const existingDocs = currentDocumentsRef.current;

      const docsWithDisplayNames = docs.map((doc, index) => {
        const existing = existingDocs.find(d => d.id === doc.id);
        return {
          ...doc,
          displayName: `Lektion ${index + 1}`,
          // Keep local base64 data if available to avoid refetching image just for UI
          data: existing?.data || doc.data
        };
      });
      
      setCurrentDocuments(docsWithDisplayNames);
    });
    return () => unsubscribe();
  }, [user]); // Run when user changes (logs in)

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const currentDoc = currentDocuments[activeDocIndex];

  // Handle Document Navigation
  const handleDocChange = (newIndex: number) => {
    setActiveDocIndex(newIndex);
  };

  // Helper: Prepare Document for Gemini
  const getPreparedDocForGemini = async (doc: LessonDocument) => {
    if (doc.data) return doc;
    if (doc.imageUrl) {
      try {
        const base64 = await urlToBase64(doc.imageUrl);
        return { ...doc, data: base64 };
      } catch (e) {
        console.warn("Image fetch failed (likely CORS), falling back to text context.", e);
        // Fallback: Return doc without data, AI will use text context
        return doc;
      }
    }
    return doc;
  };

  const stopLive = () => {
    setLiveStatus('idle');
    if (liveSessionRef.current) {
      try { liveSessionRef.current.close(); } catch (e) {}
      liveSessionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.sources.forEach(s => s.stop());
      try { audioContextRef.current.input.close(); } catch (e) {}
      try { audioContextRef.current.output.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    sessionPromiseRef.current = null;
  };

  const toggleLive = async () => {
    if (liveStatus !== 'idle') {
      stopLive();
      return;
    }

    if (!currentDoc) {
      alert("Bitte laden Sie zuerst ein Dokument hoch.");
      return;
    }

    setLiveStatus('connecting');
    try {
      const preparedDoc = await getPreparedDocForGemini(currentDoc);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = {
        input: inputCtx,
        output: outputCtx,
        nextStartTime: 0,
        sources: new Set()
      };

      const connPromise = gemini.connectLive(preparedDoc, preparedDoc.messages, {
        onopen: () => {
          setLiveStatus('active');
          const source = inputCtx.createMediaStreamSource(stream);
          const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createPcmBlob(inputData);
            connPromise.then((session: any) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputCtx.destination);

          // 1. Prepare Text Context (Priority)
          const textContext = preparedDoc.messages
             .filter(m => m.role === 'model' && m.text.length > 50) 
             .map(m => m.text)
             .join('\n\n---\n\n');

          const initialPrompt = `
SYSTEM-ANWEISUNG FÜR KONTEXT:
Ich sende dir jetzt die visuelle Datei UND die bereits erstellte Text-Analyse.
REGEL: Schaue ZUERST in die folgende TEXT-ANALYSE, um Fragen zu beantworten. Nutze das Bild nur als Sekundärquelle, falls der Text unklar ist.
Die Text-Analyse ist deine primäre Wissensdatenbank für dieses Gespräch.

TEXT-ANALYSE (PRIORITÄT):
${textContext.substring(0, 8000)}
          `;

          // 2. Send Image (if available)
          if (preparedDoc?.data) {
            connPromise.then((session: any) => {
              session.sendRealtimeInput({ 
                media: { data: preparedDoc.data, mimeType: preparedDoc.type }
              });
              session.sendRealtimeInput({ text: initialPrompt });
            });
          } else {
             // Fallback: Image missing, send ONLY text context
             connPromise.then((session: any) => {
                session.sendRealtimeInput({ 
                  text: `WARNUNG: Das Bild konnte nicht geladen werden. Nutze AUSSCHLIESSLICH diese Analyse-Daten:\n\n${initialPrompt}` 
                });
             });
          }
        },
        onmessage: async (message: LiveServerMessage) => {
          const audioB64 = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audioB64 && audioContextRef.current) {
            setLiveStatus('speaking');
            if (speakingTimeoutRef.current) window.clearTimeout(speakingTimeoutRef.current);
            
            const { output, nextStartTime, sources } = audioContextRef.current;
            const buffer = await decodeAudioData(decode(audioB64), output, 24000, 1);
            const source = output.createBufferSource();
            source.buffer = buffer;
            source.connect(output.destination);
            const startTime = Math.max(nextStartTime, output.currentTime);
            source.start(startTime);
            audioContextRef.current.nextStartTime = startTime + buffer.duration;
            sources.add(source);
            source.onended = () => {
              sources.delete(source);
              if (sources.size === 0) {
                 speakingTimeoutRef.current = window.setTimeout(() => setLiveStatus('active'), 500);
              }
            };
          }
          if (message.serverContent?.interrupted && audioContextRef.current) {
            audioContextRef.current.sources.forEach(s => s.stop());
            audioContextRef.current.sources.clear();
            audioContextRef.current.nextStartTime = 0;
            setLiveStatus('active');
          }
        },
        onerror: (e: any) => {
          console.error(e);
          stopLive();
        },
        onclose: () => setLiveStatus('idle')
      });

      sessionPromiseRef.current = connPromise;
      liveSessionRef.current = await connPromise;

    } catch (err) {
      console.error(err);
      alert("Mikrofonzugriff erforderlich oder ein Fehler ist aufgetreten.");
      setLiveStatus('idle');
    }
  };

  const createNewSession = async () => {
    if (!user) return;
    try {
      const id = await createNewSessionInDb(user.uid);
      setActiveSessionId(id);
      setView(ViewMode.DOCUMENT);
    } catch (e) {
      console.error("Failed to create session", e);
    }
  };

  // Generic upload (top right button - Admin only)
  const handleGenericFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUpload(e.target.files[0]);
    }
  };

  // Library Upload (Categorized)
  const handleLibraryUpload = (file: File, themeId: string, subtopicId: string) => {
    processUpload(file, themeId, subtopicId);
  };

  const processUpload = async (file: File, themeId?: string, subtopicId?: string) => {
    if (!activeSessionId || !user) return;
    
    setIsAnalyzing(true);
    setAnalysisProgress({ current: 0, total: 1 }); // Simple progress for single file

    try {
        setAnalysisProgress({ current: 1, total: 1 });
        
        // 1. Upload to Firebase (Pass theme/subtopic)
        const { downloadURL, storagePath, docId, initialMessage } = await uploadDocumentToDb(
          user.uid, 
          activeSessionId, 
          file, 
          user.email || '',
          themeId,
          subtopicId
        );
        
        // 2. Base64 for Gemini Analysis
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve((event.target?.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });

        const tempDoc: LessonDocument = {
          id: docId, 
          name: file.name,
          displayName: `Lektion ${currentDocuments.length + 1}`,
          type: file.type,
          data: base64Data,
          imageUrl: downloadURL,
          storagePath: storagePath,
          messages: [initialMessage],
          timestamp: Date.now(),
          themeId,
          subtopicId
        };
        
        // 3. Analysis
        const analysis = await gemini.analyzeDocumentInitially(tempDoc);
        
        if (analysis) {
           const analysisMsg: Message = {
             id: 'analysis-' + Date.now(),
             role: 'model',
             text: analysis,
             timestamp: Date.now()
           };
           await updateDocumentMessages(activeSessionId, docId, [initialMessage, analysisMsg], 1);
        }

    } catch (err) {
        console.error("Upload/Analysis error", err);
    }

    setIsAnalyzing(false);
    setAnalysisProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Optional: Switch to view
    // setView(ViewMode.DOCUMENT); 
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !activeSessionId || !currentDoc) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    const updatedMessages = [...currentDoc.messages, userMsg];
    
    const updatedDocs = [...currentDocuments];
    updatedDocs[activeDocIndex] = { ...currentDoc, messages: updatedMessages };
    setCurrentDocuments(updatedDocs);

    try {
      await updateDocumentMessages(activeSessionId, currentDoc.id, updatedMessages, 1);
      const preparedDoc = await getPreparedDocForGemini(currentDoc);
      const response = await gemini.sendChatMessage(text, preparedDoc, currentDoc.messages);
      const modelMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: response || "...", timestamp: Date.now() };
      
      const finalMessages = [...updatedMessages, modelMsg];
      await updateDocumentMessages(activeSessionId, currentDoc.id, finalMessages, 1);
      
      updatedDocs[activeDocIndex] = { ...currentDoc, messages: finalMessages };
      setCurrentDocuments([...updatedDocs]);

    } catch (err) {
      console.error(err);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F9FBFF]">
         <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!activeSessionId && sessions.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F9FBFF]">
        <div className="absolute top-6 right-6">
           <button onClick={logoutUser} className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors">Abmelden</button>
        </div>
        <div className="text-center space-y-10 px-6 max-w-lg">
          <div className="relative inline-block">
            <div className="absolute -inset-10 bg-indigo-500/10 rounded-full blur-3xl"></div>
            <div className="w-24 h-24 mx-auto rounded-[1.5rem] bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-2xl shadow-indigo-200 flex items-center justify-center relative z-10 border border-white/20">
              <span className="text-white font-black text-5xl tracking-tighter">M</span>
            </div>
            <h1 className="relative text-6xl font-black text-slate-900 tracking-tighter leading-tight mt-8">Deutsch <br/> mit Mari</h1>
          </div>
          <p className="text-slate-500 text-lg leading-relaxed font-medium">Willkommen zurück, {user.email?.split('@')[0]}.</p>
          <button onClick={createNewSession} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-bold hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 active:scale-95 text-xl">Lernreise starten</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white font-['Inter']">
      <header className="h-20 border-b flex items-center justify-between px-8 bg-white/80 backdrop-blur-md shrink-0 z-40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[1rem] bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-xl shadow-indigo-100 flex items-center justify-center relative flex-shrink-0">
             <span className="text-white font-black text-xl tracking-tighter">M</span>
             <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white"></div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-slate-900 tracking-tighter leading-none mb-1 uppercase">Mari AI</h1>
            <div className="flex items-center gap-2">
               {isAnalyzing ? (
                 <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest animate-pulse">
                   Cloud Upload...
                 </span>
               ) : liveStatus !== 'idle' ? (
                 <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                   {liveStatus === 'connecting' ? 'Verbindung...' : liveStatus === 'speaking' ? 'Spricht...' : 'Hört zu...'}
                 </span>
               ) : (
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Online</span>
               )}
            </div>
          </div>
        </div>
        
        {/* Only show top controls if NOT in modular/training modes */}
        {view !== ViewMode.DTB_TRAINING && view !== ViewMode.LIBRARY && view !== ViewMode.GAME && (
        <div className="flex items-center gap-3">
          {/* Upload Button - ONLY VISIBLE TO ADMIN */}
          {isAdmin && (
            <>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className={`w-12 h-12 rounded-[1rem] flex items-center justify-center transition-all shadow-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Dokument hochladen"
              >
                <Icons.Plus className="w-6 h-6" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleGenericFileUpload} />
            </>
          )}

          {/* Mic/Live Button */}
          <button 
            type="button"
            onClick={toggleLive}
            disabled={isAnalyzing}
            className={`w-12 h-12 rounded-[1rem] flex items-center justify-center transition-all shadow-xl relative ml-1 ${isAnalyzing ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : liveStatus !== 'idle' ? 'bg-red-500 text-white shadow-red-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'}`}
            title="Sprechen"
          >
            {liveStatus === 'idle' ? <Icons.Mic className="w-6 h-6" /> : <Icons.Stop className="w-6 h-6" />}
          </button>
        </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden relative bg-[#FDFDFF]">
        {/* Document View */}
        <div className={`h-full w-full transition-all duration-700 ease-in-out ${view === ViewMode.DOCUMENT ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none absolute inset-0'}`}>
          <DocumentViewer 
            documents={currentDocuments} 
            currentIndex={activeDocIndex} 
            onIndexChange={handleDocChange} 
            zoomLevel={zoomLevel} 
            onZoomChange={setZoomLevel}
            onUpload={handleGenericFileUpload}
            isReadOnly={!isAdmin} 
          />
        </div>
        
        {/* Chat View */}
        <div className={`h-full w-full transition-all duration-700 ease-in-out ${view === ViewMode.CHAT ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none absolute inset-0'}`}>
          <ChatInterface 
            messages={currentDoc?.messages || []} 
            onSend={handleSendMessage} 
            currentDocName={currentDoc?.displayName} 
            isLiveActive={liveStatus !== 'idle'} 
          />
        </div>

        {/* DTB TRAINING VIEW (TEST VIEW) */}
        <div className={`h-full w-full transition-all duration-700 ease-in-out ${view === ViewMode.DTB_TRAINING ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none absolute inset-0'}`}>
           {view === ViewMode.DTB_TRAINING && (
             <TestView 
                onClose={() => setView(ViewMode.CHAT)} 
                documents={currentDocuments} // PASSING DOCUMENTS FOR EXAM GENERATION
             />
           )}
        </div>

        {/* LIBRARY VIEW */}
        <div className={`h-full w-full transition-all duration-700 ease-in-out ${view === ViewMode.LIBRARY ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none absolute inset-0'}`}>
           <LibraryView 
              documents={currentDocuments} 
              onOpenDocument={(doc) => {
                 const idx = currentDocuments.findIndex(d => d.id === doc.id);
                 if (idx !== -1) {
                    setActiveDocIndex(idx);
                    setView(ViewMode.DOCUMENT);
                 }
              }}
              isAdmin={!!isAdmin}
              onUploadToCategory={handleLibraryUpload}
              isUploading={isAnalyzing}
           />
        </div>

        {/* GAME VIEW */}
        <div className={`h-full w-full transition-all duration-700 ease-in-out ${view === ViewMode.GAME ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none absolute inset-0'}`}>
           <SentenceGame />
        </div>

        {/* SETTINGS VIEW */}
        <div className={`h-full w-full transition-all duration-700 ease-in-out bg-[#F9FBFF] p-6 overflow-y-auto ${view === ViewMode.SETTINGS ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none absolute inset-0'}`}>
          <div className="max-w-md mx-auto space-y-6 pt-10">
            <h2 className="text-3xl font-black text-slate-900 mb-6">Einstellungen</h2>
            
            <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-200">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Angemeldet als</p>
                <p className="text-lg font-bold text-slate-800 truncate">{user.email}</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="w-full p-5 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between opacity-70 cursor-default">
                <div className="flex items-center gap-4">
                   <div className="p-3 rounded-xl bg-green-50 text-green-600">
                      <Icons.Refresh className="w-6 h-6" />
                   </div>
                   <div className="text-left">
                     <p className="font-bold text-slate-800">Live-Sync Aktiv</p>
                     <p className="text-xs text-slate-400">Dokumente werden automatisch aktualisiert.</p>
                   </div>
                </div>
              </div>

              <button 
                onClick={logoutUser}
                className="w-full p-5 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-red-200 hover:bg-red-50/50 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                   <div className="p-3 rounded-xl bg-red-50 text-red-500 group-hover:bg-red-100">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                      </svg>
                   </div>
                   <div className="text-left">
                     <p className="font-bold text-red-600">Abmelden</p>
                     <p className="text-xs text-red-300">Sitzung beenden</p>
                   </div>
                </div>
              </button>
            </div>
            
            <button 
               onClick={() => setView(ViewMode.CHAT)}
               className="mt-8 text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors"
            >
              ← Zurück zum Lernen
            </button>
          </div>
        </div>
      </main>

      <nav className="h-20 border-t bg-white/95 backdrop-blur-sm flex items-center justify-around px-4 shrink-0 z-40 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <button onClick={() => setView(ViewMode.DOCUMENT)} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-16 ${view === ViewMode.DOCUMENT ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className={`p-2 rounded-xl transition-all ${view === ViewMode.DOCUMENT ? 'bg-indigo-50 shadow-sm' : ''}`}>
            <Icons.Document className="w-6 h-6" />
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${view === ViewMode.DOCUMENT ? 'opacity-100' : 'opacity-60'}`}>Dokument</span>
        </button>
        <button onClick={() => setView(ViewMode.CHAT)} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-16 ${view === ViewMode.CHAT ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className={`p-2 rounded-xl transition-all ${view === ViewMode.CHAT ? 'bg-indigo-50 shadow-sm' : ''}`}>
            <Icons.Chat className="w-6 h-6" />
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${view === ViewMode.CHAT ? 'opacity-100' : 'opacity-60'}`}>Lernen</span>
        </button>
        
        <button onClick={() => setView(ViewMode.LIBRARY)} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-16 ${view === ViewMode.LIBRARY ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className={`p-2 rounded-xl transition-all ${view === ViewMode.LIBRARY ? 'bg-indigo-50 shadow-sm' : ''}`}>
            <Icons.Library className="w-6 h-6" />
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${view === ViewMode.LIBRARY ? 'opacity-100' : 'opacity-60'}`}>Bibliothek</span>
        </button>
        
        {/* GAME BUTTON */}
        <button onClick={() => setView(ViewMode.GAME)} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-16 ${view === ViewMode.GAME ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className={`p-2 rounded-xl transition-all ${view === ViewMode.GAME ? 'bg-indigo-50 shadow-sm' : ''}`}>
            <Icons.GameController className="w-6 h-6" />
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${view === ViewMode.GAME ? 'opacity-100' : 'opacity-60'}`}>Game</span>
        </button>
        
        <button onClick={() => setView(ViewMode.DTB_TRAINING)} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-16 ${view === ViewMode.DTB_TRAINING ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className={`p-2 rounded-xl transition-all ${view === ViewMode.DTB_TRAINING ? 'bg-indigo-50 shadow-sm' : ''}`}>
            <Icons.GraduationCap className="w-6 h-6" />
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${view === ViewMode.DTB_TRAINING ? 'opacity-100' : 'opacity-60'}`}>DTB B2</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
