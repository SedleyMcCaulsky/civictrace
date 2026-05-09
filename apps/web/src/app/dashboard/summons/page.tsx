'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { S, C, F, badge, badgeForStatus } from '@/lib/styles';

const FY = () => {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() + 1 >= 4 ? `${y}-${y+1}` : `${y-1}-${y}`;
};

const STATUS_OPTS = ['ISSUED','SERVED','COURT_DATE_SET','WITHDRAWN','SETTLED','JUDGEMENT'];

export default function SummonsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'all'|'eligible'>('eligible');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFY, setFilterFY] = useState(FY());
  const [filterParish, setFilterParish] = useState('');
  const [showIssue, setShowIssue] = useState<any>(null);
  const [issueForm, setIssueForm] = useState({ courtDate:'', notes:'' });
  const [issueError, setIssueError] = useState('');

  const { data: eligible, isLoading: loadElig } = useQuery({
    queryKey: ['summons-eligible', filterFY],
    queryFn: async () => (await api.get('/summons/eligible', { params:{ financialYear: filterFY } })).data,
    enabled: tab === 'eligible',
  });

  const { data: allSummons, isLoading: loadAll } = useQuery({
    queryKey: ['summons-all', filterStatus, filterFY, filterParish],
    queryFn: async () => (await api.get('/summons', { params:{ status: filterStatus||undefined, financialYear: filterFY||undefined, parish: filterParish||undefined } })).data,
    enabled: tab === 'all',
  });

  const issueMutation = useMutation({
    mutationFn: async ({ caseId, form }: any) => (await api.post(`/summons/cases/${caseId}/issue`, form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['summons-eligible'] });
      qc.invalidateQueries({ queryKey: ['summons-all'] });
      setShowIssue(null);
      setIssueForm({ courtDate:'', notes:'' });
      setIssueError('');
    },
    onError: (e: any) => setIssueError(e.response?.data?.message || 'Failed to issue summons'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: any) => (await api.patch(`/summons/${id}/status`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['summons-all'] }),
  });

  const parishes = ['Kingston','St. Andrew','St. Catherine','Clarendon','Manchester','St. Elizabeth','Westmoreland','Hanover','St. James','Trelawny','St. Ann','St. Mary','Portland','St. Thomas'];
  const fyOptions = ['2023-2024','2024-2025','2025-2026','2026-2027'];

  const eligibleCount = eligible?.length || 0;
  const allCount = allSummons?.length || 0;
  const activeCount = allSummons?.filter((s: any) => !['WITHDRAWN','SETTLED'].includes(s.status)).length || 0;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ ...S.pageHeader, marginBottom:'1.5rem' }}>
        <div>
          <h1 style={S.h1}>Summons Management</h1>
          <p style={{ ...S.muted, marginTop:'4px' }}>Track and issue legal summons for delinquent properties</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'2px', background:C.surface, padding:'4px', borderRadius:'10px', width:'fit-content', marginBottom:'1.5rem', border:`1.5px solid ${C.border}` }}>
        {[
          { id:'eligible', label:`Eligible for Summons (${eligibleCount})` },
          { id:'all',      label:`All Summons (${allCount})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding:'7px 16px', borderRadius:'7px', fontFamily:F.display, fontWeight:700, fontSize:'0.72rem', letterSpacing:'0.06em', textTransform:'uppercase', border:'none', cursor:'pointer', transition:'all .15s', background: tab===t.id ? C.card : 'transparent', color: tab===t.id ? C.blue : C.muted, boxShadow: tab===t.id ? '0 1px 3px rgba(13,19,38,0.08)':'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...S.card, padding:'12px 14px', marginBottom:'1.25rem', display:'flex', gap:'10px', flexWrap:'wrap' }}>
        <select value={filterFY} onChange={e => setFilterFY(e.target.value)} style={{ ...S.input, width:'160px' }}>
          {fyOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {tab === 'all' && (
          <>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...S.input, width:'180px' }}>
              <option value="">All statuses</option>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
            <select value={filterParish} onChange={e => setFilterParish(e.target.value)} style={{ ...S.input, width:'180px' }}>
              <option value="">All parishes</option>
              {parishes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </>
        )}
      </div>

      {/* ELIGIBLE TAB */}
      {tab === 'eligible' && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <div style={{ padding:'1rem 1.25rem', borderBottom:`1.5px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={S.h3}>Cases Eligible for Summons — FY {filterFY}</h3>
            <span style={{ ...badge('red'), fontSize:'0.7rem', padding:'4px 10px' }}>
              {eligibleCount} eligible
            </span>
          </div>
          <table>
            <thead><tr>
              {['Composite Key','Owner','Area','Parish','Visits','Outstanding','Prev Summons','Action'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loadElig && <tr><td colSpan={8} style={{ ...S.td, textAlign:'center', padding:'3rem', color:C.muted }}>Loading…</td></tr>}
              {!loadElig && eligibleCount === 0 && <tr><td colSpan={8} style={{ ...S.td, textAlign:'center', padding:'3rem', color:C.muted }}>No eligible cases for FY {filterFY}.</td></tr>}
              {eligible?.map((c: any) => (
                <tr key={c.id} onMouseEnter={e => (e.currentTarget.style.background=C.surface)} onMouseLeave={e => (e.currentTarget.style.background='')}>
                  <td style={{ ...S.td, fontFamily:F.display, fontWeight:700 }}>{c.composite_key}</td>
                  <td style={S.td}>{c.owner_name}</td>
                  <td style={S.tdMuted}>{c.area_name}</td>
                  <td style={S.tdMuted}>{c.parish}</td>
                  <td style={{ ...S.td, textAlign:'center' }}>
                    <span style={{ ...badge(parseInt(c.visit_count) >= 2 ? 'green' : 'amber'), }}>{c.visit_count}</span>
                  </td>
                  <td style={{ ...S.td, fontFamily:F.display, fontWeight:700, color:C.red }}>J${Number(c.total_outstanding||0).toLocaleString()}</td>
                  <td style={{ ...S.td, textAlign:'center' }}>
                    {parseInt(c.previous_summons) > 0 ? (
                      <span style={{ ...badge('red') }}>{c.previous_summons} prev</span>
                    ) : (
                      <span style={{ ...badge('muted') }}>First</span>
                    )}
                  </td>
                  <td style={{ ...S.td }}>
                    <button onClick={() => { setShowIssue(c); setIssueError(''); }}
                      style={{ ...S.btnPrimary, padding:'6px 14px', fontSize:'0.68rem' }}>
                      Issue Summons
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ALL SUMMONS TAB */}
      {tab === 'all' && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <div style={{ padding:'1rem 1.25rem', borderBottom:`1.5px solid ${C.border}`, display:'flex', alignItems:'center', gap:'16px' }}>
            <h3 style={S.h3}>All Summons</h3>
            <span style={badge('blue')}>{allCount} total</span>
            <span style={badge('amber')}>{activeCount} active</span>
          </div>
          <table>
            <thead><tr>
              {['Summons No.','Composite Key','Owner','Parish','FY','Issued','Court Date','Prev','Status','Update'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loadAll && <tr><td colSpan={10} style={{ ...S.td, textAlign:'center', padding:'3rem', color:C.muted }}>Loading…</td></tr>}
              {!loadAll && allCount === 0 && <tr><td colSpan={10} style={{ ...S.td, textAlign:'center', padding:'3rem', color:C.muted }}>No summons found.</td></tr>}
              {allSummons?.map((s: any) => (
                <tr key={s.id} onMouseEnter={e => (e.currentTarget.style.background=C.surface)} onMouseLeave={e => (e.currentTarget.style.background='')}>
                  <td style={{ ...S.td, fontFamily:F.display, fontWeight:700, fontSize:'0.78rem' }}>{s.summons_number}</td>
                  <td style={{ ...S.td, fontFamily:F.display, fontWeight:600, fontSize:'0.78rem' }}>{s.composite_key}</td>
                  <td style={{ ...S.td, fontSize:'0.8rem' }}>{s.owner_name}</td>
                  <td style={S.tdMuted}>{s.parish}</td>
                  <td style={S.tdMuted}>{s.financial_year}</td>
                  <td style={{ ...S.tdMuted, whiteSpace:'nowrap' }}>{s.issued_date ? new Date(s.issued_date).toLocaleDateString('en-JM') : '-'}</td>
                  <td style={{ ...S.tdMuted, whiteSpace:'nowrap' }}>{s.court_date ? new Date(s.court_date).toLocaleDateString('en-JM') : '-'}</td>
                  <td style={{ ...S.td, textAlign:'center' }}>
                    {parseInt(s.previous_summons_count) > 0 ? <span style={badge('red')}>{s.previous_summons_count}</span> : <span style={badge('muted')}>0</span>}
                  </td>
                  <td style={S.td}>
                    <span style={badgeForStatus(s.status)}>{s.status?.replace('_',' ')}</span>
                  </td>
                  <td style={S.td}>
                    <select value={s.status} onChange={e => statusMutation.mutate({ id:s.id, status:e.target.value })}
                      style={{ fontFamily:F.body, fontSize:'0.75rem', padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:C.surface, color:C.text, cursor:'pointer' }}>
                      {STATUS_OPTS.map(st => <option key={st} value={st}>{st.replace('_',' ')}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Issue Summons Modal */}
      {showIssue && (
        <div style={{ position:'fixed', inset:0, background:'rgba(13,19,38,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'1rem' }}>
          <div style={{ ...S.card, width:'100%', maxWidth:'480px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.5rem', borderBottom:`1.5px solid ${C.border}` }}>
              <h2 style={S.h2}>Issue Summons</h2>
              <button onClick={() => { setShowIssue(null); setIssueError(''); }} style={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:'8px', width:'32px', height:'32px', cursor:'pointer', color:C.muted, fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'14px' }}>
              {/* Case summary */}
              <div style={{ background:C.redBg, border:`1.5px solid ${C.redBd}`, borderRadius:'10px', padding:'12px 14px' }}>
                <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.85rem', color:C.red, margin:'0 0 4px' }}>{showIssue.composite_key}</p>
                <p style={{ fontFamily:F.body, fontSize:'0.8rem', color:C.text, margin:'0 0 2px' }}>{showIssue.owner_name}</p>
                <p style={{ fontFamily:F.body, fontSize:'0.78rem', color:C.muted, margin:0 }}>Outstanding: J${Number(showIssue.total_outstanding||0).toLocaleString()} · {showIssue.visit_count} visits FY {filterFY}</p>
                {parseInt(showIssue.previous_summons) > 0 && (
                  <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.72rem', color:C.red, marginTop:'6px', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                    ⚠ Previously summonsed {showIssue.previous_summons} time(s)
                  </p>
                )}
              </div>

              {issueError && (
                <div style={{ background:C.redBg, border:`1px solid ${C.redBd}`, borderRadius:'8px', padding:'10px 14px', color:C.red, fontSize:'0.78rem' }}>⚠ {issueError}</div>
              )}

              <div>
                <label style={S.label}>Court Date (optional)</label>
                <input type="date" value={issueForm.courtDate} onChange={e => setIssueForm(f => ({...f, courtDate:e.target.value}))} style={S.input} />
              </div>

              <div>
                <label style={S.label}>Notes</label>
                <textarea rows={3} value={issueForm.notes} onChange={e => setIssueForm(f => ({...f, notes:e.target.value}))} placeholder="Additional notes for this summons…" style={{ ...S.input, resize:'none' }} />
              </div>

              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={() => { setShowIssue(null); setIssueError(''); }} style={{ ...S.btnSecondary, flex:1 }}>Cancel</button>
                <button onClick={() => issueMutation.mutate({ caseId: showIssue.id, form: issueForm })}
                  disabled={issueMutation.isPending}
                  style={{ ...S.btnPrimary, flex:2, background:C.red, padding:'11px', borderRadius:'9px', opacity: issueMutation.isPending ? .6:1 }}>
                  {issueMutation.isPending ? 'Issuing…' : 'Issue Summons'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
