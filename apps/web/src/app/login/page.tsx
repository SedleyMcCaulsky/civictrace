'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth.store';

const API = 'https://civictrace-production.up.railway.app/api/v1';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore(s => s.login);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  async function onSubmit(data: any) {
    setError(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Login failed');
      login(json.accessToken, json.user);
      router.push('/dashboard');
    } catch (e: any) { setError(e.message || 'Invalid credentials'); }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0d1326', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden', fontFamily:'DM Sans, sans-serif' }}>
      {/* Grid */}
      <div className="vg-grid" style={{ position:'absolute', inset:0, pointerEvents:'none' }} />
      {/* Orbs */}
      <div style={{ position:'absolute', top:'-20%', right:'-12%', width:'520px', height:'520px', borderRadius:'50%', background:'radial-gradient(circle, rgba(41,121,255,0.11) 0%, transparent 68%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-18%', left:'-10%', width:'420px', height:'420px', borderRadius:'50%', background:'radial-gradient(circle, rgba(0,229,160,0.07) 0%, transparent 68%)', pointerEvents:'none' }} />

      {/* Card */}
      <div className="animate-up" style={{ position:'relative', zIndex:10, width:'100%', maxWidth:'420px', padding:'0 1.5rem' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
          <img
            src="/valugrid-logo.png"
            alt="ValuGrid"
            style={{ height:'52px', objectFit:'contain', display:'block', margin:'0 auto 10px' }}
            onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
          />
          {/* Fallback text logo if image missing */}
          <div style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'2.2rem', letterSpacing:'-0.04em', lineHeight:1 }}>
            <span style={{ color:'#2979FF' }}>VALU</span><span style={{ color:'#00E5A0' }}>GRID</span>
          </div>
          <p style={{ color:'rgba(180,196,240,0.5)', fontSize:'0.65rem', letterSpacing:'0.18em', textTransform:'uppercase', fontFamily:'Syne, sans-serif', marginTop:'8px' }}>
            Compliance Intelligence · Smarter Communities
          </p>
          <div style={{ width:'48px', height:'2px', background:'linear-gradient(90deg,#2979FF,#00E5A0)', margin:'12px auto 0', borderRadius:'2px' }} />
        </div>

        {/* Form card */}
        <div style={{ background:'rgba(13,19,38,0.92)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'16px', padding:'2rem', backdropFilter:'blur(20px)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:'12%', right:'12%', height:'1px', background:'linear-gradient(90deg,transparent,rgba(41,121,255,0.5),transparent)' }} />

          <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.05rem', fontWeight:700, color:'#EEF2FF', marginBottom:'4px' }}>Access Portal</h2>
          <p style={{ color:'rgba(180,196,240,0.55)', fontSize:'0.78rem', marginBottom:'1.75rem' }}>Enter your credentials to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {error && (
              <div style={{ background:'rgba(255,77,109,0.09)', border:'1px solid rgba(255,77,109,0.22)', borderRadius:'8px', padding:'10px 14px', color:'#FF7B93', fontSize:'0.78rem' }}>
                ⚠ {error}
              </div>
            )}

            {[
              { name:'email',    label:'Email Address', type:'email',    ph:'officer@valugrid.gov.jm' },
              { name:'password', label:'Password',      type:'password', ph:'••••••••••••' },
            ].map(f => (
              <div key={f.name}>
                <label style={{ display:'block', fontSize:'0.63rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(180,196,240,0.55)', marginBottom:'8px' }}>{f.label}</label>
                <input type={f.type} placeholder={f.ph} className="vg-input" style={{ padding:'11px 14px', borderRadius:'8px', fontSize:'0.875rem' }} {...register(f.name as any)}
                  onFocus={e => { e.target.style.borderColor='#2979FF'; e.target.style.boxShadow='0 0 0 3px rgba(41,121,255,0.18)'; }}
                  onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.08)'; e.target.style.boxShadow='none'; }} />
              </div>
            ))}

            <button type="submit" disabled={isSubmitting} className="vg-btn vg-btn-primary" style={{ padding:'13px', borderRadius:'8px', marginTop:'6px' }}>
              {isSubmitting ? 'Authenticating…' : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop:'1.5rem', paddingTop:'1.25rem', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#00E5A0', animation:'pulse-dot 2s infinite', flexShrink:0 }} />
            <span style={{ color:'rgba(180,196,240,0.45)', fontSize:'0.7rem', fontFamily:'Syne,sans-serif', letterSpacing:'0.05em' }}>Secure Government Platform · Jamaica</span>
          </div>
        </div>

        <p style={{ textAlign:'center', marginTop:'1.5rem', color:'rgba(160,180,230,0.3)', fontSize:'0.66rem', letterSpacing:'0.05em' }}>
          ValuGrid v2.0 · Property Tax Compliance Intelligence
        </p>
      </div>
    </div>
  );
}
