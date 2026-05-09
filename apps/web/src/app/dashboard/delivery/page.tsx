'use client';
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Truck, Plus, X, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  DELIVERED: 'bg-green-100 text-green-700',
  OWNER_ABSENT: 'bg-yellow-100 text-yellow-700',
  REFUSED: 'bg-red-100 text-red-700',
  VACANT: 'bg-slate-100 text-slate-600',
  INCORRECT_ADDRESS: 'bg-orange-100 text-orange-700',
  ACCESS_DENIED: 'bg-red-100 text-red-700',
  DEMOLISHED: 'bg-slate-100 text-slate-600',
  RESCHEDULED: 'bg-blue-100 text-blue-700',
  ESCALATED: 'bg-purple-100 text-purple-700',
};

const STATUS_ICONS: Record<string, any> = {
  DELIVERED: CheckCircle,
  OWNER_ABSENT: Clock,
  REFUSED: AlertTriangle,
  ESCALATED: AlertTriangle,
};

const logDeliverySchema = z.object({
  propertyCaseId: z.string().uuid('Select a case'),
  status: z.enum(['DELIVERED','OWNER_ABSENT','REFUSED','VACANT','INCORRECT_ADDRESS','ACCESS_DENIED','DEMOLISHED','RESCHEDULED','ESCALATED']),
  notes: z.string().optional(),
  recipientName: z.string().optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
});

type LogDeliveryForm = z.infer<typeof logDeliverySchema>;

export default function DeliveryPage() {
  const queryClient = useQueryClient();
  const [showLog, setShowLog] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('');

  const { data: areas } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => (await api.get('/cases/areas')).data,
  });

  const { data: casesData } = useQuery({
    queryKey: ['cases-for-delivery', caseSearch],
    queryFn: async () => (await api.get('/cases', { params: { ownerName: caseSearch, limit: 20 } })).data,
    enabled: caseSearch.length > 1,
  });

  const { data: assignments } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => (await api.get('/delivery/assignments')).data,
  });

  const { data: areaSummary } = useQuery({
    queryKey: ['area-summary', selectedAreaId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      return (await api.get(`/delivery/area/${selectedAreaId}/summary`, { params: { from: monthStart, to: today } })).data;
    },
    enabled: !!selectedAreaId,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<LogDeliveryForm>({
    resolver: zodResolver(logDeliverySchema),
    defaultValues: { status: 'DELIVERED' },
  });

  const logMutation = useMutation({
    mutationFn: async (data: LogDeliveryForm) => (await api.post('/delivery', data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setShowLog(false);
      reset();
      setCaseSearch('');
    },
  });

  function getLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setValue('gpsLat', pos.coords.latitude);
        setValue('gpsLng', pos.coords.longitude);
      });
    }
  }

  const cases = casesData?.data || [];
  const selectedCaseId = watch('propertyCaseId');

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="h-6 w-6" /> Delivery Operations
          </h1>
          <p className="text-slate-500 text-sm mt-1">Field notice delivery tracking</p>
        </div>
        <button onClick={() => setShowLog(true)}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
          <Plus className="h-4 w-4" /> Log Delivery
        </button>
      </div>

      {/* Area Summary */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <select value={selectedAreaId} onChange={e => setSelectedAreaId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
            <option value="">Select area for summary...</option>
            {areas?.map((a: any) => <option key={a.id} value={a.id}>{a.name} — {a.parish}</option>)}
          </select>
        </div>

        {areaSummary?.[0] && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Delivered', value: areaSummary[0].delivered, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Owner Absent', value: areaSummary[0].owner_absent, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { label: 'Refused', value: areaSummary[0].refused, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Vacant', value: areaSummary[0].vacant, color: 'text-slate-600', bg: 'bg-slate-50' },
              { label: 'Delivery Rate', value: `${areaSummary[0].delivery_rate_pct || 0}%`, color: 'text-blue-600', bg: 'bg-blue-50' },
            ].map(stat => (
              <div key={stat.label} className={`${stat.bg} rounded-xl p-4`}>
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value || 0}</div>
                <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assignments */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">My Assignments</h2>
        </div>
        {!assignments || assignments.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No assignments found.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Area</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Parish</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {assignments.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-sm text-slate-700">{new Date(a.assignment_date).toLocaleDateString()}</td>
                  <td className="px-6 py-3 text-sm font-medium text-slate-800">{a.area_name}</td>
                  <td className="px-6 py-3 text-sm text-slate-500">{a.parish}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[a.status] || 'bg-slate-100 text-slate-600'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-sm font-medium text-slate-700">{a.completed_cases}/{a.total_cases}</span>
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 ml-auto">
                      <div className="h-1.5 bg-green-500 rounded-full"
                        style={{ width: `${a.total_cases ? (a.completed_cases / a.total_cases) * 100 : 0}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Log Delivery Modal */}
      {showLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-slate-800">Log Delivery</h2>
              <button onClick={() => { setShowLog(false); reset(); setCaseSearch(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit(d => logMutation.mutate(d))} className="p-6 space-y-4">
              {logMutation.isError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {(logMutation.error as any)?.response?.data?.message || 'Failed to log delivery'}
                </div>
              )}

              {/* Case Search */}
              <div>
                <label className="text-sm font-medium text-slate-700">Search Property Case</label>
                <input
                  placeholder="Type owner name to search..."
                  value={caseSearch}
                  onChange={e => setCaseSearch(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                {cases.length > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    {cases.map((c: any) => (
                      <button key={c.id} type="button"
                        onClick={() => { setValue('propertyCaseId', c.id); setCaseSearch(c.composite_key); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${selectedCaseId === c.id ? 'bg-slate-100' : ''}`}>
                        <div className="font-medium text-slate-800">{c.composite_key}</div>
                        <div className="text-xs text-slate-500">{c.owner_name} — {c.property_address}</div>
                      </button>
                    ))}
                  </div>
                )}
                {errors.propertyCaseId && <p className="text-xs text-red-600 mt-1">{errors.propertyCaseId.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Delivery Status</label>
                <select {...register('status')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                  {['DELIVERED','OWNER_ABSENT','REFUSED','VACANT','INCORRECT_ADDRESS','ACCESS_DENIED','DEMOLISHED','RESCHEDULED','ESCALATED'].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Recipient Name (if delivered)</label>
                <input {...register('recipientName')} placeholder="Name of person who received notice"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <textarea {...register('notes')} rows={3} placeholder="Additional notes..."
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>

              <button type="button" onClick={getLocation}
                className="w-full border border-slate-200 text-slate-700 py-2 px-4 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                📍 Capture GPS Location
              </button>
              {watch('gpsLat') && (
                <p className="text-xs text-green-600">GPS captured: {watch('gpsLat')?.toFixed(5)}, {watch('gpsLng')?.toFixed(5)}</p>
              )}

              <button type="submit" disabled={logMutation.isPending}
                className="w-full bg-slate-800 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors">
                {logMutation.isPending ? 'Logging...' : 'Log Delivery'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
