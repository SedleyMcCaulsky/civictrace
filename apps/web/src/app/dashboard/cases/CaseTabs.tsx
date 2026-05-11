'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { S, C, F, badge, badgeForStatus } from '@/lib/styles';

const TABS = ['summons','plans','relief','strata'] as const;
const TAB_LABELS: Record<string,string> = {
  summons:'Summons History', plans:'Payment Plans', relief:'Relief Applications', strata:'Strata Lots'
};

const inp = S.input;
const lbl = S.label;

function SummonsTab({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ courtDate:'', notes:'' });
  const [error, setError] = useState('');

  const { data: summons, isLoading } = useQuery({
    queryKey: ['case-summons', caseId],
    queryFn: async () => (await api.get(`/summons/cases/${caseId}`)).data,
  });

  const { data: check } = useQuery({
    queryKey: ['case-summons-check', caseId],
    queryFn: async () => (await api.get(`/summons/cases/${caseId}/check`)).data,
  });

  const issueMutation = useMutation({
    mutationFn: async () => (await api.post(`/summons/cases/${caseId}/issue`, form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['case-summons', caseId] }); qc.invalidateQueries({ queryKey: ['case-summons-check', caseId] }); setShowForm(false); setForm({ courtDate:'', notes:'' }); setError(''); },
    onError: (e: any) => setError(e.response?.data?.message || 'Failed'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: any) => (await api.patch(`/summons/${id}/status`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['case-summons', caseId] }),
  });

  const STATUS_OPTS = ['ISSUED','SERVED','COURT_DATE_SET','WITHDRAWN','SETTLED','JUDGEMENT'];

  return (
    <div>
      {check && (
        <div style={{ marginBottom:'1rem', padding:'12px 14px', borderRadius:'10px', background: check.eligible ? C.redBg : C.surface, border: `1.5px solid ${check.eligible ? C.redBd : C.border}` }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.78rem', color: check.eligible ? C.red : C.muted, margin:'0 0 2px' }}>
                {check.eligible ? 'Eligible for Summons' : 'Not Eligible'}
              </p>
              <p style={{ fontFamily:F.body, fontSize:'0.75rem', color:C.muted, margin:0 }}>{check.reason}</p>
              <p style={{ fontFamily:F.body, fontSize:'0.72rem', color:C.muted, margin:'3px 0 0' }}>
                Visits this FY: <strong>{check.visitCount}</strong> · Outstanding: <strong style={{ color:C.red }}>J${Number(check.outstanding||0).toLocaleString()}</strong>
                {check.previousSummonsCount > 0 && <span style={{ color:C.red, marginLeft:'8px' }}>⚠ {check.previousSummonsCount} previous summons</span>}
              </p>
            </div>
            {check.eligible && (
              <button onClick={() => setShowForm(true)} style={{ ...S.btnPrimary, background:C.red, padding:'7px 14px', fontSize:'0.68rem' }}>Issue Summons</button>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ background:C.redBg, border:`1.5px solid ${C.redBd}`, borderRadius:'10px', padding:'14px', marginBottom:'1rem', display:'flex', flexDirection:'column', gap:'10px' }}>
          {error && <p style={{ fontFamily:F.body, fontSize:'0.75rem', color:C.red, margin:0 }}>⚠ {error}</p>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div><label style={lbl}>Court Date (optional)</label><input type="date" value={form.courtDate} onChange={e => setForm(f => ({...f, courtDate:e.target.value}))} style={inp} /></div>
            <div><label style={lbl}>Notes</label><input value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} placeholder="Notes…" style={inp} /></div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => { setShowForm(false); setError(''); }} style={{ ...S.btnSecondary, flex:1 }}>Cancel</button>
            <button onClick={() => issueMutation.mutate()} disabled={issueMutation.isPending} style={{ ...S.btnPrimary, flex:2, background:C.red, opacity: issueMutation.isPending ? .6:1 }}>
              {issueMutation.isPending ? 'Issuing…' : 'Issue Summons'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <p style={{ ...S.muted, textAlign:'center', padding:'1rem' }}>Loading…</p>}
      {!isLoading && (!summons || summons.length === 0) && <p style={{ ...S.muted, textAlign:'center', padding:'1.5rem' }}>No summons on record for this case.</p>}
      {summons?.length > 0 && (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Summons No.','FY','Issued','Court Date','Prev','Status','Update'].map(h => <th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {summons.map((s: any) => (
              <tr key={s.id} onMouseEnter={e=>(e.currentTarget.style.background=C.surface)} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                <td style={{ ...S.td, fontFamily:F.display, fontWeight:700, fontSize:'0.78rem' }}>{s.summons_number}</td>
                <td style={S.tdMuted}>{s.financial_year}</td>
                <td style={{ ...S.tdMuted, whiteSpace:'nowrap' }}>{s.issued_date ? new Date(s.issued_date).toLocaleDateString('en-JM') : '—'}</td>
                <td style={{ ...S.tdMuted, whiteSpace:'nowrap' }}>{s.court_date ? new Date(s.court_date).toLocaleDateString('en-JM') : '—'}</td>
                <td style={{ ...S.td, textAlign:'center' }}>
                  {parseInt(s.previous_summons_count) > 0 ? <span style={badge('red')}>{s.previous_summons_count}</span> : <span style={badge('muted')}>0</span>}
                </td>
                <td style={S.td}><span style={badgeForStatus(s.status)}>{s.status?.replace('_',' ')}</span></td>
                <td style={S.td}>
                  <select value={s.status} onChange={e => statusMutation.mutate({ id:s.id, status:e.target.value })}
                    style={{ fontFamily:F.body, fontSize:'0.72rem', padding:'3px 6px', borderRadius:'5px', border:`1px solid ${C.border}`, background:C.surface, color:C.text, cursor:'pointer' }}>
                    {STATUS_OPTS.map(st => <option key={st} value={st}>{st.replace('_',' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PlansTab({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ totalArrears:'', downPayment:'0', monthlyInstalment:'', planStartDate:'', planEndDate:'', termsNotes:'' });
  const [error, setError] = useState('');

  const { data: plans, isLoading } = useQuery({
    queryKey: ['case-plans', caseId],
    queryFn: async () => (await api.get(`/compliance-ops/cases/${caseId}/payment-plans`)).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post(`/compliance-ops/cases/${caseId}/payment-plan`, {
      totalArrears: parseFloat(form.totalArrears),
      downPayment: parseFloat(form.downPayment || '0'),
      monthlyInstalment: parseFloat(form.monthlyInstalment),
      planStartDate: form.planStartDate,
      planEndDate: form.planEndDate,
      termsNotes: form.termsNotes || null,
    })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['case-plans', caseId] }); setShowForm(false); setForm({ totalArrears:'', downPayment:'0', monthlyInstalment:'', planStartDate:'', planEndDate:'', termsNotes:'' }); setError(''); },
    onError: (e: any) => setError(e.response?.data?.message || 'Failed'),
  });

  const payMutation = useMutation({
    mutationFn: async ({ instId, amount, receipt }: any) => (await api.patch(`/compliance-ops/instalments/${instId}/payment`, { amountPaid: parseFloat(amount), receiptNumber: receipt })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['case-plans', caseId] }),
  });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1rem' }}>
        <button onClick={() => setShowForm(!showForm)} style={S.btnPrimary}>+ New Payment Plan</button>
      </div>

      {showForm && (
        <div style={{ background:C.blueBg, border:`1.5px solid ${C.blueBd}`, borderRadius:'10px', padding:'14px', marginBottom:'1rem' }}>
          {error && <p style={{ color:C.red, fontFamily:F.body, fontSize:'0.75rem', margin:'0 0 8px' }}>⚠ {error}</p>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            {[
              { key:'totalArrears', label:'Total Arrears (J$)', type:'number', ph:'e.g. 150000' },
              { key:'downPayment', label:'Down Payment (J$)', type:'number', ph:'0' },
              { key:'monthlyInstalment', label:'Monthly Instalment (J$)', type:'number', ph:'e.g. 12500' },
              { key:'planStartDate', label:'Start Date', type:'date', ph:'' },
              { key:'planEndDate', label:'End Date', type:'date', ph:'' },
            ].map(f => (
              <div key={f.key}>
                <label style={lbl}>{f.label}</label>
                <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(x => ({...x, [f.key]:e.target.value}))} placeholder={f.ph} style={inp} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom:'10px' }}>
            <label style={lbl}>Terms & Notes</label>
            <textarea rows={2} value={form.termsNotes} onChange={e => setForm(x => ({...x, termsNotes:e.target.value}))} placeholder="Any special terms or conditions…" style={{ ...inp, resize:'none' }} />
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => { setShowForm(false); setError(''); }} style={{ ...S.btnSecondary, flex:1 }}>Cancel</button>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.totalArrears || !form.monthlyInstalment || !form.planStartDate || !form.planEndDate}
              style={{ ...S.btnPrimary, flex:2, opacity: (!form.totalArrears || !form.monthlyInstalment) ? .5:1 }}>
              {createMutation.isPending ? 'Creating…' : 'Create Plan'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <p style={{ ...S.muted, textAlign:'center', padding:'1rem' }}>Loading…</p>}
      {!isLoading && (!plans || plans.length === 0) && <p style={{ ...S.muted, textAlign:'center', padding:'1.5rem' }}>No payment plans for this case.</p>}

      {plans?.map((plan: any) => (
        <div key={plan.id} style={{ border:`1.5px solid ${C.border}`, borderRadius:'10px', marginBottom:'1rem', overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:C.surface, borderBottom:`1px solid ${C.border}` }}>
            <div>
              <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.82rem', color:C.text, margin:0 }}>
                J${Number(plan.total_arrears).toLocaleString()} over {plan.total_months} months
              </p>
              <p style={{ fontFamily:F.body, fontSize:'0.72rem', color:C.muted, margin:'2px 0 0' }}>
                J${Number(plan.monthly_instalment).toLocaleString()}/month · {plan.plan_start_date?.slice(0,10)} → {plan.plan_end_date?.slice(0,10)}
                {plan.down_payment > 0 && ` · Down: J${Number(plan.down_payment).toLocaleString()}`}
              </p>
            </div>
            <span style={badge(plan.status==='COMPLETED'?'green':plan.status==='DEFAULTED'?'red':plan.status==='CANCELLED'?'muted':'blue')}>{plan.status}</span>
          </div>
          {plan.terms_notes && <p style={{ fontFamily:F.body, fontSize:'0.75rem', color:C.muted, padding:'8px 14px', margin:0, borderBottom:`1px solid ${C.border}` }}>{plan.terms_notes}</p>}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                {['Due Date','Amount Due','Amount Paid','Status','Receipt','Action'].map(h => <th key={h} style={{ ...S.th, fontSize:'0.55rem' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {plan.instalments?.map((inst: any, i: number) => {
                  const isPaid = inst.status === 'PAID';
                  const isOverdue = inst.status !== 'PAID' && new Date(inst.due_date) < new Date();
                  return (
                    <tr key={inst.id} style={{ background: i%2===0 ? C.card : C.surface }}>
                      <td style={{ ...S.tdMuted, fontSize:'0.75rem', whiteSpace:'nowrap' }}>{inst.due_date?.slice(0,10)}</td>
                      <td style={{ ...S.td, fontSize:'0.75rem', fontFamily:F.display, fontWeight:600 }}>J${Number(inst.amount_due).toLocaleString()}</td>
                      <td style={{ ...S.td, fontSize:'0.75rem', color: isPaid ? C.green : C.muted }}>J${Number(inst.amount_paid||0).toLocaleString()}</td>
                      <td style={{ ...S.td, fontSize:'0.75rem' }}>
                        <span style={badge(isPaid?'green':isOverdue?'red':inst.status==='PARTIAL'?'amber':'muted')}>
                          {isOverdue && !isPaid ? 'OVERDUE' : inst.status}
                        </span>
                      </td>
                      <td style={{ ...S.tdMuted, fontSize:'0.72rem' }}>{inst.receipt_number || '—'}</td>
                      <td style={{ ...S.td, fontSize:'0.72rem' }}>
                        {!isPaid && (
                          <button onClick={() => {
                            const amount = prompt('Amount paid (J$):');
                            const receipt = prompt('Receipt number:');
                            if (amount) payMutation.mutate({ instId: inst.id, amount, receipt: receipt || '' });
                          }} style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.62rem', padding:'3px 10px', borderRadius:'5px', border:`1px solid ${C.greenBd}`, background:C.greenBg, color:C.green, cursor:'pointer' }}>
                            Record Payment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReliefTab({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ applicantName:'', reliefType:'HARDSHIP', amountRequested:'', financialYear:'', applicationDate: new Date().toISOString().split('T')[0], notes:'' });
  const [error, setError] = useState('');

  const { data: reliefs, isLoading } = useQuery({
    queryKey: ['case-relief', caseId],
    queryFn: async () => (await api.get(`/compliance-ops/cases/${caseId}/relief`)).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post(`/compliance-ops/cases/${caseId}/relief`, {
      applicantName: form.applicantName,
      reliefType: form.reliefType,
      amountRequested: form.amountRequested ? parseFloat(form.amountRequested) : null,
      financialYear: form.financialYear || null,
      applicationDate: form.applicationDate,
      notes: form.notes || null,
    })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['case-relief', caseId] }); setShowForm(false); setError(''); },
    onError: (e: any) => setError(e.response?.data?.message || 'Failed'),
  });

  const decideMutation = useMutation({
    mutationFn: async ({ id, status, amount, notes }: any) => (await api.patch(`/compliance-ops/relief/${id}`, { status, amountApproved: amount ? parseFloat(amount) : null, decisionDate: new Date().toISOString().split('T')[0], decisionNotes: notes })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['case-relief', caseId] }),
  });

  const RELIEF_TYPES = ['HARDSHIP','PENSIONER','DISABILITY','ELDERLY','OTHER'];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1rem' }}>
        <button onClick={() => setShowForm(!showForm)} style={S.btnPrimary}>+ New Relief Application</button>
      </div>

      {showForm && (
        <div style={{ background:C.amberBg, border:`1.5px solid ${C.amberBd}`, borderRadius:'10px', padding:'14px', marginBottom:'1rem' }}>
          {error && <p style={{ color:C.red, fontFamily:F.body, fontSize:'0.75rem', margin:'0 0 8px' }}>⚠ {error}</p>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div><label style={lbl}>Applicant Name</label><input value={form.applicantName} onChange={e => setForm(x => ({...x, applicantName:e.target.value}))} style={inp} /></div>
            <div>
              <label style={lbl}>Relief Type</label>
              <select value={form.reliefType} onChange={e => setForm(x => ({...x, reliefType:e.target.value}))} style={inp}>
                {RELIEF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Amount Requested (J$)</label><input type="number" value={form.amountRequested} onChange={e => setForm(x => ({...x, amountRequested:e.target.value}))} placeholder="Optional" style={inp} /></div>
            <div><label style={lbl}>Financial Year</label><input value={form.financialYear} onChange={e => setForm(x => ({...x, financialYear:e.target.value}))} placeholder="e.g. 2025-2026" style={inp} /></div>
            <div><label style={lbl}>Application Date</label><input type="date" value={form.applicationDate} onChange={e => setForm(x => ({...x, applicationDate:e.target.value}))} style={inp} /></div>
          </div>
          <div style={{ marginBottom:'10px' }}>
            <label style={lbl}>Notes / Supporting Information</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(x => ({...x, notes:e.target.value}))} placeholder="Describe the grounds for relief…" style={{ ...inp, resize:'none' }} />
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => { setShowForm(false); setError(''); }} style={{ ...S.btnSecondary, flex:1 }}>Cancel</button>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.applicantName}
              style={{ ...S.btnPrimary, flex:2, background:C.amber, opacity: !form.applicantName ? .5:1 }}>
              {createMutation.isPending ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <p style={{ ...S.muted, textAlign:'center', padding:'1rem' }}>Loading…</p>}
      {!isLoading && (!reliefs || reliefs.length === 0) && <p style={{ ...S.muted, textAlign:'center', padding:'1.5rem' }}>No relief applications for this case.</p>}

      {reliefs?.map((r: any) => (
        <div key={r.id} style={{ border:`1.5px solid ${C.border}`, borderRadius:'10px', padding:'12px 14px', marginBottom:'10px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'8px' }}>
            <div>
              <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.82rem', color:C.text, margin:0 }}>{r.applicant_name} — {r.relief_type}</p>
              <p style={{ fontFamily:F.body, fontSize:'0.72rem', color:C.muted, margin:'2px 0 0' }}>
                Applied: {r.application_date?.slice(0,10)} {r.financial_year && `· FY ${r.financial_year}`}
                {r.amount_requested && ` · Requested: J$${Number(r.amount_requested).toLocaleString()}`}
              </p>
            </div>
            <span style={badge(r.status==='APPROVED'?'green':r.status==='REJECTED'?'red':r.status==='UNDER_REVIEW'?'blue':'amber')}>{r.status}</span>
          </div>
          {r.decision_notes && <p style={{ fontFamily:F.body, fontSize:'0.75rem', color:C.muted, margin:'4px 0 0' }}>Decision: {r.decision_notes}</p>}
          {r.amount_approved && <p style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.78rem', color:C.green, margin:'4px 0 0' }}>Approved: J${Number(r.amount_approved).toLocaleString()}</p>}
          {r.status === 'PENDING' && (
            <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
              <button onClick={() => {
                const amount = prompt('Amount approved (J$):');
                const notes = prompt('Decision notes:');
                if (notes !== null) decideMutation.mutate({ id: r.id, status:'APPROVED', amount, notes });
              }} style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.65rem', padding:'5px 12px', borderRadius:'6px', border:`1px solid ${C.greenBd}`, background:C.greenBg, color:C.green, cursor:'pointer' }}>Approve</button>
              <button onClick={() => {
                const notes = prompt('Reason for rejection:');
                if (notes !== null) decideMutation.mutate({ id: r.id, status:'REJECTED', amount: null, notes });
              }} style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.65rem', padding:'5px 12px', borderRadius:'6px', border:`1px solid ${C.redBd}`, background:C.redBg, color:C.red, cursor:'pointer' }}>Reject</button>
              <button onClick={() => decideMutation.mutate({ id: r.id, status:'UNDER_REVIEW', amount: null, notes: 'Under review' })}
                style={{ fontFamily:F.display, fontWeight:700, fontSize:'0.65rem', padding:'5px 12px', borderRadius:'6px', border:`1px solid ${C.blueBd}`, background:C.blueBg, color:C.blue, cursor:'pointer' }}>Mark Under Review</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StrataTab({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ strataPlanNumber:'', lotNumber:'', unitNumber:'', floorLevel:'', ownerName:'', ownerContact:'', areaSqm:'' });

  const { data: lots, isLoading } = useQuery({
    queryKey: ['case-strata', caseId],
    queryFn: async () => (await api.get(`/compliance-ops/cases/${caseId}/strata-lots`)).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post(`/compliance-ops/cases/${caseId}/strata-lot`, {
      strataPlanNumber: form.strataPlanNumber,
      lotNumber: form.lotNumber,
      unitNumber: form.unitNumber || null,
      floorLevel: form.floorLevel || null,
      ownerName: form.ownerName || null,
      ownerContact: form.ownerContact || null,
      areaSqm: form.areaSqm ? parseFloat(form.areaSqm) : null,
    })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['case-strata', caseId] }); setShowForm(false); },
  });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1rem' }}>
        <button onClick={() => setShowForm(!showForm)} style={S.btnPrimary}>+ Add Strata Lot</button>
      </div>

      {showForm && (
        <div style={{ background:C.blueBg, border:`1.5px solid ${C.blueBd}`, borderRadius:'10px', padding:'14px', marginBottom:'1rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            {[
              { key:'strataPlanNumber', label:'Strata Plan Number', ph:'SP-2045-KGN' },
              { key:'lotNumber', label:'Lot Number', ph:'Lot 12' },
              { key:'unitNumber', label:'Unit Number', ph:'Unit 3B' },
              { key:'floorLevel', label:'Floor Level', ph:'3rd Floor' },
              { key:'ownerName', label:'Lot Owner Name', ph:'Jane Smith' },
              { key:'ownerContact', label:'Owner Contact', ph:'876-555-0001' },
              { key:'areaSqm', label:'Area (sqm)', ph:'85.5' },
            ].map(f => (
              <div key={f.key}>
                <label style={lbl}>{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(x => ({...x, [f.key]:e.target.value}))} placeholder={f.ph} style={inp} type={f.key==='areaSqm'?'number':'text'} />
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => setShowForm(false)} style={{ ...S.btnSecondary, flex:1 }}>Cancel</button>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.strataPlanNumber || !form.lotNumber}
              style={{ ...S.btnPrimary, flex:2, opacity: (!form.strataPlanNumber || !form.lotNumber) ? .5:1 }}>
              {createMutation.isPending ? 'Adding…' : 'Add Lot'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <p style={{ ...S.muted, textAlign:'center', padding:'1rem' }}>Loading…</p>}
      {!isLoading && (!lots || lots.length === 0) && <p style={{ ...S.muted, textAlign:'center', padding:'1.5rem' }}>No strata lots registered for this case.</p>}

      {lots?.length > 0 && (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Strata Plan','Lot No.','Unit','Floor','Owner','Contact','Area (sqm)'].map(h => <th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {lots.map((lot: any, i: number) => (
              <tr key={lot.id} style={{ background: i%2===0 ? C.card : C.surface }}>
                <td style={{ ...S.td, fontFamily:F.display, fontWeight:700, fontSize:'0.78rem' }}>{lot.strata_plan_number}</td>
                <td style={{ ...S.td, fontFamily:F.display, fontWeight:600 }}>{lot.lot_number}</td>
                <td style={S.tdMuted}>{lot.unit_number || '—'}</td>
                <td style={S.tdMuted}>{lot.floor_level || '—'}</td>
                <td style={S.td}>{lot.owner_name || '—'}</td>
                <td style={S.tdMuted}>{lot.owner_contact || '—'}</td>
                <td style={S.tdMuted}>{lot.area_sqm ? `${lot.area_sqm} m²` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function CaseTabs({ caseId }: { caseId: string }) {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('summons');

  return (
    <div style={{ marginTop:'1.5rem', borderTop:`2px solid ${C.border}`, paddingTop:'1.25rem' }}>
      {/* Tab bar */}
      <div style={{ display:'flex', gap:'2px', background:C.surface, padding:'4px', borderRadius:'10px', width:'fit-content', marginBottom:'1.25rem', border:`1.5px solid ${C.border}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding:'6px 14px', borderRadius:'7px', fontFamily:F.display, fontWeight:700, fontSize:'0.68rem', letterSpacing:'0.06em', textTransform:'uppercase', border:'none', cursor:'pointer', transition:'all .15s', background:activeTab===t?C.card:'transparent', color:activeTab===t?C.blue:C.muted, boxShadow:activeTab===t?'0 1px 3px rgba(13,19,38,0.08)':'none' }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ minHeight:'160px' }}>
        {activeTab === 'summons' && <SummonsTab caseId={caseId} />}
        {activeTab === 'plans'   && <PlansTab   caseId={caseId} />}
        {activeTab === 'relief'  && <ReliefTab  caseId={caseId} />}
        {activeTab === 'strata'  && <StrataTab  caseId={caseId} />}
      </div>
    </div>
  );
}
