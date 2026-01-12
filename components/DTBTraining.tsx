
import React, { useState, useRef, useEffect } from 'react';
import { gemini, decodeAudioData, decode, createPcmBlob } from '../services/geminiService';
import { Icons } from '../constants';
import { LiveServerMessage } from '@google/genai';
import { DTBSpeakingResult } from '../types';

interface Props {}

type SectionType = 'lesen' | 'hoeren' | 'schreiben' | 'sprechen' | null;

const SECTIONS = [
  { id: 'lesen', label: 'Lesen' },
  { id: 'hoeren', label: 'Hören' },
  { id: 'schreiben', label: 'Schreiben' },
  { id: 'sprechen', label: 'Sprechen' }
] as const;

const DTBTraining: React.FC<Props> = () => {
  const [topic, setTopic] = useState('');
  const [selectedSection, setSelectedSection] = useState<SectionType>(null);
  const [loading, setLoading] = useState(false);
  const [moduleData, setModuleData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<any>(null);

  // Audio & Live State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [liveState, setLiveState] = useState<'idle' | 'connecting' | 'active' | 'speaking'>('idle');
  
  // Speaking Analysis State
  const [transcript, setTranscript] = useState<string>("");
  const [speakingResult, setSpeakingResult] = useState<DTBSpeakingResult | null>(null);
  const [isAnalysingSpeaking, setIsAnalysingSpeaking] = useState(false);
  
  // Audio Refs
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<any>(null);
  const liveSessionRef = useRef<any>(null);
  const speakingTimeoutRef = useRef<any>(null);
  
  // Capture refs for stale closures
  const transcriptRef = useRef<string>("");
  const lastSpeakerRef = useRef<'user' | 'model' | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      stopLiveSession();
    };
  }, []);

  const stopAudio = () => {
    if (playbackSourceRef.current) {
        try { playbackSourceRef.current.stop(); } catch(e) {}
    }
    if (playbackCtxRef.current) {
        try { playbackCtxRef.current.close(); } catch(e) {}
    }
    setIsPlayingAudio(false);
    playbackCtxRef.current = null;
    playbackSourceRef.current = null;
  };

  const stopLiveSession = () => {
    if (liveSessionRef.current) {
        try { liveSessionRef.current.close(); } catch(e) {}
        liveSessionRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.sources.forEach((s: any) => s.stop());
        try { audioContextRef.current.input.close(); } catch(e) {}
        try { audioContextRef.current.output.close(); } catch(e) {}
        audioContextRef.current = null;
    }
    setLiveState('idle');
  };

  const handleGenerate = async (type: SectionType) => {
    if (!topic.trim()) {
        alert("Bitte geben Sie zuerst ein Thema ein.");
        return;
    }
    setLoading(true);
    setSelectedSection(type);
    setModuleData(null);
    setAnswers({});
    setFeedback(null);
    setSpeakingResult(null);
    setTranscript("");
    transcriptRef.current = "";
    lastSpeakerRef.current = null;
    stopAudio();
    stopLiveSession();

    // Timeout Promise
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 25000)
    );

    try {
        const data: any = await Promise.race([
            gemini.generateDTBSection(topic, type!),
            timeoutPromise
        ]);

        if (data && data.parts && data.parts.length > 0) {
            setModuleData(data);
        } else {
            setModuleData(null);
        }
    } catch (e) {
        console.error("Generation failed or timed out", e);
        setModuleData(null);
    } finally {
        setLoading(false);
    }
  };

  const playAudio = async (text: string) => {
    if (isPlayingAudio) {
        stopAudio();
        return;
    }
    
    if (!text) {
        alert("Kein Text für Audio verfügbar.");
        return;
    }

    setIsAudioLoading(true);
    try {
        const base64 = await gemini.generateExamAudio(text);
        if (base64) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
            playbackCtxRef.current = ctx;
            const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            playbackSourceRef.current = source;
            source.start(0);
            setIsPlayingAudio(true);
            source.onended = () => setIsPlayingAudio(false);
        }
    } catch (e: any) {
        console.error(e);
        alert(`Audio Fehler: ${e.message || "Verbindungsproblem"}`);
    } finally {
        setIsAudioLoading(false);
    }
  };

  const startLiveSimulation = async (role: 'examiner' | 'colleague' | 'partner', context: string) => {
      if (liveState !== 'idle') {
          stopLiveSession();
          return;
      }

      setLiveState('connecting');
      setTranscript("");
      transcriptRef.current = "";
      lastSpeakerRef.current = null;
      setSpeakingResult(null);

      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const inputCtx = new AudioContext({ sampleRate: 16000 });
          const outputCtx = new AudioContext({ sampleRate: 24000 });
          audioContextRef.current = { input: inputCtx, output: outputCtx, nextStartTime: 0, sources: new Set() };

          // Construct a specialized prompt including the topic
          const specializedContext = `Thema: ${topic}. Situation: ${context}`;

          const connPromise = gemini.connectLive(specializedContext, [], {
              onopen: () => {
                  setLiveState('active');
                  const source = inputCtx.createMediaStreamSource(stream);
                  const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                  scriptProcessor.onaudioprocess = (e) => {
                      const inputData = e.inputBuffer.getChannelData(0);
                      const pcmBlob = createPcmBlob(inputData);
                      connPromise.then((session: any) => session.sendRealtimeInput({ media: pcmBlob }));
                  };
                  source.connect(scriptProcessor);
                  scriptProcessor.connect(inputCtx.destination);
                  
                  connPromise.then((session: any) => {
                      session.sendRealtimeInput({ text: "Begrüße den Kandidaten und beginne die Simulation." });
                  });
              },
              onmessage: async (message: LiveServerMessage) => {
                  // CAPTURE TRANSCRIPTS FOR ANALYSIS
                  const inputTx = message.serverContent?.inputTranscription?.text;
                  const outputTx = message.serverContent?.outputTranscription?.text;

                  // 1. Handle User Input (Streaming)
                  if (inputTx) {
                      // Check if we need to start a new line for the user
                      if (lastSpeakerRef.current !== 'user') {
                          // Add newline if it's not the very first line
                          const prefix = transcriptRef.current ? "\n" : "";
                          transcriptRef.current += `${prefix}Kandidat: `;
                          lastSpeakerRef.current = 'user';
                      }
                      // Append the chunk directly to the current line
                      transcriptRef.current += inputTx;
                      setTranscript(transcriptRef.current);
                  }

                  // 2. Handle Model Output (Streaming)
                  if (outputTx) {
                      // Check if we need to start a new line for Mari
                      if (lastSpeakerRef.current !== 'model') {
                          const prefix = transcriptRef.current ? "\n" : "";
                          transcriptRef.current += `${prefix}Mari: `;
                          lastSpeakerRef.current = 'model';
                      }
                      // Append the chunk directly
                      transcriptRef.current += outputTx;
                      setTranscript(transcriptRef.current);
                  }

                  const audioB64 = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
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
                          if (sources.size === 0) {
                              speakingTimeoutRef.current = setTimeout(() => {
                                  setLiveState('active');
                              }, 800);
                          }
                      };
                  }
              },
              onclose: () => {
                  setLiveState('idle');
              },
              onerror: () => { stopLiveSession(); alert("Verbindungsfehler"); }
          }, role);
          liveSessionRef.current = await connPromise;
      } catch (e) {
          console.error(e);
          setLiveState('idle');
          alert("Mikrofonfehler.");
      }
  };

  const evaluateSpeakingSession = async () => {
      stopLiveSession();
      
      // Wait a tick to ensure state is settled
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!transcriptRef.current.trim()) {
          alert("Kein Gesprächsprotokoll vorhanden. Bitte sprechen Sie zuerst.");
          return;
      }
      setIsAnalysingSpeaking(true);
      try {
          const result = await gemini.evaluateSpeakingDTB(transcriptRef.current);
          setSpeakingResult(result);
      } catch (e) {
          console.error(e);
          alert("Fehler bei der Bewertung.");
      } finally {
          setIsAnalysingSpeaking(false);
      }
  };

  const evaluate = async () => {
     if (selectedSection === 'schreiben') {
        setLoading(true);
        // Find writing task
        const part = moduleData.parts[0];
        const q = part.questions[0];
        const ans = answers[q.id];
        if (ans) {
            const res = await gemini.evaluateWritingTask(part.content || "Schreibaufgabe", ans, 100);
            setFeedback(res);
        }
        setLoading(false);
     } else {
        // ROBUST AUTO-CHECK FOR MCQ & MATCHING
        let correctCount = 0;
        let total = 0;
        const details: any[] = [];
        
        if (moduleData && moduleData.parts) {
            moduleData.parts.forEach((p: any) => {
                if (p.questions) {
                    p.questions.forEach((q: any) => {
                        const userAns = answers[q.id];
                        const correctAns = q.correctAnswer;
                        const options = q.options || [];
                        
                        // CLEANING STRINGS
                        const cleanUser = String(userAns || "").trim().toLowerCase();
                        const cleanCorrect = String(correctAns || "").trim().toLowerCase();
                        
                        let isCorrect = false;

                        // 1. Direct Text Match
                        if (cleanUser === cleanCorrect && cleanUser !== "") {
                            isCorrect = true;
                        }
                        // 2. Logic Check: If Correct Answer is just a letter "A", but user clicked "A: Option Text"
                        // Or if we need to map index 0->A, 1->B
                        else if (cleanCorrect.length === 1 && options.length > 0) {
                             const selectedIdx = options.findIndex((opt: any) => String(opt).trim().toLowerCase() === cleanUser);
                             if (selectedIdx !== -1) {
                                 // Convert index to letter (0 -> a, 1 -> b, 2 -> c)
                                 const letter = String.fromCharCode(97 + selectedIdx); // 97 is 'a'
                                 if (letter === cleanCorrect) {
                                     isCorrect = true;
                                 }
                             }
                        }
                        // 3. Prefix Check (Fallback): e.g. User "A: Text", Correct "A" (Handled by 2 mostly, but good for safety)
                        // Or User "A", Correct "A" (Handled by 1)
                        else if (cleanUser.startsWith(cleanCorrect + ")") || cleanUser.startsWith(cleanCorrect + ":") || cleanUser.startsWith(cleanCorrect + " ")) {
                            isCorrect = true;
                        }
                        
                        if (isCorrect) {
                            correctCount++;
                        }
                        total++;

                        details.push({
                            id: q.id,
                            text: q.text,
                            userAnswer: userAns,
                            correctAnswer: correctAns,
                            isCorrect: !!isCorrect
                        });
                    });
                }
            });
        }
        setFeedback({ score: correctCount, total, type: 'mcq', details });
     }
  };

  // --- RENDER ---
  const isHoeren = selectedSection === 'hoeren' || selectedSection === 'hören';

  if (loading) {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-white p-6">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-500 font-medium animate-pulse text-center">
                 Mari erstellt deine {selectedSection?.toUpperCase()} Übung zum Thema "{topic}"...<br/>
                 <span className="text-xs text-slate-400 mt-2 block">(Dies kann bis zu 25 Sekunden dauern)</span>
              </p>
          </div>
      );
  }

  if (!selectedSection) {
      // DASHBOARD VIEW
      return (
          <div className="h-full bg-[#F9FBFF] overflow-y-auto custom-scrollbar">
              <div className="min-h-full flex flex-col items-center justify-center p-8 pb-32">
                  <div className="max-w-2xl w-full text-center">
                      <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-indigo-600">
                          <Icons.GraduationCap className="w-10 h-10" />
                      </div>
                      <h2 className="text-3xl font-black text-slate-900 mb-2">DTB B2 Training Center</h2>
                      <p className="text-slate-500 mb-10">Wähle ein Thema und trainiere gezielt Prüfungsbereiche.</p>
                      
                      <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 mb-10">
                          <label className="block text-left text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Dein Thema</label>
                          <input 
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="z.B. Pflege, Logistik, Büro, Beschwerde..."
                            className="w-full text-lg font-bold p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                          />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {SECTIONS.map((sec) => (
                              <button
                                key={sec.id}
                                onClick={() => handleGenerate(sec.id as SectionType)}
                                className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-left"
                              >
                                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 group-hover:text-indigo-400">Modul</span>
                                  <span className="text-xl font-black text-slate-800 group-hover:text-indigo-700">{sec.label}</span>
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // --- ERROR VIEW (If data generation failed) ---
  if (!moduleData || !moduleData.parts || moduleData.parts.length === 0) {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-white p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                  <Icons.Refresh className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hoppla!</h3>
              <p className="text-slate-500 mb-6 max-w-sm">
                  Mari konnte die Übung für "{topic}" nicht erstellen. Bitte versuche es noch einmal.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setSelectedSection(null)} 
                  className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Zurück
                </button>
                <button 
                  onClick={() => handleGenerate(selectedSection)}
                  className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
                >
                  Erneut versuchen
                </button>
              </div>
          </div>
      );
  }

  // ACTIVE MODULE VIEW
  return (
      <div className="h-full flex flex-col bg-white">
          <div className="h-20 border-b flex items-center justify-between px-8 bg-slate-50 shrink-0">
              <div>
                  <h3 className="font-bold text-lg text-slate-900 capitalize">{SECTIONS.find(s => s.id === selectedSection)?.label || selectedSection} - {topic}</h3>
                  <p className="text-xs text-slate-400">DTB B2 Simulation</p>
              </div>
              <button onClick={() => setSelectedSection(null)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">
                  Beenden
              </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 min-h-0">
              <div className="max-w-3xl mx-auto space-y-8 pb-32">
                  {moduleData.parts.map((part: any, idx: number) => (
                      <div key={idx} className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
                          <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-4">{part.title}</h4>
                          {part.instructions && (
                             <p className="text-sm font-medium text-slate-700 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">{part.instructions}</p>
                          )}
                          
                          {/* CONTENT DISPLAY */}
                          {/* Special Handling for Matching Type */}
                          {part.type === 'matching' ? (
                            <div className="mb-8">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                  {/* Render content as cards assuming format A: ... B: ... */}
                                  {part.content.split(/\n\n(?=[A-F]:)/).map((block: string, i: number) => (
                                     <div key={i} className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-50 text-sm text-slate-700 whitespace-pre-wrap">
                                        <span className="font-bold text-indigo-600 mr-2">{block.substring(0,2)}</span>
                                        {block.substring(2)}
                                     </div>
                                  ))}
                               </div>
                            </div>
                          ) : (
                             /* Standard Text Content */
                             selectedSection === 'lesen' && (
                                <div className="prose prose-sm max-w-none mb-8 p-6 bg-indigo-50/50 rounded-2xl whitespace-pre-wrap leading-relaxed border border-indigo-50 text-slate-700 font-serif">
                                    {part.content}
                                </div>
                             )
                          )}

                          {isHoeren && (
                              <div className="mb-8">
                                  {/* Audio Player Box - Always Visible if Section is Hoeren */}
                                  <div className="flex items-center gap-4 bg-slate-900 text-white p-5 rounded-2xl shadow-lg shadow-indigo-200/50">
                                      <button 
                                        onClick={() => playAudio(part.content)} 
                                        disabled={isAudioLoading}
                                        className="w-14 h-14 flex items-center justify-center bg-indigo-500 rounded-full hover:bg-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                                      >
                                          {isAudioLoading ? (
                                              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                          ) : isPlayingAudio ? (
                                              <Icons.Stop className="w-6 h-6"/> 
                                          ) : (
                                              <Icons.Mic className="w-6 h-6 group-hover:scale-110 transition-transform"/>
                                          )}
                                      </button>
                                      <div className="flex-1">
                                          <div className="text-sm font-bold mb-1">
                                              {isAudioLoading ? 'Audio wird generiert...' : isPlayingAudio ? 'Wiedergabe läuft...' : 'Hörtext abspielen'}
                                          </div>
                                          {isPlayingAudio ? (
                                             <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-400 w-full animate-[width_30s_linear]"></div>
                                             </div>
                                          ) : (
                                             <div className="text-[10px] text-slate-400">Klicken zum Starten</div>
                                          )}
                                      </div>
                                  </div>
                                  
                                  {/* Error Handling if content is missing */}
                                  {!part.content && (
                                     <div className="mt-2 text-center text-red-500 text-xs font-bold">
                                         Achtung: Kein Hörtext gefunden. Bitte neu generieren.
                                     </div>
                                  )}
                              </div>
                          )}

                          {selectedSection === 'schreiben' && (
                              <div className="mb-6">
                                  <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-yellow-900 text-sm mb-4 whitespace-pre-wrap">
                                      {part.content}
                                  </div>
                                  <textarea 
                                    className="w-full h-64 p-4 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Schreiben Sie hier Ihren Text..."
                                    onChange={(e) => setAnswers(prev => ({...prev, [part.questions[0].id]: e.target.value}))}
                                  ></textarea>
                              </div>
                          )}

                          {selectedSection === 'sprechen' && (
                              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                                  <div className="mb-4 text-sm text-slate-600 whitespace-pre-wrap max-w-md mx-auto">{part.content}</div>
                                  <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 transition-all ${liveState === 'active' ? 'bg-green-500 shadow-xl shadow-green-200' : liveState === 'speaking' ? 'bg-indigo-500 scale-110' : 'bg-slate-200'}`}>
                                      <Icons.Mic className="w-10 h-10 text-white" />
                                  </div>
                                  
                                  <div className="flex gap-2 justify-center mb-6">
                                    <button 
                                        onClick={() => startLiveSimulation(idx === 0 ? 'examiner' : idx === 1 ? 'colleague' : 'partner', part.content)}
                                        disabled={liveState !== 'idle'}
                                        className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        Starten
                                    </button>
                                    {(liveState !== 'idle') && (
                                        <button 
                                            onClick={evaluateSpeakingSession}
                                            className="px-6 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600"
                                        >
                                            Beenden & Bewerten
                                        </button>
                                    )}
                                  </div>

                                  {/* Live Transcript Preview */}
                                  {transcript && (
                                      <div className="mt-4 text-left bg-white p-4 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Live Transkript</p>
                                          <pre className="whitespace-pre-wrap text-xs text-slate-600 font-sans">{transcript}</pre>
                                      </div>
                                  )}
                              </div>
                          )}

                          {/* QUESTIONS (Lesen/Hören) */}
                          {part.questions && part.questions.length > 0 && (selectedSection === 'lesen' || isHoeren) && (
                              <div className="space-y-4 animate-fade-in">
                                  {part.questions.map((q: any) => (
                                      <div key={q.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                          <p className="font-bold text-sm text-slate-800 mb-3">{q.text}</p>
                                          
                                          {/* MATCHING UI or STANDARD UI */}
                                          {part.type === 'matching' ? (
                                             <div className="flex flex-wrap gap-2">
                                                 {q.options?.map((opt: string) => (
                                                     <button 
                                                       key={opt}
                                                       onClick={() => setAnswers(prev => ({...prev, [q.id]: opt}))}
                                                       className={`w-10 h-10 flex items-center justify-center font-bold rounded-lg transition-all ${answers[q.id] === opt ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'}`}
                                                     >
                                                         {opt}
                                                     </button>
                                                 ))}
                                             </div>
                                          ) : (
                                              <div className="grid grid-cols-1 gap-2">
                                                  {q.options?.map((opt: string) => (
                                                      <button 
                                                        key={opt}
                                                        onClick={() => setAnswers(prev => ({...prev, [q.id]: opt}))}
                                                        className={`p-3 text-left text-xs font-medium rounded-lg transition-all ${answers[q.id] === opt ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'}`}
                                                      >
                                                          {opt}
                                                      </button>
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  ))}

                  {/* EVALUATION SECTION FOR READING/LISTENING/WRITING */}
                  {selectedSection !== 'sprechen' && (
                      <div className="pt-4">
                          <button onClick={evaluate} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-black shadow-xl">
                              Ergebnis prüfen
                          </button>
                      </div>
                  )}

                  {/* SPEAKING EVALUATION RESULT */}
                  {isAnalysingSpeaking && (
                      <div className="p-8 text-center animate-pulse">
                          <p className="font-bold text-indigo-600">Gespräch wird analysiert (DTB B2 Kriterien)...</p>
                      </div>
                  )}

                  {speakingResult && (
                      <div className="bg-white border-2 border-indigo-100 p-8 rounded-3xl shadow-xl animate-fade-in space-y-6">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                              <h4 className="text-xl font-black text-indigo-900">DTB B2 Ergebnis</h4>
                              <div className={`px-4 py-2 rounded-lg font-bold ${speakingResult.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {speakingResult.totalScore} / 60 Pkt. ({speakingResult.passed ? 'Bestanden' : 'Nicht bestanden'})
                              </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Kriterium I */}
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <div className="flex justify-between items-center mb-2">
                                      <span className="font-bold text-sm text-slate-700">Inhalt (Task)</span>
                                      <span className="font-black text-indigo-600">{speakingResult.scores.content.score} / 30</span>
                                  </div>
                                  <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                                      <div className="bg-indigo-600 h-1.5 rounded-full" style={{width: `${(speakingResult.scores.content.score / 30) * 100}%`}}></div>
                                  </div>
                                  <p className="text-xs text-slate-500 italic">{speakingResult.scores.content.comment}</p>
                              </div>

                              {/* Kriterium II - Aussprache */}
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <div className="flex justify-between items-center mb-2">
                                      <span className="font-bold text-sm text-slate-700">Aussprache</span>
                                      <span className="font-black text-indigo-600">{speakingResult.scores.pronunciation.score} / 10</span>
                                  </div>
                                  <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                                      <div className="bg-indigo-600 h-1.5 rounded-full" style={{width: `${(speakingResult.scores.pronunciation.score / 10) * 100}%`}}></div>
                                  </div>
                                  <p className="text-xs text-slate-500 italic">{speakingResult.scores.pronunciation.comment}</p>
                              </div>

                              {/* Kriterium III - Grammatik */}
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <div className="flex justify-between items-center mb-2">
                                      <span className="font-bold text-sm text-slate-700">Grammatik</span>
                                      <span className="font-black text-indigo-600">{speakingResult.scores.grammar.score} / 10</span>
                                  </div>
                                  <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                                      <div className="bg-indigo-600 h-1.5 rounded-full" style={{width: `${(speakingResult.scores.grammar.score / 10) * 100}%`}}></div>
                                  </div>
                                  <p className="text-xs text-slate-500 italic">{speakingResult.scores.grammar.comment}</p>
                              </div>

                              {/* Kriterium IV - Wortschatz */}
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <div className="flex justify-between items-center mb-2">
                                      <span className="font-bold text-sm text-slate-700">Wortschatz</span>
                                      <span className="font-black text-indigo-600">{speakingResult.scores.vocabulary.score} / 10</span>
                                  </div>
                                  <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                                      <div className="bg-indigo-600 h-1.5 rounded-full" style={{width: `${(speakingResult.scores.vocabulary.score / 10) * 100}%`}}></div>
                                  </div>
                                  <p className="text-xs text-slate-500 italic">{speakingResult.scores.vocabulary.comment}</p>
                              </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                              <div>
                                  <h5 className="font-bold text-green-600 mb-3 flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" /></svg>
                                      Stärken (Pros)
                                  </h5>
                                  <ul className="space-y-2">
                                      {speakingResult.details.pros.map((pro, i) => (
                                          <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                              <span className="text-green-500 mt-1">•</span> {pro}
                                          </li>
                                      ))}
                                  </ul>
                              </div>
                              <div>
                                  <h5 className="font-bold text-red-500 mb-3 flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" /></svg>
                                      Verbesserungspotenzial (Cons)
                                  </h5>
                                  <ul className="space-y-2">
                                      {speakingResult.details.cons.map((con, i) => (
                                          <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                              <span className="text-red-400 mt-1">•</span> {con}
                                          </li>
                                      ))}
                                  </ul>
                              </div>
                          </div>
                          
                          <div className="bg-indigo-50 p-4 rounded-xl text-sm text-indigo-900 leading-relaxed italic border border-indigo-100">
                              "{speakingResult.generalFeedback}"
                          </div>
                      </div>
                  )}

                  {feedback && selectedSection !== 'sprechen' && (
                      <div className="bg-white border-2 border-indigo-100 p-8 rounded-3xl shadow-xl animate-fade-in">
                          <h4 className="text-xl font-black text-indigo-900 mb-6 border-b border-indigo-50 pb-4">Auswertung</h4>
                          {feedback.type === 'mcq' ? (
                              <div className="space-y-8">
                                  <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200">
                                      <div className={`text-4xl font-black mb-2 ${feedback.score >= feedback.total * 0.6 ? 'text-green-500' : 'text-red-500'}`}>
                                          {feedback.score} / {feedback.total}
                                      </div>
                                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Richtige Antworten</p>
                                  </div>

                                  <div className="space-y-4">
                                      {feedback.details && feedback.details.length > 0 ? (
                                        feedback.details.map((item: any, i: number) => (
                                          <div key={i} className={`p-4 rounded-xl border-l-4 ${item.isCorrect ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                                              <p className="font-bold text-sm text-slate-800 mb-3">{item.text}</p>
                                              
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                                  <div className="bg-white/50 p-2 rounded-lg">
                                                      <span className="block text-slate-400 font-bold uppercase text-[9px] mb-1">Ihre Antwort</span>
                                                      <span className={`font-bold ${item.isCorrect ? 'text-green-700' : 'text-red-600'}`}>
                                                          {item.userAnswer || '---'}
                                                      </span>
                                                  </div>
                                                  {!item.isCorrect && (
                                                      <div className="bg-white/50 p-2 rounded-lg">
                                                          <span className="block text-slate-400 font-bold uppercase text-[9px] mb-1">Richtige Lösung</span>
                                                          <span className="font-bold text-slate-800">
                                                              {item.correctAnswer || 'N/A'}
                                                          </span>
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-center p-4 text-slate-500 italic">Keine Details verfügbar.</div>
                                      )}
                                  </div>
                              </div>
                          ) : (
                              <div>
                                  <div className={`text-lg font-bold mb-2 ${feedback.passed ? 'text-green-600' : 'text-red-500'}`}>
                                      {feedback.passed ? 'Bestanden' : 'Nicht bestanden'} ({feedback.score} Pkt.)
                                  </div>
                                  <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{feedback.feedback}</p>
                              </div>
                          )}
                      </div>
                  )}
              </div>
          </div>
      </div>
  );
};

export default DTBTraining;
