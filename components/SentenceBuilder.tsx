
import React, { useState, useEffect, useRef } from 'react';
import { WordOption, SentenceState, GrammarExercise } from '../types';
import { GRAMMAR_MODES, Icons } from '../constants';
import { addGrammarExercise, getGrammarExercises, getAllGrammarExercises, deleteGrammarExercise, auth, ADMIN_EMAIL } from '../services/firebase';

const SLOT_COLORS = [
    'bg-blue-100 text-blue-800 border-blue-200',   // Slot 1: Subjekt
    'bg-red-100 text-red-800 border-red-200',     // Slot 2: Verb 1
    'bg-amber-100 text-amber-800 border-amber-200', // Slot 3: Mittelfeld / Zeit
    'bg-emerald-100 text-emerald-800 border-emerald-200', // Slot 4: Mittelfeld / Ort
    'bg-purple-100 text-purple-800 border-purple-200', // Slot 5: Verb 2
    'bg-slate-100 text-slate-800 border-slate-200', // Slot 6+
];

const SentenceBuilder: React.FC = () => {
  // STATE MACHINE: 'selection' | 'building' | 'complete' | 'admin'
  const [viewState, setViewState] = useState<'selection' | 'building' | 'complete' | 'admin'>('selection');
  
  // LOGIC STATE
  // "Matrix" holds unique words for each slot index: matrix[0] = ["Ich", "Wir", ...], matrix[1] = ["muss", "kann", ...]
  const [wordMatrix, setWordMatrix] = useState<string[][]>([]); 
  const [currentStep, setCurrentStep] = useState(0);
  
  // UI STATE
  const [sentenceState, setSentenceState] = useState<SentenceState>({
    words: [],
    isComplete: false,
    modeId: null
  });
  const [currentOptions, setCurrentOptions] = useState<WordOption[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ADMIN STATE
  const [adminModeId, setAdminModeId] = useState<string>(GRAMMAR_MODES[0].id);
  const [adminInput, setAdminInput] = useState("");
  const [adminList, setAdminList] = useState<GrammarExercise[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const user = auth.currentUser;
  
  // Check Admin (Case insensitive)
  const isAdmin = user?.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentOptions, sentenceState.words]);

  // --- GAME LOGIC ---

  const selectMode = async (modeId: string) => {
    setLoading(true);

    try {
        let exercises: GrammarExercise[] = [];
        
        if (modeId === 'big_test_mixed') {
            exercises = await getAllGrammarExercises();
        } else {
            exercises = await getGrammarExercises(modeId);
        }
        
        if (exercises.length === 0) {
            alert("Henüz bu kategoride cümle yok. Lütfen Admin panelinden ekleyin.");
            setLoading(false);
            return;
        }

        // --- MATRIX GENERATION (Substitution Logic) ---
        // 1. Determine the maximum sentence length in this set to establish slots
        const maxLength = Math.max(...exercises.map(e => e.segments.length));
        
        // 2. Build Columns
        const matrix: string[][] = [];
        for (let i = 0; i < maxLength; i++) {
            // Collect all words at position 'i' from all exercises
            const wordsAtPosition = new Set<string>();
            exercises.forEach(ex => {
                if (ex.segments[i]) {
                    wordsAtPosition.add(ex.segments[i].text);
                }
            });
            // Convert Set to Array and Shuffle
            matrix.push(Array.from(wordsAtPosition).sort(() => 0.5 - Math.random()));
        }

        setWordMatrix(matrix);
        setSentenceState({ words: [], isComplete: false, modeId });
        setCurrentStep(0);
        setViewState('building');
        
        // Show first column options
        showOptionsForStep(0, matrix);

    } catch (e) {
        console.error(e);
        alert("Fehler beim Laden der Übungen.");
    } finally {
        setLoading(false);
    }
  };

  const showOptionsForStep = (stepIndex: number, matrix: string[][]) => {
      // If we are beyond the matrix or the current column is empty, we are done.
      if (stepIndex >= matrix.length || !matrix[stepIndex] || matrix[stepIndex].length === 0) {
          setSentenceState(prev => ({ ...prev, isComplete: true }));
          setViewState('complete');
          return;
      }

      const words = matrix[stepIndex];

      const options: WordOption[] = words.map((text, idx) => ({
          id: `step-${stepIndex}-${idx}-${text}`, 
          text: text,
          role: 'option',
          slot: 'mittelfeld',
          isCorrect: true // In substitution drills, all offered options are structurally valid choices
      }));

      setCurrentOptions(options);
  };

  const handleWordSelect = (option: WordOption) => {
      // Add word to sentence
      const newWords = [...sentenceState.words, option];
      setSentenceState(prev => ({ ...prev, words: newWords }));
      
      // Advance
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      showOptionsForStep(nextStep, wordMatrix);
  };

  const restartSameDrill = () => {
      // Re-shuffle the existing matrix for variety
      const shuffledMatrix = wordMatrix.map(col => col.sort(() => 0.5 - Math.random()));
      setWordMatrix(shuffledMatrix);
      
      setSentenceState(prev => ({ ...prev, words: [], isComplete: false }));
      setCurrentStep(0);
      setViewState('building');
      showOptionsForStep(0, shuffledMatrix);
  };

  const reset = () => {
    setViewState('selection');
    setSentenceState({ words: [], isComplete: false, modeId: null });
    setCurrentOptions([]);
    setWordMatrix([]);
  };

  // --- ADMIN FUNCTIONS ---

  const parseAndAddSentence = async () => {
      if (!adminInput.trim()) return;
      setIsProcessing(true);
      
      try {
        const parts = adminInput.split('|').map(s => s.trim()).filter(s => s.length > 0);
        if (parts.length < 2) {
            alert("Bitte geben Sie mindestens 2 Teile ein (getrennt durch | ).");
            setIsProcessing(false);
            return;
        }

        const segments = parts.map((text, idx) => ({
            text,
            role: idx === 0 ? 'Start' : idx === parts.length - 1 ? 'Ende' : 'Mitte'
        }));

        const newExercise: GrammarExercise = {
            modeId: adminModeId,
            segments,
            createdAt: Date.now()
        };

        await addGrammarExercise(newExercise);
        setAdminInput("");
        await loadAdminList(adminModeId);
      } catch (e) {
        console.error("Add error:", e);
        alert("Fehler beim Hinzufügen.");
      } finally {
        setIsProcessing(false);
      }
  };

  const handleLoadDemoData = async () => {
      if (!window.confirm(`Möchtest du 10 perfekte Beispiel-Sätze für 'Modalverben' generieren?`)) return;
      
      setIsProcessing(true);
      try {
          const demoSentences = [
              "Ich | muss | heute | arbeiten",
              "Du | kannst | morgen | kommen",
              "Er | will | nach Hause | gehen",
              "Wir | dürfen | hier | essen",
              "Ihr | sollt | die Aufgaben | machen",
              "Sie | möchten | einen Kaffee | trinken",
              "Mein Bruder | kann | gut | schwimmen",
              "Die Kinder | müssen | früh | schlafen",
              "Wir | wollen | am Abend | grillen",
              "Der Chef | muss | das Dokument | unterschreiben"
          ];
          
          for (const s of demoSentences) {
               const segments = s.split('|').map((text, idx) => ({
                    text: text.trim(),
                    role: 'part'
               }));
               await addGrammarExercise({
                   modeId: 'modalverben', // Force to modalverben for demo
                   segments,
                   createdAt: Date.now()
               });
          }
          alert("10 Sätze erfolgreich hinzugefügt! Bitte wechsle zu 'Modalverben' um sie zu sehen.");
          setAdminModeId('modalverben');
          await loadAdminList('modalverben');
      } catch (e) {
          console.error(e);
          alert("Fehler beim Laden der Demo-Daten.");
      } finally {
          setIsProcessing(false);
      }
  };

  const loadAdminList = async (modeId: string) => {
      setLoading(true);
      try {
        const list = await getGrammarExercises(modeId);
        const sorted = list.sort((a, b) => b.createdAt - a.createdAt);
        setAdminList(sorted);
      } catch (e) {
          console.error("Fetch error:", e);
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async (id: string) => {
      if (!id) return;
      if (window.confirm("Diesen Satz wirklich löschen?")) {
          setIsProcessing(true);
          try {
             await deleteGrammarExercise(id);
             setAdminList(prev => prev.filter(item => item.id !== id));
             await loadAdminList(adminModeId);
          } catch(e) {
             console.error("Delete error", e);
             alert("Löschen fehlgeschlagen.");
          } finally {
             setIsProcessing(false);
          }
      }
  };

  // --- VIEWS ---

  if (viewState === 'admin') {
      return (
          <div className="h-full bg-slate-50 p-4 md:p-8 overflow-y-auto">
              <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-3xl shadow-xl">
                  {/* Admin Header & Logic */}
                  <div className="flex justify-between items-center mb-6 border-b pb-4">
                      <div>
                        <h2 className="text-2xl font-black text-slate-900">Admin: Cümle Havuzu</h2>
                        <p className="text-xs text-slate-400">Her yapı için birden fazla cümle ekleyin. Sistem bunları sütunlara ayıracaktır.</p>
                      </div>
                      <button 
                        onClick={() => setViewState('selection')} 
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                      >
                        Schließen
                      </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Kategorie wählen</label>
                          <select 
                            value={adminModeId}
                            onChange={(e) => { setAdminModeId(e.target.value); loadAdminList(e.target.value); }}
                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                              {GRAMMAR_MODES.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                          </select>
                          
                          <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                             <h4 className="font-bold text-indigo-900 text-sm mb-2">Schnellstart</h4>
                             <p className="text-xs text-indigo-700 mb-3">Füge automatisch 10 Modalverb-Sätze hinzu, um die Funktion "Substitution Drill" perfekt zu testen.</p>
                             <button 
                                onClick={handleLoadDemoData}
                                disabled={isProcessing}
                                className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                             >
                                ✨ 10 Demo-Sätze laden
                             </button>
                          </div>
                      </div>
                      <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Neuer Satz (Trenne mit | )</label>
                            <div className="flex gap-2">
                                <input 
                                    value={adminInput}
                                    onChange={(e) => setAdminInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && parseAndAddSentence()}
                                    placeholder="Ich | muss | heute | arbeiten"
                                    className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                />
                                <button 
                                    onClick={parseAndAddSentence} 
                                    disabled={isProcessing || !adminInput.trim()}
                                    className="px-5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                    {isProcessing ? '...' : '+'}
                                </button>
                             </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                                <strong>Önemli:</strong> Cümleleri aynı sayıda parçaya bölün. Örn: 4 parça.<br/>
                                <i>Ich | kann | es | machen</i><br/>
                                <i>Wir | müssen | jetzt | gehen</i>
                            </p>
                          </div>
                      </div>
                  </div>
                  <div className="border-t pt-6">
                      <div className="flex items-center justify-between mb-4">
                         <h3 className="font-bold text-slate-800">Eklenen Cümleler ({adminList.length})</h3>
                         <button onClick={() => loadAdminList(adminModeId)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Aktualisieren</button>
                      </div>
                      {loading ? (
                          <div className="text-center py-10 text-slate-400">Lade Daten...</div>
                      ) : (
                          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar bg-slate-50 p-2 rounded-xl border border-slate-100">
                              {adminList.length === 0 ? (
                                  <p className="text-center py-8 text-slate-400 text-sm italic">Bu kategoride henüz cümle yok.</p>
                              ) : (
                                  adminList.map(ex => (
                                      <div key={ex.id} className="flex flex-col p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                                          <div className="flex justify-between items-center">
                                              <div className="flex flex-wrap gap-1.5 items-center">
                                                  {ex.segments.map((s, i) => (
                                                      <span key={i} className={`px-2 py-1 rounded text-sm font-medium border ${SLOT_COLORS[i % SLOT_COLORS.length]}`}>
                                                        {s.text}
                                                      </span>
                                                  ))}
                                              </div>
                                              <button 
                                                onClick={() => ex.id && handleDelete(ex.id)} 
                                                disabled={isProcessing}
                                                className="ml-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                                title="Löschen"
                                              >
                                                  X
                                              </button>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  if (viewState === 'selection') {
    const categories = Array.from(new Set(GRAMMAR_MODES.map(m => m.category)));
    
    return (
      <div className="h-full bg-[#F9FBFF] overflow-y-auto custom-scrollbar p-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 relative">
            {isAdmin && (
                <button 
                  onClick={() => { setViewState('admin'); loadAdminList(adminModeId); }}
                  className="absolute right-0 top-0 text-xs font-bold bg-slate-800 text-white px-4 py-2 rounded-full hover:bg-slate-700 shadow-lg hover:shadow-xl transition-all"
                >
                    Admin Panel
                </button>
            )}
            <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-indigo-600 shadow-lg shadow-indigo-100">
               <Icons.Puzzle className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">Cümle Fabrikası</h2>
            <p className="text-slate-500 text-lg">Kelime bloklarını birleştir, binlerce cümle kur.</p>
          </div>

          <div className="space-y-8">
            {/* BIG TEST BANNER */}
            <div>
               <h3 className="text-sm font-black text-indigo-500 uppercase tracking-widest mb-4 ml-2">Serbest Mod</h3>
               <button
                  onClick={() => selectMode('big_test_mixed')}
                  className="w-full text-left bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-3xl shadow-xl shadow-indigo-200 hover:scale-[1.01] hover:shadow-2xl transition-all group relative overflow-hidden"
                >
                  <div className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="font-black text-white text-2xl mb-2">Karışık Cümleler</h4>
                            <p className="text-indigo-100 font-medium">Bütün yapılarla rastgele kombinasyonlar.</p>
                        </div>
                        <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                            <span className="text-2xl">🎲</span>
                        </div>
                    </div>
                  </div>
               </button>
            </div>

            {categories.map(cat => (
              <div key={cat}>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">{cat}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {GRAMMAR_MODES.filter(m => m.category === cat).map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => selectMode(mode.id)}
                      className="text-left bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-300 hover:scale-[1.02] transition-all group relative overflow-hidden"
                    >
                      <h4 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-indigo-700 relative z-10">{mode.title}</h4>
                      <p className="text-xs text-slate-400 relative z-10">{mode.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // BUILDING & COMPLETE VIEW
  const isMixedMode = sentenceState.modeId === 'big_test_mixed';
  const currentTitle = isMixedMode ? "Serbest Çalışma" : (GRAMMAR_MODES.find(m => m.id === sentenceState.modeId)?.title || "Alıştırma");

  return (
    <div className="h-full flex flex-col bg-[#F9FBFF]">
      {/* HEADER */}
      <div className="h-20 border-b flex items-center justify-between px-8 bg-white/80 backdrop-blur-md shrink-0 sticky top-0 z-20">
         <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                {currentTitle}
            </h3>
            <p className="text-xs text-slate-400">Substitution Drill (Yerine Koyma)</p>
         </div>

         <div className="flex items-center gap-4">
             <button onClick={reset} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">
                Menüye Dön
             </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 flex flex-col items-center" ref={scrollRef}>
         <div className="max-w-3xl w-full flex flex-col gap-6">
            
            {/* PROGRESS BAR */}
            {viewState === 'building' && (
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${(currentStep / wordMatrix.length) * 100}%` }}></div>
                </div>
            )}

            {/* SENTENCE STRIP DISPLAY */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 min-h-[160px] flex flex-col justify-center items-center transition-all duration-500">
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                   {sentenceState.words.map((w, i) => (
                     <span key={i} className={`animate-fade-in px-4 py-2 rounded-xl text-2xl font-bold border-2 shadow-sm transition-all hover:scale-105 cursor-default ${SLOT_COLORS[i % SLOT_COLORS.length]}`}>
                        {w.text}
                     </span>
                   ))}
                   {!sentenceState.isComplete && (
                      <span className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-indigo-400 animate-spin mt-2"></span>
                   )}
                </div>
                {sentenceState.words.length === 0 && (
                   <p className="text-slate-400 text-sm font-medium">Cümleyi kurmaya başlamak için bir kelime seç.</p>
                )}
            </div>

            {/* OPTIONS AREA - SLOT MACHINE POOL */}
            {viewState === 'building' ? (
               <div className="space-y-4">
                  <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                     Sıradaki Kelimeyi Seç (Adım {currentStep + 1})
                  </p>
                  
                  <div className="flex flex-wrap justify-center gap-3 animate-fade-in">
                      {currentOptions.map((opt, idx) => {
                          const slotColorClass = SLOT_COLORS[currentStep % SLOT_COLORS.length];
                          // Parse base classes to inject hover colors dynamically if needed, 
                          // but simpler to just use a standard interactive style
                          return (
                            <button
                              key={opt.id}
                              onClick={() => handleWordSelect(opt)}
                              className={`px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl text-xl font-bold text-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-all active:scale-95`}
                            >
                               {opt.text}
                            </button>
                          );
                      })}
                  </div>
               </div>
            ) : (
               <div className="text-center py-8 animate-fade-in">
                  <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-100">
                     <span className="text-4xl">✨</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Harika Cümle!</h3>
                  <p className="text-slate-500 mb-8">Bu yapı ile oluşturabileceğin yüzlerce farklı cümle var.</p>
                  
                  <div className="flex justify-center gap-4">
                      <button 
                        onClick={restartSameDrill}
                        className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-xl hover:scale-105 transition-all"
                      >
                        Yeni Kombinasyon Dene
                      </button>
                  </div>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default SentenceBuilder;
