'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { FileText, Plus, Search, X, ChevronLeft, ChevronRight, Brain, Shield } from 'lucide-react';

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
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [aiRisk, setAiRisk] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

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

  async function generateNarrative(caseId: string) {
    setAiLoading('narrative');
    setAiNarrative(null);
    try {
      const res = await api.post(`/ai/cases/${caseId}/narrative`);
      setAiNarrative(res.data.narrative);
    } catch (err: any) {
      setAiNarrative('Error generating narrative: ' + (err.response?.data?.message || err.message));
    } finally {
      setAiLoading(null);
    }
  }

  async function generateRiskScore(caseId: string) {
    setAiLoading('risk');
    setAiRisk(null);
    try {
      const res = await api.post(`/ai/cases/${caseId}/risk-score`);
      setAiRisk(res.data);
    } catch (err: any) {
      setAiRisk({ error: err.response?.data?.message || err.message });
    } finally {
      setAiLoading(null);
    }
  }

  function handleSearch() { setSearch(searchInput); setPage(1); }
  function clearSearch() { setSearchInput({ ownerName: '', valuationNumber: '', areaCode: '' }); setSearch({ ownerName: '', valuationNumber: '', areaCode: '' }); setPage(1); }

  const cases = casesData?.data || [];
  const pagination = casesData?.pagination;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="h-6 w-6" /> Case Registry</h1>
          <p className="text-slate-500 text-sm mt-1">{pagination?.total ?? 0} total cases</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
          <Plus className="h-4 w-4" /> New Case
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input placeholder="Owner name..." value={searchInput.ownerName} onChange={e => setSearchInput(s => ({ ...s, ownerName: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          <input placeholder="Valuation number..." value={searchInput.valuationNumber} onChange={e => setSearchInput(s => ({ ...s, valuationNumber: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          <input placeholder="Area code..." value={searchInput.areaCode} onChange={e => setSearchInput(s => ({ ...s, areaCode: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          <div className="flex gap-2">
            <button onClick={handleSearch} className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700"><Search className="h-4 w-4" /> Search</button>
            <button onClick={clearSearch} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"><X className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-4">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100"><tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Composite Key</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Owner</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Address</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Risk</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Outstanding</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading && <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Loading cases...</td></tr>}
            {!isLoading && cases.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No cases found. Create your first case.</td></tr>}
            {cases.map((c: any) => (
              <tr key={c.id} onClick={() => { setSelectedCase(c.id); setAiNarrative(null); setAiRisk(null); }} className="hover:bg-slate-50 cursor-pointer transition-colors">
                <td className="px-4 py-3 text-sm font-mono font-medium text-slate-800">{c.composite_key}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{c.owner_name}</td>
                <td className="px-4 py-3 text-sm text-slate-500 max-w-48 truncate">{c.property_address}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${COMPLIANCE_COLORS[c.compliance_status] || COMPLIANCE_COLORS.UNKNOWN}`}>{c.compliance_status || 'UNKNOWN'}</span></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${RISK_COLORS[c.risk_level] || RISK_COLORS.UNKNOWN}`}>{c.risk_level || 'UNKNOWN'}</span></td>
                <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">J${Number(c.total_outstanding || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /> Prev</button>
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50">Next <ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Case Detail Modal */}
      {selectedCase && caseDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{caseDetail.composite_key}</h2>
                <p className="text-sm text-slate-500">{caseDetail.property_type} — {caseDetail.area_name}, {caseDetail.parish}</p>
              </div>
              <button onClick={() => { setSelectedCase(null); setAiNarrative(null); setAiRisk(null); }} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Case Details */}
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Owner</p><p className="text-sm font-medium text-slate-800 mt-1">{caseDetail.owner_name}</p></div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Address</p><p className="text-sm font-medium text-slate-800 mt-1">{caseDetail.property_address}</p></div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Total Outstanding</p><p className="text-lg font-bold text-red-600 mt-1">J${Number(caseDetail.total_outstanding || 0).toLocaleString()}</p></div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Years Outstanding</p><p className="text-lg font-bold text-slate-800 mt-1">{caseDetail.years_outstanding || 0}</p></div>
              </div>

              {/* Tax Balances */}
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

              {/* AI Actions */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">AI Intelligence</h3>
                <div className="flex gap-3 mb-4">
                  <button onClick={() => generateNarrative(selectedCase)} disabled={aiLoading === 'narrative'}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
                    <Brain className="h-4 w-4" />
                    {aiLoading === 'narrative' ? 'Generating...' : 'Generate Narrative'}
                  </button>
                  <button onClick={() => generateRiskScore(selectedCase)} disabled={aiLoading === 'risk'}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
                    <Shield className="h-4 w-4" />
                    {aiLoading === 'risk' ? 'Scoring...' : 'AI Risk Score'}
                  </button>
                </div>

                {/* Risk Score Result */}
                {aiRisk && !aiRisk.error && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-orange-800">Risk Assessment</span>
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${RISK_COLORS[aiRisk.level] || RISK_COLORS.UNKNOWN}`}>{aiRisk.level} ({aiRisk.score}/100)</span>
                    </div>
                    <ul className="text-xs text-orange-700 space-y-1 mb-2">
                      {aiRisk.factors?.map((f: string, i: number) => <li key={i}>• {f}</li>)}
                    </ul>
                    <p className="text-xs text-orange-800 font-medium">{aiRisk.recommendation}</p>
                  </div>
                )}

                {/* Narrative Result */}
                {aiNarrative && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-purple-800">Compliance Narrative</span>
                      <button onClick={() => navigator.clipboard.writeText(aiNarrative)} className="text-xs text-purple-600 hover:text-purple-800">Copy</button>
                    </div>
                    <div className="text-xs text-purple-900 whitespace-pre-wrap leading-relaxed">{aiNarrative}</div>
                  </div>
                )}
              </div>
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
              {createMutation.isError && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{(createMutation.error as any)?.response?.data?.message || 'Failed to create case'}</div>}
              <div>
                <label className="text-sm font-medium text-slate-700">Area</label>
                <select {...register('areaId')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                  <option value="">Select area...</option>
                  {areas?.map((a: any) => <option key={a.id} value={a.id}>{a.name} — {a.parish}</option>)}
                </select>
                {errors.areaId && <p className="text-xs text-red-600 mt-1">{errors.areaId.message}</p>}
              </div>
              {[
                { name: 'valuationNumber', label: 'Valuation Number', placeholder: 'e.g. 105C-2W-06-038' },
                { name: 'ownerName', label: 'Owner Name', placeholder: 'Full legal name' },
                { name: 'propertyAddress', label: 'Property Address', placeholder: 'Full address' },
              ].map(f => (
                <div key={f.name}>
                  <label className="text-sm font-medium text-slate-700">{f.label}</label>
                  <input {...register(f.name as any)} placeholder={f.placeholder} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  {errors[f.name as keyof CreateCaseForm] && <p className="text-xs text-red-600 mt-1">{errors[f.name as keyof CreateCaseForm]?.message}</p>}
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-slate-700">Property Type</label>
                <select {...register('propertyType')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                  {['RESIDENTIAL','COMMERCIAL','INDUSTRIAL','AGRICULTURAL','MIXED_USE','VACANT_LAND','GOVERNMENT','INSTITUTIONAL','OTHER'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-700">Tax Year</label><input type="number" {...register('taxYear', { valueAsNumber: true })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
                <div><label className="text-sm font-medium text-slate-700">Amount Due (J$)</label><input type="number" step="0.01" {...register('amountDue', { valueAsNumber: true })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
              </div>
              <button type="submit" disabled={isSubmitting || createMutation.isPending} className="w-full bg-slate-800 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors">
                {createMutation.isPending ? 'Creating...' : 'Create Case'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
