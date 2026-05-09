'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ShieldCheck, Map, BarChart3 } from 'lucide-react';

const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#ca8a04',
  LOW: '#16a34a',
  UNKNOWN: '#94a3b8',
};

const PARISH_COORDS: Record<string, [number, number]> = {
  'Kingston': [17.9977, -76.7936],
  'St. Andrew': [18.0747, -76.7444],
  'St. Catherine': [17.9900, -77.0000],
  'Clarendon': [17.9500, -77.2500],
  'Manchester': [18.0500, -77.5000],
  'St. Elizabeth': [18.0000, -77.7500],
  'Westmoreland': [18.2500, -78.1500],
  'Hanover': [18.4000, -78.1300],
  'St. James': [18.4700, -77.9200],
  'Trelawny': [18.3500, -77.6000],
  'St. Ann': [18.4300, -77.2000],
  'St. Mary': [18.3000, -76.9000],
  'Portland': [18.1700, -76.4500],
  'St. Thomas': [17.9500, -76.3500],
};

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<'map'|'analytics'>('map');
  const [MapComponents, setMapComponents] = useState<any>(null);

  const { data: cases } = useQuery({
    queryKey: ['compliance-cases'],
    queryFn: async () => (await api.get('/cases', { params: { limit: 100 } })).data,
  });

  const list = cases?.data || [];

  // Load Leaflet dynamically (SSR-safe)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    Promise.all([
      import('react-leaflet'),
      import('leaflet'),
    ]).then(([rl, L]) => {
      // Fix default marker icons
      delete (L.default.Icon.Default.prototype as any)._getIconUrl;
      L.default.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      setMapComponents({ ...rl, L: L.default });
    });
  }, []);

  // Group cases by parish for heatmap
  const byParish = list.reduce((acc: any, c: any) => {
    const parish = c.parish || c.area_name || 'Unknown';
    if (!acc[parish]) acc[parish] = { parish, cases: 0, outstanding: 0, delinquent: 0, coords: PARISH_COORDS[parish] };
    acc[parish].cases++;
    acc[parish].outstanding += Number(c.total_outstanding || 0);
    if (c.compliance_status === 'DELINQUENT') acc[parish].delinquent++;
    return acc;
  }, {});

  const parishData = Object.values(byParish) as any[];
  const maxOutstanding = Math.max(...parishData.map((p: any) => p.outstanding), 1);

  // Stats
  const delinquent = list.filter((c: any) => c.compliance_status === 'DELINQUENT').length;
  const critical = list.filter((c: any) => c.risk_level === 'CRITICAL').length;
  const high = list.filter((c: any) => c.risk_level === 'HIGH').length;
  const totalOutstanding = list.reduce((s: number, c: any) => s + Number(c.total_outstanding || 0), 0);

  const getRiskColor = (outstanding: number) => {
    const ratio = outstanding / maxOutstanding;
    if (ratio > 0.8) return RISK_COLORS.CRITICAL;
    if (ratio > 0.5) return RISK_COLORS.HIGH;
    if (ratio > 0.2) return RISK_COLORS.MEDIUM;
    if (ratio > 0) return RISK_COLORS.LOW;
    return RISK_COLORS.UNKNOWN;
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" /> Compliance & GIS Intelligence
        </h1>
        <p className="text-slate-500 text-sm mt-1">Geographic delinquency mapping and compliance analytics</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Cases', value: list.length, color: 'text-slate-800', bg: 'bg-slate-50' },
          { label: 'Delinquent', value: delinquent, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Critical Risk', value: critical, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Total Outstanding', value: `J$${totalOutstanding.toLocaleString()}`, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-6 w-fit">
        {[
          { id: 'map', label: 'Delinquency Map', icon: Map },
          { id: 'analytics', label: 'Risk Analytics', icon: BarChart3 },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* MAP TAB */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          {/* Legend */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-6">
            <span className="text-sm font-medium text-slate-700">Outstanding Balance Intensity:</span>
            {[
              { label: 'Critical (>80%)', color: RISK_COLORS.CRITICAL },
              { label: 'High (>50%)', color: RISK_COLORS.HIGH },
              { label: 'Medium (>20%)', color: RISK_COLORS.MEDIUM },
              { label: 'Low (>0%)', color: RISK_COLORS.LOW },
              { label: 'None', color: RISK_COLORS.UNKNOWN },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-xs text-slate-500">{l.label}</span>
              </div>
            ))}
          </div>

          {/* Map */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden" style={{ height: '500px' }}>
            {!MapComponents ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading map...</div>
            ) : (
              <>
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                <MapComponents.MapContainer
                  center={[18.1096, -77.2975]}
                  zoom={9}
                  style={{ height: '100%', width: '100%' }}
                >
                  <MapComponents.TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />

                  {/* Parish circles based on outstanding balance */}
                  {parishData.filter((p: any) => p.coords).map((parish: any) => (
                    <MapComponents.CircleMarker
                      key={parish.parish}
                      center={parish.coords}
                      radius={Math.max(10, Math.min(40, (parish.outstanding / maxOutstanding) * 40))}
                      pathOptions={{
                        color: getRiskColor(parish.outstanding),
                        fillColor: getRiskColor(parish.outstanding),
                        fillOpacity: 0.6,
                        weight: 2,
                      }}
                    >
                      <MapComponents.Popup>
                        <div className="text-sm">
                          <div className="font-bold text-slate-800 mb-1">{parish.parish}</div>
                          <div>Cases: <strong>{parish.cases}</strong></div>
                          <div>Delinquent: <strong className="text-red-600">{parish.delinquent}</strong></div>
                          <div>Outstanding: <strong className="text-orange-600">J${parish.outstanding.toLocaleString()}</strong></div>
                        </div>
                      </MapComponents.Popup>
                    </MapComponents.CircleMarker>
                  ))}

                  {/* Individual case markers */}
                  {list.filter((c: any) => c.gps_lat && c.gps_lng).map((c: any) => (
                    <MapComponents.Marker key={c.id} position={[c.gps_lat, c.gps_lng]}>
                      <MapComponents.Popup>
                        <div className="text-sm">
                          <div className="font-bold">{c.composite_key}</div>
                          <div>{c.owner_name}</div>
                          <div className="text-red-600">J${Number(c.total_outstanding || 0).toLocaleString()}</div>
                        </div>
                      </MapComponents.Popup>
                    </MapComponents.Marker>
                  ))}
                </MapComponents.MapContainer>
              </>
            )}
          </div>

          {/* Parish table below map */}
          {parishData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b"><h2 className="text-base font-semibold text-slate-800">Delinquency by Parish</h2></div>
              <table className="w-full">
                <thead className="bg-slate-50 border-b"><tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Parish</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Cases</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Delinquent</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Outstanding</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Risk Level</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {parishData.sort((a: any, b: any) => b.outstanding - a.outstanding).map((p: any) => (
                    <tr key={p.parish} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-sm font-medium text-slate-800">{p.parish}</td>
                      <td className="px-6 py-3 text-sm text-right">{p.cases}</td>
                      <td className="px-6 py-3 text-sm text-right text-red-600 font-medium">{p.delinquent}</td>
                      <td className="px-6 py-3 text-sm text-right font-bold text-orange-600">J${p.outstanding.toLocaleString()}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
                          style={{ backgroundColor: getRiskColor(p.outstanding) + '20', color: getRiskColor(p.outstanding) }}>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getRiskColor(p.outstanding) }} />
                          {p.outstanding / maxOutstanding > 0.8 ? 'CRITICAL' : p.outstanding / maxOutstanding > 0.5 ? 'HIGH' : p.outstanding / maxOutstanding > 0.2 ? 'MEDIUM' : p.outstanding > 0 ? 'LOW' : 'NONE'}
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

      {/* ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b"><h2 className="text-base font-semibold text-slate-800">Risk Distribution</h2></div>
            <table className="w-full">
              <thead className="bg-slate-50 border-b"><tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Composite Key</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Owner</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Area</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Risk</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Outstanding</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Years</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {list.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No cases found.</td></tr>}
                {list.sort((a: any, b: any) => Number(b.total_outstanding || 0) - Number(a.total_outstanding || 0)).map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-sm font-mono font-medium text-slate-800">{c.composite_key}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{c.owner_name}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{c.area_name}</td>
                    <td className="px-6 py-3">
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">{c.compliance_status || 'UNKNOWN'}</span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: (RISK_COLORS[c.risk_level] || RISK_COLORS.UNKNOWN) + '20', color: RISK_COLORS[c.risk_level] || RISK_COLORS.UNKNOWN }}>
                        {c.risk_level || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm font-bold text-red-600 text-right">J${Number(c.total_outstanding || 0).toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 text-right">{c.years_outstanding || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
