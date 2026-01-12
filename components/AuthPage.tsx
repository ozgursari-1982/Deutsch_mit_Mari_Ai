
import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, AuthError } from 'firebase/auth';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      const errorCode = err.code;
      let errorMessage = "Ein Fehler ist aufgetreten.";
      
      if (errorCode === 'auth/invalid-email') errorMessage = "Ungültige E-Mail-Adresse.";
      if (errorCode === 'auth/user-disabled') errorMessage = "Benutzerkonto deaktiviert.";
      if (errorCode === 'auth/user-not-found') errorMessage = "Benutzer nicht gefunden.";
      if (errorCode === 'auth/wrong-password') errorMessage = "Falsches Passwort.";
      if (errorCode === 'auth/email-already-in-use') errorMessage = "E-Mail wird bereits verwendet.";
      if (errorCode === 'auth/weak-password') errorMessage = "Passwort ist zu schwach (min. 6 Zeichen).";

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-[#F9FBFF] font-['Inter']">
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto rounded-[1.2rem] bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-2xl shadow-indigo-200 flex items-center justify-center relative mb-6">
            <span className="text-white font-black text-4xl tracking-tighter">M</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Deutsch mit Mari</h1>
          <p className="text-slate-500">Melde dich an, um deine Lernreise fortzusetzen.</p>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">E-Mail</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                placeholder="name@beispiel.de"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Passwort</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium border border-red-100 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                  <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
              ) : (
                isLogin ? "Anmelden" : "Konto erstellen"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              {isLogin ? "Noch kein Konto? Registrieren" : "Bereits registriert? Anmelden"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
