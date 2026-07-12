'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, Mail, ShieldAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminLoginButton({ className }: { className?: string }) {
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
        className={cn(
          "w-full inline-block text-center py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-200 transition-all hover:shadow-sm active:scale-[0.99] cursor-pointer select-none",
          className
        )}
      >
        Credentials Sign In (Admin / Dev)
      </button>

      {showModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          {/* Overlay click to close */}
          <div className="fixed inset-0" onClick={() => setShowModal(false)} />
          
          {/* Modal Container */}
          <div className="relative bg-white border border-slate-250 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-left z-10 animate-scale-up">
            
            {/* Header */}
            <div className="p-6 pb-5 bg-gradient-to-r from-[#0B2265] to-[#071643] text-white relative border-b border-[#0B2265]/10">
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-full flex items-center justify-center mb-3">
                <img src="/ua-logo.png" alt="UA Logo" className="w-8 h-8 object-contain rounded-full" />
              </div>
              <h3 className="text-lg font-black tracking-tight uppercase text-[#F4B400]">Admin Portal Access</h3>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-wider mt-0.5">Please sign in with administrative credentials</p>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-650 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
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
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30 focus:border-[#0B2265] transition-all font-semibold text-slate-800 placeholder-slate-400"
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
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30 focus:border-[#0B2265] transition-all font-semibold text-slate-800 placeholder-slate-400"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-transparent border border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-50 hover:text-slate-700 transition-all cursor-pointer"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#0B2265] to-[#071643] hover:from-[#16358c] hover:to-[#0B2265] text-white border border-transparent font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#0B2265]/10 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
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
