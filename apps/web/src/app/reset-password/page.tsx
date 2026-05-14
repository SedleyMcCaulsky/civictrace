'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!password || password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Invalid or expired reset link');
    } finally { setLoading(false); }
  }

  if (!token) return (
    <div style={{ textAlign:'center', color:'#f87171', fontFamily:'DM Sans,sans-serif', fontSize:'0.88rem' }}>
      Invalid reset link. <a href="/forgot-password" style={{ color:'#2979FF' }}>Request a new one</a>.
    </div>
  );

  return done ? (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>✅</div>
      <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'1rem', color:'#f9fafb', marginBottom:'8px' }}>Password Reset</h2>
      <p style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.82rem', color:'#9ca3af' }}>Redirecting to login…</p>
    </div>
  ) : (
    <>
      {error && <div style={{ background:'#1f0a0a', border:'1px solid #7f1d1d', borderRadius:'8px', padding:'10px 12px', marginBottom:'1rem' }}><p style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.78rem', color:'#f87171', margin:0 }}>{error}</p></div>}
      {[{label:'New Password', val:password, set:setPassword},{label:'Confirm Password', val:confirm, set:setConfirm}].map(f=>(
        <div key={f.label} style={{ marginBottom:'1rem' }}>
          <label style={{ display:'block', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.65rem', letterSpacing:'0.1em', textTransform:'uppercase', color:'#9ca3af', marginBottom:'6px' }}>{f.label}</label>
          <input type="password" value={f.val} onChange={e=>f.set(e.target.value)}
            style={{ width:'100%', padding:'10px 14px', background:'#1f2937', border:'1.5px solid #374151', borderRadius:'8px', color:'#f9fafb', fontFamily:'DM Sans,sans-serif', fontSize:'0.88rem', boxSizing:'border-box' as const, outline:'none' }}
          />
        </div>
      ))}
      <button onClick={submit} disabled={!password||!confirm||loading}
        style={{ width:'100%', padding:'12px', background:'#2979FF', border:'none', borderRadius:'8px', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.82rem', color:'white', cursor:'pointer', opacity:(!password||!confirm||loading)?0.6:1 }}>
        {loading ? 'Resetting…' : 'Reset Password'}
      </button>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#080c17', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:'16px', padding:'2.5rem', width:'100%', maxWidth:'420px' }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.5rem', color:'#2979FF', letterSpacing:'0.1em', margin:'0 0 4px' }}>VALUGRID</h1>
          <p style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.78rem', color:'#6b7280', margin:0 }}>Set a new password</p>
        </div>
        <Suspense fallback={<p style={{color:'#9ca3af',textAlign:'center'}}>Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
