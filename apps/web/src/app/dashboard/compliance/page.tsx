'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { S, C, F, badge, badgeForStatus } from '@/lib/styles';

const RISK_COLOR: Record<string,string> = {
  CRITICAL:'#E53E3E', HIGH:'#EA580C', MEDIUM:'#D97706', LOW:'#059669', UNKNOWN:'#94A3B8'
};

const PARISH_COORDS: Record<string,[number,number]> = {
  'Kingston':[17.9977,-76.7936],'St. Andrew':[18.0747,-76.7444],'St. Catherine':[17.99,-77.0],
  'Clarendon':[17.95,-77.25],'Manchester':[18.05,-77.5],'St. Elizabeth':[18.0,-77.75],
  'Westmoreland':[18.25,-78.15],'Hanover':[18.4,-78.13],'St. James':[18.47,-77.92],
  'Trelawny':[18.35,-77.6],'St. Ann':[18.43,-77.2],'St. Mary':[18.3,-76.9],
  'Portland':[18.17,-76.45],'St. Thomas':[17.95,-76.35],'Portmore':[17.9167,-76.8833],
};

export default function CompliancePage() {
  const [tab, setTab] = useState<'map'|'analytics'>('map');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [MapComponents, setMapComponents] = useState<any>(null);

  const { data: cases } = useQuery({
    queryKey: ['compliance-cases'],
    queryFn: async () => (await api.get('/cases', { params:{ limit:100 } })).data,
  });

  const list = cases?.data || [];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    Promise.all([import('react-leaflet'), import('leaflet')]).then(([rl, L]) => {
      delete (L.default.Icon.Default.prototype as any)._getIconUrl;
      L.default.Icon.Default.mergeOptions({
        iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      setMapComponents({ ...rl, L: L.default });
    });
  }, []);

  const byParish = list.reduce((acc: any, c: any) => {
    const p = c.parish || c.area_name || 'Unknown';
    if (!acc[p]) acc[p] = { parish:p, cases:0, outstanding:0, delinquent:0, coords:PARISH_COORDS[p] };
    acc[p].cases++;
    acc[p].outstanding += Number(c.total_outstanding||0);
    if (c.compliance_status==='DELINQUENT') acc[p].delinquent++;
    return acc;
  }, {});

  const parishData = Object.values(byParish) as any[];
  const maxOut = Math.max(...parishData.map((p: any) => p.outstanding), 1);

  const riskColor = (out: number) => {
    const r = out / maxOut;
    return r > 0.8 ? RISK_COLOR.CRITICAL : r > 0.5 ? RISK_COLOR.HIGH : r > 0.2 ? RISK_COLOR.MEDIUM : out > 0 ? RISK_COLOR.LOW : RISK_COLOR.UNKNOWN;
  };

  const riskLabel = (out: number) => {
    const r = out / maxOut;
    return r > 0.8 ? 'CRITICAL' : r > 0.5 ? 'HIGH' : r > 0.2 ? 'MEDIUM' : out > 0 ? 'LOW' : 'NONE';
  };

  const stats = [
    { label:'Total Cases',      value: list.length,                                                color:C.blue,  bg:C.blueBg,  bd:C.blueBd },
    { label:'Delinquent',       value: list.filter((c: any) => c.compliance_status==='DELINQUENT').length, color:C.red,   bg:C.redBg,   bd:C.redBd },
    { label:'Critical Risk',    value: list.filter((c: any) => c.risk_level==='CRITICAL').length,  color:C.red,   bg:C.redBg,   bd:C.redBd },
    { label:'Total Outstanding',value: `J$${list.reduce((s: number, c: any) => s + Number(c.total_outstanding||0), 0).toLocaleString()}`, color:C.amber, bg:C.amberBg, bd:C.amberBd },
  ];

  const LEGEND = [
    { label:'Critical (>80%)', color:RISK_COLOR.CRITICAL },
    { label:'High (>50%)',     color:RISK_COLOR.HIGH },
    { label:'Medium (>20%)',   color:RISK_COLOR.MEDIUM },
    { label:'Low (>0%)',       color:RISK_COLOR.LOW },
    { label:'None',            color:RISK_COLOR.UNKNOWN },
  ];

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ ...S.pageHeader, marginBottom:'1.5rem' }}>
        <div>
          <h1 style={S.h1}>GIS & Compliance</h1>
          <p style={{ ...S.muted, marginTop:'4px' }}>Geographic delinquency mapping and compliance analytics</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'1.5rem' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background:s.bg, border:`1.5px solid ${s.bd}`, borderRadius:'10px', padding:'12px 16px' }}>
            <p style={S.statLabel}>{s.label}</p>
            <p style={{ ...S.statNum, color:s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'2px', background:C.surface, padding:'4px', borderRadius:'10px', width:'fit-content', marginBottom:'1.25rem', border:`1.5px solid ${C.border}` }}>
        {[{id:'map',label:'Delinquency Map'},{id:'analytics',label:'Risk Analytics'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding:'7px 16px', borderRadius:'7px', fontFamily:F.display, fontWeight:700, fontSize:'0.72rem', letterSpacing:'0.06em', textTransform:'uppercase', border:'none', cursor:'pointer', transition:'all .15s', background: tab===t.id ? C.card : 'transparent', color: tab===t.id ? C.blue : C.muted, boxShadow: tab===t.id ? '0 1px 3px rgba(13,19,38,0.08)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* MAP */}
      {tab==='map' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' }}>
            <label style={{ fontSize:'0.8rem', color:'#6b7280', fontWeight:600 }}>OPERATIONAL AREA</label>
            <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)}
              style={{ padding:'0.35rem 0.75rem', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'0.85rem', background:'#fff', cursor:'pointer' }}>
              <option value="ALL">All Areas</option>
              {Object.keys(PARISH_COORDS).filter(p => parishData.some((d: any) => d.parish === p)).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {selectedArea !== 'ALL' && (
              <button onClick={() => setSelectedArea('ALL')}
                style={{ padding:'0.3rem 0.75rem', borderRadius:'6px', border:'1px solid #6b7280', background:'transparent', color:'#6b7280', fontSize:'0.8rem', cursor:'pointer' }}>
                ✕ Clear
              </button>
            )}
          </div>
          <div style={{ ...S.card, padding:'10px 16px', display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
            <span style={{ ...S.tiny, marginRight:'8px', marginBottom:0 }}>Intensity:</span>
            {LEGEND.map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:l.color, flexShrink:0 }} />
                <span style={{ fontFamily:F.body, fontSize:'0.72rem', color:C.muted }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Map */}
          <div style={{ ...S.card, overflow:'hidden', height:'480px' }}>
            {!MapComponents ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
                <p style={S.muted}>Loading map…</p>
              </div>
            ) : (
              <>
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                <MapComponents.MapContainer
                    key={selectedArea}
                    center={selectedArea !== 'ALL' && PARISH_COORDS[selectedArea] ? PARISH_COORDS[selectedArea] : [18.1096,-77.2975]}
                    zoom={selectedArea !== 'ALL' ? 12 : 9}
                    style={{ height:'100%', width:'100%' }}>
                  <MapComponents.TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
                  {parishData.filter((p: any) => p.coords && (selectedArea === 'ALL' || p.parish === selectedArea)).map((p: any) => (
                    <MapComponents.CircleMarker key={p.parish} center={p.coords}
                      radius={Math.max(10, Math.min(40, (p.outstanding/maxOut)*40))}
                      pathOptions={{ color:riskColor(p.outstanding), fillColor:riskColor(p.outstanding), fillOpacity:0.6, weight:2 }}>
                      <MapComponents.Popup>
                        <div style={{ fontFamily:F.body, fontSize:'0.82rem' }}>
                          <p style={{ fontFamily:F.display, fontWeight:700, marginBottom:'4px' }}>{p.parish}</p>
                          <p>Cases: <strong>{p.cases}</strong></p>
                          <p>Delinquent: <strong style={{ color:C.red }}>{p.delinquent}</strong></p>
                          <p>Outstanding: <strong style={{ color:C.amber }}>J${p.outstanding.toLocaleString()}</strong></p>
                        </div>
                      </MapComponents.Popup>
                    </MapComponents.CircleMarker>
                  ))}
                  {list.filter((c: any) => c.gps_lat && c.gps_lng && (selectedArea === 'ALL' || c.parish === selectedArea || c.area_name === selectedArea)).map((c: any) => (
                    <MapComponents.Marker key={c.id} position={[c.gps_lat, c.gps_lng]}>
                      <MapComponents.Popup>
                        <p style={{ fontFamily:F.display, fontWeight:700, margin:0 }}>{c.composite_key}</p>
                        <p style={{ fontFamily:F.body, fontSize:'0.8rem', margin:'2px 0 0' }}>{c.owner_name}</p>
                      </MapComponents.Popup>
                    </MapComponents.Marker>
                  ))}
                </MapComponents.MapContainer>
              </>
            )}
          </div>

          {/* Parish table */}
          {parishData.length > 0 && (
            <div style={{ ...S.card, overflow:'hidden' }}>
              <div style={{ padding:'1rem 1.25rem', borderBottom:`1.5px solid ${C.border}` }}><h3 style={S.h3}>Delinquency by Parish</h3></div>
              <table>
                <thead><tr>
                  {['Parish','Cases','Delinquent','Outstanding','Risk Level'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {parishData.sort((a: any,b: any) => b.outstanding-a.outstanding).map((p: any) => (
                    <tr key={p.parish} onMouseEnter={e => (e.currentTarget.style.background=C.surface)} onMouseLeave={e => (e.currentTarget.style.background='')}>
                      <td style={{ ...S.td, fontFamily:F.display, fontWeight:600 }}>{p.parish}</td>
                      <td style={S.td}>{p.cases}</td>
                      <td style={{ ...S.td, color:C.red, fontFamily:F.display, fontWeight:700 }}>{p.delinquent}</td>
                      <td style={{ ...S.td, fontFamily:F.display, fontWeight:700, color:C.amber }}>J${p.outstanding.toLocaleString()}</td>
                      <td style={S.td}>
                        <span style={{ background:riskColor(p.outstanding)+'22', color:riskColor(p.outstanding), border:`1px solid ${riskColor(p.outstanding)}44`, fontFamily:F.display, fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', padding:'3px 8px', borderRadius:'5px', whiteSpace:'nowrap' }}>
                          {riskLabel(p.outstanding)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ANALYTICS */}
      {tab==='analytics' && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <div style={{ padding:'1rem 1.25rem', borderBottom:`1.5px solid ${C.border}` }}><h3 style={S.h3}>Risk Distribution</h3></div>
          <table>
            <thead><tr>
              {['Composite Key','Owner','Area','Status','Risk','Outstanding','Years'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.length===0 && <tr><td colSpan={7} style={{ ...S.td, textAlign:'center', padding:'3rem', color:C.muted }}>No cases found.</td></tr>}
              {[...list].sort((a: any,b: any) => Number(b.total_outstanding||0)-Number(a.total_outstanding||0)).map((c: any) => (
                <tr key={c.id} onMouseEnter={e => (e.currentTarget.style.background=C.surface)} onMouseLeave={e => (e.currentTarget.style.background='')}>
                  <td style={{ ...S.td, fontFamily:F.display, fontWeight:700 }}>{c.composite_key}</td>
                  <td style={S.td}>{c.owner_name}</td>
                  <td style={S.tdMuted}>{c.area_name}</td>
                  <td style={S.td}><span style={badgeForStatus(c.compliance_status||'UNKNOWN')}>{c.compliance_status||'UNKNOWN'}</span></td>
                  <td style={S.td}><span style={badgeForStatus(c.risk_level||'UNKNOWN')}>{c.risk_level||'UNKNOWN'}</span></td>
                  <td style={{ ...S.td, fontFamily:F.display, fontWeight:700, color:C.red }}>J${Number(c.total_outstanding||0).toLocaleString()}</td>
                  <td style={S.tdMuted}>{c.years_outstanding||0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
