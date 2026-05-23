'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { S, C, F, badge } from '@/lib/styles';

export default function ReconciliationPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState([{ rawAreaCode:'', rawValuationNumber:'', amountPaid:'', paymentDate:'', yearsCovered:'' }]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: batches, refetch } = useQuery({
    queryKey: ['batches'],
    queryFn: async () => (await api.get('/reconciliation/batches')).data,
  });

  const addRow = () => setRows(r => [...r, { rawAreaCode:'', rawValuationNumber:'', amountPaid:'', paymentDate:'', yearsCovered:'' }]);
  const upd = (i: number, k: string, v: string) => setRows(r => r.map((row,idx) => idx===i ? {...row,[k]:v} : row));

  async function submit() {
    setSubmitting(true);
    try {
      const payload = { batchReference:`BATCH-${Date.now()}`, reportPeriodStart: rows[0]?.paymentDate || new Date().toISOString().split('T')[0], reportPeriodEnd: new Date().toISOString().split('T')[0], records: rows.map(r => ({ rawAreaCode:r.rawAreaCode, rawValuationNumber:r.rawValuationNumber, amountPaid:parseFloat(r.amountPaid), paymentDate:r.paymentDate, yearsCovered:r.yearsCovered.split(',').map(y => parseInt(y.trim())).filter(Boolean) })) };
      const res = await api.post('/reconciliation/batch', payload);
      setResult(res.data); refetch(); setShowForm(false);
      setRows([{ rawAreaCode:'', rawValuationNumber:'', amountPaid:'', paymentDate:'', yearsCovered:'' }]);
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  }

  return (
    <div style={S.page}>
      <div style={{ ...S.pageHeader, marginBottom:'1.5rem' }}>
        <div>
          <h1 style={S.h1}>Payment Reconciliation</h1>
          <p style={{ ...S.muted, marginTop:'4px' }}>Match payments against property cases</p>
        </div>
        <button onClick={() => setShowForm(true)} style={S.btnPrimary}>+ New Batch</button>
      </div>

      {result && (
        <div style={{ background:C.greenBg, border:`1px solid ${C.greenBd}`, borderRadius:'10px', padding:'12px 16px', marginBottom:'1.25rem' }}>
          <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.85rem', color:C.green, margin:'0 0 3px' }}>Batch Submitted: {result.batchReference}</p>
          <p style={{ ...S.muted }}>Matched: {result.matched} / {result.totalRecords} — Unmatched rate: {result.unmatchedRate}</p>
        </div>
      )}

      <div style={{ ...S.card, overflow:'hidden' }}>
        <div style={{ padding:'1rem 1.25rem', borderBottom:`1.5px solid ${C.border}` }}><h3 style={S.h3}>Recent Batches</h3></div>
        {!batches || batches.length===0 ? (
          <p style={{ ...S.muted, padding:'3rem', textAlign:'center' }}>No batches yet.</p>
        ) : (
          <table>
            <thead><tr>
              {['Reference','Period','Records','Matched','Amount','Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {batches.map((b: any) => (
                <tr key={b.id} onMouseEnter={e => (e.currentTarget.style.background=C.surface)} onMouseLeave={e => (e.currentTarget.style.background='')}>
                  <td style={{ ...S.td, fontFamily:F.display, fontWeight:700 }}>{b.batch_reference}</td>
                  <td style={S.tdMuted}>{b.report_period_start} → {b.report_period_end}</td>
                  <td style={S.td}>{b.total_records}</td>
                  <td style={{ ...S.td, color:C.green, fontFamily:F.display, fontWeight:700 }}>{b.matched_count}</td>
                  <td style={{ ...S.td, fontFamily:F.display, fontWeight:700 }}>J${Number(b.total_amount||0).toLocaleString()}</td>
                  <td style={S.td}><span style={badge('green')}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(13,19,38,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'1rem' }}>
          <div style={{ ...S.card, width:'100%', maxWidth:'860px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.5rem', borderBottom:`1.5px solid ${C.border}` }}>
              <h2 style={S.h2}>New Reconciliation Batch</h2>
              <button onClick={() => setShowForm(false)} style={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:'8px', width:'32px', height:'32px', cursor:'pointer', fontSize:'1.1rem', color:C.muted, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            <div style={{ padding:'1.5rem', overflowX:'auto' }}>
              <table style={{ minWidth:'700px' }}>
                <thead><tr>
                  {['Area Code','Valuation No.','Amount Paid','Payment Date','Years (comma-sep)',''].map(h => <th key={h} style={{ ...S.th, padding:'8px 10px' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map((row,i) => (
                    <tr key={i}>
                      {['rawAreaCode','rawValuationNumber','amountPaid','paymentDate','yearsCovered'].map(k => (
                        <td key={k} style={{ padding:'6px 8px', borderBottom:'none' }}>
                          <input value={(row as any)[k]} onChange={e => upd(i,k,e.target.value)}
                            type={k==='amountPaid' ? 'number' : k==='paymentDate' ? 'date' : 'text'}
                            placeholder={k==='rawAreaCode' ? 'ST_ANDREW or KINGSTON' : k==='rawValuationNumber' ? '105C-2W-0639' : k==='amountPaid' ? '25000' : k==='yearsCovered' ? '2023, 2024' : ''} style={S.input} />
                        </td>
                      ))}
                      <td style={{ padding:'6px 8px', borderBottom:'none' }}>
                        <button onClick={() => setRows(r => r.filter((_,idx) => idx!==i))} style={{ background:'transparent', border:`1px solid ${C.redBd}`, borderRadius:'6px', color:C.red, fontSize:'0.7rem', fontFamily:F.display, fontWeight:700, padding:'4px 10px', cursor:'pointer' }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display:'flex', gap:'10px', marginTop:'1rem' }}>
                <button onClick={addRow} style={S.btnSecondary}>+ Add Row</button>
                <button onClick={submit} disabled={submitting} style={{ ...S.btnPrimary, opacity: submitting ? .55:1 }}>{submitting ? 'Submitting…' : 'Submit Batch'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
