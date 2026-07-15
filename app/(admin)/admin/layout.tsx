'use client';

import { useEffect, useState, Suspense } from 'react';
import { Award, ShieldAlert, Settings, FolderKanban, FileSpreadsheet } from 'lucide-react';
import { AppShell } from '@/components/ui-ua/app-shell';
import { getAdminSessionUser } from '@/app/actions/admin';

const navItems = [
  { id: 'rankings', label: 'Rankings Ledger', href: '/admin', icon: Award },
  { id: 'departments', label: 'Faculty & Dept Manage', href: '/admin/management', icon: FolderKanban },
  { id: 'templates', label: 'Manage Templates', href: '/admin/templates', icon: FileSpreadsheet },
  { id: 'logs', label: 'Activity Logs', href: '/admin?tab=logs', icon: ShieldAlert },
  { id: 'settings', label: 'System Settings', href: '/admin?tab=settings', icon: Settings }
];

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    getAdminSessionUser().then(user => setCurrentUser(user));
  }, []);

  const filteredNavItems = currentUser?.role === 'SUB_ADMIN'
    ? navItems.filter(item => item.id === 'rankings')
    : navItems;

  return (
    <AppShell
      navItems={filteredNavItems}
      role={currentUser?.role === 'SUB_ADMIN' ? 'SUB ADMINISTRATOR' : 'SYSTEM ADMINISTRATOR'}
      title="Assumption"
      subtitle={currentUser?.role === 'SUB_ADMIN' ? 'Sub Admin Console' : 'Admin Console'}
    >
      <div className="max-w-7xl w-full mx-auto space-y-8 pb-12">
        {children}
      </div>
    </AppShell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans">
        <div className="w-72 bg-ua-navy shrink-0 hidden md:block h-screen" />
        <div className="flex-1 bg-background animate-pulse" />
      </div>
    }>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
