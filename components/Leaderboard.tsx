
import React, { useEffect, useState } from 'react';
import { subscribeToLeaderboard } from '../services/firebase';
import { LeaderboardEntry } from '../types';

interface Props {
  currentUserId?: string;
  onClose: () => void;
}

const Leaderboard: React.FC<Props> = ({ currentUserId, onClose }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToLeaderboard((data) => {
      setEntries(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getRankStyle = (index: number) => {
      if (index === 0) return 'bg-yellow-50 border-yellow-200 ring-4 ring-yellow-100/50';
      if (index === 1) return 'bg-slate-50 border-slate-200 ring-2 ring-slate-100';
      if (index === 2) return 'bg-orange-50 border-orange-200 ring-2 ring-orange-100';
      return 'bg-white border-slate-100';
  };

  const getRankIcon = (index: number) => {
      if (index === 0) return <span className="text-2xl">🥇</span>;
      if (index === 1) return <span className="text-2xl">🥈</span>;
      if (index === 2) return <span className="text-2xl">🥉</span>;
      return <span className="text-sm font-bold text-slate-400">#{index + 1}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
        <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b flex items-center justify-between bg-white shrink-0">
                <div>
                   <h2 className="text-2xl font-black text-slate-900">Rangliste</h2>
                   <p className="text-xs text-slate-500">Top Schüler & Punktestände</p>
                </div>
                <button 
                  onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 font-bold transition-colors"
                >
                    ✕
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#F9FBFF]">
                {loading ? (
                    <div className="text-center py-10 text-slate-400">Lade Rangliste...</div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 italic">Noch keine Einträge.</div>
                ) : (
                    <div className="space-y-3">
                        {entries.map((entry, index) => {
                            const isMe = entry.userId === currentUserId;
                            return (
                                <div 
                                  key={entry.userId}
                                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${getRankStyle(index)} ${isMe ? 'shadow-lg translate-x-2 border-indigo-300' : 'shadow-sm'}`}
                                >
                                    {/* Rank */}
                                    <div className="w-10 flex justify-center shrink-0">
                                        {getRankIcon(index)}
                                    </div>

                                    {/* Avatar */}
                                    <div className="relative shrink-0">
                                        {entry.photoURL ? (
                                            <img src={entry.photoURL} alt={entry.displayName} className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover" />
                                        ) : (
                                            <div className={`w-12 h-12 rounded-full border-2 border-white shadow-sm flex items-center justify-center font-bold text-lg text-white ${['bg-indigo-400', 'bg-pink-400', 'bg-blue-400', 'bg-green-400'][index % 4]}`}>
                                                {entry.displayName.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        {index === 0 && (
                                            <div className="absolute -top-1 -right-1 text-lg">👑</div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`font-bold truncate ${isMe ? 'text-indigo-900' : 'text-slate-800'}`}>
                                            {entry.displayName} {isMe && '(Du)'}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                            Mitglied seit {new Date(entry.createdAt).getFullYear()}
                                        </p>
                                    </div>

                                    {/* Score */}
                                    <div className="text-right shrink-0">
                                        <span className={`block font-black text-xl ${index === 0 ? 'text-yellow-600' : isMe ? 'text-indigo-600' : 'text-slate-700'}`}>
                                            {entry.score}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Punkte</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            
            {/* My Rank Footer (if not in top view) */}
            {currentUserId && entries.findIndex(e => e.userId === currentUserId) > 5 && (
                 <div className="p-4 bg-indigo-50 border-t border-indigo-100 text-center text-xs text-indigo-800 font-bold">
                     Du bist auf Platz #{entries.findIndex(e => e.userId === currentUserId) + 1}. Weiter so!
                 </div>
            )}
        </div>
    </div>
  );
};

export default Leaderboard;
