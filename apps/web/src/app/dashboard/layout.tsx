'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { LayoutDashboard, FileText, Truck, DollarSign, ShieldCheck, BarChart3, LogOut, Users, Scale } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: null },
  { href: '/dashboard/cases', label: 'Case Registry', icon: FileText, permission: 'cases:read' },
  { href: '/dashboard/deliveries', label: 'Delivery', icon: Truck, permission: 'delivery:read' },
  { href: '/dashboard/reconciliation', label: 'Reconciliation', icon: DollarSign, permission: 'reconciliation:read' },
  { href: '/dashboard/compliance', label: 'Compliance', icon: ShieldCheck, permission: 'compliance:read' },
  { href: '/dashboard/audit', label: 'Audit', icon: Scale, permission: 'audit:read' },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, permission: 'reports:view' },
  { href: '/dashboard/users', label: 'Users', icon: Users, permission: 'users:read' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, hasPermission } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // Read directly from localStorage — never misses on refresh
    try {
      const raw = localStorage.getItem('civictrace_auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.state?.isAuthenticated && parsed?.state?.token) {
          setAuthed(true);
          setChecking(false);
          return;
        }
      }
    } catch {}
    setAuthed(false);
    setChecking(false);
    router.replace('/login');
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!authed) return null;

  return (
    <div className="flex h-screen bg-slate-100">
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="text-xl font-bold">CivicTrace</div>
          <div className="text-xs text-slate-400 mt-1">Tax Compliance Ops</div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.filter(item => !item.permission || hasPermission(item.permission)).map(item => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                <item.icon className="h-4 w-4" />{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <div className="text-xs text-slate-400 mb-3">
            <div className="font-medium text-slate-200">{user?.fullName}</div>
            <div>{user?.role}</div>
          </div>
          <button onClick={() => { logout(); router.push('/login'); }}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm w-full transition-colors">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
