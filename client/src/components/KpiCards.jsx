const fmt = (n) => n.toLocaleString('tr-TR')
const pct = (a, b) => (b ? `%${((a / b) * 100).toFixed(1)}` : '%0')

export default function KpiCards({ totals }) {
  const items = [
    { label: 'Toplam kaza', value: fmt(totals.accidents) },
    { label: 'Yaralı', value: fmt(totals.injured), tone: 'warn' },
    { label: 'Ölü', value: fmt(totals.dead), tone: 'danger' },
    { label: 'Ölümlü kaza oranı', value: pct(totals.fatalAccidents, totals.accidents), tone: 'danger' },
    { label: 'Gece kazaları (22-06)', value: pct(totals.night, totals.accidents) },
  ]
  return (
    <section className="kpis">
      {items.map((k) => (
        <div key={k.label} className={`card kpi ${k.tone ?? ''}`}>
          <span>{k.label}</span>
          <strong>{k.value}</strong>
        </div>
      ))}
    </section>
  )
}
