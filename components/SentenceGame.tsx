
import React, { useState, useEffect, useRef } from 'react';
import { GameQuestion, GameValidationResult } from '../types';
import { subscribeToGameQuestions, addGameQuestionsBatch, clearAllGameQuestions, auth, ADMIN_EMAIL, updateUserLeaderboardScore } from '../services/firebase';
import { gemini } from '../services/geminiService';
import { Icons, GAME_TOPICS } from '../constants';
import Leaderboard from './Leaderboard';

const SentenceGame: React.FC = () => {
    // GAME STATE
    const [questions, setQuestions] = useState<GameQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [pool, setPool] = useState<string[]>([]); // Available words
    const [sentence, setSentence] = useState<string[]>([]); // Constructed sentence
    const [score, setScore] = useState(0);
    
    // UI STATE
    const [loading, setLoading] = useState(true);
    const [validating, setValidating] = useState(false);
    const [result, setResult] = useState<GameValidationResult | null>(null);
    const [gameFinished, setGameFinished] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    
    // ADMIN STATE: Rotation Logic
    // Start index for rotation. Default 0.
    const [rotationIndex, setRotationIndex] = useState(0); 
    const [generating, setGenerating] = useState(false);

    const user = auth.currentUser;
    const isAdmin = user?.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

    // 1. Load Questions
    useEffect(() => {
        const unsubscribe = subscribeToGameQuestions((data) => {
            setQuestions(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Initialize or Update Current Question
    useEffect(() => {
        if (questions.length > 0 && currentIndex < questions.length) {
             const q = questions[currentIndex];
             // Reset logic: Only if pool is empty OR it's a new question index
             if ((pool.length === 0 && sentence.length === 0 && !result && !gameFinished)) {
                 if (q.wordList && q.wordList.length > 0) {
                     const shuffled = [...q.wordList].sort(() => Math.random() - 0.5);
                     setPool(shuffled);
                     setSentence([]);
                     setResult(null);
                     setShowHint(false); // Reset hint state for new question
                 } else {
                     // Fallback if pool is empty from DB (should ideally not happen)
                     console.warn("Empty word list for question:", q.id);
                 }
             }
        }
    }, [questions, currentIndex, gameFinished]);

    const handleWordClick = (word: string, from: 'pool' | 'sentence', index: number) => {
        if (result) return; // Locked if result shown

        if (from === 'pool') {
            const newPool = [...pool];
            newPool.splice(index, 1);
            setPool(newPool);
            setSentence([...sentence, word]);
        } else {
            const newSentence = [...sentence];
            newSentence.splice(index, 1);
            setSentence(newSentence);
            setPool([...pool, word]);
        }
    };

    const checkAnswer = async () => {
        if (sentence.length < 2) return;
        setValidating(true);
        const currentQ = questions[currentIndex];
        
        const finalSentence = sentence.join(' ');
        
        try {
            const validation = await gemini.validateGameSentence(currentQ.task, finalSentence);
            setResult(validation);
            const change = validation.scoreChange;
            setScore(prev => prev + change);
            
            // --- Update Global Leaderboard ---
            if (user && change !== 0) {
               await updateUserLeaderboardScore(user, change);
            }

        } catch (e) {
            console.error(e);
            alert("Fehler bei der Überprüfung.");
        } finally {
            setValidating(false);
        }
    };

    const nextQuestion = () => {
        setPool([]); 
        setSentence([]);
        setResult(null);
        setShowHint(false);

        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setGameFinished(true);
        }
    };

    const giveUp = async () => {
        if (window.confirm("Bu soruyu atlamak istiyor musun? (-5 Puan)")) {
            setScore(prev => prev - 5);
            if (user) await updateUserLeaderboardScore(user, -5);
            nextQuestion();
        }
    };
    
    const clearSentence = () => {
        setPool(prev => [...prev, ...sentence]);
        setSentence([]);
    };

    const restartGame = () => {
        setScore(0);
        setCurrentIndex(0);
        setGameFinished(false);
        setPool([]);
        setSentence([]);
        setResult(null);
        setShowHint(false);
    };

    const handleExit = () => {
        if(window.confirm("Oyundan çıkmak istiyor musun?")) {
            window.location.reload(); 
        }
    };

    // ADMIN: Generate Mixed Questions (5 Topics x 2 Questions)
    const handleAdminGenerate = async () => {
        setGenerating(true);
        try {
            // 1. Calculate next batch of 5 topics
            const totalTopics = GAME_TOPICS.length;
            const batchSize = 5;
            
            // Slice the topics. If we reach the end, wrap around logic could be complex, 
            // but simple modulo arithmetic handles "start index".
            // Here we just pick 5 from the current index.
            const selectedTopics: string[] = [];
            
            for (let i = 0; i < batchSize; i++) {
                const index = (rotationIndex + i) % totalTopics;
                selectedTopics.push(GAME_TOPICS[index].prompt);
            }

            // Update rotation index for next time
            setRotationIndex((prev) => (prev + batchSize) % totalTopics);

            // 2. Clear old
            await clearAllGameQuestions();
            
            // 3. Generate (Pass the array of prompts)
            const newQuestions = await gemini.generateGameQuestions(selectedTopics);
            
            if (newQuestions && newQuestions.length > 0) {
                 await addGameQuestionsBatch(newQuestions);
                 setShowAdminPanel(false);
                 setScore(0);
                 setCurrentIndex(0);
                 setGameFinished(false);
                 setPool([]);
                 setSentence([]);
                 setResult(null);
            } else {
                 alert("Yapay zeka soru üretemedi. Lütfen tekrar deneyin.");
            }
        } catch (e) {
            console.error(e);
            alert("Hata oluştu");
        } finally {
            setGenerating(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center text-slate-400">Lade Spiel...</div>;

    // --- LEADERBOARD MODAL ---
    if (showLeaderboard) {
        return <Leaderboard currentUserId={user?.uid} onClose={() => setShowLeaderboard(false)} />;
    }

    // --- ADMIN PANEL OVERLAY ---
    if (showAdminPanel) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 p-8 relative">
                <button 
                   onClick={() => setShowAdminPanel(false)}
                   className="absolute top-6 right-6 p-2 bg-white rounded-full shadow-md text-slate-400 hover:text-slate-600"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
                <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-indigo-100 text-center">
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Oyun Oluşturucu (B1)</h2>
                    <p className="text-slate-500 mb-8 text-sm">Sistem havuzdan sıradaki 5 farklı konuyu seçer ve her biri için 2'şer soru üretir.</p>
                    
                    <div className="bg-indigo-50 p-4 rounded-xl mb-8 border border-indigo-100">
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Sıradaki Konu Grubu</p>
                        <ul className="text-sm text-indigo-800 font-medium text-left space-y-1">
                             {[0,1,2,3,4].map(i => {
                                 const idx = (rotationIndex + i) % GAME_TOPICS.length;
                                 return <li key={i}>• {GAME_TOPICS[idx].label}</li>
                             })}
                        </ul>
                    </div>

                    <button 
                      onClick={handleAdminGenerate}
                      disabled={generating}
                      className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
                    >
                        {generating ? 'Yapay Zeka Çalışıyor...' : 'Karma Oyun Oluştur (10 Soru)'}
                    </button>
                </div>
            </div>
        );
    }

    // --- GAME FINISHED SCREEN ---
    if (gameFinished) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-white p-8 text-center relative">
                <button onClick={handleExit} className="absolute top-6 left-6 text-slate-400 hover:text-white font-bold">← Menü</button>
                <div className="text-6xl mb-6">🏆</div>
                <h2 className="text-4xl font-black mb-4">Spiel Beendet!</h2>
                <p className="text-xl text-slate-400 mb-8">Dein Endpunktestand</p>
                <div className="text-8xl font-black text-indigo-400 mb-12 drop-shadow-2xl">{score}</div>
                <div className="flex gap-4">
                    <button 
                      onClick={() => setShowLeaderboard(true)} 
                      className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
                    >
                        Rangliste ansehen
                    </button>
                    <button 
                      onClick={restartGame} 
                      className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-indigo-50 shadow-xl shadow-white/10 transition-transform active:scale-95"
                    >
                        Nochmal Spielen
                    </button>
                </div>
            </div>
        );
    }

    // --- EMPTY STATE (No Questions) ---
    if (questions.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[#F9FBFF] p-8">
                <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mb-6">
                    <Icons.Puzzle className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Keine Fragen verfügbar</h2>
                <p className="text-slate-500 mb-8 text-center max-w-md">Aktuell gibt es kein aktives Spiel.</p>
                
                {isAdmin ? (
                    <button 
                      onClick={() => setShowAdminPanel(true)}
                      className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg"
                    >
                        Oyun Oluştur
                    </button>
                ) : (
                    <p className="text-sm font-bold text-orange-500">Bitte warten Sie auf den Lehrer.</p>
                )}
            </div>
        );
    }

    const currentQ = questions[currentIndex];

    // --- ACTIVE GAME UI ---
    return (
        <div className="h-full flex flex-col bg-[#FDFDFD] relative overflow-hidden">
            {/* TOP BAR */}
            <div className="h-20 bg-white border-b flex items-center justify-between px-4 md:px-8 shrink-0 z-20 shadow-sm relative">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleExit}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500 transition-colors font-bold"
                        title="Beenden"
                    >
                        ✕
                    </button>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Frage {currentIndex + 1} / {questions.length}</span>
                        <span className="text-sm font-black text-slate-800">{currentQ.level} Challenge</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowLeaderboard(true)}
                        className="px-4 py-2 rounded-xl bg-yellow-50 text-yellow-600 font-bold text-sm border border-yellow-100 hover:bg-yellow-100 transition-colors flex items-center gap-2"
                    >
                        <span>🏆</span> Rangliste
                    </button>
                    
                    <div className="bg-slate-900 text-white px-4 py-2 rounded-xl font-mono font-bold shadow-lg text-sm">
                        {score} Pkt
                    </div>
                    
                    <button 
                        onClick={giveUp} 
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-500 transition-colors" 
                        title="Bu soruyu atla (-5 Puan)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 0 1 0 1.953l-7.108 4.062A1.125 1.125 0 0 1 3 16.81V8.688ZM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 0 1 0 1.953l-7.108 4.062a1.125 1.125 0 0 1-1.683-.977V8.688Z" /></svg>
                    </button>

                    {isAdmin && (
                        <button 
                            onClick={() => setShowAdminPanel(true)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                            title="Admin Ayarları"
                        >
                            <Icons.Settings className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* MAIN GAME AREA */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 flex flex-col items-center">
                
                {/* TASK CARD */}
                <div className="w-full max-w-4xl bg-white border-l-4 border-indigo-500 shadow-md p-6 rounded-r-xl rounded-l-sm mb-6 animate-fade-in relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Aufgabe</p>
                            <h3 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">
                                {currentQ.task || "Bilde einen korrekten Satz."}
                            </h3>
                        </div>
                        {currentQ.hint && (
                            <button 
                                onClick={() => setShowHint(!showHint)}
                                className="ml-4 p-2 text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors"
                                title="Tipp anzeigen"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
                            </button>
                        )}
                    </div>
                    
                    {/* HINT SECTION */}
                    {showHint && currentQ.hint && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800 font-medium animate-fade-in flex items-start gap-2">
                             <span className="text-lg">💡</span>
                             <span>{currentQ.hint}</span>
                        </div>
                    )}
                </div>

                {/* SENTENCE CONSTRUCTION ZONE */}
                <div className="w-full max-w-4xl min-h-[140px] bg-white rounded-3xl shadow-xl shadow-slate-200/60 border-2 border-slate-100 p-6 flex flex-col items-center justify-center mb-8 transition-all relative z-10 group">
                    {sentence.length > 0 && (
                        <button 
                          onClick={clearSentence}
                          disabled={!!result}
                          className="absolute top-3 right-3 px-3 py-1.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-lg hover:bg-red-100 transition-colors z-20 flex items-center gap-1 uppercase tracking-wider"
                        >
                            <span>Löschen</span>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" /></svg>
                        </button>
                    )}
                    
                    <div className="flex flex-wrap gap-2 justify-center w-full min-h-[60px] items-center">
                        {sentence.length === 0 && (
                            <p className="text-slate-300 font-bold italic pointer-events-none select-none">Wörter hierher klicken...</p>
                        )}
                        {sentence.map((word, idx) => (
                            <button
                              key={`${word}-${idx}`}
                              onClick={() => handleWordClick(word, 'sentence', idx)}
                              disabled={!!result}
                              className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold shadow-lg hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all animate-fade-in text-sm md:text-base border-b-4 border-slate-900 active:border-b-0 active:translate-y-1"
                            >
                                {word}
                            </button>
                        ))}
                    </div>
                </div>

                {/* WORD POOL (MIXED / CROWD) */}
                <div className="w-full max-w-5xl mb-8">
                     <div className="flex flex-wrap justify-center gap-2">
                        {pool.length === 0 ? (
                           <p className="text-xs text-slate-400 italic">Wort-Pool wird geladen oder ist leer...</p>
                        ) : (
                            pool.map((word, idx) => (
                                <button
                                  key={`${word}-${idx}`}
                                  onClick={() => handleWordClick(word, 'pool', idx)}
                                  disabled={!!result}
                                  className="px-3 py-2 bg-white border-b-2 border-slate-200 text-slate-600 rounded-lg font-bold text-sm hover:border-indigo-400 hover:text-indigo-600 hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-95 active:border-b-0 active:translate-y-0.5"
                                >
                                    {word}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* CONTROLS / RESULT */}
                <div className="w-full max-w-md mx-auto pb-10">
                    {!result ? (
                        <button 
                          onClick={checkAnswer}
                          disabled={sentence.length < 2 || validating}
                          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 transition-all"
                        >
                            {validating ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                            ) : "ÜBERPRÜFEN"}
                        </button>
                    ) : (
                        <div className={`p-6 rounded-3xl border-2 animate-fade-in ${result.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-4 mb-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-md ${result.isValid ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                    {result.isValid ? '✓' : '✗'}
                                </div>
                                <div>
                                    <h4 className={`font-black text-xl ${result.isValid ? 'text-green-800' : 'text-red-800'}`}>
                                        {result.isValid ? 'Richtig!' : 'Leider falsch'}
                                    </h4>
                                    <p className={`font-bold ${result.isValid ? 'text-green-600' : 'text-red-500'}`}>
                                        {result.scoreChange > 0 ? '+' : ''}{result.scoreChange} Punkte
                                    </p>
                                </div>
                            </div>
                            
                            <p className="text-slate-700 font-medium leading-relaxed mb-4">
                                {result.feedback}
                            </p>

                            {!result.isValid && result.correction && (
                                <div className="bg-white/60 p-3 rounded-xl mb-4 border border-red-100">
                                    <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Richtige Lösung wäre:</p>
                                    <p className="font-bold text-slate-800">"{result.correction}"</p>
                                </div>
                            )}

                            <button 
                               onClick={nextQuestion}
                               className={`w-full py-3 rounded-xl font-bold shadow-lg text-white ${result.isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-900 hover:bg-black'}`}
                            >
                                Nächste Frage →
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SentenceGame;
