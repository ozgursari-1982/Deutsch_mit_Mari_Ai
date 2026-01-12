
import React, { useState } from 'react';
import { gemini } from '../services/geminiService';
import { VocabCard } from '../types';
import { Icons } from '../constants';

const VocabularyTrainer: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setCards([]);
    setFlipped({});
    
    const result = await gemini.generateVocabularyList(topic);
    if (result && Array.isArray(result)) {
      setCards(result);
    }
    setLoading(false);
  };

  const toggleFlip = (index: number) => {
    setFlipped(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="h-full bg-[#F9FBFF] overflow-y-auto custom-scrollbar">
      <div className="min-h-full flex flex-col items-center p-8 pb-32">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-600">
              <Icons.Book className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">Wortschatz-Trainer B2</h2>
            <p className="text-slate-500 mb-8">Erweitere deinen beruflichen Wortschatz gezielt nach Themen.</p>
            
            <div className="flex gap-4 max-w-xl mx-auto">
              <input 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Thema eingeben (z.B. IT-Sicherheit)..."
                className="flex-1 p-4 bg-white rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700 shadow-sm"
              />
              <button 
                onClick={handleGenerate}
                disabled={loading || !topic}
                className="px-8 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200"
              >
                {loading ? 'Generiere...' : 'Starten'}
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          {cards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {cards.map((card, idx) => (
                <div 
                  key={idx}
                  onClick={() => toggleFlip(idx)}
                  className="relative h-64 cursor-pointer perspective-1000 group"
                >
                  <div className={`w-full h-full transition-all duration-500 preserve-3d relative rounded-3xl shadow-md hover:shadow-xl ${flipped[idx] ? 'rotate-y-180' : ''}`}>
                    
                    {/* FRONT */}
                    <div className="absolute inset-0 backface-hidden bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center p-6 text-center">
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-2">Wort</span>
                      <h3 className="text-2xl font-black text-slate-800 break-words">
                        <span className="text-slate-400 font-medium text-lg mr-1">{card.article}</span>
                        {card.word}
                      </h3>
                      <p className="absolute bottom-6 text-xs text-slate-400 font-medium">Klicken zum Umdrehen</p>
                    </div>

                    {/* BACK */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-emerald-50 rounded-3xl border border-emerald-100 flex flex-col items-center justify-center p-6 text-center">
                       <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-2">Definition</span>
                       <p className="text-sm font-medium text-slate-700 mb-4 leading-relaxed">{card.definition}</p>
                       <div className="bg-white/60 p-3 rounded-xl w-full">
                          <p className="text-xs text-slate-500 italic">"{card.example}"</p>
                       </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VocabularyTrainer;
