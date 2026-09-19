// Kullanıcı 'hareketi azalt' tercih ettiyse grafik animasyonlarını kapat
export const ANIMATE = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const AXIS = { stroke: '#94a3b8', fontSize: 12, tickLine: false }
export const GRID = { stroke: '#1e293b', vertical: false }
export const TOOLTIP = {
  contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
  itemStyle: { color: '#e2e8f0' },
  cursor: { fill: 'rgba(148,163,184,0.1)' },
  formatter: (v) => v.toLocaleString('tr-TR'),
}
export const SERIES = ['#3987e5', '#d95926']
