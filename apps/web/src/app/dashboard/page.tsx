'use client';
export const dynamic = 'force-dynamic';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export default function DashboardPage() {
  const user = useAuthStore(s => s.user);
  const { data: areas }     = useQuery({ queryKey:['areas'],     queryFn: async () => (await api.get('/cases/areas')).data });
  const { data: auditData } = useQuery({ queryKey:['audit-sum'], queryFn: async () => (await api.get('/audit/logs?limit=5')).data });
  const { data: casesData } = useQuery({ queryKey:['cases-sum'], queryFn: async () => (await api.get('/cases?limit=1')).data });
  const { data: exec }      = useQuery({ queryKey:['exec'],      queryFn: async () => (await api.get('/reports/executive')).data });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.fullName?.split(' ')[0] || 'Officer';

  const stats = [
    { label:'Active Cases',      value: exec?.cases?.total_cases   || casesData?.pagination?.total || '—', color:'#2979FF', bg:'#EEF3FF', border:'#BFDBFE' },
    { label:'Delinquent',        value: exec?.cases?.delinquent    || '—', color:'#E53E3E', bg:'#FEF2F2', border:'#FECACA' },
    { label:'Outstanding',       value: exec?.cases?.total_outstanding ? `J$${(Number(exec.cases.total_outstanding)/1000).toFixed(0)}K` : '—', color:'#D97706', bg:'#FFFBEB', border:'#FDE68A' },
    { label:'Delivery Rate',     value: exec?.deliveries?.delivery_rate ? `${exec.deliveries.delivery_rate}%` : '—', color:'#059669', bg:'#E6FBF4', border:'#A7F3D0' },
    { label:'Operational Areas', value: areas?.length || '—', color:'#2979FF', bg:'#EEF3FF', border:'#BFDBFE' },
    { label:'Audit Events',      value: auditData?.pagination?.total || '—', color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE' },
  ];

  const quickActions = [
    { label:'New Case',     href:'/dashboard/cases',          icon:'⬡', desc:'Register property case' },
    { label:'Log Delivery', href:'/dashboard/deliveries',     icon:'⟳', desc:'Field delivery outcome' },
    { label:'Reconcile',    href:'/dashboard/reconciliation', icon:'⇌', desc:'Payment batch' },
    { label:'GIS Map',      href:'/dashboard/compliance',     icon:'◎', desc:'Delinquency heatmap' },
    { label:'Reports',      href:'/dashboard/reports',        icon:'▦', desc:'Generate & export' },
    { label:'Audit Trail',  href:'/dashboard/audit',          icon:'☰', desc:'Immutable logs' },
  ];

  const regionColor = (r: string) =>
    r === 'SOUTH' ? { bg:'#EEF3FF', color:'#2979FF', border:'#BFDBFE' } :
    r === 'NORTH' ? { bg:'#E6FBF4', color:'#059669', border:'#A7F3D0' } :
                    { bg:'#FFFBEB', color:'#D97706', border:'#FDE68A' };

  return (
    <div style={{ minHeight:"100vh" }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'1.75rem' }}>
        <div>
          <p style={{ color:'#5C6A8A', fontSize:'0.7rem', letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:'Syne,sans-serif', margin:'0 0 4px' }}>{greeting}</p>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.75rem', fontWeight:800, color:'#0d1326', margin:0, lineHeight:1.1 }}>
            {firstName} <span style={{ color:'#2979FF' }}>→</span>
          </h1>
          <p style={{ color:'#5C6A8A', fontSize:'0.78rem', margin:'5px 0 0' }}>
            {new Date().toLocaleDateString('en-JM', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'7px', padding:'7px 14px', borderRadius:'20px', background:'#E6FBF4', border:'1px solid #A7F3D0' }}>
          <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#059669', animation:'pulse-dot 2.5s infinite', flexShrink:0 }} />
          <span style={{ color:'#059669', fontSize:'0.68rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>System Online</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'1.75rem' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background:'#fff', border:`1.5px solid ${s.border}`, borderRadius:'12px', padding:'1.1rem 1.25rem', position:'relative', overflow:'hidden', boxShadow:'0 1px 4px rgba(13,19,38,0.06)' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:s.color, opacity:.7 }} />
            <p style={{ color:'#5C6A8A', fontSize:'0.6rem', letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:'Syne,sans-serif', margin:'0 0 8px' }}>{s.label}</p>
            <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.6rem', color:s.color, margin:0, lineHeight:1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
        {/* Quick Actions */}
        <div style={{ background:'#fff', border:'1.5px solid #DDE3F0', borderRadius:'12px', padding:'1.25rem', boxShadow:'0 1px 4px rgba(13,19,38,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'1rem' }}>
            <div style={{ width:'3px', height:'16px', background:'#2979FF', borderRadius:'3px' }} />
            <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#0d1326', margin:0 }}>Quick Actions</h3>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'7px' }}>
            {quickActions.map((a, i) => (
              <a key={i} href={a.href} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 11px', borderRadius:'8px', background:'#F5F8FF', border:'1.5px solid #DDE3F0', textDecoration:'none', transition:'all .15s' }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor='#BFDBFE'; el.style.background='#EEF3FF'; }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor='#DDE3F0'; el.style.background='#F5F8FF'; }}>
                <span style={{ fontSize:'0.9rem', color:'#2979FF', flexShrink:0 }}>{a.icon}</span>
                <div style={{ minWidth:0 }}>
                  <p style={{ color:'#0d1326', fontSize:'0.75rem', fontFamily:'Syne,sans-serif', fontWeight:700, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.label}</p>
                  <p style={{ color:'#5C6A8A', fontSize:'0.63rem', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Areas */}
        <div style={{ background:'#fff', border:'1.5px solid #DDE3F0', borderRadius:'12px', padding:'1.25rem', boxShadow:'0 1px 4px rgba(13,19,38,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'1rem' }}>
            <div style={{ width:'3px', height:'16px', background:'#00C980', borderRadius:'3px' }} />
            <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#0d1326', margin:0 }}>Operational Areas</h3>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px', maxHeight:'260px', overflowY:'auto' }}>
            {!areas && <p style={{ color:'#5C6A8A', fontSize:'0.78rem', margin:0 }}>Loading…</p>}
            {areas?.map((area: any) => {
              const rc = regionColor(area.region);
              return (
                <div key={area.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', borderRadius:'7px', background:'#F5F8FF', border:'1px solid #DDE3F0' }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <p style={{ color:'#0d1326', fontSize:'0.76rem', fontFamily:'Syne,sans-serif', fontWeight:600, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{area.name}</p>
                    <p style={{ color:'#5C6A8A', fontSize:'0.63rem', margin:0 }}>{area.parish}</p>
                  </div>
                  <span style={{ fontSize:'0.57rem', padding:'2px 7px', borderRadius:'4px', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.06em', background:rc.bg, color:rc.color, border:`1px solid ${rc.border}`, flexShrink:0, marginLeft:'8px' }}>{area.region}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
