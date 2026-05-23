'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { S, C, F, badge } from '@/lib/styles';

interface RecRow {
  caseId: string;
  compositeKey: string;
  ownerName: string;
  rawAreaCode: string;
  rawValuationNumber: string;
  amountPaid: string;
  paymentDate: string;
  yearsCovered: string;
}

function CaseSearch({ onSelect }: { onSelect: (c: any) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/cases', { params: { ownerName: q, limit: 8 } });
        setResults(res.data?.data || []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search by owner name, valuation no., or address..."
        style={{ ...S.input, width: '100%' }}
      />
      {loading && (
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: C.muted }}>
          Searching...
        </div>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '260px', overflowY: 'auto', marginTop: '4px'
        }}>
          {results.map((c: any) => (
            <div
              key={c.id}
              onClick={() => { onSelect(c); setQ(c.composite_key); setOpen(false); }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}
              onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: '0.85rem' }}>{c.composite_key}</div>
              <div style={{ fontSize: '0.78rem', color: C.muted, marginTop: '2px' }}>
                {c.owner_name} · {c.property_address}
              </div>
              <div style={{ fontSize: '0.75rem', color: C.green, marginTop: '1px' }}>
                Outstanding: J${Number(c.total_outstanding || 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && results.length === 0 && !loading && q.length >= 2 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: '8px',
          padding: '12px 14px', fontSize: '0.82rem', color: C.muted, marginTop: '4px'
        }}>
          No cases found for "{q}"
        </div>
      )}
    </div>
  );
}

const emptyRow = (): RecRow => ({
  caseId: '', compositeKey: '', ownerName: '',
  rawAreaCode: '', rawValuationNumber: '',
  amountPaid: '', paymentDate: '', yearsCovered: '',
});

export default function ReconciliationPage() {
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState<RecRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [batchDetail, setBatchDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const { data: batches, refetch } = useQuery({
    queryKey: ['batches'],
    queryFn: async () => (await api.get('/reconciliation/batches')).data,
  });

  const selectCase = (i: number, c: any) => {
    setRows(r => r.map((row, idx) => idx === i ? {
      ...row,
      caseId: c.id,
      compositeKey: c.composite_key,
      ownerName: c.owner_name,
      rawAreaCode: c.area_code,
      rawValuationNumber: c.valuation_number,
    } : row));
  };

  const upd = (i: number, k: keyof RecRow, v: string) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  async function submit() {
    const invalid = rows.filter(r => !r.caseId || !r.amountPaid || !r.paymentDate || !r.yearsCovered);
    if (invalid.length > 0) { alert('All rows must have a selected case, amount, date, and years covered.'); return; }
    setSubmitting(true);
    try {
      const payload = {
        batchReference: `BATCH-${Date.now()}`,
        reportPeriodStart: rows[0]?.paymentDate || new Date().toISOString().split('T')[0],
        reportPeriodEnd: new Date().toISOString().split('T')[0],
        records: rows.map(r => ({
          rawAreaCode: r.rawAreaCode,
          rawValuationNumber: r.rawValuationNumber,
          amountPaid: parseFloat(r.amountPaid),
          paymentDate: r.paymentDate,
          yearsCovered: r.yearsCovered.split(',').map(y => parseInt(y.trim())).filter(Boolean),
        })),
      };
      const res = await api.post('/reconciliation/batch', payload);
      setResult(res.data);
      refetch();
      setShowForm(false);
      setRows([emptyRow()]);
    } catch (e: any) { alert(e.response?.data?.message || 'Submission failed'); }
    finally { setSubmitting(false); }
  }

  async function openBatch(b: any) {
    setSelectedBatch(b);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/reconciliation/batch/${b.id}`);
      setBatchDetail(res.data);
    } catch { setBatchDetail(null); }
    finally { setLoadingDetail(false); }
  }

  return (
    <div style={S.page}>
      <div style={{ ...S.pageHeader, marginBottom: '1.5rem' }}>
        <div>
          <h1 style={S.h1}>Payment Reconciliation</h1>
          <p style={{ ...S.muted, marginTop: '4px' }}>Match payments against property cases</p>
        </div>
        <button onClick={() => setShowForm(true)} style={S.btnPrimary}>+ New Batch</button>
      </div>

      {result && (
        <div style={{ background: C.greenBg, border: `1px solid ${C.greenBd}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '1.25rem' }}>
          <p style={{ fontFamily: F.display, fontWeight: 700, fontSize: '0.85rem', color: C.green, margin: '0 0 3px' }}>
            Batch Submitted: {result.batchReference}
          </p>
          <p style={S.muted}>Matched: {result.matched} / {result.totalRecords} — Unmatched rate: {result.unmatchedRate}</p>
        </div>
      )}

      <div style={{ ...S.card, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.border}` }}>
          <h3 style={S.h3}>Recent Batches</h3>
        </div>
        {!batches || batches.length === 0 ? (
          <p style={{ ...S.muted, padding: '3rem', textAlign: 'center' }}>No batches yet.</p>
        ) : (
          <table>
            <thead><tr>
              {['Reference', 'Period', 'Records', 'Matched', 'Amount', 'Status'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {batches.map((b: any) => (
                <tr key={b.id} onClick={() => openBatch(b)} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ ...S.td, fontFamily: F.display, fontWeight: 700 }}>{b.batch_reference}</td>
                  <td style={S.tdMuted}>{new Date(b.report_period_start).toLocaleDateString()} → {new Date(b.report_period_end).toLocaleDateString()}</td>
                  <td style={S.td}>{b.total_records}</td>
                  <td style={{ ...S.td, color: C.green, fontFamily: F.display, fontWeight: 700 }}>{b.matched_count}</td>
                  <td style={{ ...S.td, fontFamily: F.display, fontWeight: 700 }}>J${Number(b.total_amount || 0).toLocaleString()}</td>
                  <td style={S.td}><span style={badge('green')}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,19,38,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ ...S.card, width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: `1.5px solid ${C.border}` }}>
              <h2 style={S.h2}>New Reconciliation Batch</h2>
              <button onClick={() => { setShowForm(false); setRows([emptyRow()]); }}
                style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1.1rem', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {rows.map((row, i) => (
                <div key={i} style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: '0.8rem', color: C.muted }}>PAYMENT RECORD {i + 1}</span>
                    {rows.length > 1 && (
                      <button onClick={() => setRows(r => r.filter((_, idx) => idx !== i))}
                        style={{ background: 'transparent', border: `1px solid ${C.redBd}`, borderRadius: '6px', color: C.red, fontSize: '0.7rem', fontFamily: F.display, fontWeight: 700, padding: '3px 10px', cursor: 'pointer' }}>
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Case Search */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '4px' }}>PROPERTY CASE</label>
                    <CaseSearch onSelect={c => selectCase(i, c)} />
                  </div>

                  {/* Selected case confirmation */}
                  {row.caseId && (
                    <div style={{ background: C.greenBg, border: `1px solid ${C.greenBd}`, borderRadius: '7px', padding: '8px 12px', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                      <span style={{ fontFamily: F.display, fontWeight: 700, color: C.green }}>{row.compositeKey}</span>
                      <span style={{ color: C.muted, marginLeft: '8px' }}>{row.ownerName}</span>
                    </div>
                  )}

                  {/* Payment fields */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '4px' }}>AMOUNT PAID (J$)</label>
                      <input type="number" value={row.amountPaid} onChange={e => upd(i, 'amountPaid', e.target.value)}
                        placeholder="25000" style={S.input} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '4px' }}>PAYMENT DATE</label>
                      <input type="date" value={row.paymentDate} onChange={e => upd(i, 'paymentDate', e.target.value)}
                        style={S.input} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '4px' }}>YEARS COVERED</label>
                      <input type="text" value={row.yearsCovered} onChange={e => upd(i, 'yearsCovered', e.target.value)}
                        placeholder="2022, 2023" style={S.input} />
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button onClick={() => setRows(r => [...r, emptyRow()])} style={S.btnSecondary}>+ Add Record</button>
                <button onClick={submit} disabled={submitting} style={{ ...S.btnPrimary, opacity: submitting ? 0.55 : 1 }}>
                  {submitting ? 'Submitting…' : 'Submit Batch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,19,38,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '860px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1.5px solid #e5e7eb' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{selectedBatch.batch_reference}</h2>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
                  Period: {new Date(selectedBatch.report_period_start).toLocaleDateString()} → {new Date(selectedBatch.report_period_end).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => { setSelectedBatch(null); setBatchDetail(null); }}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1.2rem', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', padding: '1.25rem 1.5rem', borderBottom: '1.5px solid #e5e7eb' }}>
              {[
                { label: 'Total Records', value: selectedBatch.total_records, color: '#3b82f6' },
                { label: 'Matched', value: selectedBatch.matched_count, color: '#16a34a' },
                { label: 'Unmatched', value: selectedBatch.unmatched_count, color: '#dc2626' },
                { label: 'Total Amount', value: `J$${Number(selectedBatch.total_amount || 0).toLocaleString()}`, color: '#d97706' },
              ].map(s => (
                <div key={s.label} style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: '10px', padding: '0.875rem 1rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Records Table */}
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700 }}>Payment Records</h3>
              {loadingDetail ? (
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>Loading records…</p>
              ) : !batchDetail?.records?.length ? (
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No records found.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#1e293b' }}>
                      {['Valuation No.', 'Owner / Address', 'Amount Paid', 'Years', 'Status', 'Match Confidence'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batchDetail.records.map((r: any, i: number) => (
                      <tr key={r.id} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '9px 12px', fontWeight: 700, fontFamily: 'monospace' }}>
                          {r.composite_key || r.raw_valuation_number || '—'}
                        </td>
                        <td style={{ padding: '9px 12px', color: '#374151' }}>
                          <div>{r.raw_owner_name || '—'}</div>
                          {r.property_address && <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{r.property_address}</div>}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 700, color: '#16a34a' }}>
                          J${Number(r.amount_paid || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '9px 12px', color: '#374151' }}>
                          {Array.isArray(r.years_covered) ? r.years_covered.join(', ') : r.years_covered || '—'}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 700,
                            background: r.status === 'MATCHED' ? '#dcfce7' : '#fee2e2',
                            color: r.status === 'MATCHED' ? '#16a34a' : '#dc2626'
                          }}>{r.status}</span>
                        </td>
                        <td style={{ padding: '9px 12px', color: '#6b7280' }}>
                          {r.status === 'MATCHED' ? '100%' : '0%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}