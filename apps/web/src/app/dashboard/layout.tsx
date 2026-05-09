'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';

const NAV = [
  { href:'/dashboard',                label:'Overview',        icon:'◈', perm:null },
  { href:'/dashboard/cases',          label:'Case Registry',   icon:'⬡', perm:'cases:read' },
  { href:'/dashboard/deliveries',     label:'Delivery Ops',    icon:'⟳', perm:'delivery:read' },
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
        <div style={{ width:'60px', height:'3px', background:'#DDE3F0', borderRadius:'3px', overflow:'hidden', margin:'10px auto 0' }}>
          <div style={{ height:'100%', width:'40%', background:'#2979FF', animation:'pulse-dot 1s ease infinite' }} />
        </div>
      </div>
    </div>
  );

  if (!authed) return null;

  const initials = user?.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() || 'VG';

  return (
    <div style={{ display:'flex', height:'100vh', background:'#F0F4FF', overflow:'hidden', fontFamily:'DM Sans, sans-serif' }}>

      {/* Dark Sidebar */}
      <aside style={{ width:'220px', flexShrink:0, background:'#080e1c', borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', position:'relative' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg,#2979FF,#00C980,transparent)' }} />

        {/* Logo */}
        <div style={{ padding:'1.25rem 1.1rem 0.9rem', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <img src="/valugrid-logo.png" alt="ValuGrid"
            style={{ height:'28px', objectFit:'contain', objectPosition:'left', display: logoErr ? 'none':'block' }}
            onError={() => setLogoErr(true)} />
          {logoErr && (
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.2rem', letterSpacing:'-0.03em' }}>
              <span style={{ color:'#2979FF' }}>VALU</span><span style={{ color:'#00C980' }}>GRID</span>
            </div>
          )}
          <p style={{ color:'rgba(160,180,230,0.4)', fontSize:'0.55rem', letterSpacing:'0.14em', textTransform:'uppercase', fontFamily:'Syne,sans-serif', marginTop:'5px', marginBottom:0 }}>
            Compliance Intelligence
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'0.75rem 0.65rem', display:'flex', flexDirection:'column', gap:'2px', overflowY:'auto' }}>
          {NAV.filter(i => !i.perm || hasPermission(i.perm)).map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} style={{
                display:'flex', alignItems:'center', gap:'9px',
                padding:'8px 11px', borderRadius:'8px', textDecoration:'none',
                fontSize:'0.78rem', transition:'all .15s',
                background: active ? 'rgba(41,121,255,0.14)' : 'transparent',
                border: active ? '1px solid rgba(41,121,255,0.25)' : '1px solid transparent',
                color: active ? '#7ab4ff' : 'rgba(160,180,230,0.48)',
              }}>
                <span style={{ fontSize:'0.82rem', opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                {item.label}
                {active && <div style={{ marginLeft:'auto', width:'4px', height:'4px', borderRadius:'50%', background:'#2979FF', flexShrink:0 }} />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding:'0.9rem', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'9px', marginBottom:'9px' }}>
            <div style={{ width:'30px', height:'30px', borderRadius:'8px', background:'rgba(41,121,255,0.18)', border:'1px solid rgba(41,121,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'0.65rem', color:'#7ab4ff', flexShrink:0 }}>{initials}</div>
            <div style={{ overflow:'hidden' }}>
              <p style={{ color:'#EEF2FF', fontSize:'0.75rem', fontWeight:600, fontFamily:'Syne,sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', margin:0 }}>{user?.fullName}</p>
              <p style={{ color:'rgba(160,180,230,0.45)', fontSize:'0.6rem', fontFamily:'Syne,sans-serif', margin:0 }}>{user?.role}</p>
            </div>
          </div>
          <button onClick={() => { logout(); router.push('/login'); }}
            style={{ width:'100%', padding:'7px', borderRadius:'6px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(160,180,230,0.45)', fontSize:'0.65rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer', transition:'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(229,62,62,0.35)'; e.currentTarget.style.color='#FC8181'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.color='rgba(160,180,230,0.45)'; }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Light Main */}
      <main style={{ flex:1, overflowY:'auto', background:'#F0F4FF' }}>
        {children}
      </main>
    </div>
  );
}
