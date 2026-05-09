'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';

const NAV = [
  { href:'/dashboard',                label:'Overview',       icon:'◈', perm:null },
  { href:'/dashboard/cases',          label:'Case Registry',  icon:'⬡', perm:'cases:read' },
  { href:'/dashboard/deliveries',     label:'Delivery Ops',   icon:'⟳', perm:'delivery:read' },
  { href:'/dashboard/reconciliation', label:'Reconciliation', icon:'⇌', perm:'reconciliation:read' },
  { href:'/dashboard/compliance',     label:'GIS & Compliance',icon:'◎', perm:'compliance:read' },
  { href:'/dashboard/audit',          label:'Audit Trail',    icon:'☰', perm:'audit:read' },
  { href:'/dashboard/reports',        label:'Reports',        icon:'▦', perm:'reports:view' },
  { href:'/dashboard/users',          label:'Users',          icon:'◯', perm:'users:read' },
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
        if (p?.state?.isAuthenticated && p?.state?.token) { setAuthed(true); setChecking(false); return; }
      }
    } catch {}
    setChecking(false); router.replace('/login');
  }, []);

  if (checking) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'#0d1326' }}>
      <div style={{ textAlign:'center' }}>
        <img src="/valugrid-logo.png" alt="ValuGrid" style={{ height:'40px', objectFit:'contain', display: logoErr ? 'none' : 'block', margin:'0 auto 10px' }} onError={() => setLogoErr(true)} />
        {logoErr && <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.4rem' }}><span style={{ color:'#2979FF' }}>VALU</span><span style={{ color:'#00E5A0' }}>GRID</span></div>}
        <div style={{ width:'80px', height:'2px', background:'rgba(255,255,255,0.08)', borderRadius:'2px', overflow:'hidden', margin:'12px auto 0' }}>
          <div style={{ height:'100%', width:'40%', background:'#2979FF', animation:'pulse-dot 1s ease infinite' }} />
        </div>
      </div>
    </div>
  );

  if (!authed) return null;

  const initials = user?.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() || 'VG';

  return (
    <div style={{ display:'flex', height:'100vh', background:'#0d1326', overflow:'hidden', fontFamily:'DM Sans, sans-serif' }}>

      {/* ── Sidebar ─────────────────────────────── */}
      <aside style={{ width:'224px', flexShrink:0, background:'#080e1c', borderRight:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column', position:'relative' }}>
        {/* Top accent */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'1px', background:'linear-gradient(90deg,#2979FF,transparent)' }} />

        {/* Logo */}
        <div style={{ padding:'1.4rem 1.25rem 1rem', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <img
            src="/valugrid-logo.png"
            alt="ValuGrid"
            style={{ height:'32px', objectFit:'contain', objectPosition:'left', display: logoErr ? 'none' : 'block', marginBottom: logoErr ? 0 : '4px' }}
            onError={() => setLogoErr(true)}
          />
          {logoErr && (
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.25rem', letterSpacing:'-0.03em' }}>
              <span style={{ color:'#2979FF' }}>VALU</span><span style={{ color:'#00E5A0' }}>GRID</span>
            </div>
          )}
          <p style={{ color:'rgba(180,196,240,0.45)', fontSize:'0.57rem', letterSpacing:'0.14em', textTransform:'uppercase', fontFamily:'Syne,sans-serif', marginTop:'4px', marginBottom:0 }}>
            Compliance Intelligence
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'0.85rem 0.7rem', display:'flex', flexDirection:'column', gap:'2px', overflowY:'auto' }}>
          {NAV.filter(i => !i.perm || hasPermission(i.perm)).map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'8px', textDecoration:'none', fontSize:'0.8rem', transition:'all .15s', background: active ? 'rgba(41,121,255,0.12)' : 'transparent', border: active ? '1px solid rgba(41,121,255,0.22)' : '1px solid transparent', color: active ? '#7ab4ff' : 'rgba(160,180,230,0.5)' }}>
                <span style={{ fontSize:'0.85rem', opacity: active ? 1 : 0.65 }}>{item.icon}</span>
                {item.label}
                {active && <div style={{ marginLeft:'auto', width:'4px', height:'4px', borderRadius:'50%', background:'#2979FF' }} />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding:'1rem', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
            <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:'rgba(41,121,255,0.15)', border:'1px solid rgba(41,121,255,0.22)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'0.68rem', color:'#7ab4ff', flexShrink:0 }}>{initials}</div>
            <div style={{ overflow:'hidden' }}>
              <p style={{ color:'#EEF2FF', fontSize:'0.78rem', fontWeight:600, fontFamily:'Syne,sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', margin:0 }}>{user?.fullName}</p>
              <p style={{ color:'rgba(160,180,230,0.5)', fontSize:'0.62rem', fontFamily:'Syne,sans-serif', margin:0 }}>{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push('/login'); }}
            style={{ width:'100%', padding:'8px', borderRadius:'6px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(160,180,230,0.5)', fontSize:'0.68rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer', transition:'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,77,109,0.3)'; e.currentTarget.style.color='#FF7B93'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.color='rgba(160,180,230,0.5)'; }}
          >Sign Out</button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────── */}
      <main style={{ flex:1, overflowY:'auto', background:'#0d1326', position:'relative' }}>
        <div className="vg-grid" style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, opacity:.5 }} />
        <div style={{ position:'relative', zIndex:1 }}>{children}</div>
      </main>
    </div>
  );
}
