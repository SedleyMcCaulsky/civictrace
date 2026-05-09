'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarChart3, Download, TrendingUp, Users, FileText, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'executive'|'outstanding'|'delivery'|'payment'>('executive');
  const [parish, setParish] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const { data: executive, isLoading: loadingExec } = useQuery({
    queryKey: ['executive-report'],
    queryFn: async () => (await api.get('/reports/executive')).data,
    enabled: activeTab === 'executive',
  });

  const { data: outstanding, isLoading: loadingOut } = useQuery({
    queryKey: ['outstanding-report', parish],
    queryFn: async () => (await api.get('/reports/outstanding', { params: { parish: parish || undefined } })).data,
    enabled: activeTab === 'outstanding',
  });

  const { data: delivery, isLoading: loadingDel } = useQuery({
    queryKey: ['delivery-report', dateFrom, dateTo],
    queryFn: async () => (await api.get('/reports/delivery/completion', { params: { from: dateFrom, to: dateTo } })).data,
    enabled: activeTab === 'delivery',
  });

  const { data: payment, isLoading: loadingPay } = useQuery({
    queryKey: ['payment-report', dateFrom, dateTo],
    queryFn: async () => (await api.get('/reports/payment-conversion', { params: { from: dateFrom, to: dateTo } })).data,
    enabled: activeTab === 'payment',
  });

  function downloadPDF() {
    window.open(`https://civictrace-production.up.railway.app/api/v1/reports/outstanding/export/pdf${parish ? `?parish=${parish}` : ''}`, '_blank');
  }

  function downloadExcel() {
    window.open(`https://civictrace-production.up.railway.app/api/v1/reports/outstanding/export/excel${parish ? `?parish=${parish}` : ''}`, '_blank');
  }

  const tabs = [
    { id: 'executive', label: 'Executive Dashboard', icon: TrendingUp },
    { id: 'outstanding', label: 'Outstanding Balances', icon: DollarSign },
    { id: 'delivery', label: 'Delivery Completion', icon: FileText },
    { id: 'payment', label: 'Payment Conversion', icon: Users },
  ];

  const parishList = ['Kingston', 'St. Andrew', 'St. Catherine', 'Clarendon', 'Manchester', 'St. Elizabeth', 'Westmoreland', 'Hanover', 'St. James', 'Trelawny', 'St. Ann', 'St. Mary', 'Portland', 'St. Thomas'];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Reports</h1>
          <p className="text-slate-500 text-sm mt-1">Operational intelligence and compliance analytics</p>
        </div>
        {(activeTab === 'outstanding') && (
          <div className="flex gap-2">
            <button onClick={downloadPDF} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" /> PDF
            </button>
            <button onClick={downloadExcel} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700">
              <Download className="h-4 w-4" /> Excel
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-6 w-fit">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab !== 'executive' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-6 flex gap-3 flex-wrap">
          {activeTab === 'outstanding' && (
            <select value={parish} onChange={e => setParish(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
              <option value="">All Parishes</option>
              {parishList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          {(activeTab === 'delivery' || activeTab === 'payment') && (
            <>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <span className="self-center text-slate-400 text-sm">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </>
          )}
        </div>
      )}

      {/* EXECUTIVE DASHBOARD */}
      {activeTab === 'executive' && (
        <div className="space-y-6">
          {loadingExec ? <div className="text-slate-400 text-sm">Loading...</div> : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Cases', value: executive?.cases?.total_cases || 0, color: 'text-slate-800', bg: 'bg-slate-50' },
                  { label: 'Delinquent', value: executive?.cases?.delinquent || 0, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Total Outstanding', value: `J$${Number(executive?.cases?.total_outstanding || 0).toLocaleString()}`, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'Delivery Rate', value: `${executive?.deliveries?.delivery_rate || 0}%`, color: 'text-green-600', bg: 'bg-green-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Deliveries', value: executive?.deliveries?.total_deliveries || 0, color: 'text-slate-800', bg: 'bg-slate-50' },
                  { label: 'Delivered', value: executive?.deliveries?.delivered || 0, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Reconciled Amount', value: `J$${Number(executive?.reconciliation?.total_reconciled || 0).toLocaleString()}`, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Match Rate', value: `${executive?.reconciliation?.avg_match_rate || 0}%`, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {executive?.topAreas?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
                  <h2 className="text-base font-semibold text-slate-800 mb-4">Top Areas by Outstanding Balance</h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={executive.topAreas.map((a: any) => ({ name: a.name, outstanding: Number(a.outstanding || 0), cases: Number(a.case_count || 0) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: any) => `J$${Number(v).toLocaleString()}`} />
                      <Bar dataKey="outstanding" fill="#1e293b" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* OUTSTANDING BALANCES */}
      {activeTab === 'outstanding' && (
        <div className="space-y-6">
          {loadingOut ? <div className="text-slate-400 text-sm">Loading...</div> : (
            <>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Cases', value: outstanding?.totals?.total_cases || 0, color: 'text-slate-800', bg: 'bg-slate-50' },
                  { label: 'Delinquent', value: outstanding?.totals?.delinquent_count || 0, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Grand Total Outstanding', value: `J$${Number(outstanding?.totals?.grand_total || 0).toLocaleString()}`, color: 'text-orange-600', bg: 'bg-orange-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b"><tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Area</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Parish</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Cases</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Delinquent</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Total Outstanding</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Avg Outstanding</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {outstanding?.byArea?.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No data found.</td></tr>}
                    {outstanding?.byArea?.map((row: any) => (
                      <tr key={row.area_name} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-sm font-medium text-slate-800">{row.area_name}</td>
                        <td className="px-6 py-3 text-sm text-slate-600">{row.parish}</td>
                        <td className="px-6 py-3 text-sm text-right">{row.total_cases}</td>
                        <td className="px-6 py-3 text-sm text-right text-red-600 font-medium">{row.delinquent_cases}</td>
                        <td className="px-6 py-3 text-sm text-right font-bold text-orange-600">J${Number(row.total_outstanding || 0).toLocaleString()}</td>
                        <td className="px-6 py-3 text-sm text-right text-slate-600">J${Number(row.avg_outstanding || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* DELIVERY COMPLETION */}
      {activeTab === 'delivery' && (
        <div className="space-y-6">
          {loadingDel ? <div className="text-slate-400 text-sm">Loading...</div> : (
            <>
              {delivery?.byArea?.length === 0 && delivery?.byOfficer?.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center text-slate-400 text-sm">No delivery data for this period.</div>
              ) : (
                <>
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b"><h2 className="text-base font-semibold text-slate-800">By Area</h2></div>
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b"><tr>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Area</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Delivered</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Absent</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Refused</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Rate</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {delivery?.byArea?.map((row: any) => (
                          <tr key={row.area_name} className="hover:bg-slate-50">
                            <td className="px-6 py-3 text-sm font-medium text-slate-800">{row.area_name} — {row.parish}</td>
                            <td className="px-6 py-3 text-sm text-right">{row.total_deliveries}</td>
                            <td className="px-6 py-3 text-sm text-right text-green-600 font-medium">{row.delivered}</td>
                            <td className="px-6 py-3 text-sm text-right text-yellow-600">{row.owner_absent}</td>
                            <td className="px-6 py-3 text-sm text-right text-red-600">{row.refused}</td>
                            <td className="px-6 py-3 text-sm text-right font-bold">{row.delivery_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b"><h2 className="text-base font-semibold text-slate-800">By Officer</h2></div>
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b"><tr>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Officer</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Delivered</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Rate</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {delivery?.byOfficer?.map((row: any) => (
                          <tr key={row.officer_name} className="hover:bg-slate-50">
                            <td className="px-6 py-3 text-sm font-medium text-slate-800">{row.officer_name}</td>
                            <td className="px-6 py-3 text-sm text-right">{row.total}</td>
                            <td className="px-6 py-3 text-sm text-right text-green-600 font-medium">{row.delivered}</td>
                            <td className="px-6 py-3 text-sm text-right font-bold">{row.rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* PAYMENT CONVERSION */}
      {activeTab === 'payment' && (
        <div className="space-y-6">
          {loadingPay ? <div className="text-slate-400 text-sm">Loading...</div> : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Records', value: payment?.summary?.total_records || 0, color: 'text-slate-800', bg: 'bg-slate-50' },
                  { label: 'Matched', value: payment?.summary?.total_matched || 0, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Total Amount', value: `J$${Number(payment?.summary?.total_amount || 0).toLocaleString()}`, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Match Rate', value: `${payment?.summary?.overall_match_rate || 0}%`, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b"><tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Batch Reference</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Period</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Records</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Matched</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Match Rate</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {payment?.batches?.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No batches found.</td></tr>}
                    {payment?.batches?.map((b: any) => (
                      <tr key={b.batch_reference} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-sm font-mono text-slate-800">{b.batch_reference}</td>
                        <td className="px-6 py-3 text-sm text-slate-600">{b.report_period_start} → {b.report_period_end}</td>
                        <td className="px-6 py-3 text-sm text-right">{b.total_records}</td>
                        <td className="px-6 py-3 text-sm text-right text-green-600 font-medium">{b.matched_count}</td>
                        <td className="px-6 py-3 text-sm text-right font-medium">J${Number(b.total_amount || 0).toLocaleString()}</td>
                        <td className="px-6 py-3 text-sm text-right font-bold">{b.match_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
