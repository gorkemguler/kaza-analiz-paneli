import { ResponsiveContainer } from 'recharts'

export function Kpis({ items }) {
  return (
    <section className="kpis">
      {items.map((k) => (
        <div key={k.label} className={`card kpi ${k.tone ?? ''}`}>
          <span>{k.label}</span>
          <strong>{k.value}</strong>
          {k.note && <small>{k.note}</small>}
        </div>
      ))}
    </section>
  )
}

export function ChartCard({ title, subtitle, children, span = 1, height = 240 }) {
  return (
    <div className={`card chart span-${span}`}>
      <h2>{title}</h2>
      {subtitle && <p className="subtitle">{subtitle}</p>}
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ChipGroup({ label, options, selected, onChange, colors }) {
  const toggle = (opt) => onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt])
  return (
    <fieldset className="chip-group">
      <legend>{label}</legend>
      {options.map((opt) => (
        <button key={opt} type="button" className={`chip ${selected.includes(opt) ? 'active' : ''}`} aria-pressed={selected.includes(opt)} onClick={() => toggle(opt)}>
          {colors?.[opt] && <i className="dot" style={{ background: colors[opt] }} />}
          {opt}
        </button>
      ))}
    </fieldset>
  )
}

export function Sources({ items }) {
  return (
    <section className="sources">
      <h2>Veri kaynakları</h2>
      <ul>
        {items.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.name}
            </a>
            {s.note && <span> · {s.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
