'use client';
export const dynamic = 'force-dynamic';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { S, C, F } from '@/lib/styles';

export default function DashboardPage() {
  const user = useAuthStore(s => s.user);
  const { data: areas }  = useQuery({ queryKey:['areas'],    queryFn: async () => (await api.get('/cases/areas')).data });
  const { data: audit }  = useQuery({ queryKey:['aud-sum'],  queryFn: async () => (await api.get('/audit/logs?limit=1')).data });
  const { data: exec }   = useQuery({ queryKey:['exec'],     queryFn: async () => (await api.get('/reports/executive')).data });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.fullName?.split(' ')[0] || 'Officer';

  const stats = [
    { label:'Active Cases',      value: exec?.cases?.total_cases        ?? 0,      color:C.blue,   bg:C.blueBg,   bd:C.blueBd },
    { label:'Delinquent',        value: exec?.cases?.delinquent         ?? 0,      color:C.red,    bg:C.redBg,    bd:C.redBd },
    { label:'Outstanding',       value: exec?.cases?.total_outstanding  ? `J$${(Number(exec.cases.total_outstanding)/1000).toFixed(0)}K` : 'J$0', color:C.amber,  bg:C.amberBg,  bd:C.amberBd },
    { label:'Delivery Rate',     value: exec?.deliveries?.delivery_rate ? `${exec.deliveries.delivery_rate}%` : '0%', color:C.green,  bg:C.greenBg,  bd:C.greenBd },
    { label:'Operational Areas', value: areas?.length                   ?? 0,      color:C.blue,   bg:C.blueBg,   bd:C.blueBd },
    { label:'Audit Events',      value: audit?.pagination?.total        ?? 0,      color:C.purple, bg:C.purpleBg, bd:C.purpleBd },
  ];

  const actions = [
    { label:'New Case',     href:'/dashboard/cases',          icon:'⬡', desc:'Register property case' },
    { label:'Log Delivery', href:'/dashboard/deliveries',     icon:'⟳', desc:'Field delivery outcome' },
    { label:'Assignments',  href:'/dashboard/assignments',    icon:'⊞', desc:'Assign field officers' },
    { label:'Reconcile',    href:'/dashboard/reconciliation', icon:'⇌', desc:'Payment batch' },
    { label:'GIS Map',      href:'/dashboard/compliance',     icon:'◎', desc:'Delinquency heatmap' },
    { label:'Reports',      href:'/dashboard/reports',        icon:'▦', desc:'Generate & export' },
  ];

  const rc = (r: string) => r==='SOUTH' ? {bg:C.blueBg,color:C.blue,bd:C.blueBd} : r==='NORTH' ? {bg:C.greenBg,color:C.green,bd:C.greenBd} : {bg:C.amberBg,color:C.amber,bd:C.amberBd};

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ ...S.pageHeader, marginBottom:'1.75rem' }}>
        <div>
          <p style={{ ...S.tiny, marginBottom:'4px' }}>{greeting}</p>
          <h1 style={{ ...S.h1, fontSize:'1.75rem' }}>{firstName} <span style={{ color:C.blue }}>→</span></h1>
          <p style={{ ...S.muted, marginTop:'5px' }}>{new Date().toLocaleDateString('en-JM',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'7px', padding:'7px 14px', borderRadius:'20px', background:C.greenBg, border:`1px solid ${C.greenBd}` }}>
          <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:C.green, animation:'pulse-dot 2.5s infinite', flexShrink:0 }} />
          <span style={{ ...S.tiny, color:C.green, marginBottom:0 }}>System Online</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'1.75rem' }}>
        {stats.map((s,i) => (
          <div key={i} style={{ ...S.card, padding:'1rem 1.25rem', position:'relative', overflow:'hidden', border:`1.5px solid ${s.bd}` }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:s.color }} />
            <p style={S.statLabel}>{s.label}</p>
            <p style={{ ...S.statNum, color:s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
        <div style={{ ...S.card, padding:'1.25rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'1rem' }}>
            <div style={S.accentBar(C.blue)} />
            <h3 style={S.h3}>Quick Actions</h3>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'7px' }}>
            {actions.map((a,i) => (
              <a key={i} href={a.href} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 11px', borderRadius:'8px', background:C.surface, border:`1.5px solid ${C.border}`, textDecoration:'none', transition:'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=C.blueBd; e.currentTarget.style.background=C.blueBg; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.background=C.surface; }}>
                <span style={{ fontSize:'0.9rem', color:C.blue, flexShrink:0 }}>{a.icon}</span>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.75rem', color:C.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.label}</p>
                  <p style={{ fontFamily:F.body, fontSize:'0.63rem', color:C.muted, margin:0 }}>{a.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div style={{ ...S.card, padding:'1.25rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'1rem' }}>
            <div style={S.accentBar(C.green)} />
            <h3 style={S.h3}>Operational Areas</h3>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px', maxHeight:'260px', overflowY:'auto' }}>
            {!areas && <p style={S.muted}>Loading…</p>}
            {areas?.map((area: any) => {
              const r = rc(area.region);
              return (
                <div key={area.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', borderRadius:'7px', background:C.surface, border:`1px solid ${C.border}` }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <p style={{ fontFamily:F.display, fontWeight:600, fontSize:'0.76rem', color:C.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{area.name}</p>
                    <p style={{ fontFamily:F.body, fontSize:'0.63rem', color:C.muted, margin:0 }}>{area.parish}</p>
                  </div>
                  <span style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.57rem', letterSpacing:'0.06em', textTransform:'uppercase', padding:'2px 8px', borderRadius:'4px', background:r.bg, color:r.color, border:`1px solid ${r.bd}`, flexShrink:0, marginLeft:'8px' }}>{area.region}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
