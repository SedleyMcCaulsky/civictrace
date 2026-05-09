'use client';
export const dynamic = 'force-dynamic';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const C = {
  bg: '#080c17', card: 'rgba(13,19,35,0.9)', surface: 'rgba(255,255,255,0.03)',
  blue: '#1B6EFF', green: '#00D68F', red: '#ff4d5e', amber: '#f59e0b', purple: '#a78bfa',
  text: '#e8eeff', muted: 'rgba(160,180,230,0.6)', border: 'rgba(255,255,255,0.07)',
  borderBlue: 'rgba(27,110,255,0.25)', grid: 'rgba(27,110,255,0.04)',
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: areas } = useQuery({ queryKey: ['areas'], queryFn: async () => (await api.get('/cases/areas')).data });
  const { data: auditData } = useQuery({ queryKey: ['audit-summary'], queryFn: async () => (await api.get('/audit/logs?limit=5')).data });
  const { data: casesData } = useQuery({ queryKey: ['cases-summary'], queryFn: async () => (await api.get('/cases?limit=5')).data });
  const { data: executive } = useQuery({ queryKey: ['executive'], queryFn: async () => (await api.get('/reports/executive')).data });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.fullName?.split(' ')[0] || 'Officer';

  const stats = [
    { label: 'Active Cases', value: executive?.cases?.total_cases || casesData?.pagination?.total || '—', color: C.blue, sub: 'Property records' },
    { label: 'Delinquent', value: executive?.cases?.delinquent || '—', color: C.red, sub: 'Require action' },
    { label: 'Outstanding', value: executive?.cases?.total_outstanding ? `J$${(Number(executive.cases.total_outstanding)/1000).toFixed(0)}K` : '—', color: C.amber, sub: 'Total liability' },
    { label: 'Delivery Rate', value: executive?.deliveries?.delivery_rate ? `${executive.deliveries.delivery_rate}%` : '—', color: C.green, sub: 'Field success rate' },
    { label: 'Operational Areas', value: areas?.length || '—', color: C.blue, sub: 'Active zones' },
    { label: 'Audit Events', value: auditData?.pagination?.total || '—', color: C.purple, sub: 'Logged actions' },
  ];

  const quickActions = [
    { label: 'New Case', href: '/dashboard/cases', icon: '⬡', desc: 'Register property case' },
    { label: 'Log Delivery', href: '/dashboard/deliveries', icon: '⟳', desc: 'Field delivery outcome' },
    { label: 'Reconcile', href: '/dashboard/reconciliation', icon: '⇌', desc: 'Payment batch' },
    { label: 'GIS Map', href: '/dashboard/compliance', icon: '◎', desc: 'Delinquency heatmap' },
    { label: 'Reports', href: '/dashboard/reports', icon: '▦', desc: 'Generate & export' },
    { label: 'Audit Trail', href: '/dashboard/audit', icon: '☰', desc: 'Immutable logs' },
  ];

  const regionColor = (r: string) => r === 'SOUTH' ? { bg: 'rgba(27,110,255,0.1)', color: '#6ba7ff', border: 'rgba(27,110,255,0.2)' } : r === 'NORTH' ? { bg: 'rgba(0,214,143,0.1)', color: '#00D68F', border: 'rgba(0,214,143,0.2)' } : { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)' };

  return (
    <div style={{ padding: '2rem 2.5rem', background: C.bg, minHeight: '100vh' }}>
      {/* Grid bg */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `linear-gradient(${C.grid} 1px, transparent 1px), linear-gradient(90deg, ${C.grid} 1px, transparent 1px)`, backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: C.muted, fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Syne, sans-serif', marginBottom: '6px' }}>{greeting}</p>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, color: C.text, letterSpacing: '-0.03em', fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
              {firstName} <span style={{ color: C.blue }}>→</span>
            </h1>
            <p style={{ color: C.muted, fontSize: '0.8rem', marginTop: '6px', fontFamily: 'DM Sans, sans-serif' }}>
              {new Date().toLocaleDateString('en-JM', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(0,214,143,0.06)', border: '1px solid rgba(0,214,143,0.15)' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: C.green, animation: 'vg-pulse 2s infinite' }} />
            <span style={{ color: C.green, fontSize: '0.7rem', fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>System Online</span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '2rem' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '1.25rem', position: 'relative', overflow: 'hidden', backdropFilter: 'blur(20px)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
              <p style={{ color: C.muted, fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Syne, sans-serif', marginBottom: '10px' }}>{s.label}</p>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.03em', color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ color: C.muted, fontSize: '0.7rem', marginTop: '6px', fontFamily: 'DM Sans, sans-serif' }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Bottom grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Quick Actions */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '1.5rem', backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
              <div style={{ width: '3px', height: '18px', background: C.blue, borderRadius: '2px' }} />
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.text }}>Quick Actions</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {quickActions.map((a, i) => (
                <a key={i} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, textDecoration: 'none', transition: 'all 0.15s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.borderBlue; el.style.background = 'rgba(27,110,255,0.06)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.border; el.style.background = 'rgba(255,255,255,0.02)'; }}>
                  <span style={{ fontSize: '1rem', color: C.blue }}>{a.icon}</span>
                  <div>
                    <p style={{ color: C.text, fontSize: '0.78rem', fontFamily: 'Syne, sans-serif', fontWeight: 600, margin: 0 }}>{a.label}</p>
                    <p style={{ color: C.muted, fontSize: '0.65rem', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>{a.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Areas */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '1.5rem', backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
              <div style={{ width: '3px', height: '18px', background: C.green, borderRadius: '2px' }} />
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.text }}>Operational Areas</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
              {!areas && <p style={{ color: C.muted, fontSize: '0.8rem' }}>Loading...</p>}
              {areas?.map((area: any) => {
                const rc = regionColor(area.region);
                return (
                  <div key={area.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}` }}>
                    <div>
                      <p style={{ color: C.text, fontSize: '0.78rem', fontFamily: 'Syne, sans-serif', fontWeight: 500, margin: 0 }}>{area.name}</p>
                      <p style={{ color: C.muted, fontSize: '0.65rem', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>{area.parish}</p>
                    </div>
                    <span style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px', fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: '0.08em', background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>{area.region}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
