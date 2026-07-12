'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
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
        className="w-full inline-block text-center py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-200 transition-all hover:shadow-sm active:scale-[0.99] cursor-pointer select-none"
      >
        Credentials Sign In (Admin / Dev)
      </button>

      {showModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 animate-fade-in">
          {/* Overlay click to close */}
          <div className="fixed inset-0" onClick={() => setShowModal(false)} />
          
          {/* Modal Container */}
          <div className="relative bg-slate-900 border border-white/10 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-left z-10 animate-scale-up">
            
            {/* Header */}
            <div className="p-6 pb-5 bg-gradient-to-r from-[#002366] to-[#001440] text-white relative border-b border-white/5">
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mb-3">
                <img src="/ua-logo.png" alt="UA Logo" className="w-8 h-8 object-contain rounded-full" />
              </div>
              <h3 className="text-lg font-black tracking-tight uppercase">Admin Portal Access</h3>
              <p className="text-slate-300/80 text-[10px] font-bold uppercase tracking-wider mt-0.5">Please sign in with administrative credentials</p>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-[#D2143A]/10 border border-[#D2143A]/30 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-[#D2143A]" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[9px] font-bold text-[#FFBD00] uppercase tracking-wider mb-1.5">
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
                    className="w-full pl-10 pr-4 py-2.5 border border-white/10 rounded-xl text-sm bg-black/20 focus:outline-none focus:ring-2 focus:ring-[#FFBD00]/30 focus:border-[#FFBD00]/50 transition-all font-semibold text-white placeholder-slate-500"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-[#FFBD00] uppercase tracking-wider mb-1.5">
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
                    className="w-full pl-10 pr-4 py-2.5 border border-white/10 rounded-xl text-sm bg-black/20 focus:outline-none focus:ring-2 focus:ring-[#FFBD00]/30 focus:border-[#FFBD00]/50 transition-all font-semibold text-white placeholder-slate-500"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-transparent border border-white/10 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-white/5 hover:text-white transition-all cursor-pointer"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#002366] to-[#001440] hover:from-[#002d80] hover:to-[#002366] text-white border border-[#FFBD00]/20 hover:border-[#FFBD00]/50 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#002366]/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
