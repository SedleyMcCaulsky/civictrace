'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { S, C, F, badge } from '@/lib/styles';

export default function UsersPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const { data: users, isLoading } = useQuery({ queryKey:['users'], queryFn: async () => (await api.get('/users')).data });
  const { data: roles } = useQuery({ queryKey:['roles'], queryFn: async () => (await api.get('/users/roles')).data });
  const { register, handleSubmit, reset } = useForm<any>();

  const createMutation = useMutation({
    mutationFn: async (d: any) => (await api.post('/users', d)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['users'] }); setShowCreate(false); reset(); },
  });

  return (
    <div style={S.page}>
      <div style={{ ...S.pageHeader, marginBottom:'1.5rem' }}>
        <div>
          <h1 style={S.h1}>User Management</h1>
          <p style={{ ...S.muted, marginTop:'4px' }}>{users?.length ?? 0} users</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={S.btnPrimary}>+ New User</button>
      </div>

      <div style={{ ...S.card, overflow:'hidden' }}>
        <table>
          <thead><tr>
            {['Name','Email','Role','Region','Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} style={{ ...S.td, textAlign:'center', padding:'3rem', color:C.muted }}>Loading…</td></tr>}
            {users?.map((u: any) => (
              <tr key={u.id} onMouseEnter={e => (e.currentTarget.style.background=C.surface)} onMouseLeave={e => (e.currentTarget.style.background='')}>
                <td style={{ ...S.td, fontFamily:F.display, fontWeight:600 }}>{u.full_name}</td>
                <td style={S.tdMuted}>{u.email}</td>
                <td style={S.td}>{u.role_name}</td>
                <td style={S.tdMuted}>{u.region || '—'}</td>
                <td style={S.td}><span style={u.is_active ? badge('green') : badge('red')}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div style={{ position:'fixed', inset:0, background:'rgba(13,19,38,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'1rem' }}>
          <div style={{ ...S.card, width:'100%', maxWidth:'440px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.5rem', borderBottom:`1.5px solid ${C.border}` }}>
              <h2 style={S.h2}>Create User</h2>
              <button onClick={() => { setShowCreate(false); reset(); }} style={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:'8px', width:'32px', height:'32px', cursor:'pointer', fontSize:'1.1rem', color:C.muted, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            <form onSubmit={handleSubmit(d => createMutation.mutate(d))} style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'14px' }}>
              {createMutation.isError && <div style={{ background:C.redBg, border:`1px solid ${C.redBd}`, borderRadius:'8px', padding:'10px 14px', color:C.red, fontSize:'0.78rem' }}>{(createMutation.error as any)?.response?.data?.message || 'Failed'}</div>}
              {[
                { name:'fullName',         label:'Full Name',         ph:'John Brown' },
                { name:'email',            label:'Email',             ph:'john@valugrid.gov.jm' },
                { name:'employeeNumber',   label:'Employee Number',   ph:'EMP-001' },
                { name:'region',           label:'Region',            ph:'SOUTH' },
                { name:'temporaryPassword',label:'Temporary Password',ph:'Min 12 characters' },
              ].map(f => (
                <div key={f.name}>
                  <label style={S.label}>{f.label}</label>
                  <input {...register(f.name, { required:!['employeeNumber','region'].includes(f.name) })} placeholder={f.ph} style={S.input} />
                </div>
              ))}
              <div>
                <label style={S.label}>Role</label>
                <select {...register('roleId', { required:true })} style={S.input}>
                  <option value="">Select role…</option>
                  {roles?.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={createMutation.isPending} style={{ ...S.btnPrimary, padding:'12px', borderRadius:'9px', opacity: createMutation.isPending ? .55:1 }}>
                {createMutation.isPending ? 'Creating…' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
