'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { KeyRound, Mail, ShieldAlert, X } from 'lucide-react';

export default function AdminLoginButton() {
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const res = await signIn('credentials', {
        username,
        password,
        redirect: false,
      }) as any;
      
      if (res?.error) {
        setError('Invalid username or password.');
      } else {
        // Redirect on successful login
        window.location.href = '/admin';
      }
    } catch (err) {
      setError('An unexpected authorization error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => {
          setShowModal(true);
          setError('');
          setUsername('');
          setPassword('');
        }}
        className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors cursor-pointer select-none"
      >
        Credentials Sign In (Admin / Dev)
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
          {/* Overlay click to close */}
          <div className="fixed inset-0" onClick={() => setShowModal(false)} />
          
          {/* Modal Container */}
          <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-left z-10 animate-scale-up">
            
            {/* Header */}
            <div className="p-6 pb-4 bg-slate-900 text-white relative">
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-2xl font-black mb-3 shadow-md shadow-indigo-600/10">
                UA
              </div>
              <h3 className="text-lg font-black tracking-tight">Admin Portal Access</h3>
              <p className="text-slate-400 text-xs mt-0.5">Please sign in with your administrative credentials</p>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="masteradmin"
                    className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-slate-800"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-slate-800"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/10 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
