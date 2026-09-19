import { fmt } from '../api.js'

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const RAMP = ['#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb']

// Gün × saat yoğunluk matrisi: devriye/denetim planlaması için hangi gün hangi saatte kaza yoğunlaşıyor
export default function WeekHourGrid({ grid, title = 'Gün ve saate göre kaza yoğunluğu', unit = 'kaza' }) {
  const max = Math.max(1, ...grid.flat())
  const color = (v) => (v === 0 ? 'transparent' : RAMP[Math.min(RAMP.length - 1, Math.floor((v / max) * RAMP.length))])

  return (
    <div className="card chart span-3">
      <h2>{title}</h2>
      <p className="subtitle">Koyu hücre az, açık hücre çok {unit} · Hücrenin üzerine gelince sayı görünür</p>
      <div className="whgrid" role="table" aria-label="Gün ve saate göre kaza sayısı">
        <div role="row" className="whrow">
          <span />
          {[...Array(24).keys()].map((h) => (
            <span key={h} role="columnheader" className="whhour">
              {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
            </span>
          ))}
        </div>
        {grid.map((row, d) => (
          <div role="row" className="whrow" key={d}>
            <span role="rowheader" className="whday">
              {DAYS[d]}
            </span>
            {row.map((v, h) => (
              <span
                key={h}
                role="cell"
                className="whcell"
                style={{ background: color(v) }}
                title={`${DAYS[d]} ${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00 · ${fmt(v)} ${unit}`}
                aria-label={`${DAYS[d]} saat ${h}: ${v} ${unit}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
