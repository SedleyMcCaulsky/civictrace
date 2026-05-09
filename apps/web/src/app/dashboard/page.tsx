'use client';
export const dynamic = 'force-dynamic';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: areas } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => (await api.get('/cases/areas')).data,
  });

  const { data: auditData } = useQuery({
    queryKey: ['audit-summary'],
    queryFn: async () => (await api.get('/audit/logs?limit=5')).data,
  });

  const { data: casesData } = useQuery({
    queryKey: ['cases-summary'],
    queryFn: async () => (await api.get('/cases?limit=5')).data,
  });

  const { data: executive } = useQuery({
    queryKey: ['executive'],
    queryFn: async () => (await api.get('/reports/executive')).data,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.fullName?.split(' ')[0] || 'Officer';

  const stats = [
    { label: 'Active Cases', value: executive?.cases?.total_cases || casesData?.pagination?.total || '—', accent: 'blue', sub: 'Property records' },
    { label: 'Delinquent', value: executive?.cases?.delinquent || '—', accent: 'red', sub: 'Require action' },
    { label: 'Outstanding', value: executive?.cases?.total_outstanding ? `J$${(Number(executive.cases.total_outstanding)/1000).toFixed(0)}K` : '—', accent: 'amber', sub: 'Total liability' },
    { label: 'Delivery Rate', value: executive?.deliveries?.delivery_rate ? `${executive.deliveries.delivery_rate}%` : '—', accent: 'green', sub: 'Field success rate' },
    { label: 'Operational Areas', value: areas?.length || '—', accent: 'blue', sub: 'Active zones' },
    { label: 'Audit Events', value: auditData?.pagination?.total || '—', accent: 'purple', sub: 'Logged actions' },
  ];

  const accentColors: Record<string, string> = {
    blue: 'var(--vg-blue)', green: 'var(--vg-green)',
    red: '#ff4d5e', amber: '#f59e0b', purple: '#8b5cf6',
  };

  const quickActions = [
    { label: 'New Case', href: '/dashboard/cases', icon: '⬡', desc: 'Register property case' },
    { label: 'Log Delivery', href: '/dashboard/deliveries', icon: '⟳', desc: 'Field delivery outcome' },
    { label: 'Reconcile', href: '/dashboard/reconciliation', icon: '⇌', desc: 'Payment batch' },
    { label: 'GIS Map', href: '/dashboard/compliance', icon: '◎', desc: 'Delinquency heatmap' },
    { label: 'Reports', href: '/dashboard/reports', icon: '▦', desc: 'Generate & export' },
    { label: 'Audit Trail', href: '/dashboard/audit', icon: '☰', desc: 'Immutable logs' },
  ];

  return (
    <div style={{ padding: '2rem 2.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ color: 'var(--vg-text-muted)', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Syne, sans-serif', marginBottom: '4px' }}>
            {greeting}
          </p>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--vg-text)', letterSpacing: '-0.02em', fontFamily: 'Syne, sans-serif' }}>
            {firstName} <span style={{ color: 'var(--vg-blue)' }}>→</span>
          </h1>
          <p style={{ color: 'var(--vg-text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
            {new Date().toLocaleDateString('en-JM', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '8px', background: 'rgba(0,214,143,0.06)', border: '1px solid rgba(0,214,143,0.15)' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--vg-green)', animation: 'vg-pulse 2s infinite' }} />
          <span style={{ color: 'var(--vg-green)', fontSize: '0.7rem', fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>System Online</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '2rem' }}>
        {stats.map((stat, i) => (
          <div key={i} className="vg-card" style={{ borderRadius: '12px', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${accentColors[stat.accent]}, transparent)` }} />
            <p style={{ color: 'var(--vg-text-muted)', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Syne, sans-serif', marginBottom: '8px' }}>{stat.label}</p>
            <p className="vg-stat-number" style={{ color: accentColors[stat.accent] || 'var(--vg-text)' }}>{stat.value}</p>
            <p style={{ color: 'var(--vg-text-muted)', fontSize: '0.7rem', marginTop: '4px' }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions + Areas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Quick Actions */}
        <div className="vg-card" style={{ borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
            <div style={{ width: '3px', height: '18px', background: 'var(--vg-blue)', borderRadius: '2px' }} />
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vg-text)' }}>Quick Actions</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {quickActions.map((a, i) => (
              <a key={i} href={a.href} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--vg-border)',
                textDecoration: 'none', transition: 'all 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(27,110,255,0.3)'; el.style.background = 'rgba(27,110,255,0.06)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--vg-border)'; el.style.background = 'rgba(255,255,255,0.02)'; }}
              >
                <span style={{ fontSize: '1rem', color: 'var(--vg-blue)', flexShrink: 0 }}>{a.icon}</span>
                <div>
                  <p style={{ color: 'var(--vg-text)', fontSize: '0.78rem', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>{a.label}</p>
                  <p style={{ color: 'var(--vg-text-muted)', fontSize: '0.65rem' }}>{a.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Operational Areas */}
        <div className="vg-card" style={{ borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
            <div style={{ width: '3px', height: '18px', background: 'var(--vg-green)', borderRadius: '2px' }} />
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vg-text)' }}>Operational Areas</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
            {!areas && <p style={{ color: 'var(--vg-text-muted)', fontSize: '0.8rem' }}>Loading...</p>}
            {areas?.map((area: any) => (
              <div key={area.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: '6px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--vg-border)',
              }}>
                <div>
                  <p style={{ color: 'var(--vg-text)', fontSize: '0.78rem', fontFamily: 'Syne, sans-serif', fontWeight: 500 }}>{area.name}</p>
                  <p style={{ color: 'var(--vg-text-muted)', fontSize: '0.65rem' }}>{area.parish}</p>
                </div>
                <span style={{
                  fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px',
                  fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: '0.08em',
                  background: area.region === 'SOUTH' ? 'rgba(27,110,255,0.1)' : area.region === 'NORTH' ? 'rgba(0,214,143,0.1)' : 'rgba(245,158,11,0.1)',
                  color: area.region === 'SOUTH' ? '#6ba7ff' : area.region === 'NORTH' ? 'var(--vg-green)' : '#f59e0b',
                  border: `1px solid ${area.region === 'SOUTH' ? 'rgba(27,110,255,0.2)' : area.region === 'NORTH' ? 'rgba(0,214,143,0.2)' : 'rgba(245,158,11,0.2)'}`,
                }}>{area.region}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
