export const dynamic = 'force-dynamic';

'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Scale } from 'lucide-react';

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ entityType: '', action: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, filters],
    queryFn: async () => (await api.get('/audit/logs', { params: { ...filters, page, limit: 25 } })).data,
  });

  const logs = data?.data || [];
  const pagination = data?.pagination;

  const ACTION_COLORS: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
    LOGIN: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Scale className="h-6 w-6" /> Audit Trail</h1>
        <p className="text-slate-500 text-sm mt-1">Immutable record of all system actions — {pagination?.total ?? 0} total events</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-6 flex gap-3">
        <select value={filters.entityType} onChange={e => { setFilters(f => ({ ...f, entityType: e.target.value })); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
          <option value="">All entity types</option>
          {['cases','delivery','reconciliation','users','auth'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.action} onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
          <option value="">All actions</option>
          {['CREATE','UPDATE','DELETE','LOGIN','EXPORT'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-4">
        <table className="w-full">
          <thead className="bg-slate-50 border-b"><tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Time</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actor</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Entity</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">IP</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading && <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Loading...</td></tr>}
            {!isLoading && logs.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No audit events found.</td></tr>}
            {logs.map((log: any) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(log.occurred_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{log.actor_email || 'system'}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}>{log.action}</span></td>
                <td className="px-4 py-3 text-sm text-slate-600">{log.entity_type}</td>
                <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{log.description || log.composite_key}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{log.ip_address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.total > 25 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {pagination.page} — {pagination.total} total</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50">Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 25} className="px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
