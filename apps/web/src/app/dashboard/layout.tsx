'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';

const NAV = [
  { href:'/dashboard',                label:'Overview',        icon:'◈', perm:null },
  { href:'/dashboard/cases',          label:'Case Registry',   icon:'⬡', perm:'cases:read' },
  { href:'/dashboard/deliveries',     label:'Delivery Ops',    icon:'⟳', perm:'delivery:read' },
  { href:'/dashboard/assignments',     label:'Assignments',      icon:'⊞', perm:'delivery:read' },
  { href:'/dashboard/summons',          label:'Summons',          icon:'⚖', perm:'cases:read' },
  { href:'/dashboard/analytics',        label:'Analytics',        icon:'▦', perm:'reports:view' },
  { href:'/dashboard/agent',             label:'AI Agent',         icon:'⚡', perm:'cases:read' },
  { href:'/dashboard/reconciliation', label:'Reconciliation',  icon:'⇌', perm:'reconciliation:read' },
  { href:'/dashboard/compliance',     label:'GIS & Compliance',icon:'◎', perm:'compliance:read' },
  { href:'/dashboard/audit',          label:'Audit Trail',     icon:'☰', perm:'audit:read' },
  { href:'/dashboard/reports',        label:'Reports',         icon:'▦', perm:'reports:view' },
  { href:'/dashboard/users',          label:'Users',           icon:'◯', perm:'users:read' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, hasPermission } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('civictrace_auth');
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.state?.isAuthenticated && p?.state?.token) {
          setAuthed(true); setChecking(false); return;
        }
      }
    } catch {}
    setChecking(false); router.replace('/login');
  }, []);

  if (checking) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'#F0F4FF' }}>
      <div style={{ textAlign:'center' }}>
        <img src="/valugrid-logo.png" alt="ValuGrid" style={{ height:'36px', objectFit:'contain', display: logoErr ? 'none':'block', margin:'0 auto 10px' }} onError={() => setLogoErr(true)} />
        {logoErr && <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.4rem' }}><span style={{ color:'#2979FF' }}>VALU</span><span style={{ color:'#00C980' }}>GRID</span></div>}
      </div>
    </div>
  );

  if (!authed) return null;

  const initials = user?.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() || 'VG';

  return (
    <div style={{ display:'flex', height:'100vh', background:'#F0F4FF', overflow:'hidden', fontFamily:'DM Sans, sans-serif' }}>

      {/* ── Sidebar ─────────────────────────── */}
      <aside style={{ width:'210px', flexShrink:0, background:'#080e1c', borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', position:'relative' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg,#2979FF,#00C980,transparent)' }} />

        {/* Logo */}
        <div style={{ padding:'1.2rem 1rem 0.9rem', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <img src="/valugrid-logo.png" alt="ValuGrid"
            style={{ height:'26px', objectFit:'contain', objectPosition:'left', display: logoErr ? 'none':'block' }}
            onError={() => setLogoErr(true)} />
          {logoErr && (
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.1rem' }}>
              <span style={{ color:'#2979FF' }}>VALU</span><span style={{ color:'#00C980' }}>GRID</span>
            </div>
          )}
          <p style={{ color:'rgba(160,180,230,0.38)', fontSize:'0.52rem', letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:'Syne,sans-serif', marginTop:'4px', marginBottom:0 }}>
            Compliance Intelligence
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'0.7rem 0.6rem', display:'flex', flexDirection:'column', gap:'1px', overflowY:'auto' }}>
          {NAV.filter(i => !i.perm || hasPermission(i.perm)).map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} style={{
                display:'flex', alignItems:'center', gap:'8px',
                padding:'8px 10px', borderRadius:'7px', textDecoration:'none',
                fontSize:'0.77rem', fontFamily:'DM Sans, sans-serif',
                transition:'all .15s',
                background: active ? 'rgba(41,121,255,0.14)' : 'transparent',
                border: active ? '1px solid rgba(41,121,255,0.22)' : '1px solid transparent',
                color: active ? '#7ab4ff' : 'rgba(160,180,230,0.45)',
              }}>
                <span style={{ fontSize:'0.8rem', opacity: active ? 1 : 0.55, flexShrink:0 }}>{item.icon}</span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.label}</span>
                {active && <div style={{ marginLeft:'auto', width:'4px', height:'4px', borderRadius:'50%', background:'#2979FF', flexShrink:0 }} />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding:'0.85rem 0.9rem', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
            <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:'rgba(41,121,255,0.18)', border:'1px solid rgba(41,121,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'0.62rem', color:'#7ab4ff', flexShrink:0 }}>{initials}</div>
            <div style={{ overflow:'hidden', flex:1 }}>
              <p style={{ color:'#EEF2FF', fontSize:'0.73rem', fontWeight:600, fontFamily:'Syne,sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', margin:0 }}>{user?.fullName}</p>
              <p style={{ color:'rgba(160,180,230,0.42)', fontSize:'0.58rem', fontFamily:'Syne,sans-serif', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.role}</p>
            </div>
          </div>
          <button onClick={() => { logout(); router.push('/login'); }}
            style={{ width:'100%', padding:'6px', borderRadius:'6px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(160,180,230,0.42)', fontSize:'0.63rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer', transition:'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(229,62,62,0.35)'; e.currentTarget.style.color='#FC8181'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.color='rgba(160,180,230,0.42)'; }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main — constrained width here so ALL pages benefit ── */}
      <main style={{ flex:1, overflowY:'auto', background:'#F0F4FF' }}>
        <div style={{ maxWidth:'1080px', margin:'0 auto', padding:'2rem 2rem', boxSizing:'border-box' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
