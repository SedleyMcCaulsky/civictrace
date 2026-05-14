'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!email) return;
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Something went wrong');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#080c17', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:'16px', padding:'2.5rem', width:'100%', maxWidth:'420px' }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.5rem', color:'#2979FF', letterSpacing:'0.1em', margin:'0 0 4px' }}>VALUGRID</h1>
          <p style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.78rem', color:'#6b7280', margin:0 }}>Reset your password</p>
        </div>

        {sent ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>✉️</div>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'1rem', color:'#f9fafb', marginBottom:'8px' }}>Check your email</h2>
            <p style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.82rem', color:'#9ca3af', lineHeight:1.6 }}>
              If an account exists for <strong style={{color:'#f9fafb'}}>{email}</strong>, a reset link has been sent. Check your inbox and spam folder.
            </p>
            <a href="/login" style={{ display:'block', marginTop:'1.5rem', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.78rem', color:'#2979FF', textDecoration:'none' }}>← Back to login</a>
          </div>
        ) : (
          <>
            {error && <div style={{ background:'#1f0a0a', border:'1px solid #7f1d1d', borderRadius:'8px', padding:'10px 12px', marginBottom:'1rem' }}><p style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.78rem', color:'#f87171', margin:0 }}>{error}</p></div>}
            <div style={{ marginBottom:'1rem' }}>
              <label style={{ display:'block', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.65rem', letterSpacing:'0.1em', textTransform:'uppercase', color:'#9ca3af', marginBottom:'6px' }}>Email Address</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&submit()}
                placeholder="your@email.com"
                style={{ width:'100%', padding:'10px 14px', background:'#1f2937', border:'1.5px solid #374151', borderRadius:'8px', color:'#f9fafb', fontFamily:'DM Sans,sans-serif', fontSize:'0.88rem', boxSizing:'border-box' as const, outline:'none' }}
              />
            </div>
            <button onClick={submit} disabled={!email||loading}
              style={{ width:'100%', padding:'12px', background:'#2979FF', border:'none', borderRadius:'8px', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.82rem', color:'white', cursor:'pointer', opacity:(!email||loading)?0.6:1 }}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <a href="/login" style={{ display:'block', textAlign:'center', marginTop:'1rem', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.75rem', color:'#6b7280', textDecoration:'none' }}>← Back to login</a>
          </>
        )}
      </div>
    </div>
  );
}
