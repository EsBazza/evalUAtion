import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import AdminLoginButton from '@/components/AdminLoginButton';
import GoogleLoginButton from '@/components/GoogleLoginButton';

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    const role = (session.user as any).role;
    if (role === 'STUDENT') {
      redirect('/evaluate');
    } else if (role === 'FACULTY') {
      redirect('/faculty');
    } else if (role === 'ADMIN') {
      redirect('/admin');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
      
      <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 text-center space-y-8 relative">
        <div className="space-y-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-3xl font-extrabold text-white">UA</span>
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-400 via-indigo-300 to-white bg-clip-text text-transparent tracking-tight pt-2">
            evalUAtion
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            University of the Assumption Faculty Evaluation System
          </p>
        </div>

        {!session ? (
          <div className="space-y-6 pt-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Please sign in with your official University Google account to access your respective dashboard.
            </p>
            <GoogleLoginButton />
            
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-600 text-xs font-semibold uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <AdminLoginButton />
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-1">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Signed in as</p>
              <p className="text-sm font-bold text-slate-200 truncate">{session.user?.email}</p>
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 text-xs font-bold rounded-full border border-indigo-500/25">
                {(session.user as any)?.role}
              </span>
            </div>
            
            {(session.user as any)?.role === 'STUDENT' && (
              <Link 
                href="/evaluate" 
                className="inline-block w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/35 hover:-translate-y-0.5 active:translate-y-0"
              >
                Go to Student evalUAtion
              </Link>
            )}

            {(session.user as any)?.role === 'FACULTY' && (
              <Link 
                href="/faculty" 
                className="inline-block w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/35 hover:-translate-y-0.5 active:translate-y-0"
              >
                Go to Faculty Dashboard
              </Link>
            )}

            {(session.user as any)?.role === 'ADMIN' && (
              <Link 
                href="/admin" 
                className="inline-block w-full py-3 px-4 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold rounded-xl transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Go to Admin Dashboard
              </Link>
            )}
            
            <Link 
              href="/api/auth/signout" 
              className="inline-block w-full py-3 px-4 bg-transparent hover:bg-slate-900/40 text-slate-400 hover:text-slate-200 font-semibold rounded-xl border border-slate-800 transition-colors"
            >
              Sign Out
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
