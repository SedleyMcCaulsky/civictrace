export const dynamic = 'force-dynamic';

'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

export default function ReportsPage() {
  const { data: cases } = useQuery({
    queryKey: ['report-cases'],
    queryFn: async () => (await api.get('/cases', { params: { limit: 100 } })).data,
  });

  const list = cases?.data || [];

  const byParish = list.reduce((acc: any, c: any) => {
    const k = c.area_name || 'Unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const parishData = Object.entries(byParish).map(([name, count]) => ({ name, count })).sort((a: any, b: any) => b.count - a.count).slice(0, 8);

  const byType = list.reduce((acc: any, c: any) => {
    acc[c.property_type] = (acc[c.property_type] || 0) + 1;
    return acc;
  }, {});
  const typeData = Object.entries(byType).map(([name, value]) => ({ name, value }));

  const renderLabel = ({ name, percent }: { name?: string; percent?: number }) =>
    `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Portfolio analytics and visualizations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Cases by Area</h2>
          {parishData.length === 0 ? <p className="text-slate-400 text-sm">No data yet.</p> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={parishData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#1e293b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Cases by Property Type</h2>
          {typeData.length === 0 ? <p className="text-slate-400 text-sm">No data yet.</p> : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={renderLabel}>
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Outstanding Balance Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-slate-800">{list.length}</div>
              <div className="text-xs text-slate-500 mt-1">Total Cases</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">J${list.reduce((s: number, c: any) => s + Number(c.total_outstanding || 0), 0).toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-1">Total Outstanding</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">{list.filter((c: any) => c.compliance_status === 'DELINQUENT').length}</div>
              <div className="text-xs text-slate-500 mt-1">Delinquent Cases</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
