// ── ValuGrid Shared Style Constants ─────────────────────────────
// Import this in every page: import { S, C } from '@/lib/styles'

export const C = {
  text:      '#0d1326',
  muted:     '#5C6A8A',
  faint:     '#8A96B0',
  border:    '#DDE3F0',
  surface:   '#F5F8FF',
  card:      '#FFFFFF',
  bg:        '#F0F4FF',
  blue:      '#2979FF',
  blueBg:    '#EEF3FF',
  blueBd:    '#BFDBFE',
  green:     '#059669',
  greenBg:   '#E6FBF4',
  greenBd:   '#A7F3D0',
  red:       '#E53E3E',
  redBg:     '#FEF2F2',
  redBd:     '#FECACA',
  amber:     '#D97706',
  amberBg:   '#FFFBEB',
  amberBd:   '#FDE68A',
  purple:    '#7C3AED',
  purpleBg:  '#F5F3FF',
  purpleBd:  '#DDD6FE',
};

export const F = {
  display: "'Syne', sans-serif",
  body:    "'DM Sans', sans-serif",
};

// Common element styles
export const S = {
  page:    { padding:'1.75rem 2rem', minHeight:'100vh' } as React.CSSProperties,

  h1:      { fontFamily:F.display, fontSize:'1.5rem', fontWeight:800, color:C.text, letterSpacing:'-0.02em', margin:0, lineHeight:1.2 } as React.CSSProperties,
  h2:      { fontFamily:F.display, fontSize:'1rem',   fontWeight:700, color:C.text, letterSpacing:'-0.01em', margin:0 } as React.CSSProperties,
  h3:      { fontFamily:F.display, fontSize:'0.72rem', fontWeight:700, color:C.text, letterSpacing:'0.1em', textTransform:'uppercase' as const, margin:0 } as React.CSSProperties,

  label:   { display:'block' as const, fontFamily:F.display, fontSize:'0.62rem', fontWeight:700 as const, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:C.muted, marginBottom:'6px' } as React.CSSProperties,
  muted:   { fontFamily:F.body, fontSize:'0.78rem', color:C.muted } as React.CSSProperties,
  tiny:    { fontFamily:F.display, fontSize:'0.6rem', fontWeight:700 as const, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:C.muted } as React.CSSProperties,

  card:    { background:C.card, border:`1.5px solid ${C.border}`, borderRadius:'12px', boxShadow:'0 1px 3px rgba(13,19,38,0.07)' } as React.CSSProperties,
  surface: { background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px' } as React.CSSProperties,

  input:   { width:'100%', padding:'9px 12px', borderRadius:'8px', background:'#FAFBFF', border:`1.5px solid ${C.border}`, color:C.text, fontSize:'0.875rem', fontFamily:F.body, outline:'none', boxSizing:'border-box' as const } as React.CSSProperties,

  btnPrimary: { padding:'9px 18px', borderRadius:'8px', background:C.blue, color:'#fff', fontFamily:F.display, fontWeight:700 as const, fontSize:'0.72rem', letterSpacing:'0.08em', textTransform:'uppercase' as const, border:'none', cursor:'pointer' as const } as React.CSSProperties,
  btnSecondary: { padding:'9px 18px', borderRadius:'8px', background:'transparent', color:C.muted, fontFamily:F.display, fontWeight:700 as const, fontSize:'0.72rem', letterSpacing:'0.08em', textTransform:'uppercase' as const, border:`1.5px solid ${C.border}`, cursor:'pointer' as const } as React.CSSProperties,

  th:      { padding:'10px 16px', textAlign:'left' as const, fontFamily:F.display, fontSize:'0.6rem', fontWeight:700 as const, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:C.muted, background:C.surface, borderBottom:`1.5px solid ${C.border}` } as React.CSSProperties,
  td:      { padding:'11px 16px', fontFamily:F.body, fontSize:'0.83rem', color:C.text, borderBottom:`1px solid #F0F4FF` } as React.CSSProperties,
  tdMuted: { padding:'11px 16px', fontFamily:F.body, fontSize:'0.83rem', color:C.muted, borderBottom:`1px solid #F0F4FF` } as React.CSSProperties,

  statNum: { fontFamily:F.display, fontWeight:800 as const, fontSize:'1.6rem', letterSpacing:'-0.03em', lineHeight:1, margin:0 } as React.CSSProperties,
  statLabel: { fontFamily:F.display, fontSize:'0.6rem', fontWeight:700 as const, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:C.muted, margin:'0 0 8px' } as React.CSSProperties,

  sectionHead: { fontFamily:F.display, fontSize:'0.62rem', fontWeight:700 as const, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:C.muted, margin:'0 0 10px' } as React.CSSProperties,
  accentBar: (color: string) => ({ width:'3px', height:'16px', background:color, borderRadius:'3px', flexShrink:0 } as React.CSSProperties),

  pageHeader: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'1.5rem' } as React.CSSProperties,
};

export function badge(type: 'blue'|'green'|'red'|'amber'|'purple'|'muted'): React.CSSProperties {
  const map = {
    blue:   { background:C.blueBg,   color:C.blue,   border:`1px solid ${C.blueBd}` },
    green:  { background:C.greenBg,  color:C.green,  border:`1px solid ${C.greenBd}` },
    red:    { background:C.redBg,    color:C.red,    border:`1px solid ${C.redBd}` },
    amber:  { background:C.amberBg,  color:C.amber,  border:`1px solid ${C.amberBd}` },
    purple: { background:C.purpleBg, color:C.purple, border:`1px solid ${C.purpleBd}` },
    muted:  { background:'#F1F5F9',  color:'#64748B', border:'1px solid #E2E8F0' },
  };
  return { ...map[type], fontFamily:F.display, fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' as const, padding:'3px 8px', borderRadius:'5px', whiteSpace:'nowrap' as const, display:'inline-block' };
}

export function badgeForStatus(status: string): React.CSSProperties {
  const map: Record<string,ReturnType<typeof badge>> = {
    COMPLIANT:   badge('green'),
    DELINQUENT:  badge('red'),
    PENDING:     badge('amber'),
    LOW:         badge('green'),
    MEDIUM:      badge('amber'),
    HIGH:        { background:'#FFF7ED', color:'#EA580C', border:'1px solid #FED7AA', fontFamily:F.display, fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' as const, padding:'3px 8px', borderRadius:'5px', whiteSpace:'nowrap' as const, display:'inline-block' },
    CRITICAL:    badge('red'),
    'IN_PROGRESS': badge('blue'),
    COMPLETE:    badge('green'),
    CANCELLED:   badge('muted'),
    DELIVERED:   badge('green'),
    OWNER_ABSENT: badge('amber'),
    REFUSED:     badge('red'),
    VACANT:      badge('muted'),
    ESCALATED:   badge('purple'),
    CREATE:      badge('green'),
    UPDATE:      badge('blue'),
    DELETE:      badge('red'),
    LOGIN:       badge('purple'),
  };
  return map[status] || badge('muted');
}
