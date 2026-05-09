'use client';
export const dynamic = 'force-dynamic';


import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { Users, Plus, X } from 'lucide-react';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get('/users')).data });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: async () => (await api.get('/users/roles')).data });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.post('/users', data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setShowCreate(false); reset(); },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Users className="h-6 w-6" /> User Management</h1><p className="text-slate-500 text-sm mt-1">{users?.length ?? 0} users</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700"><Plus className="h-4 w-4" /> New User</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b"><tr>
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Region</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading && <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm">Loading...</td></tr>}
            {users?.map((u: any) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-medium text-slate-800">{u.full_name}</td>
                <td className="px-6 py-3 text-sm text-slate-600">{u.email}</td>
                <td className="px-6 py-3 text-sm text-slate-600">{u.role_name}</td>
                <td className="px-6 py-3 text-sm text-slate-500">{u.region || '—'}</td>
                <td className="px-6 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-slate-800">Create User</h2>
              <button onClick={() => { setShowCreate(false); reset(); }}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="p-6 space-y-4">
              {createMutation.isError && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{(createMutation.error as any)?.response?.data?.message || 'Failed'}</div>}
              {[
                { name: 'fullName', label: 'Full Name', placeholder: 'John Brown' },
                { name: 'email', label: 'Email', placeholder: 'john@civictrace.gov.jm' },
                { name: 'employeeNumber', label: 'Employee Number', placeholder: 'EMP-001' },
                { name: 'region', label: 'Region', placeholder: 'SOUTH' },
                { name: 'temporaryPassword', label: 'Temporary Password', placeholder: 'Min 12 characters' },
              ].map(f => (
                <div key={f.name}>
                  <label className="text-sm font-medium text-slate-700">{f.label}</label>
                  <input {...register(f.name, { required: !['employeeNumber','region'].includes(f.name) })} placeholder={f.placeholder} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-slate-700">Role</label>
                <select {...register('roleId', { required: true })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                  <option value="">Select role...</option>
                  {roles?.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={createMutation.isPending} className="w-full bg-slate-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
                {createMutation.isPending ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
