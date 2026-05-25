'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { S, C, F, badge } from '@/lib/styles';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const TABS = ['executive','outstanding','delivery','payment'] as const;
const TAB_LABELS = { executive:'Executive', outstanding:'Outstanding', delivery:'Delivery', payment:'Payment' };
const PIE_COLORS = [C.red, C.amber, '#EAB308', C.green, C.blue, C.purple];

export default function ReportsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('executive');
  const [parish, setParish] = useState('');
  const [fy, setFy] = useState('2024-2025');
  const [from, setFrom] = useState(new Date(new Date().getFullYear(),0,1).toISOString().split('T')[0]);
  const [to,   setTo]   = useState(new Date().toISOString().split('T')[0]);

  const { data: exec }  = useQuery({ queryKey:['rep-exec'],          queryFn: async () => (await api.get('/reports/executive')).data,                                          enabled: tab==='executive' });
  const { data: out }   = useQuery({ queryKey:['rep-out', parish],   queryFn: async () => (await api.get('/reports/outstanding',       { params:{ parish:parish||undefined } })).data, enabled: tab==='outstanding' });
  const { data: del }   = useQuery({ queryKey:['rep-del', from, to], queryFn: async () => (await api.get('/reports/delivery/completion',{ params:{ from, to } })).data,        enabled: tab==='delivery' });
  const { data: pay }   = useQuery({ queryKey:['rep-pay', from, to], queryFn: async () => (await api.get('/reports/payment-conversion', { params:{ from, to } })).data,       enabled: tab==='payment' });

  const parishes = ['Kingston','St. Andrew','St. Catherine','Clarendon','Manchester','St. Elizabeth','Westmoreland','Hanover','St. James','Trelawny','St. Ann','St. Mary','Portland','St. Thomas'];

  const API_BASE = 'https://civictrace-production.up.railway.app/api/v1';

  return (
    <div style={S.page}>
      <div style={{ ...S.pageHeader, marginBottom:'1.5rem' }}>
        <div>
          <h1 style={S.h1}>Reports</h1>
          <p style={{ ...S.muted, marginTop:'4px' }}>Operational intelligence and compliance analytics</p>
        </div>
        {tab==='outstanding' && (
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={async () => {
              const token = localStorage.getItem('valugrid_token');
              const res = await fetch(`${API_BASE}/reports/outstanding/export/pdf${parish?`?parish=${parish}`:''}`, { headers: { Authorization: `Bearer ${token}` } });
              const blob = await res.blob(); const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'outstanding-report.pdf'; a.click(); URL.revokeObjectURL(url);
            }} style={S.btnSecondary}>↓ Outstanding PDF</button>
            <button onClick={async () => {
              const token = localStorage.getItem('valugrid_token');
              const res = await fetch(`${API_BASE}/reports/outstanding/export/excel${parish?`?parish=${parish}`:''}`, { headers: { Authorization: `Bearer ${token}` } });
              const blob = await res.blob(); const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'outstanding-report.xlsx'; a.click(); URL.revokeObjectURL(url);
            }} style={S.btnPrimary}>↓ Outstanding Excel</button>
            <button onClick={async () => {
              const token = localStorage.getItem('valugrid_token');
              const res = await fetch(`${API_BASE}/reports/summons/export/pdf?financialYear=${fy}`, { headers: { Authorization: `Bearer ${token}` } });
              const blob = await res.blob(); const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'summons-report.pdf'; a.click(); URL.revokeObjectURL(url);
            }} style={S.btnSecondary}>↓ Summons PDF</button>
            <button onClick={async () => {
              const token = localStorage.getItem('valugrid_token');
              const res = await fetch(`${API_BASE}/reports/summons/export/excel?financialYear=${fy}`, { headers: { Authorization: `Bearer ${token}` } });
              const blob = await res.blob(); const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'summons-report.xlsx'; a.click(); URL.revokeObjectURL(url);
            }} style={S.btnPrimary}>↓ Summons Excel</button>
            <button onClick={async () => {
              const token = localStorage.getItem('valugrid_token');
              const res = await fetch(`${API_BASE}/reports/relief/export/pdf?financialYear=${fy}`, { headers: { Authorization: `Bearer ${token}` } });
              const blob = await res.blob(); const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'relief-report.pdf'; a.click(); URL.revokeObjectURL(url);
            }} style={S.btnSecondary}>↓ Relief PDF</button>
            <button onClick={async () => {
              const token = localStorage.getItem('valugrid_token');
              const res = await fetch(`${API_BASE}/reports/relief/export/excel?financialYear=${fy}`, { headers: { Authorization: `Bearer ${token}` } });
              const blob = await res.blob(); const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'relief-report.xlsx'; a.click(); URL.revokeObjectURL(url);
            }} style={S.btnPrimary}>↓ Relief Excel</button>
            <button onClick={async () => {
              const token = localStorage.getItem('valugrid_token');
              const res = await fetch(`${API_BASE}/reports/collections/export/pdf?financialYear=${fy}`, { headers: { Authorization: `Bearer ${token}` } });
              const blob = await res.blob(); const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'collections-report.pdf'; a.click(); URL.revokeObjectURL(url);
            }} style={S.btnSecondary}>↓ Collections PDF</button>
            <button onClick={async () => {
              const token = localStorage.getItem('valugrid_token');
              const res = await fetch(`${API_BASE}/reports/collections/export/excel?financialYear=${fy}`, { headers: { Authorization: `Bearer ${token}` } });
              const blob = await res.blob(); const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'collections-report.xlsx'; a.click(); URL.revokeObjectURL(url);
            }} style={S.btnPrimary}>↓ Collections Excel</button>
            <button onClick={async () => {
              const token = localStorage.getItem('valugrid_token');
              const res = await fetch(`${API_BASE}/reports/arrears/export/pdf?financialYear=${fy}${parish?`&parish=${parish}`:''}`, { headers: { Authorization: `Bearer ${token}` } });
              const blob = await res.blob(); const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'arrears-report.pdf'; a.click(); URL.revokeObjectURL(url);
            }} style={S.btnSecondary}>↓ Arrears PDF</button>
            <button onClick={async () => {
              const token = localStorage.getItem('valugrid_token');
              const res = await fetch(`${API_BASE}/reports/arrears/export/excel?financialYear=${fy}${parish?`&parish=${parish}`:''}`, { headers: { Authorization: `Bearer ${token}` } });
              const blob = await res.blob(); const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'arrears-report.xlsx'; a.click(); URL.revokeObjectURL(url);
            }} style={S.btnPrimary}>↓ Arrears Excel</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'2px', background:C.surface, padding:'4px', borderRadius:'10px', width:'fit-content', marginBottom:'1.5rem', border:`1.5px solid ${C.border}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:'7px 16px', borderRadius:'7px', fontFamily:F.display, fontWeight:700, fontSize:'0.72rem', letterSpacing:'0.06em', textTransform:'uppercase', border:'none', cursor:'pointer', transition:'all .15s', background: tab===t ? C.card : 'transparent', color: tab===t ? C.blue : C.muted, boxShadow: tab===t ? '0 1px 3px rgba(13,19,38,0.08)' : 'none' }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Filters */}
      {tab !== 'executive' && (
        <div style={{ ...S.card, padding:'12px 14px', marginBottom:'1.25rem', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
          {tab==='outstanding' && (
            <select value={parish} onChange={e => setParish(e.target.value)} style={{ ...S.input, width:'200px' }}>
              <option value="">All Parishes</option>
              {parishes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          {(tab==='delivery'||tab==='payment') && (
            <>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...S.input, width:'160px' }} />
              <span style={S.muted}>to</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...S.input, width:'160px' }} />
            </>
          )}
        </div>
      )}

      {/* Executive */}
      {tab==='executive' && exec && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px' }}>
            {[
              { label:'Total Cases',    value: exec.cases?.total_cases   ?? 0,  color:C.blue,  bg:C.blueBg,  bd:C.blueBd },
              { label:'Delinquent',     value: exec.cases?.delinquent    ?? 0,  color:C.red,   bg:C.redBg,   bd:C.redBd },
              { label:'Outstanding',    value: `J$${Number(exec.cases?.total_outstanding||0).toLocaleString()}`, color:C.amber, bg:C.amberBg, bd:C.amberBd },
              { label:'Delivery Rate',  value: `${exec.deliveries?.delivery_rate||0}%`, color:C.green, bg:C.greenBg, bd:C.greenBd },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, border:`1.5px solid ${s.bd}`, borderRadius:'10px', padding:'12px 16px' }}>
                <p style={S.statLabel}>{s.label}</p>
                <p style={{ ...S.statNum, color:s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
          {exec.topAreas?.length > 0 && (
            <div style={{ ...S.card, padding:'1.25rem' }}>
              <h3 style={{ ...S.h3, marginBottom:'1rem' }}>Top Areas by Outstanding Balance</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={exec.topAreas.map((a: any) => ({ name:a.name, outstanding:Number(a.outstanding||0) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:C.muted, fontFamily:F.body }} />
                  <YAxis tick={{ fontSize:11, fill:C.muted, fontFamily:F.body }} />
                  <Tooltip formatter={(v: any) => `J$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="outstanding" fill={C.blue} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Outstanding */}
      {tab==='outstanding' && out && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
            {[
              { label:'Total Cases',    value: out.totals?.total_cases      ?? 0, color:C.blue,  bg:C.blueBg,  bd:C.blueBd },
              { label:'Delinquent',     value: out.totals?.delinquent_count ?? 0, color:C.red,   bg:C.redBg,   bd:C.redBd },
              { label:'Grand Total',    value: `J$${Number(out.totals?.grand_total||0).toLocaleString()}`, color:C.amber, bg:C.amberBg, bd:C.amberBd },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, border:`1.5px solid ${s.bd}`, borderRadius:'10px', padding:'12px 16px' }}>
                <p style={S.statLabel}>{s.label}</p>
                <p style={{ ...S.statNum, color:s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div style={{ ...S.card, overflow:'hidden' }}>
            <table>
              <thead><tr>{['Area','Parish','Cases','Delinquent','Total Outstanding','Avg Outstanding'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {out.byArea?.length===0 && <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', padding:'3rem', color:C.muted }}>No data.</td></tr>}
                {out.byArea?.map((r: any) => (
                  <tr key={r.area_name} onMouseEnter={e => (e.currentTarget.style.background=C.surface)} onMouseLeave={e => (e.currentTarget.style.background='')}>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:600 }}>{r.area_name}</td>
                    <td style={S.tdMuted}>{r.parish}</td>
                    <td style={S.td}>{r.total_cases}</td>
                    <td style={{ ...S.td, color:C.red, fontFamily:F.display, fontWeight:700 }}>{r.delinquent_cases}</td>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:700, color:C.amber }}>J${Number(r.total_outstanding||0).toLocaleString()}</td>
                    <td style={S.tdMuted}>J${Number(r.avg_outstanding||0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delivery */}
      {tab==='delivery' && del && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          {(!del.byArea?.length && !del.byOfficer?.length) ? (
            <div style={{ ...S.card, padding:'3rem', textAlign:'center' }}><p style={S.muted}>No delivery data for this period.</p></div>
          ) : (
            <>
              <div style={{ ...S.card, overflow:'hidden' }}>
                <div style={{ padding:'1rem 1.25rem', borderBottom:`1.5px solid ${C.border}` }}><h3 style={S.h3}>By Area</h3></div>
                <table>
                  <thead><tr>{['Area','Total','Delivered','Absent','Refused','Rate'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {del.byArea?.map((r: any) => (
                      <tr key={r.area_name} onMouseEnter={e => (e.currentTarget.style.background=C.surface)} onMouseLeave={e => (e.currentTarget.style.background='')}>
                        <td style={{ ...S.td, fontFamily:F.display, fontWeight:600 }}>{r.area_name} — {r.parish}</td>
                        <td style={S.td}>{r.total_deliveries}</td>
                        <td style={{ ...S.td, color:C.green, fontFamily:F.display, fontWeight:700 }}>{r.delivered}</td>
                        <td style={{ ...S.td, color:C.amber }}>{r.owner_absent}</td>
                        <td style={{ ...S.td, color:C.red }}>{r.refused}</td>
                        <td style={{ ...S.td, fontFamily:F.display, fontWeight:800, color:C.blue }}>{r.delivery_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ ...S.card, overflow:'hidden' }}>
                <div style={{ padding:'1rem 1.25rem', borderBottom:`1.5px solid ${C.border}` }}><h3 style={S.h3}>By Officer</h3></div>
                <table>
                  <thead><tr>{['Officer','Total','Delivered','Rate'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {del.byOfficer?.map((r: any) => (
                      <tr key={r.officer_name} onMouseEnter={e => (e.currentTarget.style.background=C.surface)} onMouseLeave={e => (e.currentTarget.style.background='')}>
                        <td style={{ ...S.td, fontFamily:F.display, fontWeight:600 }}>{r.officer_name}</td>
                        <td style={S.td}>{r.total}</td>
                        <td style={{ ...S.td, color:C.green, fontFamily:F.display, fontWeight:700 }}>{r.delivered}</td>
                        <td style={{ ...S.td, fontFamily:F.display, fontWeight:800, color:C.blue }}>{r.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Payment */}
      {tab==='payment' && pay && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px' }}>
            {[
              { label:'Total Records', value: pay.summary?.total_records  ?? 0, color:C.blue,  bg:C.blueBg,  bd:C.blueBd },
              { label:'Matched',       value: pay.summary?.total_matched  ?? 0, color:C.green, bg:C.greenBg, bd:C.greenBd },
              { label:'Total Amount',  value: `J$${Number(pay.summary?.total_amount||0).toLocaleString()}`, color:C.blue, bg:C.blueBg, bd:C.blueBd },
              { label:'Match Rate',    value: `${pay.summary?.overall_match_rate||0}%`, color:C.purple, bg:C.purpleBg, bd:C.purpleBd },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, border:`1.5px solid ${s.bd}`, borderRadius:'10px', padding:'12px 16px' }}>
                <p style={S.statLabel}>{s.label}</p>
                <p style={{ ...S.statNum, color:s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div style={{ ...S.card, overflow:'hidden' }}>
            <table>
              <thead><tr>{['Batch Reference','Period','Records','Matched','Amount','Match Rate'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {pay.batches?.length===0 && <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', padding:'3rem', color:C.muted }}>No batches.</td></tr>}
                {pay.batches?.map((b: any) => (
                  <tr key={b.batch_reference} onMouseEnter={e => (e.currentTarget.style.background=C.surface)} onMouseLeave={e => (e.currentTarget.style.background='')}>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:700 }}>{b.batch_reference}</td>
                    <td style={S.tdMuted}>{b.report_period_start} → {b.report_period_end}</td>
                    <td style={S.td}>{b.total_records}</td>
                    <td style={{ ...S.td, color:C.green, fontFamily:F.display, fontWeight:700 }}>{b.matched_count}</td>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:700 }}>J${Number(b.total_amount||0).toLocaleString()}</td>
                    <td style={{ ...S.td, fontFamily:F.display, fontWeight:800, color:C.blue }}>{b.match_rate}%</td>
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
