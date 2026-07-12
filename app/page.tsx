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
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-slate-950 font-sans relative overflow-hidden bg-[url('/bg.jpg')] bg-cover bg-center bg-fixed">
      {/* Dark overlay with deep blue tint */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-[-20]" />

      {/* Decorative Brand Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#002366]/20 rounded-full blur-[100px] pointer-events-none z-[-10]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#FFBD00]/8 rounded-full blur-[120px] pointer-events-none z-[-10]" />
      <div className="absolute bottom-10 left-10 w-64 h-64 bg-[#D2143A]/8 rounded-full blur-[80px] pointer-events-none z-[-10]" />

      {/* LEFT COLUMN: Transparent blue hue on mobile, White Panel on desktop */}
      <div className="w-full md:w-[45%] min-h-screen flex flex-col justify-between p-6 sm:p-8 md:p-12 relative border-b border-white/10 md:border-b-0 md:border-r md:border-slate-200 bg-[#0B2265]/40 backdrop-blur-md md:bg-white md:backdrop-blur-none shrink-0 shadow-none md:shadow-2xl">

        {/* Top Block: Logo and Welcome Message */}
        <div className="space-y-8 z-10">
          {/* Branding / Logo */}
          <div className="flex items-center gap-5">
            <img src="/ua-logo.png" alt="UA Logo" className="w-24 h-24 object-contain shrink-0 rounded-full" />
            <div>
              <h2 className="text-[24px] font-bold text-slate-300 md:text-slate-400 tracking-widest uppercase leading-none mb-1">University of the</h2>
              <h2 className="text-[42px] font-black text-ua-gold md:text-[#002366] tracking-wider uppercase leading-none">Assumption</h2>
            </div>
          </div>
          {/* Welcome message / Session status header */}
          {!session ? (
            <div className="space-y-2.5">
              <h1 className="text-2xl font-black text-white md:text-[#002366] tracking-tight uppercase">
                Welcome Back
              </h1>

              <p className="text-xs text-slate-200 md:text-slate-500 font-medium leading-relaxed max-w-sm">
                Please sign in with your official University Google account to access your dashboard.
              </p>

              {/* Brand Title (visible only on mobile/tablet, centered and large) */}
              <div className="flex flex-col items-center justify-center text-center pt-8 pb-4 md:hidden select-none w-full">
                <h1 className="font-black uppercase tracking-tighter text-[26vw] xs:text-[24vw] sm:text-[8rem] leading-[0.8] flex flex-col items-center w-full">
                  <span className="text-white w-full text-center">EVAL</span>
                  <span className="flex justify-center w-full">
                    <span className="text-[#FFBD00]">UA</span>
                    <span className="text-white">TE</span>
                  </span>
                </h1>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFBD00]/15 border border-[#FFBD00]/30 text-[10px] font-bold text-[#FFBD00] uppercase tracking-wider w-fit">
                Authenticated
              </span>
              <h1 className="text-2xl font-black text-white md:text-[#002366] tracking-tight uppercase">
                Active Session
              </h1>
            </div>
          )}
        </div>

        {/* Bottom Block: Form Actions and Footer */}
        <div className="space-y-6 z-10 pt-16 md:pt-0">
          {!session ? (
            <div className="space-y-4">
              <GoogleLoginButton />

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-white/20 md:border-slate-200"></div>
                <span className="flex-shrink mx-4 text-slate-300 md:text-slate-400 text-[10px] font-bold uppercase tracking-widest">or secure portal</span>
                <div className="flex-grow border-t border-white/20 md:border-slate-200"></div>
              </div>

              <div className="text-center">
                <AdminLoginButton className="bg-white/10 hover:bg-white/20 text-white border-white/15 hover:text-white md:bg-slate-50 md:hover:bg-slate-100 md:text-slate-600 md:border-slate-200" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-white/10 border border-white/20 md:bg-slate-50 md:border-slate-200 rounded-2xl space-y-1">
                <p className="text-[10px] text-slate-300 md:text-slate-400 font-bold uppercase tracking-widest">Signed in as</p>
                <p className="text-xs font-bold text-white md:text-slate-700 truncate">{session.user?.email}</p>
                <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-white/15 border border-white/20 text-ua-gold md:bg-[#002366]/10 md:border-[#002366]/20 md:text-[#002366] text-[10px] font-bold rounded-full">
                  {(session.user as any)?.role}
                </span>
              </div>

              <div className="space-y-2.5">
                {(session.user as any)?.role === 'STUDENT' && (
                  <Link
                    href="/evaluate"
                    className="inline-block w-full text-center py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-900/20 hover:shadow-emerald-700/35 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  >
                    Go to Student evalUAte
                  </Link>
                )}

                {(session.user as any)?.role === 'FACULTY' && (
                  <Link
                    href="/faculty"
                    className="inline-block w-full text-center py-3 px-4 bg-gradient-to-r from-[#002366] to-[#001440] hover:from-[#002d80] hover:to-[#002366] text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/10 hover:border-white/20 transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  >
                    Go to Faculty Dashboard
                  </Link>
                )}

                {(session.user as any)?.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className="inline-block w-full text-center py-3 px-4 bg-gradient-to-r from-[#D2143A] to-[#A00E2B] hover:from-[#e51c44] hover:to-[#D2143A] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  >
                    Go to Admin Dashboard
                  </Link>
                )}

                <Link
                  href="/api/auth/signout"
                  className="inline-block w-full text-center py-3 px-4 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/15 transition-all md:bg-slate-50 md:hover:bg-slate-100 md:text-slate-500 md:hover:text-slate-700 md:border-slate-200 cursor-pointer"
                >
                  Sign Out
                </Link>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-white/15 md:border-slate-100">
            <p className="text-[10px] text-slate-350 md:text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
              © 2026 University of the Assumption
            </p>
          </div>
        </div>

        {/* BACKGROUND TEXT FOR LEFT PANEL (Split Word "eval") */}
        <div className="absolute top-1/2 right-0 translate-y-[-50%] pointer-events-none select-none hidden md:block z-0 pr-0">
          <span
            className="text-right font-black uppercase tracking-tighter text-[7.5rem] xl:text-[8.5rem] 2xl:text-[9.5rem] leading-none bg-[linear-gradient(rgba(0,35,102,0.65),rgba(0,35,102,0.65)),url('/bg.jpg')] bg-clip-text text-transparent bg-cover bg-center bg-fixed select-none"
          >
            eval
          </span>
        </div>
      </div>

      {/* RIGHT COLUMN: Landscape Presentation (Visual / Split Typography) */}
      <div className="hidden md:flex flex-1 flex-col justify-between p-12 relative bg-black/10 group overflow-hidden">
        {/* Overlay of dark blue in the right side */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#001133]/90 via-[#002366]/65 to-black/35 pointer-events-none z-0" />

        {/* Top Menu Navigation */}
        <div className="flex justify-end gap-6 z-10 text-[10px] font-black text-white/70 tracking-wider">
          <a href="https://ua.edu.ph" target="_blank" rel="noopener noreferrer" className="hover:text-[#FFBD00] transition-colors uppercase">UA Home</a>
        </div>

        {/* Bottom Narrative / Tagline */}
        <div className="z-10 max-w-sm">
          <span className="text-[10px] font-bold text-[#FFBD00] tracking-widest uppercase mb-1.5 block">01 / academic excellence</span>
          <h3 className="text-white text-base font-extrabold tracking-tight leading-relaxed">
            Empowering University of the Assumption students and faculty with secure, dynamic, and anonymous evaluations.
          </h3>
        </div>

        {/* Far-right vertical visual text */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 origin-bottom rotate-90 select-none pointer-events-none text-white/5 text-[9px] font-black tracking-[0.3em] uppercase leading-none whitespace-nowrap z-10">
          ASSUMPTION • EXCELLENCE
        </div>

        {/* BACKGROUND TEXT FOR RIGHT PANEL (Split Word "UAte") */}
        <div className="absolute top-1/2 left-0 translate-y-[-50%] pointer-events-none select-none hidden md:block z-0 pl-0">
          <span className="text-left font-black uppercase tracking-tighter text-[7.5rem] xl:text-[8.5rem] 2xl:text-[9.5rem] leading-none select-none flex">
            <span className="inline-block text-[#FFBD00] transition-transform duration-500 ease-out group-hover:translate-y-[-18px]">
              UA
            </span>
            <span className="inline-block text-white">
              te
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
