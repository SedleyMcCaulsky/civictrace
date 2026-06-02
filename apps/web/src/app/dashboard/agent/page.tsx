'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { S, C, F, badge } from '@/lib/styles';

const AS: Record<string,{color:string;bg:string;bd:string;label:string}> = {
  ISSUE_SUMMONS:      { color:'#E53E3E', bg:'#FEF2F2', bd:'#FECACA', label:'Issue Summons' },
  CREATE_PAYMENT_PLAN:{ color:'#2979FF', bg:'#EEF3FF', bd:'#BFDBFE', label:'Payment Plan' },
  FLAG_RELIEF:        { color:'#D97706', bg:'#FFFBEB', bd:'#FDE68A', label:'Flag Relief' },
  ESCALATE:           { color:'#7C3AED', bg:'#F5F3FF', bd:'#DDD6FE', label:'Escalate' },
  MONITOR:            { color:'#059669', bg:'#E6FBF4', bd:'#A7F3D0', label:'Monitor' },
};
const CS: Record<string,string> = { HIGH:'#059669', MEDIUM:'#D97706', LOW:'#E53E3E' };

export default function AgentPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('PENDING');
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);

  const { data: queue, isLoading } = useQuery({
    queryKey: ['agent-queue', tab],
    queryFn: async () => (await api.get('/agent/queue', { params:{ status: tab } })).data,
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ['agent-stats'],
    queryFn: async () => (await api.get('/agent/queue/stats')).data,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, n }: any) => (await api.post(`/agent/queue/${id}/approve`, { notes: n })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-queue'] }); qc.invalidateQueries({ queryKey: ['agent-stats'] }); },
  });

  const clearMutation = useMutation({
    mutationFn: async (status: string) => (await api.delete(`/agent/queue/clear`, { params: { status } })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-queue'] }); qc.invalidateQueries({ queryKey: ['agent-stats'] }); },
  });
  const rejectMutation = useMutation({
    mutationFn: async ({ id, n }: any) => (await api.post(`/agent/queue/${id}/reject`, { notes: n })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-queue'] }); qc.invalidateQueries({ queryKey: ['agent-stats'] }); },
  });

  async function runAgent() {
    setRunning(true); setRunResult(null);
    try {
      const r = await api.post('/agent/run', {}, { timeout: 120000 });
      setRunResult(r.data);
      qc.invalidateQueries({ queryKey: ['agent-queue'] });
      qc.invalidateQueries({ queryKey: ['agent-stats'] });
    } catch (e: any) {
      setRunResult({ error: e.response?.data?.message || e.message || 'Request failed. Check Railway logs.' });
    } finally { setRunning(false); }
  }

  const s = stats || [];
  const pending  = s.filter((x:any)=>x.status==='PENDING').reduce((a:number,x:any)=>a+parseInt(x.count),0);
  const executed = s.filter((x:any)=>x.status==='EXECUTED').reduce((a:number,x:any)=>a+parseInt(x.count),0);
  const rejected = s.filter((x:any)=>x.status==='REJECTED').reduce((a:number,x:any)=>a+parseInt(x.count),0);
  const ab: Record<string,number> = {};
  s.filter((x:any)=>x.status==='PENDING').forEach((x:any)=>{ ab[x.recommended_action]=(ab[x.recommended_action]||0)+parseInt(x.count); });
  const items = queue || [];

  return (
    <div style={S.page}>
      <div style={{ ...S.pageHeader, marginBottom:'1.5rem' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
            <h1 style={S.h1}>Compliance Agent</h1>
            <span style={{ ...badge('purple'), padding:'4px 10px' }}>AI-Powered</span>
          </div>
          <p style={S.muted}>Nightly AI analysis — review and approve recommended enforcement actions</p>
          <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.75rem' }}>
            <button onClick={() => { if(confirm('Clear all PENDING items? This cannot be undone.')) clearMutation.mutate('PENDING'); }} disabled={clearMutation.isPending}
              style={{ padding:'0.4rem 1rem', borderRadius:'6px', border:'1px solid #d97706', background:'transparent', color:'#d97706', cursor:'pointer', fontSize:'0.8rem' }}>
              Clear Pending
            </button>
            <button onClick={() => { if(confirm('Clear all REJECTED items?')) clearMutation.mutate('REJECTED'); }} disabled={clearMutation.isPending}
              style={{ padding:'0.4rem 1rem', borderRadius:'6px', border:'1px solid #dc2626', background:'transparent', color:'#dc2626', cursor:'pointer', fontSize:'0.8rem' }}>
              Clear Rejected
            </button>
            <button onClick={() => { if(confirm('Clear all EXECUTED items?')) clearMutation.mutate('EXECUTED'); }} disabled={clearMutation.isPending}
              style={{ padding:'0.4rem 1rem', borderRadius:'6px', border:'1px solid #6b7280', background:'transparent', color:'#6b7280', cursor:'pointer', fontSize:'0.8rem' }}>
              Clear Executed
            </button>
            <button onClick={() => { if(confirm('Clear ALL completed items (rejected + executed)?')) clearMutation.mutate('ALL'); }} disabled={clearMutation.isPending}
              style={{ padding:'0.4rem 1rem', borderRadius:'6px', border:'1px solid #1a3d2b', background:'#1a3d2b', color:'#fff', cursor:'pointer', fontSize:'0.8rem' }}>
              Clear All Completed
            </button>
          </div>
        </div>
        <button onClick={runAgent} disabled={running}
          style={{ ...S.btnPrimary, background:'#7C3AED', padding:'10px 20px', opacity:running?0.6:1 }}>
          {running ? 'Running Agent…' : 'Run Agent Now'}
        </button>
      </div>

      {runResult && (
        <div style={{ background:runResult.error?C.redBg:C.greenBg, border:`1.5px solid ${runResult.error?C.redBd:C.greenBd}`, borderRadius:'10px', padding:'12px 16px', marginBottom:'1.25rem' }}>
          {runResult.info
            ? <p style={{ color:C.blue, fontFamily:F.body, fontSize:'0.82rem', margin:0 }}>{runResult.info}</p>
            : runResult.error
            ? <p style={{ color:C.red, fontFamily:F.body, fontSize:'0.82rem', margin:0 }}>Error: {runResult.error}</p>
            : <p style={{ color:C.green, fontFamily:F.body, fontSize:'0.82rem', margin:0 }}>
                Agent complete — <strong>{runResult.analysed}</strong> analysed, <strong>{runResult.queued}</strong> queued
              </p>}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px', marginBottom:'1.5rem' }}>
        {[
          { label:'Pending Review', value:pending,  color:C.amber,  bg:C.amberBg,  bd:C.amberBd },
          { label:'Executed',       value:executed, color:C.green,  bg:C.greenBg,  bd:C.greenBd },
          { label:'Rejected',       value:rejected, color:C.muted,  bg:C.surface,  bd:C.border },
          { label:'Summons Queued', value:ab['ISSUE_SUMMONS']||0,        color:C.red,   bg:C.redBg,   bd:C.redBd },
          { label:'Plans Queued',   value:ab['CREATE_PAYMENT_PLAN']||0,  color:C.blue,  bg:C.blueBg,  bd:C.blueBd },
        ].map(x=>(
          <div key={x.label} style={{ background:x.bg, border:`1.5px solid ${x.bd}`, borderRadius:'10px', padding:'12px 14px' }}>
            <p style={S.statLabel}>{x.label}</p>
            <p style={{ ...S.statNum, color:x.color, fontSize:'1.5rem' }}>{x.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'2px', background:C.surface, padding:'4px', borderRadius:'10px', width:'fit-content', marginBottom:'1.25rem', border:`1.5px solid ${C.border}` }}>
        {['PENDING','APPROVED','EXECUTED','REJECTED'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:'7px 16px', borderRadius:'7px', fontFamily:F.display, fontWeight:700, fontSize:'0.68rem', letterSpacing:'0.06em', textTransform:'uppercase', border:'none', cursor:'pointer', background:tab===t?C.card:'transparent', color:tab===t?C.blue:C.muted }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ ...S.card, overflow:'hidden' }}>
        {isLoading && <p style={{ ...S.muted, padding:'3rem', textAlign:'center' }}>Loading…</p>}
        {!isLoading && items.length===0 && (
          <p style={{ ...S.muted, padding:'3rem', textAlign:'center' }}>
            {tab==='PENDING' ? 'No pending recommendations — click Run Agent Now to analyse all delinquent cases' : `No ${tab.toLowerCase()} items`}
          </p>
        )}
        {items.map((item:any)=>{
          const a=AS[item.recommended_action]||AS.MONITOR;
          const cc=CS[item.confidence]||C.muted;
          return (
            <div key={item.id} style={{ borderBottom:`1.5px solid ${C.border}`, padding:'1.25rem 1.5rem' }}
              onMouseEnter={e=>(e.currentTarget.style.background=C.surface)}
              onMouseLeave={e=>(e.currentTarget.style.background='')}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', flexWrap:'wrap' }}>
                    <span style={{ fontFamily:F.display, fontWeight:800, fontSize:'0.85rem', color:C.text }}>{item.composite_key}</span>
                    <div style={{ background:a.bg, border:`1px solid ${a.bd}`, borderRadius:'6px', padding:'3px 10px' }}>
                      <span style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.65rem', color:a.color, letterSpacing:'0.06em', textTransform:'uppercase' as const }}>{a.label}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                      <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:cc }} />
                      <span style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.6rem', color:cc, letterSpacing:'0.08em', textTransform:'uppercase' as const }}>{item.confidence}</span>
                    </div>
                  </div>
                  <p style={{ fontFamily:F.body, fontSize:'0.8rem', color:C.muted, margin:'0 0 8px' }}>{item.owner_name}</p>
                  <div style={{ background:'#F5F3FF', border:`1px solid ${C.purpleBd}`, borderRadius:'8px', padding:'10px 12px', marginBottom:'8px' }}>
                    <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.6rem', letterSpacing:'0.1em', textTransform:'uppercase' as const, color:C.purple, margin:'0 0 4px' }}>AI Reasoning</p>
                    <p style={{ fontFamily:F.body, fontSize:'0.78rem', color:'#3B0764', margin:0, lineHeight:1.6 }}>{item.reasoning}</p>
                  </div>
                  <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
                    {[
                      { label:'Outstanding', value:`J$${Number(item.total_outstanding||0).toLocaleString()}`, color:C.red },
                      { label:'Years',  value:String(item.years_outstanding||0), color:Number(item.years_outstanding)>2?C.red:C.amber },
                      { label:'Visits', value:String(item.visit_count||0), color:C.text },
                      { label:'Summons',value:String(item.active_summons||0), color:C.text },
                      { label:'Plans',  value:String(item.active_plans||0), color:C.text },
                    ].map(m=>(
                      <div key={m.label} style={{ textAlign:'center' as const }}>
                        <p style={{ ...S.tiny, margin:'0 0 2px' }}>{m.label}</p>
                        <p style={{ fontFamily:F.display, fontWeight:800, fontSize:'0.85rem', color:m.color, margin:0 }}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {tab==='PENDING' && (
                  <div style={{ flexShrink:0, display:'flex', flexDirection:'column', gap:'8px', minWidth:'200px' }}>
                    <textarea placeholder="Review notes…" value={notes[item.id]||''} onChange={e=>setNotes(n=>({...n,[item.id]:e.target.value}))} rows={2}
                      style={{ ...S.input, resize:'none' as const, fontSize:'0.78rem', width:'100%', boxSizing:'border-box' as const }} />
                    <button onClick={()=>approveMutation.mutate({id:item.id,n:notes[item.id]||''})} disabled={approveMutation.isPending}
                      style={{ ...S.btnPrimary, background:a.color, padding:'9px', borderRadius:'8px' }}>
                      Approve & Execute
                    </button>
                    <button onClick={()=>rejectMutation.mutate({id:item.id,n:notes[item.id]||'Rejected'})} disabled={rejectMutation.isPending}
                      style={{ ...S.btnSecondary, padding:'8px', borderRadius:'8px' }}>
                      Reject
                    </button>
                  </div>
                )}

                {tab!=='PENDING' && (
                  <div style={{ flexShrink:0, textAlign:'right' as const }}>
                    <span style={badge(tab==='EXECUTED'?'green':tab==='REJECTED'?'muted':'blue')}>{tab}</span>
                    {item.reviewed_by_name && <p style={{ ...S.muted, fontSize:'0.72rem', marginTop:'6px' }}>by {item.reviewed_by_name}</p>}
                    {item.review_notes && <p style={{ fontFamily:F.body, fontSize:'0.72rem', color:C.muted, marginTop:'4px' }}>{item.review_notes}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {tab==='PENDING' && items.length===0 && (
        <div style={{ marginTop:'1.5rem', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem' }}>
          {[
            { step:'01', title:'Nightly Analysis', desc:'Every night at 11:30 PM the agent queries all delinquent cases including visits, balances, and enforcement history.', color:C.blue },
            { step:'02', title:'AI Recommendation', desc:'Groq AI analyses each case and recommends: Issue Summons, Payment Plan, Relief Flag, Escalate or Monitor with full reasoning.', color:C.purple },
            { step:'03', title:'Supervisor Approval', desc:'Review each recommendation. One click approves and auto-executes. Every action is logged to the audit trail.', color:C.green },
          ].map(x=>(
            <div key={x.step} style={{ ...S.card, padding:'1.25rem' }}>
              <div style={{ fontFamily:F.display, fontWeight:800, fontSize:'1.5rem', color:x.color, marginBottom:'8px' }}>{x.step}</div>
              <h3 style={{ ...S.h3, color:C.text, marginBottom:'8px' }}>{x.title}</h3>
              <p style={{ ...S.muted, fontSize:'0.78rem', lineHeight:1.6 }}>{x.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
