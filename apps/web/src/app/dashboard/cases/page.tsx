'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';

const COMPLIANCE_STYLE: Record<string,{bg:string,color:string,border:string}> = {
  COMPLIANT:  { bg:'#E6FBF4', color:'#059669', border:'#A7F3D0' },
  DELINQUENT: { bg:'#FEF2F2', color:'#E53E3E', border:'#FECACA' },
  PENDING:    { bg:'#FFFBEB', color:'#D97706', border:'#FDE68A' },
  UNKNOWN:    { bg:'#F1F5F9', color:'#64748B', border:'#E2E8F0' },
};
const RISK_STYLE: Record<string,{bg:string,color:string,border:string}> = {
  LOW:      { bg:'#E6FBF4', color:'#059669', border:'#A7F3D0' },
  MEDIUM:   { bg:'#FFFBEB', color:'#D97706', border:'#FDE68A' },
  HIGH:     { bg:'#FFF7ED', color:'#EA580C', border:'#FED7AA' },
  CRITICAL: { bg:'#FEF2F2', color:'#E53E3E', border:'#FECACA' },
  UNKNOWN:  { bg:'#F1F5F9', color:'#64748B', border:'#E2E8F0' },
};

const badgeStyle = (s: Record<string,{bg:string,color:string,border:string}>, key: string) => {
  const v = s[key] || s.UNKNOWN;
  return { background:v.bg, color:v.color, border:`1px solid ${v.border}`, fontSize:'0.62rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' as const, padding:'3px 8px', borderRadius:'5px', whiteSpace:'nowrap' as const };
};

const createSchema = z.object({
  areaId: z.string().uuid('Select an area'),
  valuationNumber: z.string().min(3),
  ownerName: z.string().min(2),
  propertyAddress: z.string().min(5),
  propertyType: z.enum(['RESIDENTIAL','COMMERCIAL','INDUSTRIAL','AGRICULTURAL','MIXED_USE','VACANT_LAND','GOVERNMENT','INSTITUTIONAL','OTHER']),
  taxYear: z.number().min(2000).max(2100),
  amountDue: z.number().min(0.01),
});
type CreateForm = z.infer<typeof createSchema>;

export default function CasesPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState({ ownerName:'', valuationNumber:'', areaCode:'' });
  const [draft, setDraft] = useState({ ownerName:'', valuationNumber:'', areaCode:'' });
  const [showCreate, setShowCreate] = useState(false);
  const [selCase, setSelCase] = useState<string|null>(null);
  const [aiNarrative, setAiNarrative] = useState<string|null>(null);
  const [aiRisk, setAiRisk] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState<string|null>(null);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadNotes, setUploadNotes] = useState('');

  const { data: areas } = useQuery({ queryKey:['areas'], queryFn: async () => (await api.get('/cases/areas')).data });
  const { data: casesData, isLoading } = useQuery({ queryKey:['cases', page, search], queryFn: async () => (await api.get('/cases', { params:{...search, page, limit:20} })).data });
  const { data: caseDetail } = useQuery({ queryKey:['case', selCase], queryFn: async () => (await api.get(`/cases/${selCase}`)).data, enabled:!!selCase });

  useEffect(() => {
    if (selCase) api.get(`/evidence/cases/${selCase}`).then(r => setEvidence(r.data||[])).catch(() => setEvidence([]));
  }, [selCase]);

  const { register, handleSubmit, reset, formState:{ isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { propertyType:'RESIDENTIAL', taxYear: new Date().getFullYear(), amountDue:0 },
  });

  const createMutation = useMutation({
    mutationFn: async (d: CreateForm) => (await api.post('/cases', { areaId:d.areaId, valuationNumber:d.valuationNumber, ownerName:d.ownerName, propertyAddress:d.propertyAddress, propertyType:d.propertyType, taxBalances:[{ taxYear:d.taxYear, amountDue:d.amountDue }] })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['cases'] }); setShowCreate(false); reset(); },
  });

  async function genNarrative(id: string) {
    setAiLoading('narrative'); setAiNarrative(null);
    try { const r = await api.post(`/ai/cases/${id}/narrative`); setAiNarrative(r.data.narrative); }
    catch (e: any) { setAiNarrative('Error: ' + (e.response?.data?.message || e.message)); }
    finally { setAiLoading(null); }
  }

  async function genRisk(id: string) {
    setAiLoading('risk'); setAiRisk(null);
    try { const r = await api.post(`/ai/cases/${id}/risk-score`); setAiRisk(r.data); }
    catch (e: any) { setAiRisk({ error: e.message }); }
    finally { setAiLoading(null); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selCase) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (uploadNotes) fd.append('notes', uploadNotes);
      fd.append('evidenceType', 'PHOTO');
      await api.post(`/evidence/cases/${selCase}/upload`, fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      const r = await api.get(`/evidence/cases/${selCase}`);
      setEvidence(r.data||[]); setUploadNotes('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) { alert('Upload failed: ' + (e.response?.data?.message || e.message)); }
    finally { setUploading(false); }
  }

  const cases = casesData?.data || [];
  const pg = casesData?.pagination;

  const inputStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', background:'#FAFBFF', border:'1.5px solid #DDE3F0', color:'#0d1326', fontSize:'0.85rem', fontFamily:'DM Sans,sans-serif', outline:'none', boxSizing:'border-box' as const };
  const labelStyle = { display:'block' as const, fontSize:'0.63rem', fontFamily:'Syne,sans-serif', fontWeight:700 as const, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'#5C6A8A', marginBottom:'7px' };
  const sectionHead = { fontFamily:'Syne,sans-serif', fontSize:'0.72rem', fontWeight:700 as const, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'#5C6A8A', marginBottom:'10px' };

  return (
    <div style={{ minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.75rem' }}>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.5rem', fontWeight:800, color:'#0d1326', margin:0 }}>Case Registry</h1>
          <p style={{ color:'#5C6A8A', fontSize:'0.78rem', margin:'4px 0 0' }}>{pg?.total ?? 0} total cases</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="vg-btn-primary" style={{ padding:'9px 18px', borderRadius:'9px' }}>+ New Case</button>
      </div>

      {/* Search */}
      <div className="vg-card" style={{ borderRadius:'12px', padding:'1rem', marginBottom:'1.25rem' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:'10px', alignItems:'end' }}>
          {[
            { ph:'Owner name…',        key:'ownerName' },
            { ph:'Valuation number…',  key:'valuationNumber' },
            { ph:'Area code…',         key:'areaCode' },
          ].map(f => (
            <input key={f.key} placeholder={f.ph} value={(draft as any)[f.key]} onChange={e => setDraft(d => ({...d, [f.key]: e.target.value}))} style={inputStyle}
              onFocus={e => { e.target.style.borderColor='#2979FF'; e.target.style.boxShadow='0 0 0 3px rgba(41,121,255,0.1)'; }}
              onBlur={e => { e.target.style.borderColor='#DDE3F0'; e.target.style.boxShadow='none'; }} />
          ))}
          <div style={{ display:'flex', gap:'6px' }}>
            <button onClick={() => { setSearch(draft); setPage(1); }} className="vg-btn-primary" style={{ padding:'9px 16px', borderRadius:'8px', whiteSpace:'nowrap' }}>Search</button>
            <button onClick={() => { setDraft({ownerName:'',valuationNumber:'',areaCode:''}); setSearch({ownerName:'',valuationNumber:'',areaCode:''}); setPage(1); }} style={{ padding:'9px 12px', borderRadius:'8px', background:'#F5F8FF', border:'1.5px solid #DDE3F0', color:'#5C6A8A', cursor:'pointer', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.78rem' }}>×</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="vg-card" style={{ borderRadius:'12px', overflow:'hidden', marginBottom:'1rem' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#F5F8FF', borderBottom:'1.5px solid #DDE3F0' }}>
              {['Composite Key','Owner','Address','Status','Risk','Outstanding'].map((h,i) => (
                <th key={h} style={{ padding:'10px 16px', textAlign: i===5 ? 'right':'left', fontSize:'0.62rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#5C6A8A' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ padding:'3rem', textAlign:'center', color:'#5C6A8A', fontSize:'0.85rem' }}>Loading cases…</td></tr>}
            {!isLoading && cases.length===0 && <tr><td colSpan={6} style={{ padding:'3rem', textAlign:'center', color:'#5C6A8A', fontSize:'0.85rem' }}>No cases found. Create your first case.</td></tr>}
            {cases.map((c: any) => (
              <tr key={c.id} onClick={() => { setSelCase(c.id); setAiNarrative(null); setAiRisk(null); setEvidence([]); }}
                style={{ borderBottom:'1px solid #F0F4FF', cursor:'pointer', transition:'background .1s' }}
                onMouseEnter={e => (e.currentTarget.style.background='#F5F8FF')}
                onMouseLeave={e => (e.currentTarget.style.background='')}>
                <td style={{ padding:'11px 16px', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.8rem', color:'#0d1326' }}>{c.composite_key}</td>
                <td style={{ padding:'11px 16px', fontSize:'0.83rem', color:'#0d1326' }}>{c.owner_name}</td>
                <td style={{ padding:'11px 16px', fontSize:'0.8rem', color:'#5C6A8A', maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.property_address}</td>
                <td style={{ padding:'11px 16px' }}><span style={badgeStyle(COMPLIANCE_STYLE, c.compliance_status||'UNKNOWN')}>{c.compliance_status||'UNKNOWN'}</span></td>
                <td style={{ padding:'11px 16px' }}><span style={badgeStyle(RISK_STYLE, c.risk_level||'UNKNOWN')}>{c.risk_level||'UNKNOWN'}</span></td>
                <td style={{ padding:'11px 16px', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.83rem', color:'#0d1326', textAlign:'right' }}>J${Number(c.total_outstanding||0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pg && pg.totalPages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p style={{ color:'#5C6A8A', fontSize:'0.78rem' }}>Page {pg.page} of {pg.totalPages}</p>
          <div style={{ display:'flex', gap:'6px' }}>
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding:'7px 14px', borderRadius:'7px', background:'#fff', border:'1.5px solid #DDE3F0', color:'#5C6A8A', fontSize:'0.78rem', fontFamily:'Syne,sans-serif', fontWeight:700, cursor:'pointer', opacity: page===1 ? .4:1 }}>← Prev</button>
            <button onClick={() => setPage(p => Math.min(pg.totalPages,p+1))} disabled={page===pg.totalPages} style={{ padding:'7px 14px', borderRadius:'7px', background:'#fff', border:'1.5px solid #DDE3F0', color:'#5C6A8A', fontSize:'0.78rem', fontFamily:'Syne,sans-serif', fontWeight:700, cursor:'pointer', opacity: page===pg.totalPages ? .4:1 }}>Next →</button>
          </div>
        </div>
      )}

      {/* Case Detail Modal */}
      {selCase && caseDetail && (
        <div style={{ position:'fixed', inset:0, background:'rgba(13,19,38,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'680px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(13,19,38,0.25)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.5rem', borderBottom:'1.5px solid #F0F4FF' }}>
              <div>
                <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1rem', color:'#0d1326', margin:0 }}>{caseDetail.composite_key}</h2>
                <p style={{ color:'#5C6A8A', fontSize:'0.75rem', margin:'3px 0 0' }}>{caseDetail.property_type} · {caseDetail.area_name}, {caseDetail.parish}</p>
              </div>
              <button onClick={() => { setSelCase(null); setAiNarrative(null); setAiRisk(null); }} style={{ background:'#F5F8FF', border:'1.5px solid #DDE3F0', borderRadius:'8px', width:'32px', height:'32px', cursor:'pointer', fontSize:'1.1rem', color:'#5C6A8A', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>

            <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.5rem' }}>
              {/* Case info */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                {[
                  { label:'Owner',             value: caseDetail.owner_name },
                  { label:'Address',           value: caseDetail.property_address },
                  { label:'Total Outstanding', value: `J$${Number(caseDetail.total_outstanding||0).toLocaleString()}`, bold:true, color:'#E53E3E' },
                  { label:'Years Outstanding', value: caseDetail.years_outstanding||0, bold:true },
                ].map(f => (
                  <div key={f.label} style={{ background:'#F5F8FF', borderRadius:'10px', padding:'12px 14px', border:'1px solid #DDE3F0' }}>
                    <p style={{ ...labelStyle, marginBottom:'4px' }}>{f.label}</p>
                    <p style={{ color: f.color||'#0d1326', fontFamily:'Syne,sans-serif', fontWeight: f.bold ? 800:600, fontSize: f.bold ? '1.2rem':'0.88rem', margin:0 }}>{f.value}</p>
                  </div>
                ))}
              </div>

              {/* Tax balances */}
              {caseDetail.taxBalances?.length > 0 && (
                <div>
                  <p style={sectionHead}>Tax Balances</p>
                  <div style={{ border:'1.5px solid #DDE3F0', borderRadius:'10px', overflow:'hidden' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                      <thead><tr style={{ background:'#F5F8FF', borderBottom:'1px solid #DDE3F0' }}>
                        {['Year','Due','Paid','Balance','Status'].map((h,i) => (
                          <th key={h} style={{ padding:'8px 14px', textAlign: i>0 ? 'right':'left', ...labelStyle, marginBottom:0 }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {caseDetail.taxBalances.map((b: any) => (
                          <tr key={b.id} style={{ borderBottom:'1px solid #F0F4FF' }}>
                            <td style={{ padding:'9px 14px', fontFamily:'Syne,sans-serif', fontWeight:700, color:'#0d1326' }}>{b.tax_year}</td>
                            <td style={{ padding:'9px 14px', textAlign:'right', color:'#5C6A8A' }}>J${Number(b.amount_due).toLocaleString()}</td>
                            <td style={{ padding:'9px 14px', textAlign:'right', color:'#059669' }}>J${Number(b.amount_paid).toLocaleString()}</td>
                            <td style={{ padding:'9px 14px', textAlign:'right', fontFamily:'Syne,sans-serif', fontWeight:700, color:'#E53E3E' }}>J${Number(b.balance||b.amount_due-b.amount_paid).toLocaleString()}</td>
                            <td style={{ padding:'9px 14px', textAlign:'right' }}><span style={badgeStyle(COMPLIANCE_STYLE, b.status||'UNKNOWN')}>{b.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Evidence */}
              <div>
                <p style={sectionHead}>Evidence Files</p>
                <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                  <input placeholder="Notes (optional)" value={uploadNotes} onChange={e => setUploadNotes(e.target.value)} style={{ ...inputStyle, flex:1 }}
                    onFocus={e => { e.target.style.borderColor='#2979FF'; }} onBlur={e => { e.target.style.borderColor='#DDE3F0'; }} />
                  <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display:'none' }} onChange={handleUpload} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} className="vg-btn-primary" style={{ padding:'9px 16px', borderRadius:'8px', whiteSpace:'nowrap', opacity: uploading?.55:1 }}>
                    {uploading ? 'Uploading…' : '📎 Upload'}
                  </button>
                </div>
                {evidence.length===0 ? (
                  <p style={{ color:'#5C6A8A', fontSize:'0.78rem' }}>No evidence files yet.</p>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {evidence.map((f: any) => (
                      <div key={f.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', borderRadius:'8px', background:'#F5F8FF', border:'1px solid #DDE3F0' }}>
                        <div>
                          <p style={{ color:'#0d1326', fontSize:'0.8rem', fontFamily:'Syne,sans-serif', fontWeight:600, margin:0 }}>{f.file_name}</p>
                          {f.notes && <p style={{ color:'#5C6A8A', fontSize:'0.7rem', margin:'2px 0 0' }}>{f.notes}</p>}
                        </div>
                        <a href={f.url} target="_blank" rel="noreferrer" style={{ color:'#2979FF', fontSize:'0.75rem', fontFamily:'Syne,sans-serif', fontWeight:700, textDecoration:'none' }}>View →</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI */}
              <div>
                <p style={sectionHead}>AI Intelligence</p>
                <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                  <button onClick={() => genNarrative(selCase)} disabled={aiLoading==='narrative'} style={{ padding:'9px 16px', borderRadius:'8px', background:'#F5F3FF', border:'1.5px solid #DDD6FE', color:'#7C3AED', fontSize:'0.75rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer', opacity: aiLoading==='narrative' ? .6:1 }}>
                    🧠 {aiLoading==='narrative' ? 'Generating…' : 'Generate Narrative'}
                  </button>
                  <button onClick={() => genRisk(selCase)} disabled={aiLoading==='risk'} style={{ padding:'9px 16px', borderRadius:'8px', background:'#FFF7ED', border:'1.5px solid #FED7AA', color:'#EA580C', fontSize:'0.75rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer', opacity: aiLoading==='risk' ? .6:1 }}>
                    🛡 {aiLoading==='risk' ? 'Scoring…' : 'AI Risk Score'}
                  </button>
                </div>
                {aiRisk && !aiRisk.error && (
                  <div style={{ background:'#FFF7ED', border:'1.5px solid #FED7AA', borderRadius:'10px', padding:'14px', marginBottom:'10px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                      <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.82rem', color:'#EA580C' }}>Risk Assessment</span>
                      <span style={badgeStyle(RISK_STYLE, aiRisk.level||'UNKNOWN')}>{aiRisk.level} ({aiRisk.score}/100)</span>
                    </div>
                    <ul style={{ margin:'0 0 8px', paddingLeft:'16px' }}>{aiRisk.factors?.map((f: string, i: number) => <li key={i} style={{ color:'#92400E', fontSize:'0.78rem', marginBottom:'2px' }}>{f}</li>)}</ul>
                    <p style={{ color:'#92400E', fontSize:'0.78rem', fontFamily:'Syne,sans-serif', fontWeight:600, margin:0 }}>{aiRisk.recommendation}</p>
                  </div>
                )}
                {aiNarrative && (
                  <div style={{ background:'#F5F3FF', border:'1.5px solid #DDD6FE', borderRadius:'10px', padding:'14px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                      <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.82rem', color:'#7C3AED' }}>Compliance Narrative</span>
                      <button onClick={() => navigator.clipboard.writeText(aiNarrative)} style={{ background:'transparent', border:'1px solid #DDD6FE', borderRadius:'6px', color:'#7C3AED', fontSize:'0.7rem', fontFamily:'Syne,sans-serif', fontWeight:700, padding:'3px 10px', cursor:'pointer' }}>Copy</button>
                    </div>
                    <p style={{ color:'#3B0764', fontSize:'0.78rem', lineHeight:1.7, whiteSpace:'pre-wrap', margin:0 }}>{aiNarrative}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position:'fixed', inset:0, background:'rgba(13,19,38,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'480px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(13,19,38,0.25)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.5rem', borderBottom:'1.5px solid #F0F4FF' }}>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1rem', color:'#0d1326', margin:0 }}>New Property Case</h2>
              <button onClick={() => { setShowCreate(false); reset(); }} style={{ background:'#F5F8FF', border:'1.5px solid #DDE3F0', borderRadius:'8px', width:'32px', height:'32px', cursor:'pointer', fontSize:'1.1rem', color:'#5C6A8A', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            <form onSubmit={handleSubmit(d => createMutation.mutate(d))} style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={labelStyle}>Area</label>
                <select {...register('areaId')} style={inputStyle}>
                  <option value="">Select area…</option>
                  {areas?.map((a: any) => <option key={a.id} value={a.id}>{a.name} — {a.parish}</option>)}
                </select>
              </div>
              {[
                { name:'valuationNumber', label:'Valuation Number', ph:'105C-2W-06-038' },
                { name:'ownerName',       label:'Owner Name',       ph:'Full legal name' },
                { name:'propertyAddress', label:'Property Address', ph:'Full address' },
              ].map(f => (
                <div key={f.name}>
                  <label style={labelStyle}>{f.label}</label>
                  <input {...register(f.name as any)} placeholder={f.ph} style={inputStyle}
                    onFocus={e => { e.target.style.borderColor='#2979FF'; e.target.style.boxShadow='0 0 0 3px rgba(41,121,255,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor='#DDE3F0'; e.target.style.boxShadow='none'; }} />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Property Type</label>
                <select {...register('propertyType')} style={inputStyle}>
                  {['RESIDENTIAL','COMMERCIAL','INDUSTRIAL','AGRICULTURAL','MIXED_USE','VACANT_LAND','GOVERNMENT','INSTITUTIONAL','OTHER'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={labelStyle}>Tax Year</label>
                  <input type="number" {...register('taxYear', { valueAsNumber:true })} style={inputStyle}
                    onFocus={e => { e.target.style.borderColor='#2979FF'; }} onBlur={e => { e.target.style.borderColor='#DDE3F0'; }} />
                </div>
                <div>
                  <label style={labelStyle}>Amount Due (J$)</label>
                  <input type="number" step="0.01" {...register('amountDue', { valueAsNumber:true })} style={inputStyle}
                    onFocus={e => { e.target.style.borderColor='#2979FF'; }} onBlur={e => { e.target.style.borderColor='#DDE3F0'; }} />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting || createMutation.isPending} className="vg-btn-primary" style={{ padding:'12px', borderRadius:'9px', marginTop:'4px' }}>
                {createMutation.isPending ? 'Creating…' : 'Create Case'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
