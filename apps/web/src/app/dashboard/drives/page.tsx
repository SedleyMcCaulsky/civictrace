'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { S, C, F, badge } from '@/lib/styles';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const STATUS_S: Record<string,{color:string;bg:string;bd:string}> = {
  PLANNED:   { color:'#2979FF', bg:'#EEF3FF', bd:'#BFDBFE' },
  ACTIVE:    { color:'#059669', bg:'#E6FBF4', bd:'#A7F3D0' },
  COMPLETED: { color:'#7C3AED', bg:'#F5F3FF', bd:'#DDD6FE' },
  CANCELLED: { color:'#64748B', bg:'#F1F5F9', bd:'#E2E8F0' },
};
const PM = ['CASH','CHEQUE','CARD','TRANSFER'];
const PARISHES = ['Kingston','St. Andrew','St. Catherine','Clarendon','Manchester',
  'St. Elizabeth','Westmoreland','Hanover','St. James','Trelawny','St. Ann',
  'St. Mary','Portland','St. Thomas'];

export default function DrivesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'drives'|'report'>('drives');
  const [selDrive, setSelDrive] = useState<string|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddColl, setShowAddColl] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterParish, setFilterParish] = useState('');
  const [reportPeriod, setReportPeriod] = useState('monthly');
  const [reportFrom, setReportFrom] = useState(new Date(new Date().getFullYear(),0,1).toISOString().split('T')[0]);
  const [reportTo, setReportTo] = useState(new Date().toISOString().split('T')[0]);
  const [driveForm, setDriveForm] = useState({ driveName:'', location:'', parish:'Kingston', driveDate:'', driveEndDate:'', status:'PLANNED', targetAmount:'', notes:'' });
  const [collForm, setCollForm] = useState({ ownerName:'', compositeKey:'', propertyAddress:'', parish:'Kingston', amountCollected:'', yearsCovered:'', paymentMethod:'CASH', receiptNumber:'', notes:'' });

  const { data: drives, isLoading } = useQuery({
    queryKey: ['drives', filterStatus, filterParish],
    queryFn: async () => (await api.get('/drives', { params:{ status:filterStatus||undefined, parish:filterParish||undefined } })).data,
  });

  const { data: stats } = useQuery({
    queryKey: ['drive-stats'],
    queryFn: async () => (await api.get('/drives/stats')).data,
  });

  const { data: driveDetail } = useQuery({
    queryKey: ['drive', selDrive],
    queryFn: async () => (await api.get(`/drives/${selDrive}`)).data,
    enabled: !!selDrive,
  });

  const { data: report } = useQuery({
    queryKey: ['drive-report', reportPeriod, reportFrom, reportTo, filterParish],
    queryFn: async () => (await api.get('/drives/report', { params:{ period:reportPeriod, from:reportFrom, to:reportTo, parish:filterParish||undefined } })).data,
    enabled: tab === 'report',
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post('/drives', driveForm)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['drives'] }); qc.invalidateQueries({ queryKey:['drive-stats'] }); setShowCreate(false); setDriveForm({ driveName:'', location:'', parish:'Kingston', driveDate:'', driveEndDate:'', status:'PLANNED', targetAmount:'', notes:'' }); },
  });

  const addCollMutation = useMutation({
    mutationFn: async () => (await api.post(`/drives/${selDrive}/collections`, {
      ...collForm,
      amountCollected: parseFloat(collForm.amountCollected),
      yearsCovered: collForm.yearsCovered ? collForm.yearsCovered.split(',').map((y:string)=>parseInt(y.trim())).filter(Boolean) : null,
    })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['drive', selDrive] }); qc.invalidateQueries({ queryKey:['drive-stats'] }); setShowAddColl(false); setCollForm({ ownerName:'', compositeKey:'', propertyAddress:'', parish:'Kingston', amountCollected:'', yearsCovered:'', paymentMethod:'CASH', receiptNumber:'', notes:'' }); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, d }: any) => (await api.patch(`/drives/${id}`, { ...d, status })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['drives'] }); qc.invalidateQueries({ queryKey:['drive', selDrive] }); },
  });

  const deleteCollMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/drives/collections/${id}`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['drive', selDrive] }); qc.invalidateQueries({ queryKey:['drive-stats'] }); },
  });

  const inp = S.input;
  const lbl = S.label;
  const fmt = (n: any) => `J$${Number(n||0).toLocaleString()}`;

  return (
    <div style={S.page}>
      <div style={{ ...S.pageHeader, marginBottom:'1.5rem' }}>
        <div>
          <h1 style={S.h1}>Tax Drives</h1>
          <p style={S.muted}>Mobile property tax collection drives — track location, date, collections and performance</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={S.btnPrimary}>+ New Drive</button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px', marginBottom:'1.5rem' }}>
        {[
          { label:'Total Drives',    value:stats?.total_drives||0,       color:C.blue,   bg:C.blueBg,   bd:C.blueBd },
          { label:'Completed',       value:stats?.completed_drives||0,   color:C.purple, bg:C.purpleBg, bd:C.purpleBd },
          { label:'Planned',         value:stats?.planned_drives||0,     color:C.amber,  bg:C.amberBg,  bd:C.amberBd },
          { label:'Total Collected', value:fmt(stats?.total_collected),  color:C.green,  bg:C.greenBg,  bd:C.greenBd },
          { label:'Cases Settled',   value:stats?.cases_settled||0,      color:C.blue,   bg:C.blueBg,   bd:C.blueBd },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, border:`1.5px solid ${s.bd}`, borderRadius:'10px', padding:'12px 14px' }}>
            <p style={S.statLabel}>{s.label}</p>
            <p style={{ ...S.statNum, color:s.color, fontSize:'1.4rem' }}>{String(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'2px', background:C.surface, padding:'4px', borderRadius:'10px', width:'fit-content', marginBottom:'1.25rem', border:`1.5px solid ${C.border}` }}>
        {[{id:'drives',label:'All Drives'},{id:'report',label:'Period Report'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding:'7px 16px', borderRadius:'7px', fontFamily:F.display, fontWeight:700, fontSize:'0.68rem', letterSpacing:'0.06em', textTransform:'uppercase', border:'none', cursor:'pointer', background:tab===t.id?C.card:'transparent', color:tab===t.id?C.blue:C.muted }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...S.card, padding:'12px 14px', marginBottom:'1.25rem', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
        {tab === 'drives' && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width:'160px' }}>
            <option value="">All statuses</option>
            {['PLANNED','ACTIVE','COMPLETED','CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select value={filterParish} onChange={e => setFilterParish(e.target.value)} style={{ ...inp, width:'180px' }}>
          <option value="">All parishes</option>
          {PARISHES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {tab === 'report' && (
          <>
            <select value={reportPeriod} onChange={e => setReportPeriod(e.target.value)} style={{ ...inp, width:'140px' }}>
              {['monthly','quarterly','yearly'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
            </select>
            <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={{ ...inp, width:'155px' }} />
            <span style={S.muted}>to</span>
            <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} style={{ ...inp, width:'155px' }} />
          </>
        )}
      </div>

      {/* DRIVES TAB */}
      {tab === 'drives' && (
        <div style={{ display:'grid', gridTemplateColumns: selDrive ? '1fr 1fr' : '1fr', gap:'1.25rem' }}>
          {/* Drive list */}
          <div style={{ ...S.card, overflow:'hidden' }}>
            <div style={{ padding:'1rem 1.25rem', borderBottom:`1.5px solid ${C.border}` }}>
              <h3 style={S.h3}>Tax Drives</h3>
            </div>
            {isLoading && <p style={{ ...S.muted, padding:'2rem', textAlign:'center' }}>Loading…</p>}
            {!isLoading && (!drives || drives.length === 0) && (
              <p style={{ ...S.muted, padding:'3rem', textAlign:'center' }}>No drives yet. Create your first drive.</p>
            )}
            {drives?.map((d: any) => {
              const ss = STATUS_S[d.status] || STATUS_S.PLANNED;
              const pct = d.target_amount > 0 ? Math.min(100, Math.round(Number(d.total_collected||0)/Number(d.target_amount)*100)) : 0;
              return (
                <div key={d.id} onClick={() => setSelDrive(selDrive===d.id ? null : d.id)}
                  style={{ padding:'1rem 1.25rem', borderBottom:`1px solid ${C.border}`, cursor:'pointer', background: selDrive===d.id ? C.blueBg : '' }}
                  onMouseEnter={e => { if(selDrive!==d.id) e.currentTarget.style.background=C.surface; }}
                  onMouseLeave={e => { if(selDrive!==d.id) e.currentTarget.style.background=''; }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'6px' }}>
                    <div>
                      <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.88rem', color:C.text, margin:'0 0 2px' }}>{d.drive_name}</p>
                      <p style={{ fontFamily:F.body, fontSize:'0.75rem', color:C.muted, margin:0 }}>{d.location} · {d.parish}</p>
                    </div>
                    <span style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.bd}`, fontFamily:F.display, fontWeight:700, fontSize:'0.6rem', letterSpacing:'0.08em', textTransform:'uppercase', padding:'3px 8px', borderRadius:'5px' }}>{d.status}</span>
                  </div>
                  <div style={{ display:'flex', gap:'16px', marginBottom:'8px' }}>
                    <div><p style={{ ...S.tiny, margin:'0 0 1px' }}>Date</p><p style={{ fontFamily:F.display, fontWeight:600, fontSize:'0.75rem', color:C.text, margin:0 }}>{d.drive_date?.slice(0,10)}</p></div>
                    <div><p style={{ ...S.tiny, margin:'0 0 1px' }}>Collected</p><p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.82rem', color:C.green, margin:0 }}>{fmt(d.total_collected)}</p></div>
                    <div><p style={{ ...S.tiny, margin:'0 0 1px' }}>Transactions</p><p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.82rem', color:C.text, margin:0 }}>{d.total_transactions||0}</p></div>
                    {d.target_amount > 0 && <div><p style={{ ...S.tiny, margin:'0 0 1px' }}>Target</p><p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.82rem', color:C.blue, margin:0 }}>{fmt(d.target_amount)}</p></div>}
                  </div>
                  {d.target_amount > 0 && (
                    <div style={{ height:'4px', background:'#DDE3F0', borderRadius:'4px', overflow:'hidden' }}>
                      <div style={{ height:'100%', background:pct>=100?C.green:C.blue, borderRadius:'4px', width:`${pct}%`, transition:'width .4s' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Drive detail */}
          {selDrive && driveDetail && (
            <div style={{ ...S.card, overflow:'hidden', maxHeight:'80vh', overflowY:'auto' }}>
              <div style={{ padding:'1rem 1.25rem', borderBottom:`1.5px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:C.card, zIndex:10 }}>
                <div>
                  <h3 style={{ ...S.h3, color:C.text, textTransform:'none', letterSpacing:0, fontSize:'0.9rem' }}>{driveDetail.drive_name}</h3>
                  <p style={{ ...S.muted, fontSize:'0.72rem', marginTop:'2px' }}>{driveDetail.location} · {driveDetail.parish}</p>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  {driveDetail.status === 'PLANNED' && (
                    <button onClick={() => updateStatusMutation.mutate({ id:selDrive, status:'ACTIVE', d:driveDetail })}
                      style={{ ...S.btnPrimary, background:C.green, padding:'6px 12px', fontSize:'0.68rem' }}>Start Drive</button>
                  )}
                  {driveDetail.status === 'ACTIVE' && (
                    <button onClick={() => updateStatusMutation.mutate({ id:selDrive, status:'COMPLETED', d:driveDetail })}
                      style={{ ...S.btnPrimary, background:C.purple, padding:'6px 12px', fontSize:'0.68rem' }}>Complete</button>
                  )}
                  <button onClick={() => setShowAddColl(true)} style={{ ...S.btnPrimary, padding:'6px 12px', fontSize:'0.68rem' }}>+ Add Collection</button>
                  <button onClick={() => setSelDrive(null)} style={{ ...S.btnSecondary, padding:'6px 10px', fontSize:'0.68rem' }}>×</button>
                </div>
              </div>

              {/* Summary */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', padding:'1rem' }}>
                {[
                  { label:'Total Collected', value:fmt(driveDetail.total_collected), color:C.green },
                  { label:'Transactions',    value:driveDetail.total_transactions||0, color:C.blue },
                  { label:'Cases Settled',   value:driveDetail.cases_settled||0,      color:C.purple },
                ].map(s => (
                  <div key={s.label} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px 12px', textAlign:'center' }}>
                    <p style={S.statLabel}>{s.label}</p>
                    <p style={{ fontFamily:F.display, fontWeight:800, fontSize:'1.1rem', color:s.color, margin:0 }}>{String(s.value)}</p>
                  </div>
                ))}
              </div>

              {/* Add collection form */}
              {showAddColl && (
                <div style={{ margin:'0 1rem 1rem', background:C.blueBg, border:`1.5px solid ${C.blueBd}`, borderRadius:'10px', padding:'14px' }}>
                  <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.72rem', letterSpacing:'0.1em', textTransform:'uppercase', color:C.blue, margin:'0 0 12px' }}>Add Collection</p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                    <div><label style={lbl}>Owner Name *</label><input value={collForm.ownerName} onChange={e => setCollForm(f=>({...f,ownerName:e.target.value}))} style={inp} placeholder="Full name" /></div>
                    <div><label style={lbl}>Composite Key</label><input value={collForm.compositeKey} onChange={e => setCollForm(f=>({...f,compositeKey:e.target.value}))} style={inp} placeholder="e.g. KINGSTON::KGN-RES-0045" /></div>
                    <div><label style={lbl}>Amount Collected (J$) *</label><input type="number" value={collForm.amountCollected} onChange={e => setCollForm(f=>({...f,amountCollected:e.target.value}))} style={inp} /></div>
                    <div><label style={lbl}>Payment Method</label>
                      <select value={collForm.paymentMethod} onChange={e => setCollForm(f=>({...f,paymentMethod:e.target.value}))} style={inp}>
                        {PM.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div><label style={lbl}>Receipt Number</label><input value={collForm.receiptNumber} onChange={e => setCollForm(f=>({...f,receiptNumber:e.target.value}))} style={inp} /></div>
                    <div><label style={lbl}>Years Covered</label><input value={collForm.yearsCovered} onChange={e => setCollForm(f=>({...f,yearsCovered:e.target.value}))} style={inp} placeholder="2023, 2024" /></div>
                  </div>
                  <div style={{ marginBottom:'8px' }}>
                    <label style={lbl}>Property Address</label>
                    <input value={collForm.propertyAddress} onChange={e => setCollForm(f=>({...f,propertyAddress:e.target.value}))} style={inp} />
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={() => setShowAddColl(false)} style={{ ...S.btnSecondary, flex:1 }}>Cancel</button>
                    <button onClick={() => addCollMutation.mutate()} disabled={!collForm.ownerName || !collForm.amountCollected || addCollMutation.isPending}
                      style={{ ...S.btnPrimary, flex:2, opacity:(!collForm.ownerName||!collForm.amountCollected)?.5:1 }}>
                      {addCollMutation.isPending ? 'Saving…' : 'Save Collection'}
                    </button>
                  </div>
                </div>
              )}

              {/* Collections list */}
              <div style={{ padding:'0 1rem 1rem' }}>
                <p style={{ ...S.sectionHead, marginBottom:'8px' }}>Collections ({driveDetail.collections?.length || 0})</p>
                {(!driveDetail.collections || driveDetail.collections.length === 0) && (
                  <p style={{ ...S.muted, fontSize:'0.78rem', textAlign:'center', padding:'1rem' }}>No collections yet. Click + Add Collection.</p>
                )}
                {driveDetail.collections?.map((c: any) => (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderRadius:'8px', background:C.surface, border:`1px solid ${C.border}`, marginBottom:'6px' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.8rem', color:C.text, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.owner_name}</p>
                      <div style={{ display:'flex', gap:'8px' }}>
                        {c.composite_key && <p style={{ fontFamily:F.body, fontSize:'0.7rem', color:C.muted, margin:0 }}>{c.composite_key}</p>}
                        <p style={{ fontFamily:F.body, fontSize:'0.7rem', color:C.muted, margin:0 }}>{c.payment_method}</p>
                        {c.receipt_number && <p style={{ fontFamily:F.body, fontSize:'0.7rem', color:C.muted, margin:0 }}>#{c.receipt_number}</p>}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <p style={{ fontFamily:F.display, fontWeight:800, fontSize:'0.9rem', color:C.green, margin:0 }}>{fmt(c.amount_collected)}</p>
                      <button onClick={() => { if(confirm('Remove this collection?')) deleteCollMutation.mutate(c.id); }}
                        style={{ background:'transparent', border:`1px solid ${C.redBd}`, borderRadius:'5px', color:C.red, fontSize:'0.65rem', fontFamily:F.display, fontWeight:700, padding:'3px 8px', cursor:'pointer' }}>
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* REPORT TAB */}
      {tab === 'report' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          {report && report.length > 0 && (
            <div style={{ ...S.card, padding:'1.25rem' }}>
              <h3 style={{ ...S.h3, marginBottom:'1rem' }}>Collections by {reportPeriod.charAt(0).toUpperCase()+reportPeriod.slice(1)}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={report.map((r: any) => ({ period:String(r.period||'').slice(0,10), collected:Number(r.total_collected||0) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="period" tick={{ fontSize:10, fill:C.muted }} />
                  <YAxis tick={{ fontSize:10, fill:C.muted }} />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Bar dataKey="collected" fill={C.blue} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ ...S.card, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                {['Period','Parish','Drives','Transactions','Cases Settled','Collected','Target','Achievement'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {!report || report.length === 0 ? (
                  <tr><td colSpan={8} style={{ ...S.td, textAlign:'center', padding:'3rem', color:C.muted }}>No completed drives in this period.</td></tr>
                ) : report.map((r: any, i: number) => (
                  <tr key={i} onMouseEnter={e=>(e.currentTarget.style.background=C.surface)} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:700 }}>{String(r.period||'').slice(0,10)}</td>
                    <td style={S.tdMuted}>{r.parish||'All'}</td>
                    <td style={S.td}>{r.total_drives}</td>
                    <td style={S.td}>{r.total_transactions}</td>
                    <td style={{ ...S.td, color:C.purple, fontFamily:F.display, fontWeight:700 }}>{r.cases_settled}</td>
                    <td style={{ ...S.td, color:C.green, fontFamily:F.display, fontWeight:700 }}>{fmt(r.total_collected)}</td>
                    <td style={S.tdMuted}>{fmt(r.total_target)}</td>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:800, color:Number(r.achievement_pct)>=100?C.green:Number(r.achievement_pct)>=50?C.amber:C.red }}>
                      {r.achievement_pct||0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Drive Modal */}
      {showCreate && (
        <div style={{ position:'fixed', inset:0, background:'rgba(13,19,38,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'1rem' }}>
          <div style={{ ...S.card, width:'100%', maxWidth:'520px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.5rem', borderBottom:`1.5px solid ${C.border}` }}>
              <h2 style={S.h2}>New Tax Drive</h2>
              <button onClick={() => setShowCreate(false)} style={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:'8px', width:'32px', height:'32px', cursor:'pointer', color:C.muted, fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'12px' }}>
              <div><label style={lbl}>Drive Name *</label><input value={driveForm.driveName} onChange={e=>setDriveForm(f=>({...f,driveName:e.target.value}))} style={inp} placeholder="e.g. Kingston Central Tax Drive Q1 2026" /></div>
              <div><label style={lbl}>Location *</label><input value={driveForm.location} onChange={e=>setDriveForm(f=>({...f,location:e.target.value}))} style={inp} placeholder="Specific venue or street" /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div><label style={lbl}>Parish *</label>
                  <select value={driveForm.parish} onChange={e=>setDriveForm(f=>({...f,parish:e.target.value}))} style={inp}>
                    {PARISHES.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Status</label>
                  <select value={driveForm.status} onChange={e=>setDriveForm(f=>({...f,status:e.target.value}))} style={inp}>
                    {['PLANNED','ACTIVE','COMPLETED','CANCELLED'].map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Drive Date *</label><input type="date" value={driveForm.driveDate} onChange={e=>setDriveForm(f=>({...f,driveDate:e.target.value}))} style={inp} /></div>
                <div><label style={lbl}>End Date</label><input type="date" value={driveForm.driveEndDate} onChange={e=>setDriveForm(f=>({...f,driveEndDate:e.target.value}))} style={inp} /></div>
              </div>
              <div><label style={lbl}>Collection Target (J$)</label><input type="number" value={driveForm.targetAmount} onChange={e=>setDriveForm(f=>({...f,targetAmount:e.target.value}))} style={inp} placeholder="Optional target amount" /></div>
              <div><label style={lbl}>Notes</label><textarea rows={2} value={driveForm.notes} onChange={e=>setDriveForm(f=>({...f,notes:e.target.value}))} style={{ ...inp, resize:'none' as const }} /></div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={()=>setShowCreate(false)} style={{ ...S.btnSecondary, flex:1 }}>Cancel</button>
                <button onClick={()=>createMutation.mutate()} disabled={!driveForm.driveName||!driveForm.location||!driveForm.driveDate||createMutation.isPending}
                  style={{ ...S.btnPrimary, flex:2, opacity:(!driveForm.driveName||!driveForm.driveDate)?.5:1 }}>
                  {createMutation.isPending ? 'Creating…' : 'Create Drive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
