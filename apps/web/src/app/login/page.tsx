'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth.store';

const LIVE_API = 'https://civictrace-production.up.railway.app/api/v1';
const C = {
  bg: '#080c17', blue: '#1B6EFF', green: '#00D68F',
  text: '#e8eeff', muted: 'rgba(160,180,230,0.6)',
  border: 'rgba(255,255,255,0.07)', card: 'rgba(13,19,35,0.9)',
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: any) {
    setError(null);
    try {
      const res = await fetch(`${LIVE_API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Login failed');
      login(json.accessToken, json.user);
      router.push('/dashboard');
    } catch (err: any) { setError(err.message || 'Invalid credentials'); }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(27,110,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(27,110,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />
      {/* Blue orb */}
      <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(27,110,255,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
      {/* Green orb */}
      <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,214,143,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '400px', padding: '0 1.5rem' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '2.5rem', letterSpacing: '-0.04em' }}>
            <span style={{ color: C.blue }}>VALU</span><span style={{ color: C.green }}>GRID</span>
          </div>
          <p style={{ color: C.muted, fontSize: '0.68rem', letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Syne, sans-serif', marginTop: '8px' }}>
            Compliance Intelligence · Smarter Communities
          </p>
          <div style={{ width: '48px', height: '2px', background: `linear-gradient(90deg, ${C.blue}, ${C.green})`, margin: '14px auto 0', borderRadius: '2px' }} />
        </div>

        {/* Card */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '2rem', backdropFilter: 'blur(20px)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '1px', background: `linear-gradient(90deg, transparent, ${C.blue}50, transparent)` }} />

          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.05rem', fontWeight: 600, color: C.text, marginBottom: '4px' }}>Access Portal</h2>
          <p style={{ color: C.muted, fontSize: '0.78rem', marginBottom: '1.75rem', fontFamily: 'DM Sans, sans-serif' }}>Enter your credentials to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div style={{ background: 'rgba(255,60,80,0.08)', border: '1px solid rgba(255,60,80,0.2)', borderRadius: '8px', padding: '10px 14px', color: '#ff7b87', fontSize: '0.78rem', fontFamily: 'DM Sans, sans-serif' }}>
                ⚠ {error}
              </div>
            )}
            {[
              { name: 'email', label: 'Email Address', type: 'email', placeholder: 'officer@valugrid.gov.jm' },
              { name: 'password', label: 'Password', type: 'password', placeholder: '••••••••••••' },
            ].map(f => (
              <div key={f.name}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, marginBottom: '8px' }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} {...register(f.name as any)} style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.text, fontSize: '0.875rem', fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => { e.target.style.borderColor = C.blue; e.target.style.boxShadow = '0 0 0 3px rgba(27,110,255,0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }} />
              </div>
            ))}

            <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '13px', borderRadius: '8px', background: isSubmitting ? 'rgba(27,110,255,0.6)' : C.blue, color: 'white', fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', marginTop: '0.5rem', transition: 'all 0.2s' }}
              onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.background = '#2d7fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isSubmitting ? 'rgba(27,110,255,0.6)' : C.blue; }}>
              {isSubmitting ? 'Authenticating...' : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.green, animation: 'vg-pulse 2s infinite', flexShrink: 0 }} />
            <span style={{ color: C.muted, fontSize: '0.7rem', fontFamily: 'Syne, sans-serif', letterSpacing: '0.05em' }}>Secure Government Platform · Jamaica</span>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'rgba(160,180,230,0.35)', fontSize: '0.68rem', letterSpacing: '0.05em', fontFamily: 'DM Sans, sans-serif' }}>
          ValuGrid v2.0 · Property Tax Compliance Intelligence
        </p>
      </div>
    </div>
  );
}
