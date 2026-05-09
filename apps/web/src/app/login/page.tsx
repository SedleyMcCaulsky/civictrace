'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth.store';

const LIVE_API = 'https://civictrace-production.up.railway.app/api/v1';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setError(null);
    try {
      const res = await fetch(`${LIVE_API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Login failed');
      login(json.accessToken, json.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--vg-bg-deep)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated grid background */}
      <div className="vg-grid-bg" style={{ position: 'absolute', inset: 0, opacity: mounted ? 1 : 0, transition: 'opacity 1s' }} />

      {/* Blue orb top right */}
      <div style={{
        position: 'absolute', top: '-15%', right: '-10%',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(27,110,255,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Green orb bottom left */}
      <div style={{
        position: 'absolute', bottom: '-15%', left: '-10%',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,214,143,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(27,110,255,0.3), transparent)',
        animation: 'vg-scan 8s linear infinite',
        pointerEvents: 'none',
      }} />

      {/* Login card */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: '420px', padding: '0 1.5rem',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.6s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <span className="vg-logo-mark" style={{ fontSize: '2.5rem' }}>
              <span className="vg-logo-valu">VALU</span><span className="vg-logo-grid">GRID</span>
            </span>
          </div>
          <p style={{ color: 'var(--vg-text-muted)', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Syne, sans-serif' }}>
            Compliance Intelligence · Smarter Communities
          </p>
          <div style={{ width: '40px', height: '2px', background: 'linear-gradient(90deg, var(--vg-blue), var(--vg-green))', margin: '1rem auto 0' }} />
        </div>

        {/* Card */}
        <div className="vg-card" style={{ borderRadius: '16px', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
          {/* Card top accent line */}
          <div style={{
            position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
            background: 'linear-gradient(90deg, transparent, var(--vg-blue), transparent)',
          }} />

          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--vg-text)' }}>
            Access Portal
          </h2>
          <p style={{ color: 'var(--vg-text-muted)', fontSize: '0.8rem', marginBottom: '1.75rem' }}>
            Enter your credentials to continue
          </p>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div style={{
                background: 'rgba(255,60,80,0.08)', border: '1px solid rgba(255,60,80,0.2)',
                borderRadius: '8px', padding: '10px 14px',
                color: '#ff6b7a', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span>⚠</span> {error}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--vg-text-muted)', marginBottom: '8px' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="officer@valugrid.gov.jm"
                className="vg-input"
                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', fontSize: '0.875rem' }}
                {...register('email')}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--vg-text-muted)', marginBottom: '8px' }}>
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                className="vg-input"
                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', fontSize: '0.875rem' }}
                {...register('password')}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="vg-btn-primary"
              style={{
                width: '100%', padding: '13px', borderRadius: '8px',
                marginTop: '0.5rem', fontSize: '0.75rem',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--vg-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--vg-green)', animation: 'vg-pulse 2s infinite' }} />
            <span style={{ color: 'var(--vg-text-muted)', fontSize: '0.72rem', fontFamily: 'Syne, sans-serif', letterSpacing: '0.05em' }}>
              Secure Government Platform · Jamaica
            </span>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--vg-text-muted)', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
          ValuGrid v2.0 · Property Tax Compliance Intelligence
        </p>
      </div>
    </div>
  );
}
