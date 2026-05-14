'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { S, C, F, badge } from '@/lib/styles';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const STATUS_S: Record<string,{color:string;bg:string;bd:string}> = {
  PLANNED:   { color:'#2979FF', bg:'#EEF3FF', bd:'#BFDBFE' },
  ACTIVE:    { color:'#059669', bg:'#E6FBF4', bd:'#A7F3D0' },
  COMPLETED: { color:'#7C3AED', bg:'#F5F3FF', bd:'#DDD6FE' },
  CANCELLED: { color:'#64748B', bg:'#F1F5F9', bd:'#E2E8F0' },
};
const PARISHES = ['Kingston','St. Andrew','St. Catherine','Clarendon','Manchester',
  'St. Elizabeth','Westmoreland','Hanover','St. James','Trelawny','St. Ann',
  'St. Mary','Portland','St. Thomas'];
const EMPTY = { driveName:'', location:'', parish:'Kingston', driveDate:'', status:'PLANNED', targetAmount:'', amountCash:'0', amountDebit:'0', amountCredit:'0', amountCheque:'0', taxpayerCount:'0', notes:'' };

export default function DrivesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'drives'|'report'>('drives');
  const [sel, setSel] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({...EMPTY});
  const [filterStatus, setFilterStatus] = useState('');
  const [filterParish, setFilterParish] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [from, setFrom] = useState(new Date(new Date().getFullYear(),0,1).toISOString().split('T')[0]);
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);

  const { data: drives, isLoading } = useQuery({
    queryKey: ['drives', filterStatus, filterParish],
    queryFn: async () => (await api.get('/drives', { params:{ status:filterStatus||undefined, parish:filterParish||undefined } })).data,
  });
  const { data: stats } = useQuery({ queryKey:['drive-stats'], queryFn: async () => (await api.get('/drives/stats')).data });
  const { data: report } = useQuery({
    queryKey: ['drive-report', period, from, to, filterParish],
    queryFn: async () => (await api.get('/drives/report', { params:{ period, from, to, parish:filterParish||undefined } })).data,
    enabled: tab === 'report',
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const p = { ...form, targetAmount:form.targetAmount?parseFloat(form.targetAmount):null, amountCash:parseFloat(form.amountCash||'0'), amountDebit:parseFloat(form.amountDebit||'0'), amountCredit:parseFloat(form.amountCredit||'0'), amountCheque:parseFloat(form.amountCheque||'0'), taxpayerCount:parseInt(form.taxpayerCount||'0') };
      if (editMode && sel) return (await api.patch(`/drives/${sel.id}`, p)).data;
      return (await api.post('/drives', p)).data;
    },
    onSuccess: (data) => { qc.invalidateQueries({queryKey:['drives']}); qc.invalidateQueries({queryKey:['drive-stats']}); setSel(data); setShowForm(false); setEditMode(false); setForm({...EMPTY}); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id:string) => (await api.delete(`/drives/${id}`)).data,
    onSuccess: () => { qc.invalidateQueries({queryKey:['drives']}); qc.invalidateQueries({queryKey:['drive-stats']}); setSel(null); },
  });

  const fmt = (n:any) => `J$${Number(n||0).toLocaleString()}`;
  const inp = S.input;
  const lbl = S.label;

  const pieData = sel ? [
    { name:'Cash',   value:Number(sel.amount_cash||0),   color:'#059669' },
    { name:'Debit',  value:Number(sel.amount_debit||0),  color:'#2979FF' },
    { name:'Credit', value:Number(sel.amount_credit||0), color:'#7C3AED' },
    { name:'Cheque', value:Number(sel.amount_cheque||0), color:'#D97706' },
  ].filter(d=>d.value>0) : [];

  return (
    <div style={S.page}>
      <div style={{...S.pageHeader, marginBottom:'1.5rem'}}>
        <div>
          <h1 style={S.h1}>Tax Drives</h1>
          <p style={S.muted}>Mobile property tax collection drives — track totals by payment method</p>
        </div>
        <button onClick={()=>{setForm({...EMPTY});setEditMode(false);setShowForm(true);}} style={S.btnPrimary}>+ New Drive</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'10px',marginBottom:'1.5rem'}}>
        {[
          {label:'Total Drives',value:String(stats?.total_drives||0),color:C.blue,bg:C.blueBg,bd:C.blueBd},
          {label:'Completed',value:String(stats?.completed_drives||0),color:C.purple,bg:C.purpleBg,bd:C.purpleBd},
          {label:'Planned',value:String(stats?.planned_drives||0),color:C.amber,bg:C.amberBg,bd:C.amberBd},
          {label:'Total Collected',value:fmt(stats?.total_collected),color:C.green,bg:C.greenBg,bd:C.greenBd},
          {label:'Taxpayers',value:String(stats?.total_taxpayers||0),color:C.blue,bg:C.blueBg,bd:C.blueBd},
          {label:'Achievement',value:`${stats?.achievement_pct||0}%`,color:C.purple,bg:C.purpleBg,bd:C.purpleBd},
        ].map(s=>(
          <div key={s.label} style={{background:s.bg,border:`1.5px solid ${s.bd}`,borderRadius:'10px',padding:'10px 12px'}}>
            <p style={S.statLabel}>{s.label}</p>
            <p style={{...S.statNum,color:s.color,fontSize:'1.2rem'}}>{s.value}</p>
          </div>
        ))}
      </div>

      {stats && Number(stats.total_collected)>0 && (
        <div style={{...S.card,padding:'12px 16px',marginBottom:'1.25rem',display:'flex',gap:'16px',flexWrap:'wrap',alignItems:'center'}}>
          <span style={{...S.tiny,marginBottom:0,marginRight:'4px'}}>Collection breakdown:</span>
          {[
            {label:'Cash',value:stats.total_cash,color:'#059669',bg:'#E6FBF4',bd:'#A7F3D0'},
            {label:'Debit Card',value:stats.total_debit,color:'#2979FF',bg:'#EEF3FF',bd:'#BFDBFE'},
            {label:'Credit Card',value:stats.total_credit,color:'#7C3AED',bg:'#F5F3FF',bd:'#DDD6FE'},
            {label:'Cheque',value:stats.total_cheque,color:'#D97706',bg:'#FFFBEB',bd:'#FDE68A'},
          ].filter(x=>Number(x.value)>0).map(x=>(
            <div key={x.label} style={{background:x.bg,border:`1px solid ${x.bd}`,borderRadius:'8px',padding:'6px 14px',textAlign:'center'}}>
              <p style={{fontFamily:F.display,fontWeight:700,fontSize:'0.6rem',letterSpacing:'0.1em',textTransform:'uppercase',color:x.color,margin:'0 0 2px'}}>{x.label}</p>
              <p style={{fontFamily:F.display,fontWeight:800,fontSize:'0.88rem',color:x.color,margin:0}}>{fmt(x.value)}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{display:'flex',gap:'2px',background:C.surface,padding:'4px',borderRadius:'10px',width:'fit-content',marginBottom:'1.25rem',border:`1.5px solid ${C.border}`}}>
        {[{id:'drives',label:'All Drives'},{id:'report',label:'Period Report'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)} style={{padding:'7px 16px',borderRadius:'7px',fontFamily:F.display,fontWeight:700,fontSize:'0.68rem',letterSpacing:'0.06em',textTransform:'uppercase',border:'none',cursor:'pointer',background:tab===t.id?C.card:'transparent',color:tab===t.id?C.blue:C.muted}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{...S.card,padding:'12px 14px',marginBottom:'1.25rem',display:'flex',gap:'10px',flexWrap:'wrap',alignItems:'center'}}>
        {tab==='drives' && <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{...inp,width:'160px'}}><option value="">All statuses</option>{['PLANNED','ACTIVE','COMPLETED','CANCELLED'].map(s=><option key={s} value={s}>{s}</option>)}</select>}
        <select value={filterParish} onChange={e=>setFilterParish(e.target.value)} style={{...inp,width:'180px'}}><option value="">All parishes</option>{PARISHES.map(p=><option key={p} value={p}>{p}</option>)}</select>
        {tab==='report' && (<><select value={period} onChange={e=>setPeriod(e.target.value)} style={{...inp,width:'140px'}}>{['monthly','quarterly','yearly'].map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}</select><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{...inp,width:'155px'}}/><span style={S.muted}>to</span><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{...inp,width:'155px'}}/></>)}
      </div>

      {tab==='drives' && (
        <div style={{display:'grid',gridTemplateColumns:sel?'1fr 1fr':'1fr',gap:'1.25rem'}}>
          <div style={{...S.card,overflow:'hidden'}}>
            {isLoading && <p style={{...S.muted,padding:'2rem',textAlign:'center'}}>Loading…</p>}
            {!isLoading && (!drives||drives.length===0) && <p style={{...S.muted,padding:'3rem',textAlign:'center'}}>No drives yet.</p>}
            {drives?.map((d:any)=>{
              const ss=STATUS_S[d.status]||STATUS_S.PLANNED;
              const pct=d.target_amount>0?Math.min(100,Math.round(Number(d.total_collected||0)/Number(d.target_amount)*100)):0;
              return (
                <div key={d.id} onClick={()=>setSel(sel?.id===d.id?null:d)} style={{padding:'1rem 1.25rem',borderBottom:`1px solid ${C.border}`,cursor:'pointer',background:sel?.id===d.id?C.blueBg:''}} onMouseEnter={e=>{if(sel?.id!==d.id)e.currentTarget.style.background=C.surface;}} onMouseLeave={e=>{if(sel?.id!==d.id)e.currentTarget.style.background='';}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'6px'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontFamily:F.display,fontWeight:700,fontSize:'0.88rem',color:C.text,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.drive_name}</p>
                      <p style={{fontFamily:F.body,fontSize:'0.73rem',color:C.muted,margin:0}}>{d.location} · {d.parish} · {d.drive_date?.slice(0,10)}</p>
                    </div>
                    <span style={{background:ss.bg,color:ss.color,border:`1px solid ${ss.bd}`,fontFamily:F.display,fontWeight:700,fontSize:'0.6rem',letterSpacing:'0.08em',textTransform:'uppercase',padding:'3px 8px',borderRadius:'5px',flexShrink:0,marginLeft:'8px'}}>{d.status}</span>
                  </div>
                  <div style={{display:'flex',gap:'16px',marginBottom:d.target_amount>0?'8px':'0'}}>
                    <div><p style={{...S.tiny,margin:'0 0 1px'}}>Collected</p><p style={{fontFamily:F.display,fontWeight:800,fontSize:'0.88rem',color:C.green,margin:0}}>{fmt(d.total_collected)}</p></div>
                    <div><p style={{...S.tiny,margin:'0 0 1px'}}>Taxpayers</p><p style={{fontFamily:F.display,fontWeight:700,fontSize:'0.88rem',color:C.text,margin:0}}>{d.taxpayer_count||0}</p></div>
                    {d.target_amount>0 && <div><p style={{...S.tiny,margin:'0 0 1px'}}>Target</p><p style={{fontFamily:F.display,fontWeight:700,fontSize:'0.88rem',color:C.blue,margin:0}}>{fmt(d.target_amount)}</p></div>}
                  </div>
                  {d.target_amount>0 && <div style={{height:'4px',background:'#DDE3F0',borderRadius:'4px',overflow:'hidden'}}><div style={{height:'100%',background:pct>=100?C.green:C.blue,borderRadius:'4px',width:`${pct}%`}}/></div>}
                </div>
              );
            })}
          </div>

          {sel && (
            <div style={{...S.card,overflow:'hidden'}}>
              <div style={{padding:'1rem 1.25rem',borderBottom:`1.5px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <p style={{fontFamily:F.display,fontWeight:800,fontSize:'0.92rem',color:C.text,margin:'0 0 2px'}}>{sel.drive_name}</p>
                  <p style={{fontFamily:F.body,fontSize:'0.72rem',color:C.muted,margin:0}}>{sel.location} · {sel.parish} · {sel.drive_date?.slice(0,10)}</p>
                </div>
                <div style={{display:'flex',gap:'6px'}}>
                  <button onClick={()=>{setForm({driveName:sel.drive_name,location:sel.location,parish:sel.parish,driveDate:sel.drive_date?.slice(0,10),status:sel.status,targetAmount:sel.target_amount||'',amountCash:sel.amount_cash||'0',amountDebit:sel.amount_debit||'0',amountCredit:sel.amount_credit||'0',amountCheque:sel.amount_cheque||'0',taxpayerCount:sel.taxpayer_count||'0',notes:sel.notes||''});setEditMode(true);setShowForm(true);}} style={{...S.btnSecondary,padding:'6px 12px',fontSize:'0.68rem'}}>Edit</button>
                  <button onClick={()=>{if(confirm('Delete this drive?'))deleteMutation.mutate(sel.id);}} style={{...S.btnSecondary,padding:'6px 12px',fontSize:'0.68rem',color:C.red,borderColor:C.redBd}}>Delete</button>
                  <button onClick={()=>setSel(null)} style={{...S.btnSecondary,padding:'6px 10px',fontSize:'0.68rem'}}>×</button>
                </div>
              </div>
              <div style={{padding:'1.25rem'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'1.25rem'}}>
                  {[
                    {label:'Total Collected',value:fmt(sel.total_collected),color:C.green,bg:C.greenBg,bd:C.greenBd},
                    {label:'Taxpayers',value:String(sel.taxpayer_count||0),color:C.blue,bg:C.blueBg,bd:C.blueBd},
                    {label:'Target',value:sel.target_amount?fmt(sel.target_amount):'—',color:C.amber,bg:C.amberBg,bd:C.amberBd},
                    {label:'Achievement',value:sel.target_amount?`${sel.target_achievement_pct||0}%`:'—',color:C.purple,bg:C.purpleBg,bd:C.purpleBd},
                  ].map(s=>(
                    <div key={s.label} style={{background:s.bg,border:`1.5px solid ${s.bd}`,borderRadius:'8px',padding:'10px 12px'}}>
                      <p style={S.statLabel}>{s.label}</p>
                      <p style={{fontFamily:F.display,fontWeight:800,fontSize:'1.1rem',color:s.color,margin:0}}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <p style={{...S.sectionHead,marginBottom:'10px'}}>Payment Method Breakdown</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'8px',marginBottom:'1.25rem'}}>
                  {[
                    {label:'Cash',value:sel.amount_cash||0,color:'#059669',bg:'#E6FBF4',bd:'#A7F3D0'},
                    {label:'Debit Card',value:sel.amount_debit||0,color:'#2979FF',bg:'#EEF3FF',bd:'#BFDBFE'},
                    {label:'Credit Card',value:sel.amount_credit||0,color:'#7C3AED',bg:'#F5F3FF',bd:'#DDD6FE'},
                    {label:'Cheque',value:sel.amount_cheque||0,color:'#D97706',bg:'#FFFBEB',bd:'#FDE68A'},
                  ].map(x=>(
                    <div key={x.label} style={{background:x.bg,border:`1px solid ${x.bd}`,borderRadius:'8px',padding:'10px',textAlign:'center'}}>
                      <p style={{fontFamily:F.display,fontWeight:700,fontSize:'0.6rem',letterSpacing:'0.1em',textTransform:'uppercase',color:x.color,margin:'0 0 4px'}}>{x.label}</p>
                      <p style={{fontFamily:F.display,fontWeight:800,fontSize:'0.95rem',color:x.color,margin:0}}>{fmt(x.value)}</p>
                    </div>
                  ))}
                </div>
                {pieData.length>0 && (
                  <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:'16px',marginBottom:'1rem'}}>
                    <PieChart width={160} height={140}>
                      <Pie data={pieData} cx={80} cy={70} innerRadius={40} outerRadius={60} dataKey="value">
                        {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                      </Pie>
                      <Tooltip formatter={(v:any)=>fmt(v)}/>
                    </PieChart>
                    <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                      {pieData.map(d=>(
                        <div key={d.name} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                          <div style={{width:'10px',height:'10px',borderRadius:'2px',background:d.color,flexShrink:0}}/>
                          <span style={{fontFamily:F.body,fontSize:'0.75rem',color:C.text}}>{d.name}: {fmt(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {sel.notes && <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px'}}><p style={{...S.sectionHead,marginBottom:'4px'}}>Notes</p><p style={{fontFamily:F.body,fontSize:'0.78rem',color:C.text,margin:0,lineHeight:1.6}}>{sel.notes}</p></div>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='report' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>
          {report&&report.length>0 && (
            <div style={{...S.card,padding:'1.25rem'}}>
              <h3 style={{...S.h3,marginBottom:'1rem'}}>Collections by {period.charAt(0).toUpperCase()+period.slice(1)}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={report.map((r:any)=>({period:String(r.period||'').slice(0,7),Cash:Number(r.total_cash||0),Debit:Number(r.total_debit||0),Credit:Number(r.total_credit||0),Cheque:Number(r.total_cheque||0)}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="period" tick={{fontSize:10,fill:C.muted}}/>
                  <YAxis tick={{fontSize:10,fill:C.muted}}/>
                  <Tooltip formatter={(v:any)=>fmt(v)}/>
                  <Bar dataKey="Cash" fill="#059669" stackId="a"/>
                  <Bar dataKey="Debit" fill="#2979FF" stackId="a"/>
                  <Bar dataKey="Credit" fill="#7C3AED" stackId="a"/>
                  <Bar dataKey="Cheque" fill="#D97706" stackId="a" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{...S.card,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Period','Parish','Drives','Taxpayers','Cash','Debit','Credit','Cheque','Total','Target','Achievement'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {!report||report.length===0
                  ? <tr><td colSpan={11} style={{...S.td,textAlign:'center',padding:'3rem',color:C.muted}}>No completed drives in this period.</td></tr>
                  : report.map((r:any,i:number)=>(
                    <tr key={i} onMouseEnter={e=>(e.currentTarget.style.background=C.surface)} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                      <td style={{...S.td,fontFamily:F.display,fontWeight:700}}>{String(r.period||'').slice(0,10)}</td>
                      <td style={S.tdMuted}>{r.parish||'All'}</td>
                      <td style={S.td}>{r.total_drives}</td>
                      <td style={S.td}>{r.total_taxpayers||0}</td>
                      <td style={{...S.td,color:'#059669'}}>{fmt(r.total_cash)}</td>
                      <td style={{...S.td,color:'#2979FF'}}>{fmt(r.total_debit)}</td>
                      <td style={{...S.td,color:'#7C3AED'}}>{fmt(r.total_credit)}</td>
                      <td style={{...S.td,color:'#D97706'}}>{fmt(r.total_cheque)}</td>
                      <td style={{...S.td,color:C.green,fontFamily:F.display,fontWeight:800}}>{fmt(r.total_collected)}</td>
                      <td style={S.tdMuted}>{fmt(r.total_target)}</td>
                      <td style={{...S.td,fontFamily:F.display,fontWeight:800,color:Number(r.achievement_pct)>=100?C.green:Number(r.achievement_pct)>=50?C.amber:C.red}}>{r.achievement_pct||0}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{position:'fixed',inset:0,background:'rgba(13,19,38,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:'1rem'}}>
          <div style={{...S.card,width:'100%',maxWidth:'560px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1.25rem 1.5rem',borderBottom:`1.5px solid ${C.border}`}}>
              <h2 style={S.h2}>{editMode?'Edit Drive':'New Tax Drive'}</h2>
              <button onClick={()=>{setShowForm(false);setEditMode(false);}} style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:'8px',width:'32px',height:'32px',cursor:'pointer',color:C.muted,fontSize:'1.1rem',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{padding:'1.5rem',display:'flex',flexDirection:'column',gap:'12px'}}>
              <div><label style={lbl}>Drive Name *</label><input value={form.driveName} onChange={e=>setForm(f=>({...f,driveName:e.target.value}))} style={inp} placeholder="e.g. Kingston Central Tax Drive"/></div>
              <div><label style={lbl}>Location *</label><input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} style={inp} placeholder="Venue or street"/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                <div><label style={lbl}>Parish *</label><select value={form.parish} onChange={e=>setForm(f=>({...f,parish:e.target.value}))} style={inp}>{PARISHES.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                <div><label style={lbl}>Drive Date *</label><input type="date" value={form.driveDate} onChange={e=>setForm(f=>({...f,driveDate:e.target.value}))} style={inp}/></div>
                <div><label style={lbl}>Status</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={inp}>{['PLANNED','ACTIVE','COMPLETED','CANCELLED'].map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                <div><label style={lbl}>Target Amount (J$)</label><input type="number" value={form.targetAmount} onChange={e=>setForm(f=>({...f,targetAmount:e.target.value}))} style={inp} placeholder="Optional"/></div>
              </div>
              <div style={{background:C.greenBg,border:`1.5px solid ${C.greenBd}`,borderRadius:'10px',padding:'14px'}}>
                <p style={{fontFamily:F.display,fontWeight:700,fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:C.green,margin:'0 0 10px'}}>Collections Breakdown</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                  {[{key:'amountCash',label:'Cash (J$)',color:'#059669'},{key:'amountDebit',label:'Debit Card (J$)',color:'#2979FF'},{key:'amountCredit',label:'Credit Card (J$)',color:'#7C3AED'},{key:'amountCheque',label:'Cheque (J$)',color:'#D97706'}].map(x=>(
                    <div key={x.key}><label style={{...lbl,color:x.color}}>{x.label}</label><input type="number" min="0" value={(form as any)[x.key]} onChange={e=>setForm(f=>({...f,[x.key]:e.target.value}))} style={{...inp,borderColor:x.color+'44'}}/></div>
                  ))}
                </div>
                <div style={{background:'white',border:`1px solid ${C.greenBd}`,borderRadius:'6px',padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontFamily:F.display,fontWeight:700,fontSize:'0.72rem',color:C.green}}>TOTAL</span>
                  <span style={{fontFamily:F.display,fontWeight:800,fontSize:'1rem',color:C.green}}>{fmt([form.amountCash,form.amountDebit,form.amountCredit,form.amountCheque].reduce((a,v)=>a+parseFloat(v||'0'),0))}</span>
                </div>
              </div>
              <div><label style={lbl}>No. of Taxpayers</label><input type="number" min="0" value={form.taxpayerCount} onChange={e=>setForm(f=>({...f,taxpayerCount:e.target.value}))} style={inp}/></div>
              <div><label style={lbl}>Notes</label><textarea rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{...inp,resize:'none' as const}}/></div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={()=>{setShowForm(false);setEditMode(false);}} style={{...S.btnSecondary,flex:1}}>Cancel</button>
                <button onClick={()=>saveMutation.mutate()} disabled={!form.driveName||!form.location||!form.driveDate||saveMutation.isPending} style={{...S.btnPrimary,flex:2,opacity:(!form.driveName||!form.driveDate)?0.5:1}}>
                  {saveMutation.isPending?'Saving…':editMode?'Save Changes':'Create Drive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
