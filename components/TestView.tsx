
import React, { useState, useEffect, useRef } from 'react';
import { DTBExam, ExamSection, ExamQuestion, TestData, LessonDocument, DTBSpeakingResult, PartScore, GlobalScore } from '../types';
import { Icons, TEXTBOOK_STRUCTURE } from '../constants';
import { gemini, decodeAudioData, decode, createPcmBlob } from '../services/geminiService';
import { saveExamToDb, subscribeToExams } from '../services/firebase';
import { auth } from '../services/firebase';
import { LiveServerMessage } from '@google/genai';

interface Props {
  testData?: TestData | null;
  onClose: () => void;
  documents?: LessonDocument[];
}

type ViewState = 'list' | 'create' | 'taking' | 'result';
type LiveState = 'idle' | 'connecting' | 'active' | 'speaking';
type TranscriptTurn = { role: 'user' | 'model'; text: string; };

const ADMIN_EMAIL = 'ozgursari1982@gmail.com';

const TestView: React.FC<Props> = ({ onClose, documents = [] }) => {
  const [viewState, setViewState] = useState<ViewState>('list');
  const [exams, setExams] = useState<DTBExam[]>([]);
  const [currentExam, setCurrentExam] = useState<DTBExam | null>(null);
  
  // ADMIN STATE
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [sectionIndex, setSectionIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  
  // EVALUATION STATE
  const [speakingDialogs, setSpeakingDialogs] = useState<Record<number, TranscriptTurn[]>>({});
  const [speakingResult, setSpeakingResult] = useState<any>(null);
  const [isGradingSpeaking, setIsGradingSpeaking] = useState(false);
  
  // REFS
  const [liveState, setLiveState] = useState<LiveState>('idle');
  const audioContextRef = useRef<any>(null);
  const liveSessionRef = useRef<any>(null);
  const speakingTimeoutRef = useRef<any>(null);
  const transcriptBufferRef = useRef<{user: string, model: string}>({ user: '', model: '' });

  const user = auth.currentUser;
  const isAdmin = user?.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

  // --- HELPER FOR SAFE RENDERING ---
  const safeRender = (val: any) => {
    if (typeof val === 'string' || typeof val === 'number') return val;
    if (typeof val === 'object' && val !== null) return JSON.stringify(val);
    return "";
  };

  // --- HELPER FOR REALTIME TRANSCRIPT CLEANING ---
  const cleanRealtimeTranscript = (text: string) => {
      let cleaned = text;
      cleaned = cleaned.replace(/\s\s+/g, ' ');
      return cleaned.trim();
  };

  const getGradeColor = (grade: string) => {
      if (grade === 'A') return 'bg-green-100 text-green-700 border-green-200';
      if (grade === 'B') return 'bg-blue-100 text-blue-700 border-blue-200';
      if (grade === 'C') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      return 'bg-red-100 text-red-700 border-red-200';
  };

  useEffect(() => {
    const unsubscribe = subscribeToExams((fetchedExams) => {
      setExams(fetchedExams);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let interval: any;
    if (viewState === 'taking' && timer > 0) {
      interval = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer, viewState]);

  useEffect(() => {
    stopLiveSession();
  }, [sectionIndex, viewState]);

  // --- ADMIN: CREATE EXAM LOGIC ---

  const toggleThemeExpand = (themeId: string) => {
    setExpandedThemeId(expandedThemeId === themeId ? null : themeId);
  };

  const toggleSelection = (themeId: string, subtopicId: string) => {
    const key = `${themeId}_${subtopicId}`;
    if (selectedKeys.includes(key)) {
        setSelectedKeys(selectedKeys.filter(k => k !== key));
    } else {
        setSelectedKeys([...selectedKeys, key]);
    }
  };

  const handleCreateExam = async () => {
    if (selectedKeys.length === 0) {
        alert("Bitte wählen Sie mindestens ein Thema oder Unterthema aus.");
        return;
    }
    
    setIsCreating(true);
    
    try {
      const relevantDocs = documents.filter(d => {
          if (!d.themeId || !d.subtopicId) return false;
          const key = `${d.themeId}_${d.subtopicId}`;
          return selectedKeys.includes(key);
      });
      
      const contextData = relevantDocs.map(d => {
          const analysis = d.messages.find(m => m.role === 'model')?.text || "";
          return `DOKUMENT: ${d.displayName} (${d.name})\nTHEMA: ${d.themeId}-${d.subtopicId}\nINHALT:\n${analysis}`;
      }).join('\n\n========================================\n\n');

      const selectedTitles = selectedKeys.map(key => {
          const [tId, sId] = key.split('_');
          const theme = TEXTBOOK_STRUCTURE.find(t => t.id === tId);
          const sub = theme?.subtopics.find(s => s.id === sId);
          return `${theme?.title} - ${sub?.title}`;
      }).join(", ");

      const examTitle = selectedKeys.length === 1 
         ? selectedTitles 
         : `Gemischte Prüfung (${selectedKeys.length} Themen)`;

      const exam = await gemini.generateDTBExam(contextData, selectedTitles);
      
      if (exam) {
        exam.title = exam.title || examTitle; 
        exam.topic = selectedTitles;
        await saveExamToDb(exam);
        setViewState('list');
        setSelectedKeys([]);
      } else {
          alert("Fehler bei der Generierung. Bitte versuchen Sie es erneut.");
      }
    } catch (e) {
      console.error("Create failed", e);
      alert("Fehler beim Erstellen der Prüfung.");
    } finally {
      setIsCreating(false);
    }
  };

  // --- USER: TAKE EXAM ---

  const startExam = (exam: DTBExam) => {
    setCurrentExam(exam);
    setSectionIndex(0);
    setSpeakingDialogs({});
    setSpeakingResult(null);
    if (exam.sections && exam.sections.length > 0) {
        const firstSec = exam.sections[0];
        setTimer((firstSec.durationMinutes || 16) * 60);
        setViewState('taking');
    } else {
        alert("Fehlerhafte Prüfungsdaten.");
    }
  };

  const nextSection = () => {
    if (!currentExam || !currentExam.sections) return;
    stopLiveSession();

    if (sectionIndex < currentExam.sections.length - 1) {
      setSectionIndex(prev => prev + 1);
      const nextSec = currentExam.sections[sectionIndex + 1];
      setTimer((nextSec.durationMinutes || 16) * 60);
      window.scrollTo(0,0);
    } else {
      finishExam();
    }
  };

  const finishExam = () => {
    stopLiveSession();
    setViewState('result');
    evaluateSpeaking();
  };

  // --- SCORING LOGIC ---

  const evaluateSpeaking = async () => {
    setIsGradingSpeaking(true);
    try {
        const transcript = Object.keys(speakingDialogs).length === 0 
            ? "" 
            : Object.keys(speakingDialogs).map(key => {
                return `TEIL ${parseInt(key)+1}:\n` + speakingDialogs[parseInt(key)].map(t => `${t.role === 'model' ? 'PRÜFER' : 'KANDIDAT'}: ${cleanRealtimeTranscript(t.text)}`).join('\n');
            }).join('\n\n');

        const result = await gemini.evaluateSpeakingDTB(transcript);
        setSpeakingResult(result);
    } catch (e) {
        console.error("Speaking Eval Error", e);
    } finally {
        setIsGradingSpeaking(false);
    }
  };

  const stopLiveSession = () => {
    if (liveSessionRef.current) { 
        try { liveSessionRef.current.close(); } catch(e) {} 
        liveSessionRef.current = null;
    }
    if (audioContextRef.current) {
        if (audioContextRef.current.sources) {
            audioContextRef.current.sources.forEach((s: any) => {
                try { s.stop(); } catch(e) {}
            });
            audioContextRef.current.sources.clear();
        }
        try { audioContextRef.current.input.close(); } catch(e) {}
        try { audioContextRef.current.output.close(); } catch(e) {}
        audioContextRef.current = null;
    }
    if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = null;
    }
    setLiveState('idle');
  };

  const startLiveSession = async (role: 'examiner' | 'colleague' | 'partner', context: string, partIndex: number) => {
    if (liveState !== 'idle') { stopLiveSession(); return; }
    setLiveState('connecting');
    transcriptBufferRef.current = { user: '', model: '' };

    const appendTurn = (role: 'user' | 'model', text: string) => {
        if (!text.trim()) return;
        setSpeakingDialogs(prev => {
           const partDialog = prev[partIndex] || [];
           const lastMsgIndex = partDialog.length - 1;
           const lastMsg = partDialog[lastMsgIndex];

           if (lastMsg && lastMsg.role === role) {
               const updatedMsg = { ...lastMsg, text: lastMsg.text + " " + text }; 
               const newDialog = [...partDialog];
               newDialog[lastMsgIndex] = updatedMsg;
               return { ...prev, [partIndex]: newDialog };
           } else {
               return { ...prev, [partIndex]: [...partDialog, { role, text }] };
           }
        });
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = { input: inputCtx, output: outputCtx, nextStartTime: 0, sources: new Set() };

      const connPromise = gemini.connectLive(context, [], {
        onopen: () => {
          setLiveState('active');
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createPcmBlob(inputData);
            connPromise.then((s: any) => {
                try { s.sendRealtimeInput({ media: pcmBlob }); } catch(e) {}
            });
          };
          source.connect(processor);
          processor.connect(inputCtx.destination);
          
          connPromise.then((s: any) => {
             s.sendRealtimeInput({ text: "Starte die Prüfung jetzt. Begrüße mich." });
          });
        },
        onmessage: async (msg: LiveServerMessage) => {
           if (msg.serverContent?.inputTranscription?.text) appendTurn('user', msg.serverContent.inputTranscription.text);
           if (msg.serverContent?.outputTranscription?.text) appendTurn('model', msg.serverContent.outputTranscription.text);
           
           const audioB64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
           if (audioB64 && audioContextRef.current) {
              setLiveState('speaking');
              if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
              
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
                 if (sources.size === 0) speakingTimeoutRef.current = setTimeout(() => setLiveState('active'), 500);
              };
           }
        },
        onerror: () => { stopLiveSession(); alert("Verbindung unterbrochen"); },
        onclose: () => setLiveState('idle')
      }, role);
      liveSessionRef.current = await connPromise;
    } catch (e) { setLiveState('idle'); alert("Mikrofonfehler: Bitte Berechtigungen prüfen."); }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- PART SCORE CARD COMPONENT ---
  const PartScoreCard = ({ title, score }: { title: string, score: PartScore | GlobalScore }) => (
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col h-full">
          <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-slate-700 text-sm">{title}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-black border ${getGradeColor(score.grade)}`}>
                  {score.grade} ({score.points}/{score.maxPoints})
              </span>
          </div>
          <p className="text-xs text-slate-500 italic mt-auto leading-tight">{score.reason}</p>
      </div>
  );

  // --- RENDER ---

  if (viewState === 'create') {
    return (
      <div className="h-full bg-[#F9FBFF] p-8 flex flex-col items-center justify-center overflow-y-auto">
        <div className="max-w-3xl w-full bg-white rounded-3xl p-8 shadow-xl flex flex-col max-h-[90vh]">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Granulare Prüfungserstellung</h2>
          <p className="text-slate-500 mb-6">Wählen Sie spezifische Themenbereiche für die Prüfung aus.</p>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-100 rounded-2xl mb-6 bg-slate-50/50">
             {TEXTBOOK_STRUCTURE.map(theme => {
               const isExpanded = expandedThemeId === theme.id;
               const activeCount = theme.subtopics.filter(s => selectedKeys.includes(`${theme.id}_${s.id}`)).length;
               
               return (
                 <div key={theme.id} className="border-b border-slate-100 last:border-0 bg-white">
                    <div onClick={() => toggleThemeExpand(theme.id)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                         <span className={`font-bold text-sm ${activeCount > 0 ? 'text-indigo-700' : 'text-slate-700'}`}>
                           {theme.title}
                         </span>
                         {activeCount > 0 && (
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {activeCount} ausgewählt
                            </span>
                         )}
                      </div>
                      <div className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                      </div>
                    </div>
                    <div className={`overflow-hidden transition-all duration-300 bg-slate-50 ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                       <div className="p-2 space-y-1">
                          {theme.subtopics.map(sub => {
                             const key = `${theme.id}_${sub.id}`;
                             const isSelected = selectedKeys.includes(key);
                             const hasDocs = documents.some(d => d.themeId === theme.id && d.subtopicId === sub.id);
                             return (
                               <div key={sub.id} onClick={() => toggleSelection(theme.id, sub.id)} className={`p-3 mx-2 rounded-xl flex items-center justify-between cursor-pointer border transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                                  <div className="flex items-center gap-3">
                                     <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold border ${isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{sub.id}</div>
                                     <span className="text-sm font-medium">{sub.title}</span>
                                  </div>
                                  {hasDocs && !isSelected && (<Icons.Document className="w-4 h-4 text-slate-300" />)}
                               </div>
                             );
                          })}
                       </div>
                    </div>
                 </div>
               );
             })}
          </div>
          <div className="flex gap-3 shrink-0">
            <button onClick={() => { setViewState('list'); setSelectedKeys([]); }} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Abbrechen</button>
            <button onClick={handleCreateExam} disabled={isCreating} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-50">{isCreating ? 'Generiere...' : `Prüfung erstellen (${selectedKeys.length})`}</button>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'taking' && currentExam && currentExam.sections) {
    const section = currentExam.sections[sectionIndex];
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="h-20 border-b flex items-center justify-between px-8 bg-slate-900 text-white shrink-0">
          <div>
            <h2 className="font-bold text-lg">{currentExam.title}</h2>
            <p className="text-xs text-slate-400">{section.title} • {formatTime(timer)}</p>
          </div>
          <button onClick={nextSection} className="bg-indigo-600 px-6 py-2 rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all">
            {sectionIndex === (currentExam.sections?.length || 0) - 1 ? 'Beenden' : 'Weiter >'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 max-w-5xl mx-auto w-full relative">
          <div className="space-y-12 pb-24">
            {(section.parts || []).map((part, pIdx) => (
              <div key={pIdx} className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                <h4 className="font-bold text-indigo-600 mb-4 uppercase text-xs tracking-widest">{part.title}</h4>
                <div className="mb-6 text-sm font-medium text-slate-700 whitespace-pre-line">{safeRender(part.instructions)}</div>
                  <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-300">
                      <div className="mb-4 text-sm text-slate-600 whitespace-pre-wrap max-w-md mx-auto">{part.content}</div>
                      <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 transition-all ${liveState === 'active' ? 'bg-green-500' : liveState === 'speaking' ? 'bg-indigo-500 scale-110' : 'bg-slate-200'}`}>
                          <Icons.Mic className="w-10 h-10 text-white" />
                      </div>
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => startLiveSession(pIdx === 0 ? 'examiner' : pIdx === 1 ? 'colleague' : 'partner', part.content || "", pIdx)} disabled={liveState !== 'idle'} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50">Aufnahme Starten</button>
                        {liveState !== 'idle' && (<button onClick={stopLiveSession} className="px-6 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600">Stop</button>)}
                      </div>
                      {speakingDialogs[pIdx] && (
                         <div className="mt-4 text-left p-4 bg-slate-50 text-xs max-h-40 overflow-y-auto rounded-xl">
                            {speakingDialogs[pIdx].map((t, i) => (
                               <div key={i} className="mb-1"><span className="font-bold">{t.role === 'model' ? 'Prüfer' : 'Du'}:</span> {cleanRealtimeTranscript(t.text)}</div>
                            ))}
                         </div>
                      )}
                  </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- RESULT VIEW ---
  if (viewState === 'result' && currentExam) {
     return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 p-8">
           <div className="max-w-5xl mx-auto bg-white rounded-[2rem] shadow-xl p-10">
              <div className="text-center mb-10">
                  <h2 className="text-3xl font-black text-slate-900 mb-2">Prüfungsergebnis (Sprechen)</h2>
                  <p className="text-slate-500">Offizielle DTB B2 Bewertung</p>
              </div>
              
              <div className="pt-4 border-t border-slate-200">
                 {isGradingSpeaking ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-indigo-600 font-bold animate-pulse">Analysiere Gespräch nach telc Kriterien...</p>
                    </div>
                 ) : speakingResult && speakingResult.partScores ? (
                    <div>
                       {/* TOTAL SCORE CARD */}
                       <div className={`p-6 rounded-2xl border-l-8 mb-8 flex items-center justify-between ${speakingResult.passed ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                           <div>
                               <h3 className={`text-2xl font-black ${speakingResult.passed ? 'text-green-800' : 'text-red-800'}`}>
                                   {speakingResult.totalScore} / 60 Pkt.
                               </h3>
                               <p className={`font-bold ${speakingResult.passed ? 'text-green-600' : 'text-red-600'}`}>
                                   {speakingResult.passed ? 'BESTANDEN' : 'NICHT BESTANDEN'} (min. 36 Pkt.)
                               </p>
                           </div>
                           <div className="text-right max-w-md">
                               <p className="text-sm font-medium italic text-slate-600">"{speakingResult.generalFeedback}"</p>
                           </div>
                       </div>

                       {/* CRITERIA I: TASK FULFILLMENT (GRID) */}
                       <h4 className="text-lg font-black text-slate-800 mb-4 uppercase tracking-widest border-b pb-2">I. Aufgabenbewältigung (30 Pkt.)</h4>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                           <PartScoreCard title="Teil 1A: Thema" score={speakingResult.partScores.part1A} />
                           <PartScoreCard title="Teil 1B: Fragen" score={speakingResult.partScores.part1B} />
                           <PartScoreCard title="Teil 1C: Aspekt" score={speakingResult.partScores.part1C} />
                           <PartScoreCard title="Teil 2: Kollegen" score={speakingResult.partScores.part2} />
                           <PartScoreCard title="Teil 3: Lösung" score={speakingResult.partScores.part3} />
                       </div>

                       {/* GLOBAL CRITERIA */}
                       <h4 className="text-lg font-black text-slate-800 mb-4 uppercase tracking-widest border-b pb-2">Sprachliche Angemessenheit (30 Pkt.)</h4>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                           <PartScoreCard title="II. Aussprache" score={speakingResult.globalScores.pronunciation} />
                           <PartScoreCard title="III. Grammatik" score={speakingResult.globalScores.grammar} />
                           <PartScoreCard title="IV. Wortschatz" score={speakingResult.globalScores.vocabulary} />
                       </div>

                       {/* RECONSTRUCTED TRANSCRIPT */}
                       {speakingResult.reconstructedTranscript && (
                           <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mt-8">
                               <h5 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-4">Protokoll (Rekonstruiert)</h5>
                               <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">
                                   {speakingResult.reconstructedTranscript}
                               </div>
                           </div>
                       )}
                    </div>
                 ) : (
                    <div className="text-center text-slate-400 italic py-10">Keine Daten verfügbar.</div>
                 )}
              </div>

              <div className="text-center mt-10">
                  <button onClick={() => setViewState('list')} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-black transition-all">Zurück zur Übersicht</button>
              </div>
           </div>
        </div>
     );
  }

  return (
    <div className="h-full bg-[#FDFDFD] flex flex-col">
      <div className="p-8 pb-4 border-b flex items-center justify-between bg-white shrink-0">
        <h2 className="text-2xl font-black text-slate-900">DTB B2 Prüfungscenter (Sprechen)</h2>
        <div className="flex gap-3">
          {isAdmin && <button onClick={() => setViewState('create')} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-indigo-700">+ Neuer Test</button>}
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
             <Icons.Minus className="w-6 h-6" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 content-start">
         {exams.length === 0 ? (
            <div className="col-span-3 text-center text-slate-400 py-20 italic">Keine Prüfungen verfügbar.</div>
         ) : (
            exams.map(exam => (
               <div key={exam.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
                  <div className="mb-4">
                     <h3 className="font-bold text-lg text-slate-900 line-clamp-2">{exam.title}</h3>
                     <p className="text-xs text-slate-400 mt-1 line-clamp-1">{exam.topic || 'Allgemein'}</p>
                  </div>
                  <button onClick={() => startExam(exam)} className="mt-auto w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors">Starten</button>
               </div>
            ))
         )}
      </div>
    </div>
  );
};

export default TestView;
