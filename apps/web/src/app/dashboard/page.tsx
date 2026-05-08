'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { FileText, Truck, DollarSign, AlertTriangle } from 'lucide-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: areas } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      const res = await api.get('/cases/areas');
      return res.data;
    },
  });

  const { data: auditData } = useQuery({
    queryKey: ['audit-summary'],
    queryFn: async () => {
      const res = await api.get('/audit/logs?limit=5');
      return res.data;
    },
  });

  const kpis = [
    {
      title: 'Total Areas',
      value: areas?.length ?? '—',
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: 'Active operational zones',
    },
    {
      title: 'Audit Events',
      value: auditData?.pagination?.total ?? '—',
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      sub: 'Total logged actions',
    },
    {
      title: 'Deliveries',
      value: '—',
      icon: Truck,
      color: 'text-green-600',
      bg: 'bg-green-50',
      sub: 'Field operations today',
    },
    {
      title: 'Reconciliations',
      value: '—',
      icon: DollarSign,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      sub: 'Payment batches processed',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">
          Good {getGreeting()}, {user?.fullName?.split(' ')[0]}
        </h1>
        <p className="text-slate-500 mt-1">
          {new Date().toLocaleDateString('en-JM', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium text-slate-600">{kpi.title}</div>
              <div className={`p-2 rounded-lg ${kpi.bg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-800 mb-1">{kpi.value}</div>
            <div className="text-xs text-slate-400">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <a href="/dashboard/cases" className="flex items-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700 transition-colors">
              <FileText className="h-4 w-4" />
              Case Registry
            </a>
            <a href="/dashboard/delivery" className="flex items-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700 transition-colors">
              <Truck className="h-4 w-4" />
              Log Delivery
            </a>
            <a href="/dashboard/reconciliation" className="flex items-center gap-2 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors">
              <DollarSign className="h-4 w-4" />
              Reconciliation
            </a>
            <a href="/dashboard/audit" className="flex items-center gap-2 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors">
              <AlertTriangle className="h-4 w-4" />
              Audit Logs
            </a>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Operational Areas</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {areas?.slice(0, 8).map((area: any) => (
              <div key={area.id} className="flex items-center justify-between py-2 border-b border-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-700">{area.name}</div>
                  <div className="text-xs text-slate-400">{area.parish}</div>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                  {area.region}
                </span>
              </div>
            ))}
            {!areas && (
              <div className="text-sm text-slate-400">Loading areas...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
