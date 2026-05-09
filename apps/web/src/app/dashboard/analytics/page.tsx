'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { S, C, F, badge } from '@/lib/styles';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const TABS = ['overall','arrears','collections','delinquency','forecast','bottlenecks'] as const;
const TAB_LABELS: Record<string,string> = {
  overall:'Overall Collections', arrears:'Arrears Report', collections:'Collections by Period',
  delinquency:'Delinquency Report', forecast:'Forecast', bottlenecks:'Bottlenecks',
};

const FY = () => { const now = new Date(); const y = now.getFullYear(); return now.getMonth()+1>=4?`${y}-${y+1}`:`${y-1}-${y}`; };

export default function AnalyticsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('overall');
  const [period, setPeriod] = useState('monthly');
  const [parish, setParish] = useState('');
  const [financialYear, setFinancialYear] = useState(FY());
  const [from, setFrom] = useState(new Date(new Date().getFullYear(),0,1).toISOString().split('T')[0]);
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);
  const [months, setMonths] = useState(6);

  const { data: overall } = useQuery({ queryKey:['an-overall',financialYear], queryFn: async () => (await api.get('/analytics/collections/overall',{params:{financialYear}})).data, enabled:tab==='overall' });
  const { data: arrears } = useQuery({ queryKey:['an-arrears',parish,financialYear], queryFn: async () => (await api.get('/analytics/arrears',{params:{parish:parish||undefined,financialYear}})).data, enabled:tab==='arrears' });
  const { data: collections } = useQuery({ queryKey:['an-coll',period,from,to,parish], queryFn: async () => (await api.get('/analytics/collections',{params:{period,from,to,parish:parish||undefined}})).data, enabled:tab==='collections' });
  const { data: delinquency } = useQuery({ queryKey:['an-del',parish], queryFn: async () => (await api.get('/analytics/delinquency',{params:{parish:parish||undefined}})).data, enabled:tab==='delinquency' });
  const { data: forecast } = useQuery({ queryKey:['an-forecast',months], queryFn: async () => (await api.get('/analytics/forecast',{params:{months}})).data, enabled:tab==='forecast' });
  const { data: bottlenecks } = useQuery({ queryKey:['an-bottleneck'], queryFn: async () => (await api.get('/analytics/bottlenecks')).data, enabled:tab==='bottlenecks' });

  const parishes = ['Kingston','St. Andrew','St. Catherine','Clarendon','Manchester','St. Elizabeth','Westmoreland','Hanover','St. James','Trelawny','St. Ann','St. Mary','Portland','St. Thomas'];
  const fyOpts = ['2023-2024','2024-2025','2025-2026','2026-2027'];

  return (
    <div style={S.page}>
      <div style={{ ...S.pageHeader, marginBottom:'1.5rem' }}>
        <div>
          <h1 style={S.h1}>Analytics & Reports</h1>
          <p style={{ ...S.muted, marginTop:'4px' }}>Arrears, collections, forecasts, bottlenecks and delinquency intelligence</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'2px', background:C.surface, padding:'4px', borderRadius:'10px', marginBottom:'1.5rem', border:`1.5px solid ${C.border}`, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:'7px 14px', borderRadius:'7px', fontFamily:F.display, fontWeight:700, fontSize:'0.68rem', letterSpacing:'0.06em', textTransform:'uppercase', border:'none', cursor:'pointer', transition:'all .15s', background:tab===t?C.card:'transparent', color:tab===t?C.blue:C.muted, boxShadow:tab===t?'0 1px 3px rgba(13,19,38,0.08)':'none' }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...S.card, padding:'12px 14px', marginBottom:'1.25rem', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
        {['overall','arrears','delinquency'].includes(tab) && (
          <select value={financialYear} onChange={e => setFinancialYear(e.target.value)} style={{ ...S.input, width:'160px' }}>
            {fyOpts.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {['arrears','collections','delinquency'].includes(tab) && (
          <select value={parish} onChange={e => setParish(e.target.value)} style={{ ...S.input, width:'180px' }}>
            <option value="">All Parishes</option>
            {parishes.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {tab === 'collections' && (
          <>
            <select value={period} onChange={e => setPeriod(e.target.value)} style={{ ...S.input, width:'140px' }}>
              {['daily','weekly','monthly','quarterly','yearly'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
            </select>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...S.input, width:'155px' }} />
            <span style={S.muted}>to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...S.input, width:'155px' }} />
          </>
        )}
        {tab === 'forecast' && (
          <select value={months} onChange={e => setMonths(Number(e.target.value))} style={{ ...S.input, width:'160px' }}>
            {[3,6,9,12].map(m => <option key={m} value={m}>{m} months ahead</option>)}
          </select>
        )}
      </div>

      {/* OVERALL COLLECTIONS */}
      {tab === 'overall' && overall && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px' }}>
            {[
              { label:'Total Levied',      value:`J$${Number(overall.total_levied||0).toLocaleString()}`,    color:C.blue,  bg:C.blueBg,  bd:C.blueBd },
              { label:'Total Collected',   value:`J$${Number(overall.total_collected||0).toLocaleString()}`, color:C.green, bg:C.greenBg, bd:C.greenBd },
              { label:'Outstanding',       value:`J$${Number(overall.total_outstanding||0).toLocaleString()}`, color:C.red, bg:C.redBg, bd:C.redBd },
              { label:'Collection Rate',   value:`${overall.collection_rate||0}%`,                          color:C.purple,bg:C.purpleBg,bd:C.purpleBd },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, border:`1.5px solid ${s.bd}`, borderRadius:'10px', padding:'12px 16px' }}>
                <p style={S.statLabel}>{s.label}</p>
                <p style={{ ...S.statNum, color:s.color, fontSize:'1.3rem' }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px' }}>
            {[
              { label:'Total Cases',      value: overall.total_cases||0,          color:C.blue },
              { label:'With Payment',     value: overall.cases_with_payment||0,   color:C.green },
              { label:'No Payment',       value: overall.cases_no_payment||0,     color:C.red },
              { label:'Active Plans',     value: overall.active_payment_plans||0, color:C.amber },
              { label:'Summons Issued',   value: overall.summons_issued_fy||0,    color:C.red },
              { label:'Relief Approved',  value: overall.relief_approved||0,      color:C.purple },
            ].map(s => (
              <div key={s.label} style={{ ...S.card, padding:'10px 14px' }}>
                <p style={S.statLabel}>{s.label}</p>
                <p style={{ fontFamily:F.display, fontWeight:800, fontSize:'1.2rem', color:s.color, margin:0 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ARREARS */}
      {tab === 'arrears' && arrears && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
            {[
              { label:'Total Cases',    value: arrears.totals?.total_cases||0,                               color:C.blue, bg:C.blueBg, bd:C.blueBd },
              { label:'Total Levied',   value:`J$${Number(arrears.totals?.total_levied||0).toLocaleString()}`, color:C.blue, bg:C.blueBg, bd:C.blueBd },
              { label:'Total Collected',value:`J$${Number(arrears.totals?.total_collected||0).toLocaleString()}`, color:C.green, bg:C.greenBg, bd:C.greenBd },
              { label:'Outstanding',    value:`J$${Number(arrears.totals?.total_outstanding||0).toLocaleString()}`, color:C.red, bg:C.redBg, bd:C.redBd },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, border:`1.5px solid ${s.bd}`, borderRadius:'10px', padding:'12px 16px' }}>
                <p style={S.statLabel}>{s.label}</p>
                <p style={{ ...S.statNum, color:s.color, fontSize:'1.2rem' }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div style={{ ...S.card, overflow:'hidden' }}>
            <table>
              <thead><tr>
                {['Area','Parish','Cases','Delinquent','Levied','Collected','Outstanding','Rate%','Summons','Plans'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {arrears.rows?.length===0 && <tr><td colSpan={10} style={{ ...S.td, textAlign:'center', padding:'2rem', color:C.muted }}>No data.</td></tr>}
                {arrears.rows?.map((r: any) => (
                  <tr key={r.area_name} onMouseEnter={e=>(e.currentTarget.style.background=C.surface)} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:600 }}>{r.area_name}</td>
                    <td style={S.tdMuted}>{r.parish}</td>
                    <td style={S.td}>{r.total_cases}</td>
                    <td style={{ ...S.td, color:C.red, fontFamily:F.display, fontWeight:700 }}>{r.delinquent_cases}</td>
                    <td style={S.tdMuted}>J${Number(r.total_levied||0).toLocaleString()}</td>
                    <td style={{ ...S.td, color:C.green, fontFamily:F.display, fontWeight:600 }}>J${Number(r.total_collected||0).toLocaleString()}</td>
                    <td style={{ ...S.td, color:C.amber, fontFamily:F.display, fontWeight:700 }}>J${Number(r.total_outstanding||0).toLocaleString()}</td>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:800, color: Number(r.collection_rate_pct)>50?C.green:C.red }}>{r.collection_rate_pct||0}%</td>
                    <td style={{ ...S.td, textAlign:'center' }}>{r.summons_issued||0}</td>
                    <td style={{ ...S.td, textAlign:'center' }}>{r.active_payment_plans||0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COLLECTIONS BY PERIOD */}
      {tab === 'collections' && collections && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          {collections.length > 0 && (
            <div style={{ ...S.card, padding:'1.25rem' }}>
              <h3 style={{ ...S.h3, marginBottom:'1rem' }}>Collections Over Time</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={collections.map((r: any) => ({ period: String(r.period||'').slice(0,10), collected: Number(r.amount_collected||0) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="period" tick={{ fontSize:10, fill:C.muted, fontFamily:F.body }} />
                  <YAxis tick={{ fontSize:10, fill:C.muted, fontFamily:F.body }} />
                  <Tooltip formatter={(v: any) => `J$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="collected" fill={C.blue} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ ...S.card, overflow:'hidden' }}>
            <table>
              <thead><tr>
                {['Period','Parish','Cases','Amount Collected','Amount Levied','Rate%'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {collections.length===0 && <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', padding:'2rem', color:C.muted }}>No data for this period.</td></tr>}
                {collections.map((r: any, i: number) => (
                  <tr key={i} onMouseEnter={e=>(e.currentTarget.style.background=C.surface)} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:600 }}>{String(r.period||'').slice(0,10)}</td>
                    <td style={S.tdMuted}>{r.parish}</td>
                    <td style={S.td}>{r.cases_with_activity}</td>
                    <td style={{ ...S.td, color:C.green, fontFamily:F.display, fontWeight:700 }}>J${Number(r.amount_collected||0).toLocaleString()}</td>
                    <td style={S.tdMuted}>J${Number(r.amount_levied||0).toLocaleString()}</td>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:800, color:Number(r.collection_rate_pct)>50?C.green:C.amber }}>{r.collection_rate_pct||0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DELINQUENCY */}
      {tab === 'delinquency' && delinquency && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <div style={{ padding:'1rem 1.25rem', borderBottom:`1.5px solid ${C.border}`, display:'flex', alignItems:'center', gap:'12px' }}>
            <h3 style={S.h3}>Delinquency Report</h3>
            <span style={badge('red')}>{delinquency.length} delinquent cases</span>
          </div>
          <table>
            <thead><tr>
              {['Composite Key','Owner','Area','Parish','Outstanding','Years','Visits','Summons','Plans','Relief','Strata','Risk'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {delinquency.length===0 && <tr><td colSpan={12} style={{ ...S.td, textAlign:'center', padding:'2rem', color:C.muted }}>No delinquent cases found.</td></tr>}
              {delinquency.map((c: any) => (
                <tr key={c.composite_key} onMouseEnter={e=>(e.currentTarget.style.background=C.surface)} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                  <td style={{ ...S.td, fontFamily:F.display, fontWeight:700, fontSize:'0.78rem' }}>{c.composite_key}</td>
                  <td style={{ ...S.td, fontSize:'0.8rem' }}>{c.owner_name}</td>
                  <td style={S.tdMuted}>{c.area_name}</td>
                  <td style={S.tdMuted}>{c.parish}</td>
                  <td style={{ ...S.td, color:C.red, fontFamily:F.display, fontWeight:700 }}>J${Number(c.total_outstanding||0).toLocaleString()}</td>
                  <td style={{ ...S.td, textAlign:'center', color:Number(c.years_outstanding)>3?C.red:C.amber, fontFamily:F.display, fontWeight:700 }}>{c.years_outstanding||0}</td>
                  <td style={{ ...S.td, textAlign:'center' }}>{c.total_visits||0}</td>
                  <td style={{ ...S.td, textAlign:'center' }}>
                    {parseInt(c.active_summons)>0 ? <span style={badge('red')}>{c.active_summons}</span> : <span style={badge('muted')}>0</span>}
                  </td>
                  <td style={{ ...S.td, textAlign:'center' }}>
                    {parseInt(c.active_plans)>0 ? <span style={badge('green')}>{c.active_plans}</span> : <span style={badge('muted')}>0</span>}
                  </td>
                  <td style={{ ...S.td, textAlign:'center' }}>
                    {parseInt(c.pending_relief)>0 ? <span style={badge('amber')}>{c.pending_relief}</span> : <span style={badge('muted')}>0</span>}
                  </td>
                  <td style={{ ...S.td, textAlign:'center' }}>
                    {c.is_strata ? <span style={badge('blue')}>Strata</span> : <span style={badge('muted')}>No</span>}
                  </td>
                  <td style={S.td}><span style={badge(c.risk_level==='CRITICAL'?'red':c.risk_level==='HIGH'?'red':c.risk_level==='MEDIUM'?'amber':'green')}>{c.risk_level||'—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* FORECAST */}
      {tab === 'forecast' && forecast && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ ...S.card, padding:'12px 16px', background:C.blueBg, border:`1.5px solid ${C.blueBd}` }}>
            <p style={S.statLabel}>Historical Monthly Average</p>
            <p style={{ ...S.statNum, color:C.blue }}>J${Number(forecast.avgMonthlyCollection||0).toLocaleString()}</p>
          </div>
          {forecast.forecast?.length > 0 && (
            <div style={{ ...S.card, padding:'1.25rem' }}>
              <h3 style={{ ...S.h3, marginBottom:'1rem' }}>Revenue Forecast — Next {months} Months</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={forecast.forecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="month" tick={{ fontSize:10, fill:C.muted }} />
                  <YAxis tick={{ fontSize:10, fill:C.muted }} />
                  <Tooltip formatter={(v: any) => `J$${Number(v).toLocaleString()}`} />
                  <Line type="monotone" dataKey="historicalAverage" stroke={C.muted} strokeDasharray="5 5" name="Historical Avg" />
                  <Line type="monotone" dataKey="plannedInstalments" stroke={C.green} name="Payment Plans" />
                  <Line type="monotone" dataKey="projectedTotal" stroke={C.blue} strokeWidth={2} name="Projected Total" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ ...S.card, overflow:'hidden' }}>
            <table>
              <thead><tr>
                {['Month','Historical Average','Payment Plans','Projected Total'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {forecast.forecast?.map((r: any) => (
                  <tr key={r.month} onMouseEnter={e=>(e.currentTarget.style.background=C.surface)} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:700 }}>{r.month}</td>
                    <td style={S.tdMuted}>J${Number(r.historicalAverage||0).toLocaleString()}</td>
                    <td style={{ ...S.td, color:C.green, fontFamily:F.display, fontWeight:600 }}>J${Number(r.plannedInstalments||0).toLocaleString()}</td>
                    <td style={{ ...S.td, color:C.blue, fontFamily:F.display, fontWeight:800 }}>J${Number(r.projectedTotal||0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOTTLENECKS */}
      {tab === 'bottlenecks' && bottlenecks && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
            <div style={{ ...S.card, padding:'1.25rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'1rem' }}>
                <div style={S.accentBar(C.red)} />
                <h3 style={S.h3}>Delivery Outcomes</h3>
              </div>
              <table>
                <thead><tr>
                  {['Status','Count','%'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {bottlenecks.deliveryStatus?.map((r: any) => (
                    <tr key={r.status}>
                      <td style={S.td}><span style={badge(r.status==='DELIVERED'?'green':r.status==='OWNER_ABSENT'?'amber':r.status==='REFUSED'?'red':'muted')}>{r.status?.replace('_',' ')}</span></td>
                      <td style={{ ...S.td, fontFamily:F.display, fontWeight:700 }}>{r.count}</td>
                      <td style={S.tdMuted}>{r.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ ...S.card, padding:'1.25rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'1rem' }}>
                <div style={S.accentBar(C.amber)} />
                <h3 style={S.h3}>Unvisited Cases</h3>
              </div>
              <div style={{ background:C.redBg, border:`1.5px solid ${C.redBd}`, borderRadius:'10px', padding:'1rem' }}>
                <p style={{ ...S.statNum, color:C.red }}>{bottlenecks.unvisited?.count||0}</p>
                <p style={{ ...S.muted, marginTop:'4px' }}>cases with no delivery visit</p>
                <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.85rem', color:C.amber, marginTop:'8px' }}>J${Number(bottlenecks.unvisited?.outstanding||0).toLocaleString()} outstanding</p>
              </div>
            </div>
          </div>
          <div style={{ ...S.card, overflow:'hidden' }}>
            <div style={{ padding:'1rem 1.25rem', borderBottom:`1.5px solid ${C.border}` }}><h3 style={S.h3}>Area Coverage Gaps</h3></div>
            <table>
              <thead><tr>
                {['Area','Parish','Total Cases','Visited','Unvisited','Coverage%','Outstanding'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {bottlenecks.areaGaps?.map((r: any) => (
                  <tr key={r.name} onMouseEnter={e=>(e.currentTarget.style.background=C.surface)} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:600 }}>{r.name}</td>
                    <td style={S.tdMuted}>{r.parish}</td>
                    <td style={S.td}>{r.total}</td>
                    <td style={{ ...S.td, color:C.green, fontFamily:F.display, fontWeight:600 }}>{r.visited}</td>
                    <td style={{ ...S.td, color:C.red, fontFamily:F.display, fontWeight:700 }}>{r.unvisited}</td>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:800, color:Number(r.coverage_pct)>70?C.green:Number(r.coverage_pct)>40?C.amber:C.red }}>{r.coverage_pct||0}%</td>
                    <td style={{ ...S.td, color:C.amber }}>J${Number(r.outstanding||0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ ...S.card, overflow:'hidden' }}>
            <div style={{ padding:'1rem 1.25rem', borderBottom:`1.5px solid ${C.border}` }}><h3 style={S.h3}>Officer Performance (Last 90 Days)</h3></div>
            <table>
              <thead><tr>
                {['Officer','Total Deliveries','Delivered','Delivery Rate'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {bottlenecks.officerPerf?.length===0 && <tr><td colSpan={4} style={{ ...S.td, textAlign:'center', padding:'2rem', color:C.muted }}>No delivery data.</td></tr>}
                {bottlenecks.officerPerf?.map((r: any) => (
                  <tr key={r.officer} onMouseEnter={e=>(e.currentTarget.style.background=C.surface)} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:600 }}>{r.officer}</td>
                    <td style={S.td}>{r.total}</td>
                    <td style={{ ...S.td, color:C.green, fontFamily:F.display, fontWeight:600 }}>{r.delivered}</td>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:800, color:Number(r.rate)>70?C.green:Number(r.rate)>40?C.amber:C.red }}>{r.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
