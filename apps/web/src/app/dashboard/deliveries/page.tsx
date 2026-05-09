'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';

// ── IndexedDB offline queue ───────────────────────────────────────
const DB_NAME = 'vg_offline', STORE = 'deliveries', DB_VER = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'localId', autoIncrement: true });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function queueOffline(payload: any) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ ...payload, queuedAt: Date.now(), synced: false });
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

async function getPendingQueue(): Promise<any[]> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => res(req.result.filter((r: any) => !r.synced));
    req.onerror = () => rej(req.error);
  });
}

async function markSynced(localId: number) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.get(localId);
    req.onsuccess = () => {
      const rec = req.result;
      if (rec) { rec.synced = true; store.put(rec); }
    };
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

async function syncPendingToAPI() {
  const queue = await getPendingQueue();
  let synced = 0;
  for (const item of queue) {
    try {
      await api.post('/delivery', item.payload);
      await markSynced(item.localId);
      synced++;
    } catch {}
  }
  return synced;
}

// ── Types & validation ────────────────────────────────────────────
const logSchema = z.object({
  propertyCaseId: z.string().uuid('Select a case'),
  status: z.enum(['DELIVERED','OWNER_ABSENT','REFUSED','VACANT','INCORRECT_ADDRESS','ACCESS_DENIED','DEMOLISHED','RESCHEDULED','ESCALATED']),
  recipientName: z.string().optional(),
  notes: z.string().optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
});

type LogForm = z.infer<typeof logSchema>;

const STATUS_OPTIONS = [
  { value:'DELIVERED',        label:'✅  Delivered',         fieldColor:'#16a34a' },
  { value:'OWNER_ABSENT',     label:'🕐  Owner Absent',       fieldColor:'#d97706' },
  { value:'REFUSED',          label:'🚫  Refused',            fieldColor:'#dc2626' },
  { value:'VACANT',           label:'🏚  Vacant',             fieldColor:'#6b7280' },
  { value:'INCORRECT_ADDRESS',label:'📍  Wrong Address',      fieldColor:'#ea580c' },
  { value:'ACCESS_DENIED',    label:'🔒  Access Denied',      fieldColor:'#dc2626' },
  { value:'DEMOLISHED',       label:'🏗  Demolished',          fieldColor:'#6b7280' },
  { value:'RESCHEDULED',      label:'📅  Rescheduled',        fieldColor:'#2563eb' },
  { value:'ESCALATED',        label:'⚠️  Escalated',           fieldColor:'#7c3aed' },
];

const STATUS_DARK: Record<string,string> = {
  DELIVERED:'rgba(0,229,160,0.12)', OWNER_ABSENT:'rgba(255,171,0,0.12)',
  REFUSED:'rgba(255,77,109,0.12)', VACANT:'rgba(255,255,255,0.06)',
  INCORRECT_ADDRESS:'rgba(255,100,0,0.12)', ACCESS_DENIED:'rgba(255,77,109,0.12)',
  ESCALATED:'rgba(167,139,250,0.12)', RESCHEDULED:'rgba(41,121,255,0.12)', DEMOLISHED:'rgba(255,255,255,0.06)',
};

// ── Component ─────────────────────────────────────────────────────
export default function DeliveryPage() {
  const queryClient = useQueryClient();
  const [showLog, setShowLog] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncMsg, setSyncMsg] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');
  const [fieldMode, setFieldMode] = useState(false);

  // Network detection
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  // Count pending queue
  useEffect(() => {
    getPendingQueue().then(q => setPendingCount(q.length)).catch(() => {});
  }, [showLog]);

  // Auto-sync when back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      setSyncMsg('Syncing offline logs…');
      syncPendingToAPI().then(n => {
        setSyncMsg(n > 0 ? `✓ ${n} delivery log${n>1?'s':''} synced` : '');
        getPendingQueue().then(q => setPendingCount(q.length));
        queryClient.invalidateQueries({ queryKey: ['assignments'] });
        setTimeout(() => setSyncMsg(''), 4000);
      });
    }
  }, [isOnline]);

  const { data: areas } = useQuery({ queryKey:['areas'], queryFn: async () => (await api.get('/cases/areas')).data, enabled: isOnline });
  const { data: casesData } = useQuery({ queryKey:['cases-search', caseSearch], queryFn: async () => (await api.get('/cases', { params:{ ownerName:caseSearch, limit:15 } })).data, enabled: isOnline && caseSearch.length > 1 });
  const { data: assignments } = useQuery({ queryKey:['assignments'], queryFn: async () => (await api.get('/delivery/assignments')).data, enabled: isOnline });

  const { register, handleSubmit, reset, setValue, watch, formState:{ errors } } = useForm<LogForm>({
    resolver: zodResolver(logSchema),
    defaultValues: { status: 'DELIVERED' },
  });

  const logMutation = useMutation({
    mutationFn: async (data: LogForm) => (await api.post('/delivery', data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:['assignments'] }); setShowLog(false); reset(); setCaseSearch(''); },
  });

  async function onSubmit(data: LogForm) {
    if (!isOnline) {
      await queueOffline({ payload: data });
      setPendingCount(c => c + 1);
      setShowLog(false); reset(); setCaseSearch('');
      setSyncMsg('📴 Saved offline — will sync when connected');
      setTimeout(() => setSyncMsg(''), 5000);
      return;
    }
    logMutation.mutate(data);
  }

  function captureGPS() {
    setGpsStatus('Getting location…');
    navigator.geolocation.getCurrentPosition(
      pos => { setValue('gpsLat', pos.coords.latitude); setValue('gpsLng', pos.coords.longitude); setGpsStatus(`📍 ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`); },
      () => setGpsStatus('GPS unavailable'),
      { timeout: 10000, maximumAge: 0 }
    );
  }

  const cases = casesData?.data || [];
  const selectedId = watch('propertyCaseId');
  const selectedStatus = watch('status');

  // ── Field mode (light, high contrast for outdoor use) ────────────
  const F = { bg:'#F0F4FF', card:'#FFFFFF', text:'#0d1326', muted:'#5C6A8A', border:'#D8E0F0', blue:'#2979FF', green:'#00C980', red:'#E53E3E', amber:'#D97706' };

  if (fieldMode) return (
    <div style={{ minHeight:'100vh', background:F.bg, fontFamily:'DM Sans, sans-serif', padding:'1rem' }}>
      {/* Field mode header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:F.card, border:`1px solid ${F.border}`, borderRadius:'12px', padding:'12px 16px', marginBottom:'1rem', boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
        <div>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.2rem' }}><span style={{ color:F.blue }}>VALU</span><span style={{ color:F.green }}>GRID</span></div>
          <div style={{ fontSize:'0.65rem', color:F.muted, letterSpacing:'0.1em', textTransform:'uppercase' }}>Field Mode</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          {pendingCount > 0 && <div style={{ background:'rgba(255,171,0,0.15)', border:'1px solid rgba(217,119,6,0.3)', borderRadius:'6px', padding:'4px 10px', fontSize:'0.72rem', color:F.amber, fontFamily:'Syne,sans-serif', fontWeight:700 }}>⚡ {pendingCount} pending</div>}
          <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.7rem', color: isOnline ? F.green : F.red, fontFamily:'Syne,sans-serif', fontWeight:700 }}>
            <div style={{ width:'7px', height:'7px', borderRadius:'50%', background: isOnline ? F.green : F.red, animation: isOnline ? 'none' : 'pulse-dot 1s infinite' }} />
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button onClick={() => setFieldMode(false)} style={{ padding:'6px 12px', borderRadius:'8px', background:'transparent', border:`1px solid ${F.border}`, color:F.muted, fontSize:'0.7rem', fontFamily:'Syne,sans-serif', fontWeight:700, cursor:'pointer' }}>Dashboard</button>
        </div>
      </div>

      {syncMsg && <div style={{ background: isOnline ? 'rgba(0,201,128,0.1)' : 'rgba(255,171,0,0.1)', border:`1px solid ${isOnline ? 'rgba(0,201,128,0.3)' : 'rgba(217,119,6,0.3)'}`, borderRadius:'10px', padding:'10px 16px', marginBottom:'1rem', fontSize:'0.82rem', color: isOnline ? F.green : F.amber, fontFamily:'Syne,sans-serif', fontWeight:600 }}>{syncMsg}</div>}

      {/* Log delivery button — prominent */}
      <button onClick={() => setShowLog(true)} style={{ width:'100%', padding:'18px', borderRadius:'12px', background:F.blue, color:'#fff', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1rem', letterSpacing:'0.06em', textTransform:'uppercase', border:'none', cursor:'pointer', marginBottom:'1rem', boxShadow:'0 4px 16px rgba(41,121,255,0.3)' }}>
        + Log Delivery
      </button>

      {/* Recent assignments */}
      {!isOnline && (
        <div style={{ background:F.card, border:`1px solid ${F.border}`, borderRadius:'12px', padding:'1.25rem', marginBottom:'1rem' }}>
          <p style={{ color:F.muted, fontSize:'0.8rem', textAlign:'center' }}>📴 Offline — previously loaded data shown below. New logs will sync when connected.</p>
        </div>
      )}

      {assignments && assignments.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {assignments.map((a: any) => (
            <div key={a.id} style={{ background:F.card, border:`1px solid ${F.border}`, borderRadius:'12px', padding:'1rem 1.25rem', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <p style={{ color:F.text, fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.9rem', margin:0 }}>{a.area_name}</p>
                  <p style={{ color:F.muted, fontSize:'0.75rem', margin:'2px 0 0' }}>{a.parish} · {new Date(a.assignment_date).toLocaleDateString()}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:F.blue, fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.1rem', margin:0 }}>{a.completed_cases}/{a.total_cases}</p>
                  <p style={{ color:F.muted, fontSize:'0.68rem', margin:'2px 0 0' }}>completed</p>
                </div>
              </div>
              <div style={{ marginTop:'10px', height:'4px', background:'#E8EEF8', borderRadius:'4px', overflow:'hidden' }}>
                <div style={{ height:'100%', background:F.blue, borderRadius:'4px', width:`${a.total_cases ? (a.completed_cases/a.total_cases)*100 : 0}%`, transition:'width .4s' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Field Log Modal */}
      {showLog && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end', zIndex:100 }}>
          <div style={{ background:F.card, width:'100%', borderRadius:'20px 20px 0 0', padding:'1.5rem', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ width:'40px', height:'4px', background:'#D8E0F0', borderRadius:'4px', margin:'0 auto 1.25rem' }} />
            <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.1rem', color:F.text, marginBottom:'1.25rem' }}>Log Delivery</h2>

            {!isOnline && <div style={{ background:'rgba(255,171,0,0.1)', border:'1px solid rgba(217,119,6,0.3)', borderRadius:'8px', padding:'10px 14px', marginBottom:'1rem', fontSize:'0.78rem', color:F.amber, fontFamily:'Syne,sans-serif', fontWeight:600 }}>📴 Offline — will sync when connected</div>}

            <form onSubmit={handleSubmit(onSubmit)} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              {/* Case search */}
              <div>
                <label style={{ display:'block', fontSize:'0.72rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:F.muted, marginBottom:'8px' }}>Search Property Case</label>
                <input placeholder="Type owner name…" value={caseSearch} onChange={e => setCaseSearch(e.target.value)} style={{ width:'100%', padding:'14px', borderRadius:'10px', background:'#F5F7FF', border:`1px solid ${F.border}`, color:F.text, fontSize:'1rem', fontFamily:'DM Sans,sans-serif', boxSizing:'border-box', outline:'none' }} />
                {cases.length > 0 && (
                  <div style={{ border:`1px solid ${F.border}`, borderRadius:'10px', overflow:'hidden', marginTop:'6px', maxHeight:'160px', overflowY:'auto' }}>
                    {cases.map((c: any) => (
                      <button key={c.id} type="button" onClick={() => { setValue('propertyCaseId', c.id); setCaseSearch(c.composite_key); }} style={{ width:'100%', textAlign:'left', padding:'12px 14px', background: selectedId === c.id ? 'rgba(41,121,255,0.08)' : '#fff', border:'none', borderBottom:`1px solid ${F.border}`, cursor:'pointer' }}>
                        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.85rem', color: selectedId === c.id ? F.blue : F.text }}>{c.composite_key}</div>
                        <div style={{ fontSize:'0.75rem', color:F.muted }}>{c.owner_name} · {c.property_address}</div>
                      </button>
                    ))}
                  </div>
                )}
                {errors.propertyCaseId && <p style={{ color:F.red, fontSize:'0.75rem', margin:'4px 0 0' }}>{errors.propertyCaseId.message}</p>}
              </div>

              {/* Status grid — large buttons */}
              <div>
                <label style={{ display:'block', fontSize:'0.72rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:F.muted, marginBottom:'8px' }}>Delivery Status</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                  {STATUS_OPTIONS.map(s => (
                    <button key={s.value} type="button" onClick={() => setValue('status', s.value as any)} style={{ padding:'14px 10px', borderRadius:'10px', border:`2px solid ${selectedStatus === s.value ? s.fieldColor : F.border}`, background: selectedStatus === s.value ? `${s.fieldColor}18` : '#F5F7FF', color: selectedStatus === s.value ? s.fieldColor : F.muted, fontSize:'0.82rem', fontFamily:'Syne,sans-serif', fontWeight:700, cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <input placeholder="Recipient name (if delivered)" style={{ padding:'14px', borderRadius:'10px', background:'#F5F7FF', border:`1px solid ${F.border}`, color:F.text, fontSize:'1rem', fontFamily:'DM Sans,sans-serif', outline:'none' }} {...register('recipientName')} />

              <textarea placeholder="Notes…" rows={3} style={{ padding:'14px', borderRadius:'10px', background:'#F5F7FF', border:`1px solid ${F.border}`, color:F.text, fontSize:'1rem', fontFamily:'DM Sans,sans-serif', outline:'none', resize:'none' }} {...register('notes')} />

              {/* GPS */}
              <button type="button" onClick={captureGPS} style={{ padding:'14px', borderRadius:'10px', background:'#F5F7FF', border:`1px solid ${F.border}`, color:F.blue, fontSize:'0.85rem', fontFamily:'Syne,sans-serif', fontWeight:700, cursor:'pointer' }}>
                📍 Capture GPS Location
              </button>
              {gpsStatus && <p style={{ color:F.green, fontSize:'0.78rem', fontFamily:'Syne,sans-serif', fontWeight:600, margin:'-6px 0 0' }}>{gpsStatus}</p>}

              <div style={{ display:'flex', gap:'10px' }}>
                <button type="button" onClick={() => { setShowLog(false); reset(); setCaseSearch(''); }} style={{ flex:1, padding:'16px', borderRadius:'12px', background:'transparent', border:`1px solid ${F.border}`, color:F.muted, fontSize:'0.85rem', fontFamily:'Syne,sans-serif', fontWeight:700, cursor:'pointer' }}>Cancel</button>
                <button type="submit" disabled={logMutation.isPending} className="vg-btn-field" style={{ flex:2, background: isOnline ? F.blue : F.amber, color:'#fff' }}>
                  {logMutation.isPending ? 'Logging…' : isOnline ? 'Log Delivery' : '📴 Save Offline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // ── Supervisor/desktop mode (dark) ────────────────────────────────
  const D = { bg:'#0d1326', card:'rgba(13,19,38,0.9)', text:'#EEF2FF', muted:'rgba(160,180,230,0.55)', border:'rgba(255,255,255,0.08)', blue:'#2979FF', green:'#00E5A0', red:'#FF4D6D', amber:'#FFAB00' };

  return (
    <div style={{ padding:'2rem 2.5rem', background:D.bg, minHeight:'100vh', fontFamily:'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.75rem' }}>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.5rem', fontWeight:700, color:D.text, margin:0 }}>Delivery Operations</h1>
          <p style={{ color:D.muted, fontSize:'0.78rem', margin:'4px 0 0' }}>Field notice delivery tracking</p>
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          {pendingCount > 0 && <div style={{ background:'rgba(255,171,0,0.12)', border:'1px solid rgba(255,171,0,0.25)', borderRadius:'8px', padding:'6px 14px', color:D.amber, fontSize:'0.72rem', fontFamily:'Syne,sans-serif', fontWeight:700 }}>⚡ {pendingCount} pending sync</div>}
          <button onClick={() => setFieldMode(true)} style={{ padding:'9px 18px', borderRadius:'8px', background:'rgba(0,229,160,0.1)', border:'1px solid rgba(0,229,160,0.25)', color:D.green, fontSize:'0.72rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer' }}>
            ☀ Field Mode
          </button>
          <button onClick={() => setShowLog(true)} style={{ padding:'9px 18px', borderRadius:'8px', background:D.blue, color:'#fff', fontSize:'0.72rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', border:'none', cursor:'pointer' }}>
            + Log Delivery
          </button>
        </div>
      </div>

      {syncMsg && <div style={{ background:'rgba(0,229,160,0.08)', border:'1px solid rgba(0,229,160,0.2)', borderRadius:'8px', padding:'10px 16px', marginBottom:'1.25rem', fontSize:'0.8rem', color:D.green, fontFamily:'Syne,sans-serif', fontWeight:600 }}>{syncMsg}</div>}

      {/* Assignments table */}
      <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:'12px', overflow:'hidden', backdropFilter:'blur(16px)' }}>
        <div style={{ padding:'1.1rem 1.5rem', borderBottom:`1px solid ${D.border}` }}>
          <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'0.82rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:D.muted, margin:0 }}>Active Assignments</h2>
        </div>
        {!assignments || assignments.length === 0 ? (
          <div style={{ padding:'3rem', textAlign:'center', color:D.muted, fontSize:'0.85rem' }}>No assignments found.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'rgba(255,255,255,0.03)' }}>
              {['Date','Area','Parish','Status','Progress'].map(h => (
                <th key={h} style={{ padding:'10px 20px', textAlign: h==='Progress' ? 'right' : 'left', fontSize:'0.62rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:D.muted, borderBottom:`1px solid ${D.border}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {assignments.map((a: any) => (
                <tr key={a.id} style={{ borderBottom:`1px solid ${D.border}` }}>
                  <td style={{ padding:'12px 20px', fontSize:'0.82rem', color:D.muted }}>{new Date(a.assignment_date).toLocaleDateString()}</td>
                  <td style={{ padding:'12px 20px', fontSize:'0.82rem', fontFamily:'Syne,sans-serif', fontWeight:600, color:D.text }}>{a.area_name}</td>
                  <td style={{ padding:'12px 20px', fontSize:'0.82rem', color:D.muted }}>{a.parish}</td>
                  <td style={{ padding:'12px 20px' }}><span style={{ ...STATUS_DARK[a.status] && { background:STATUS_DARK[a.status] }, padding:'3px 10px', borderRadius:'5px', fontSize:'0.65rem', fontFamily:'Syne,sans-serif', fontWeight:700, color:D.text }}>{a.status}</span></td>
                  <td style={{ padding:'12px 20px', textAlign:'right' }}>
                    <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'0.85rem', color:D.blue }}>{a.completed_cases}/{a.total_cases}</span>
                    <div style={{ width:'80px', height:'3px', background:'rgba(255,255,255,0.08)', borderRadius:'3px', marginTop:'5px', marginLeft:'auto' }}>
                      <div style={{ height:'100%', background:D.blue, borderRadius:'3px', width:`${a.total_cases ? (a.completed_cases/a.total_cases)*100 : 0}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Desktop log modal */}
      {showLog && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'1rem' }}>
          <div style={{ background:'#111827', border:`1px solid ${D.border}`, borderRadius:'16px', width:'100%', maxWidth:'520px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.5rem', borderBottom:`1px solid ${D.border}` }}>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'1rem', color:D.text, margin:0 }}>Log Delivery</h2>
              <button onClick={() => { setShowLog(false); reset(); setCaseSearch(''); }} style={{ background:'transparent', border:'none', color:D.muted, cursor:'pointer', fontSize:'1.2rem', lineHeight:1 }}>×</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div>
                <label style={{ display:'block', fontSize:'0.63rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:D.muted, marginBottom:'8px' }}>Search Case</label>
                <input placeholder="Owner name…" value={caseSearch} onChange={e => setCaseSearch(e.target.value)} className="vg-input" style={{ padding:'10px 14px', borderRadius:'8px', fontSize:'0.875rem' }} />
                {cases.length > 0 && (
                  <div style={{ border:`1px solid ${D.border}`, borderRadius:'8px', overflow:'hidden', marginTop:'6px', maxHeight:'140px', overflowY:'auto' }}>
                    {cases.map((c: any) => (
                      <button key={c.id} type="button" onClick={() => { setValue('propertyCaseId', c.id); setCaseSearch(c.composite_key); }} style={{ width:'100%', textAlign:'left', padding:'10px 14px', background: selectedId === c.id ? 'rgba(41,121,255,0.12)' : 'transparent', border:'none', borderBottom:`1px solid ${D.border}`, cursor:'pointer', color: selectedId === c.id ? '#7ab4ff' : D.muted, fontSize:'0.8rem', fontFamily:'Syne,sans-serif', fontWeight:600 }}>
                        {c.composite_key} — {c.owner_name}
                      </button>
                    ))}
                  </div>
                )}
                {errors.propertyCaseId && <p style={{ color:D.red, fontSize:'0.72rem', marginTop:'4px' }}>{errors.propertyCaseId.message}</p>}
              </div>

              <div>
                <label style={{ display:'block', fontSize:'0.63rem', fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:D.muted, marginBottom:'8px' }}>Status</label>
                <select {...register('status')} className="vg-input" style={{ padding:'10px 14px', borderRadius:'8px', fontSize:'0.875rem' }}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <input placeholder="Recipient name (if delivered)" className="vg-input" style={{ padding:'10px 14px', borderRadius:'8px', fontSize:'0.875rem' }} {...register('recipientName')} />
              <textarea placeholder="Notes…" rows={3} className="vg-input" style={{ padding:'10px 14px', borderRadius:'8px', fontSize:'0.875rem', resize:'none' }} {...register('notes')} />

              <button type="button" onClick={captureGPS} style={{ padding:'10px', borderRadius:'8px', background:'rgba(255,255,255,0.04)', border:`1px solid ${D.border}`, color:D.blue, fontSize:'0.78rem', fontFamily:'Syne,sans-serif', fontWeight:700, cursor:'pointer' }}>📍 Capture GPS</button>
              {gpsStatus && <p style={{ color:D.green, fontSize:'0.75rem', fontFamily:'Syne,sans-serif', margin:'-6px 0 0' }}>{gpsStatus}</p>}

              <button type="submit" disabled={logMutation.isPending} className="vg-btn vg-btn-primary" style={{ padding:'12px', borderRadius:'8px' }}>
                {logMutation.isPending ? 'Logging…' : 'Log Delivery'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
