'use client';
export const dynamic = 'force-dynamic';


import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { DollarSign, Plus, X } from 'lucide-react';

export default function ReconciliationPage() {
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState([{ rawAreaCode: '', rawValuationNumber: '', amountPaid: '', paymentDate: '', yearsCovered: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: batches, refetch } = useQuery({
    queryKey: ['batches'],
    queryFn: async () => (await api.get('/reconciliation/batches')).data,
  });

  function addRow() { setRows(r => [...r, { rawAreaCode: '', rawValuationNumber: '', amountPaid: '', paymentDate: '', yearsCovered: '' }]); }
  function updateRow(i: number, field: string, value: string) { setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row)); }
  function removeRow(i: number) { setRows(r => r.filter((_, idx) => idx !== i)); }

  async function submitBatch() {
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
      setRows([{ rawAreaCode: '', rawValuationNumber: '', amountPaid: '', paymentDate: '', yearsCovered: '' }]);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit batch');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><DollarSign className="h-6 w-6" /> Payment Reconciliation</h1><p className="text-slate-500 text-sm mt-1">Match payments against property cases</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700"><Plus className="h-4 w-4" /> New Batch</button>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="font-semibold text-green-800">Batch Submitted: {result.batchReference}</div>
          <div className="text-sm text-green-700 mt-1">Matched: {result.matched} / {result.totalRecords} — Unmatched rate: {result.unmatchedRate}</div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b"><h2 className="text-base font-semibold text-slate-800">Recent Batches</h2></div>
        {!batches || batches.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No batches yet.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b"><tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Reference</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Period</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Records</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Matched</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {batches.map((b: any) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm font-mono text-slate-800">{b.batch_reference}</td>
                  <td className="px-6 py-3 text-sm text-slate-500">{b.report_period_start} → {b.report_period_end}</td>
                  <td className="px-6 py-3 text-sm text-right">{b.total_records}</td>
                  <td className="px-6 py-3 text-sm text-right text-green-600 font-medium">{b.matched_count}</td>
                  <td className="px-6 py-3 text-sm text-right font-medium">J${Number(b.total_amount || 0).toLocaleString()}</td>
                  <td className="px-6 py-3"><span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-slate-800">New Reconciliation Batch</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left py-2 px-2 text-xs text-slate-500">Area Code</th>
                    <th className="text-left py-2 px-2 text-xs text-slate-500">Valuation No.</th>
                    <th className="text-left py-2 px-2 text-xs text-slate-500">Amount Paid</th>
                    <th className="text-left py-2 px-2 text-xs text-slate-500">Payment Date</th>
                    <th className="text-left py-2 px-2 text-xs text-slate-500">Years (comma separated)</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-1 px-2"><input value={row.rawAreaCode} onChange={e => updateRow(i, 'rawAreaCode', e.target.value)} placeholder="NORBROOK" className="w-full px-2 py-1 border border-slate-200 rounded text-sm" /></td>
                        <td className="py-1 px-2"><input value={row.rawValuationNumber} onChange={e => updateRow(i, 'rawValuationNumber', e.target.value)} placeholder="105C-2W-06-038" className="w-full px-2 py-1 border border-slate-200 rounded text-sm" /></td>
                        <td className="py-1 px-2"><input type="number" value={row.amountPaid} onChange={e => updateRow(i, 'amountPaid', e.target.value)} placeholder="45000" className="w-full px-2 py-1 border border-slate-200 rounded text-sm" /></td>
                        <td className="py-1 px-2"><input type="date" value={row.paymentDate} onChange={e => updateRow(i, 'paymentDate', e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded text-sm" /></td>
                        <td className="py-1 px-2"><input value={row.yearsCovered} onChange={e => updateRow(i, 'yearsCovered', e.target.value)} placeholder="2023, 2024" className="w-full px-2 py-1 border border-slate-200 rounded text-sm" /></td>
                        <td className="py-1 px-2"><button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={addRow} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50">+ Add Row</button>
                <button onClick={submitBatch} disabled={submitting} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Batch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
