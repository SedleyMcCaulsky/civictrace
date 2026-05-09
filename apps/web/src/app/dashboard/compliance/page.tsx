export const dynamic = 'force-dynamic';

'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ShieldCheck } from 'lucide-react';

export default function CompliancePage() {
  const { data: cases } = useQuery({
    queryKey: ['compliance-cases'],
    queryFn: async () => (await api.get('/cases', { params: { limit: 50 } })).data,
  });

  const list = cases?.data || [];
  const delinquent = list.filter((c: any) => c.compliance_status === 'DELINQUENT').length;
  const critical = list.filter((c: any) => c.risk_level === 'CRITICAL').length;
  const high = list.filter((c: any) => c.risk_level === 'HIGH').length;
  const totalOutstanding = list.reduce((s: number, c: any) => s + Number(c.total_outstanding || 0), 0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Compliance Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Portfolio risk and compliance overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Cases', value: list.length, color: 'text-slate-800', bg: 'bg-slate-50' },
          { label: 'Delinquent', value: delinquent, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Critical Risk', value: critical, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Total Outstanding', value: `J$${totalOutstanding.toLocaleString()}`, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b"><h2 className="text-base font-semibold text-slate-800">High Risk Cases</h2></div>
        <table className="w-full">
          <thead className="bg-slate-50 border-b"><tr>
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Composite Key</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Owner</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Risk</th>
            <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Outstanding</th>
            <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Years</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {list.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No cases found.</td></tr>}
            {list.map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-mono font-medium text-slate-800">{c.composite_key}</td>
                <td className="px-6 py-3 text-sm text-slate-700">{c.owner_name}</td>
                <td className="px-6 py-3"><span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">{c.compliance_status}</span></td>
                <td className="px-6 py-3"><span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">{c.risk_level}</span></td>
                <td className="px-6 py-3 text-sm font-medium text-red-600 text-right">J${Number(c.total_outstanding || 0).toLocaleString()}</td>
                <td className="px-6 py-3 text-sm text-slate-600 text-right">{c.years_outstanding || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
