'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Menu, X, Award, ShieldAlert, Settings, FolderKanban, FileSpreadsheet, LogOut } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';

interface AdminLayoutProps {
  children: React.ReactNode;
}

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Helper to determine if a menu item is active
  const isTabActive = (id: string, href: string) => {
    if (id === 'rankings') {
      return pathname === '/admin' && (!searchParams.get('tab') || searchParams.get('tab') === 'rankings');
    }
    if (id === 'logs') {
      return pathname === '/admin' && searchParams.get('tab') === 'logs';
    }
    if (id === 'settings') {
      return pathname === '/admin' && searchParams.get('tab') === 'settings';
    }
    return pathname.startsWith(href);
  };

  const navItems = [
    { id: 'rankings', label: 'Rankings Ledger', href: '/admin', icon: Award },
    { id: 'departments', label: 'Faculty & Dept Manage', href: '/admin/management', icon: FolderKanban },
    { id: 'templates', label: 'Manage Templates', href: '/admin/templates', icon: FileSpreadsheet },
    { id: 'logs', label: 'Activity Logs', href: '/admin?tab=logs', icon: ShieldAlert },
    { id: 'settings', label: 'System Settings', href: '/admin?tab=settings', icon: Settings }
  ];

  return (
    <>
      {/* Mobile Sticky Navbar Header */}
      <header className="md:hidden sticky top-0 z-45 w-full flex items-center justify-between bg-ua-blue text-white px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <img src="/ua-logo.png" alt="UA Logo" className="w-10 h-10 object-contain rounded-full border border-white/20 bg-white" />
          <div>
            <h1 className="text-xs font-bold tracking-widest text-slate-300 leading-none">UNIVERSITY OF THE</h1>
            <h2 className="text-sm font-black tracking-wide text-ua-gold uppercase leading-tight">Assumption</h2>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6 text-ua-gold" /> : <Menu className="w-6 h-6 text-white" />}
        </button>
      </header>

      {/* Left Sidebar (Desktop Fixed / Mobile Slide-over) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-ua-blue text-white flex flex-col justify-between border-r border-ua-blue-dark/50 shadow-2xl transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand branding header in Sidebar */}
          <div className="p-6 border-b border-ua-blue-dark/40 flex items-center gap-4 bg-ua-blue-dark/20">
            <img src="/ua-logo.png" alt="UA Logo" className="w-12 h-12 object-contain rounded-full border-2 border-white/10" />
            <div>
              <h3 className="text-[10px] font-bold text-slate-300 tracking-widest uppercase leading-none mb-1">University of the</h3>
              <h2 className="text-lg font-black text-ua-gold tracking-wide uppercase leading-none">Assumption</h2>
              <span className="inline-block mt-1 text-[9px] font-bold text-white/50 tracking-wider uppercase">Admin Console</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const active = isTabActive(item.id, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`group flex items-center gap-3.5 px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-l-xl rounded-r-none transition-all duration-200 border-r-4 ${
                    active
                      ? 'bg-ua-blue-dark/50 border-ua-gold text-white shadow-md'
                      : 'border-transparent text-slate-300 hover:bg-ua-blue-dark/20 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-colors duration-200 ${active ? 'text-ua-gold' : 'text-slate-400 group-hover:text-ua-gold'}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Panel (User Context & Logout) */}
        <div className="p-4 border-t border-ua-blue-dark/40 bg-ua-blue-dark/15 space-y-3.5">
          <div className="px-3 py-2 bg-ua-blue-dark/30 rounded-xl border border-white/5 space-y-0.5">
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Authenticated Role</p>
            <p className="text-xs font-black text-ua-gold tracking-wide">SYSTEM ADMINISTRATOR</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-2.5 py-3 border border-ua-red hover:bg-ua-red text-white hover:text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-200 shadow-md cursor-pointer hover:shadow-ua-red/25"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out Session</span>
          </button>
        </div>
      </aside>

      {/* Backdrop for Mobile Sidebar Open */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-955 bg-slate-950/60 backdrop-blur-sm md:hidden"
        />
      )}
    </>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      <Suspense fallback={<div className="w-72 bg-ua-blue shrink-0 hidden md:block h-screen" />}>
        <SidebarContent />
      </Suspense>

      {/* Main Viewport Workspace */}
      <main className="flex-1 min-w-0 md:h-screen md:overflow-y-auto bg-slate-50 flex flex-col justify-between">
        <div className="flex-1 p-5 sm:p-8 md:p-10 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </div>
        <Footer />
      </main>
    </div>
  );
}
