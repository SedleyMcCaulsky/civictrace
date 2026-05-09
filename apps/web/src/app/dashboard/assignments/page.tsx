'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  PENDING:    { bg:'#FFFBEB', color:'#D97706', border:'#FDE68A' },
  IN_PROGRESS:{ bg:'#EEF3FF', color:'#2979FF', border:'#BFDBFE' },
  COMPLETE:   { bg:'#E6FBF4', color:'#059669', border:'#A7F3D0' },
  CANCELLED:  { bg:'#F1F5F9', color:'#64748B', border:'#E2E8F0' },
};

const inp = { width:'100%', padding:'9px 12px', borderRadius:'8px', background:'#FAFBFF', border:'1.5px solid #DDE3F0', color:'#0d1326', fontSize:'0.85rem', fontFamily:'DM Sans,sans-serif', outline:'none', boxSizing:'border-box' as const };
const lbl = { display:'block' as const, fontSize:'0.62rem', fontFamily:'Syne,sans-serif', fontWeight:700 as const, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'#5C6A8A', marginBottom:'6px' };

export default function AssignmentsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filterOfficer, setFilterOfficer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ officerId:'', areaId:'', assignmentDate: new Date().toISOString().split('T')[0], notes:'' });
  const [error, setError] = useState('');

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['all-assignments', filterOfficer, filterStatus],
    queryFn: async () => (await api.get('/delivery/assignments/all', {
      params: { officerId: filterOfficer||undefined, status: filterStatus||undefined }
    })).data,
  });

  const { data: officers } = useQuery({
    queryKey: ['officers'],
    queryFn: async () => (await api.get('/delivery/officers')).data,
  });

  const { data: areas } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => (await api.get('/cases/areas')).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post('/delivery/assignments/simple', form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-assignments'] });
      setShowCreate(false);
      setForm({ officerId:'', areaId:'', assignmentDate: new Date().toISOString().split('T')[0], notes:'' });
      setError('');
    },
    onError: (e: any) => setError(e.response?.data?.message || 'Failed to create assignment'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/delivery/assignments/${id}/remove`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-assignments'] }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id:string; status:string }) =>
      (await api.patch(`/delivery/assignments/${id}/status`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-assignments'] }),
  });

  const total = assignments?.length || 0;
  const pending = assignments?.filter((a: any) => a.status === 'PENDING').length || 0;
  const inProgress = assignments?.filter((a: any) => a.status === 'IN_PROGRESS').length || 0;
  const complete = assignments?.filter((a: any) => a.status === 'COMPLETE').length || 0;

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem' }}>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.4rem', fontWeight:800, color:'#0d1326', margin:0 }}>Officer Assignments</h1>
          <p style={{ color:'#5C6A8A', fontSize:'0.78rem', margin:'4px 0 0' }}>Assign field officers to operational areas</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ padding:'9px 18px', borderRadius:'9px', background:'#2979FF', color:'#fff', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.75rem', letterSpacing:'0.07em', textTransform:'uppercase', border:'none', cursor:'pointer' }}>
          + New Assignment
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'1.5rem' }}>
        {[
          { label:'Total',       value:total,      color:'#2979FF', bg:'#EEF3FF', border:'#BFDBFE' },
          { label:'Pending',     value:pending,    color:'#D97706', bg:'#FFFBEB', border:'#FDE68A' },
          { label:'In Progress', value:inProgress, color:'#2979FF', bg:'#EEF3FF', border:'#BFDBFE' },
          { label:'Complete',    value:complete,   color:'#059669', bg:'#E6FBF4', border:'#A7F3D0' },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, border:`1.5px solid ${s.border}`, borderRadius:'10px', padding:'12px 16px' }}>
            <p style={{ color:'#5C6A8A', fontSize:'0.6rem', letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:'Syne,sans-serif', margin:'0 0 6px' }}>{s.label}</p>
            <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.5rem', color:s.color, margin:0, lineHeight:1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background:'#fff', border:'1.5px solid #DDE3F0', borderRadius:'10px', padding:'12px 14px', marginBottom:'1.25rem', display:'flex', gap:'10px' }}>
        <select value={filterOfficer} onChange={e => setFilterOfficer(e.target.value)} style={{ ...inp, width:'220px' }}>
          <option value="">All officers</option>
          {officers?.map((o: any) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width:'160px' }}>
          <option value="">All statuses</option>
          {['PENDING','IN_PROGRESS','COMPLETE','CANCELLED'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        {(filterOfficer || filterStatus) && (
          <button onClick={() => { setFilterOfficer(''); setFilterStatus(''); }}
            style={{ padding:'8px 14px', borderRadius:'7px', background:'#F5F8FF', border:'1.5px solid #DDE3F0', color:'#5C6A8A', fontSize:'0.75rem', fontFamily:'Syne,sans-serif', fontWeight:700, cursor:'pointer' }}>
            Clear
          </button>
        )}
      </div>

      <div style={{ background:'#fff', border:'1.5px solid #DDE3F0', borderRadius:'12px', overflow:'hidden', boxShadow:'0 1px 4px rgba(13,19,38,0.06)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#F5F8FF', borderBottom:'1.5px solid #DDE3F0' }}>
              {['Date','Officer','Area','Parish','Cases','Progress','Status',''].map((h,i) => (
                <th key={i} style={{ padding:'10px 14px', textAlign:'left', fontSize:'0.6rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#5C6A8A' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} style={{ padding:'3rem', textAlign:'center', color:'#5C6A8A', fontSize:'0.85rem' }}>Loading…</td></tr>}
            {!isLoading && (!assignments || assignments.length === 0) && (
              <tr><td colSpan={8} style={{ padding:'3rem', textAlign:'center', color:'#5C6A8A', fontSize:'0.85rem' }}>
                No assignments yet. Create one to get started.
              </td></tr>
            )}
            {assignments?.map((a: any) => {
              const pct = a.total_cases > 0 ? Math.round((a.completed_cases / a.total_cases) * 100) : 0;
              const ss = STATUS_STYLE[a.status] || STATUS_STYLE.PENDING;
              return (
                <tr key={a.id} style={{ borderBottom:'1px solid #F0F4FF' }}
                  onMouseEnter={e => (e.currentTarget.style.background='#FAFBFF')}
                  onMouseLeave={e => (e.currentTarget.style.background='')}>
                  <td style={{ padding:'11px 14px', fontSize:'0.8rem', color:'#5C6A8A', whiteSpace:'nowrap' }}>
                    {new Date(a.assignment_date).toLocaleDateString('en-JM', { day:'numeric', month:'short', year:'numeric' })}
                  </td>
                  <td style={{ padding:'11px 14px' }}>
                    <p style={{ color:'#0d1326', fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:'0.82rem', margin:0 }}>{a.officer_name}</p>
                    {a.officer_region && <p style={{ color:'#5C6A8A', fontSize:'0.68rem', margin:'1px 0 0' }}>{a.officer_region}</p>}
                  </td>
                  <td style={{ padding:'11px 14px', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.82rem', color:'#0d1326' }}>{a.area_name}</td>
                  <td style={{ padding:'11px 14px', fontSize:'0.8rem', color:'#5C6A8A' }}>{a.parish}</td>
                  <td style={{ padding:'11px 14px', textAlign:'center', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.85rem', color:'#2979FF' }}>{a.total_cases || 0}</td>
                  <td style={{ padding:'11px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <div style={{ width:'60px', height:'4px', background:'#EEF3FF', borderRadius:'4px', overflow:'hidden' }}>
                        <div style={{ height:'100%', background:'#2979FF', borderRadius:'4px', width:`${pct}%` }} />
                      </div>
                      <span style={{ fontSize:'0.72rem', color:'#5C6A8A', fontFamily:'Syne,sans-serif', fontWeight:600 }}>{pct}%</span>
                    </div>
                  </td>
                  <td style={{ padding:'11px 14px' }}>
                    <select value={a.status} onChange={e => statusMutation.mutate({ id:a.id, status:e.target.value })}
                      style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}`, padding:'4px 8px', borderRadius:'5px', fontSize:'0.65rem', fontFamily:'Syne,sans-serif', fontWeight:700, cursor:'pointer' }}>
                      {['PENDING','IN_PROGRESS','COMPLETE','CANCELLED'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                    </select>
                  </td>
                  <td style={{ padding:'11px 14px' }}>
                    <button onClick={() => { if (confirm('Remove this assignment?')) deleteMutation.mutate(a.id); }}
                      style={{ background:'transparent', border:'1px solid #FECACA', borderRadius:'6px', color:'#E53E3E', fontSize:'0.7rem', fontFamily:'Syne,sans-serif', fontWeight:700, padding:'4px 10px', cursor:'pointer' }}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div style={{ position:'fixed', inset:0, background:'rgba(13,19,38,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'460px', boxShadow:'0 20px 60px rgba(13,19,38,0.2)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.5rem', borderBottom:'1.5px solid #F0F4FF' }}>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1rem', color:'#0d1326', margin:0 }}>New Assignment</h2>
              <button onClick={() => { setShowCreate(false); setError(''); }}
                style={{ background:'#F5F8FF', border:'1.5px solid #DDE3F0', borderRadius:'8px', width:'32px', height:'32px', cursor:'pointer', fontSize:'1.1rem', color:'#5C6A8A', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'14px' }}>
              {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:'8px', padding:'10px 14px', color:'#E53E3E', fontSize:'0.78rem' }}>⚠ {error}</div>}
              <div>
                <label style={lbl}>Field Officer</label>
                <select value={form.officerId} onChange={e => setForm(f => ({...f, officerId:e.target.value}))} style={inp}>
                  <option value="">Select officer…</option>
                  {officers?.map((o: any) => <option key={o.id} value={o.id}>{o.full_name}{o.region ? ` · ${o.region}` : ''}</option>)}
                </select>
                {officers?.length === 0 && <p style={{ color:'#D97706', fontSize:'0.72rem', margin:'4px 0 0' }}>No officers found. Create officer accounts in Users first.</p>}
              </div>
              <div>
                <label style={lbl}>Operational Area</label>
                <select value={form.areaId} onChange={e => setForm(f => ({...f, areaId:e.target.value}))} style={inp}>
                  <option value="">Select area…</option>
                  {areas?.map((a: any) => <option key={a.id} value={a.id}>{a.name} — {a.parish}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Assignment Date</label>
                <input type="date" value={form.assignmentDate} onChange={e => setForm(f => ({...f, assignmentDate:e.target.value}))} style={inp}
                  onFocus={e => e.target.style.borderColor='#2979FF'} onBlur={e => e.target.style.borderColor='#DDE3F0'} />
              </div>
              <div>
                <label style={lbl}>Notes (optional)</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))}
                  placeholder="Instructions for the officer…" style={{ ...inp, resize:'none' as const }}
                  onFocus={e => e.target.style.borderColor='#2979FF'} onBlur={e => e.target.style.borderColor='#DDE3F0'} />
              </div>
              {form.officerId && form.areaId && (
                <div style={{ background:'#EEF3FF', border:'1.5px solid #BFDBFE', borderRadius:'10px', padding:'12px 14px' }}>
                  <p style={{ color:'#2979FF', fontSize:'0.68rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', margin:'0 0 5px' }}>Preview</p>
                  <p style={{ color:'#0d1326', fontSize:'0.82rem', margin:0 }}>
                    <strong>{officers?.find((o: any) => o.id === form.officerId)?.full_name}</strong> → <strong>{areas?.find((a: any) => a.id === form.areaId)?.name}</strong>
                  </p>
                  <p style={{ color:'#5C6A8A', fontSize:'0.75rem', margin:'3px 0 0' }}>
                    {new Date(form.assignmentDate).toLocaleDateString('en-JM', { weekday:'long', day:'numeric', month:'long' })}
                  </p>
                </div>
              )}
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={() => { setShowCreate(false); setError(''); }}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', background:'transparent', border:'1.5px solid #DDE3F0', color:'#5C6A8A', fontSize:'0.78rem', fontFamily:'Syne,sans-serif', fontWeight:700, cursor:'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => createMutation.mutate()} disabled={!form.officerId || !form.areaId || createMutation.isPending}
                  style={{ flex:2, padding:'11px', borderRadius:'9px', background:(!form.officerId || !form.areaId) ? '#94a3b8':'#2979FF', color:'#fff', fontSize:'0.78rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', border:'none', cursor:(!form.officerId || !form.areaId) ? 'not-allowed':'pointer' }}>
                  {createMutation.isPending ? 'Creating…' : 'Create Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
