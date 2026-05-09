'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { S, C, F, badgeForStatus } from '@/lib/styles';

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ entityType:'', action:'' });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, filters],
    queryFn: async () => (await api.get('/audit/logs', { params:{ ...filters, page, limit:25 } })).data,
  });

  const logs = data?.data || [];
  const pg = data?.pagination;

  return (
    <div style={S.page}>
      <div style={{ ...S.pageHeader, marginBottom:'1.5rem' }}>
        <div>
          <h1 style={S.h1}>Audit Trail</h1>
          <p style={{ ...S.muted, marginTop:'4px' }}>Immutable record of all system actions — {pg?.total ?? 0} total events</p>
        </div>
      </div>

      <div style={{ ...S.card, padding:'12px 14px', marginBottom:'1.25rem', display:'flex', gap:'10px' }}>
        {[
          { val:filters.entityType, key:'entityType', ph:'All entity types', opts:['cases','delivery','reconciliation','users','auth'] },
          { val:filters.action,     key:'action',     ph:'All actions',      opts:['CREATE','UPDATE','DELETE','LOGIN','EXPORT'] },
        ].map(f => (
          <select key={f.key} value={f.val} onChange={e => { setFilters(x => ({...x,[f.key]:e.target.value})); setPage(1); }}
            style={{ ...S.input, width:'200px' }}>
            <option value="">{f.ph}</option>
            {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </div>

      <div style={{ ...S.card, overflow:'hidden', marginBottom:'1rem' }}>
        <table>
          <thead><tr>
            {['Time','Actor','Action','Entity','Description','IP'].map(h => <th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', padding:'3rem', color:C.muted }}>Loading…</td></tr>}
            {!isLoading && logs.length===0 && <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', padding:'3rem', color:C.muted }}>No audit events found.</td></tr>}
            {logs.map((log: any) => (
              <tr key={log.id} onMouseEnter={e => (e.currentTarget.style.background=C.surface)} onMouseLeave={e => (e.currentTarget.style.background='')}>
                <td style={{ ...S.tdMuted, whiteSpace:'nowrap' }}>{new Date(log.occurred_at).toLocaleString()}</td>
                <td style={S.td}>{log.actor_email || 'system'}</td>
                <td style={S.td}><span style={badgeForStatus(log.action)}>{log.action}</span></td>
                <td style={S.tdMuted}>{log.entity_type}</td>
                <td style={{ ...S.tdMuted, maxWidth:'240px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.description || log.composite_key}</td>
                <td style={{ ...S.tdMuted, fontSize:'0.75rem' }}>{log.ip_address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pg && pg.total > 25 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p style={S.muted}>Page {pg.page} — {pg.total} total</p>
          <div style={{ display:'flex', gap:'6px' }}>
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ ...S.btnSecondary, opacity: page===1 ? .4:1 }}>← Prev</button>
            <button onClick={() => setPage(p => p+1)} disabled={logs.length<25} style={{ ...S.btnSecondary, opacity: logs.length<25 ? .4:1 }}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
