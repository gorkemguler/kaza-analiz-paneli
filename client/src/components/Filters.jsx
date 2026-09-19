function ChipGroup({ label, options, selected, onChange }) {
  const toggle = (opt) =>
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt])
  return (
    <fieldset className="chip-group">
      <legend>{label}</legend>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`chip ${selected.includes(opt) ? 'active' : ''}`}
          aria-pressed={selected.includes(opt)}
          onClick={() => toggle(opt)}
        >
          {opt}
        </button>
      ))}
    </fieldset>
  )
}

export default function Filters({ meta, value, onChange, onReset }) {
  const set = (key) => (v) => onChange({ ...value, [key]: v })
  const { from: min, to: max } = meta.dateRange

  return (
    <section className="card filters">
      <div className="filter-row">
        <label>
          Şehir
          <select value={value.city} onChange={(e) => set('city')(e.target.value)}>
            <option value="">Tümü</option>
            {meta.cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Başlangıç
          <input type="date" min={min} max={max} value={value.from} onChange={(e) => set('from')(e.target.value)} />
        </label>
        <label>
          Bitiş
          <input type="date" min={min} max={max} value={value.to} onChange={(e) => set('to')(e.target.value)} />
        </label>
        <button type="button" className="reset" onClick={onReset}>
          Filtreleri temizle
        </button>
      </div>
      <ChipGroup label="Kaza türü" options={meta.types} selected={value.type} onChange={set('type')} />
      <ChipGroup label="Sonuç" options={meta.severities} selected={value.severity} onChange={set('severity')} />
      <ChipGroup label="Hava durumu" options={meta.weathers} selected={value.weather} onChange={set('weather')} />
    </section>
  )
}
