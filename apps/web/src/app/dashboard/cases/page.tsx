'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { FileText, Plus, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';

const COMPLIANCE_COLORS: Record<string, string> = {
  COMPLIANT: 'bg-green-100 text-green-700',
  DELINQUENT: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  UNKNOWN: 'bg-slate-100 text-slate-600',
};

const RISK_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
  UNKNOWN: 'bg-slate-100 text-slate-600',
};

const createCaseSchema = z.object({
  areaId: z.string().uuid('Select an area'),
  valuationNumber: z.string().min(3, 'Required'),
  ownerName: z.string().min(2, 'Required'),
  propertyAddress: z.string().min(5, 'Required'),
  propertyType: z.enum(['RESIDENTIAL','COMMERCIAL','INDUSTRIAL','AGRICULTURAL','MIXED_USE','VACANT_LAND','GOVERNMENT','INSTITUTIONAL','OTHER']),
  volume: z.string().optional(),
  folio: z.string().optional(),
  taxYear: z.number().min(2000).max(2100),
  amountDue: z.number().min(0.01),
});

type CreateCaseForm = z.infer<typeof createCaseSchema>;

export default function CasesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState({ ownerName: '', valuationNumber: '', areaCode: '' });
  const [searchInput, setSearchInput] = useState({ ownerName: '', valuationNumber: '', areaCode: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);

  const { data: areas } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => (await api.get('/cases/areas')).data,
  });

  const { data: casesData, isLoading } = useQuery({
    queryKey: ['cases', page, search],
    queryFn: async () => (await api.get('/cases', { params: { ...search, page, limit: 20 } })).data,
  });

  const { data: caseDetail } = useQuery({
    queryKey: ['case', selectedCase],
    queryFn: async () => (await api.get(`/cases/${selectedCase}`)).data,
    enabled: !!selectedCase,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateCaseForm>({
    resolver: zodResolver(createCaseSchema),
    defaultValues: { propertyType: 'RESIDENTIAL', taxYear: new Date().getFullYear(), amountDue: 0 },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateCaseForm) => {
      const payload = {
        areaId: data.areaId,
        valuationNumber: data.valuationNumber,
        ownerName: data.ownerName,
        propertyAddress: data.propertyAddress,
        propertyType: data.propertyType,
        volume: data.volume,
        folio: data.folio,
        taxBalances: [{ taxYear: data.taxYear, amountDue: data.amountDue }],
      };
      return (await api.post('/cases', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setShowCreate(false);
      reset();
    },
  });

  function handleSearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function clearSearch() {
    setSearchInput({ ownerName: '', valuationNumber: '', areaCode: '' });
    setSearch({ ownerName: '', valuationNumber: '', areaCode: '' });
    setPage(1);
  }

  const cases = casesData?.data || [];
  const pagination = casesData?.pagination;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-6 w-6" /> Case Registry
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {pagination?.total ?? 0} total cases
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
          <Plus className="h-4 w-4" /> New Case
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            placeholder="Owner name..."
            value={searchInput.ownerName}
            onChange={e => setSearchInput(s => ({ ...s, ownerName: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <input
            placeholder="Valuation number..."
            value={searchInput.valuationNumber}
            onChange={e => setSearchInput(s => ({ ...s, valuationNumber: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <input
            placeholder="Area code..."
            value={searchInput.areaCode}
            onChange={e => setSearchInput(s => ({ ...s, areaCode: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <div className="flex gap-2">
            <button onClick={handleSearch}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700">
              <Search className="h-4 w-4" /> Search
            </button>
            <button onClick={clearSearch}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-4">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Composite Key</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Address</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Risk</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Loading cases...</td></tr>
            )}
            {!isLoading && cases.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No cases found. Create your first case.</td></tr>
            )}
            {cases.map((c: any) => (
              <tr key={c.id} onClick={() => setSelectedCase(c.id)}
                className="hover:bg-slate-50 cursor-pointer transition-colors">
                <td className="px-4 py-3 text-sm font-mono font-medium text-slate-800">{c.composite_key}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{c.owner_name}</td>
                <td className="px-4 py-3 text-sm text-slate-500 max-w-48 truncate">{c.property_address}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${COMPLIANCE_COLORS[c.compliance_status] || COMPLIANCE_COLORS.UNKNOWN}`}>
                    {c.compliance_status || 'UNKNOWN'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${RISK_COLORS[c.risk_level] || RISK_COLORS.UNKNOWN}`}>
                    {c.risk_level || 'UNKNOWN'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">
                  J${Number(c.total_outstanding || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} cases)
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
              className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Case Detail Modal */}
      {selectedCase && caseDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{caseDetail.composite_key}</h2>
                <p className="text-sm text-slate-500">{caseDetail.property_type}</p>
              </div>
              <button onClick={() => setSelectedCase(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Owner</p><p className="text-sm font-medium text-slate-800 mt-1">{caseDetail.owner_name}</p></div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Address</p><p className="text-sm font-medium text-slate-800 mt-1">{caseDetail.property_address}</p></div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Area</p><p className="text-sm font-medium text-slate-800 mt-1">{caseDetail.area_name} — {caseDetail.parish}</p></div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Status</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full font-medium ${COMPLIANCE_COLORS[caseDetail.compliance_status] || COMPLIANCE_COLORS.UNKNOWN}`}>
                    {caseDetail.compliance_status || 'UNKNOWN'}
                  </span>
                </div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Total Outstanding</p><p className="text-lg font-bold text-red-600 mt-1">J${Number(caseDetail.total_outstanding || 0).toLocaleString()}</p></div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Years Outstanding</p><p className="text-lg font-bold text-slate-800 mt-1">{caseDetail.years_outstanding || 0}</p></div>
              </div>

              {caseDetail.taxBalances?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Tax Balances</h3>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b"><th className="text-left py-2 text-xs text-slate-400">Year</th><th className="text-right py-2 text-xs text-slate-400">Due</th><th className="text-right py-2 text-xs text-slate-400">Paid</th><th className="text-right py-2 text-xs text-slate-400">Balance</th><th className="text-center py-2 text-xs text-slate-400">Status</th></tr></thead>
                    <tbody>{caseDetail.taxBalances.map((b: any) => (
                      <tr key={b.id} className="border-b border-slate-50">
                        <td className="py-2 font-medium">{b.tax_year}</td>
                        <td className="py-2 text-right">J${Number(b.amount_due).toLocaleString()}</td>
                        <td className="py-2 text-right">J${Number(b.amount_paid).toLocaleString()}</td>
                        <td className="py-2 text-right font-medium text-red-600">J${Number(b.balance || b.amount_due - b.amount_paid).toLocaleString()}</td>
                        <td className="py-2 text-center"><span className="text-xs px-2 py-0.5 bg-slate-100 rounded-full">{b.status}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Case Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-slate-800">New Property Case</h2>
              <button onClick={() => { setShowCreate(false); reset(); }} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="p-6 space-y-4">
              {createMutation.isError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {(createMutation.error as any)?.response?.data?.message || 'Failed to create case'}
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700">Area</label>
                <select {...register('areaId')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                  <option value="">Select area...</option>
                  {areas?.map((a: any) => <option key={a.id} value={a.id}>{a.name} — {a.parish}</option>)}
                </select>
                {errors.areaId && <p className="text-xs text-red-600 mt-1">{errors.areaId.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Valuation Number</label>
                <input {...register('valuationNumber')} placeholder="e.g. 105C-2W-06-038" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                {errors.valuationNumber && <p className="text-xs text-red-600 mt-1">{errors.valuationNumber.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Owner Name</label>
                <input {...register('ownerName')} placeholder="Full legal name" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                {errors.ownerName && <p className="text-xs text-red-600 mt-1">{errors.ownerName.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Property Address</label>
                <input {...register('propertyAddress')} placeholder="Full property address" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                {errors.propertyAddress && <p className="text-xs text-red-600 mt-1">{errors.propertyAddress.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Property Type</label>
                <select {...register('propertyType')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                  {['RESIDENTIAL','COMMERCIAL','INDUSTRIAL','AGRICULTURAL','MIXED_USE','VACANT_LAND','GOVERNMENT','INSTITUTIONAL','OTHER'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Volume</label>
                  <input {...register('volume')} placeholder="Optional" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Folio</label>
                  <input {...register('folio')} placeholder="Optional" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Tax Year</label>
                  <input type="number" {...register('taxYear', { valueAsNumber: true })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Amount Due (J$)</label>
                  <input type="number" step="0.01" {...register('amountDue', { valueAsNumber: true })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting || createMutation.isPending}
                className="w-full bg-slate-800 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors">
                {createMutation.isPending ? 'Creating...' : 'Create Case'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
