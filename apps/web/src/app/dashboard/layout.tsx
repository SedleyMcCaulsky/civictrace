'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';

const C = {
  bg: '#080c17', sidebar: 'rgba(8,10,20,0.98)', blue: '#1B6EFF', green: '#00D68F',
  text: '#e8eeff', muted: 'rgba(160,180,230,0.55)', border: 'rgba(255,255,255,0.07)',
  activeText: '#6ba7ff', activeBg: 'rgba(27,110,255,0.1)', activeBorder: 'rgba(27,110,255,0.2)',
};

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '◈', permission: null },
  { href: '/dashboard/cases', label: 'Case Registry', icon: '⬡', permission: 'cases:read' },
  { href: '/dashboard/deliveries', label: 'Delivery Ops', icon: '⟳', permission: 'delivery:read' },
  { href: '/dashboard/reconciliation', label: 'Reconciliation', icon: '⇌', permission: 'reconciliation:read' },
  { href: '/dashboard/compliance', label: 'GIS & Compliance', icon: '◎', permission: 'compliance:read' },
  { href: '/dashboard/audit', label: 'Audit Trail', icon: '☰', permission: 'audit:read' },
  { href: '/dashboard/reports', label: 'Reports', icon: '▦', permission: 'reports:view' },
  { href: '/dashboard/users', label: 'Users', icon: '◯', permission: 'users:read' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, hasPermission } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('civictrace_auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.state?.isAuthenticated && parsed?.state?.token) {
          setAuthed(true); setChecking(false); return;
        }
      }
    } catch {}
    setAuthed(false); setChecking(false);
    router.replace('/login');
  }, []);

  if (checking) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.03em' }}>
          <span style={{ color: C.blue }}>VALU</span><span style={{ color: C.green }}>GRID</span>
        </div>
        <div style={{ marginTop: '12px', width: '100px', height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', margin: '12px auto 0' }}>
          <div style={{ height: '100%', width: '40%', background: C.blue, animation: 'vg-pulse 1s ease infinite' }} />
        </div>
      </div>
    </div>
  );

  if (!authed) return null;

  const initials = user?.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'VG';

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{ width: '220px', flexShrink: 0, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, ${C.blue}, transparent)` }} />

        {/* Logo */}
        <div style={{ padding: '1.5rem 1.25rem 1rem', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.03em' }}>
            <span style={{ color: C.blue }}>VALU</span><span style={{ color: C.green }}>GRID</span>
          </div>
          <p style={{ color: C.muted, fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '4px', fontFamily: 'Syne, sans-serif' }}>
            Compliance Intelligence
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
          {navItems.filter(item => !item.permission || hasPermission(item.permission)).map(item => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.8rem', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s', background: isActive ? C.activeBg : 'transparent', border: isActive ? `1px solid ${C.activeBorder}` : '1px solid transparent', color: isActive ? C.activeText : C.muted }}>
                <span style={{ fontSize: '0.9rem', opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                {item.label}
                {isActive && <div style={{ marginLeft: 'auto', width: '4px', height: '4px', borderRadius: '50%', background: C.blue }} />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '1rem', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(27,110,255,0.15)', border: '1px solid rgba(27,110,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.7rem', color: '#6ba7ff', flexShrink: 0 }}>{initials}</div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ color: C.text, fontSize: '0.78rem', fontWeight: 500, fontFamily: 'Syne, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{user?.fullName}</p>
              <p style={{ color: C.muted, fontSize: '0.65rem', fontFamily: 'Syne, sans-serif', letterSpacing: '0.05em', margin: 0 }}>{user?.role}</p>
            </div>
          </div>
          <button onClick={() => { logout(); router.push('/login'); }} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, fontSize: '0.7rem', fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(255,60,80,0.3)'; el.style.color = '#ff6b7a'; }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = C.border; el.style.color = C.muted; }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
        {children}
      </main>
    </div>
  );
}
