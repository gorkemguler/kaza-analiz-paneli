export default function HotspotTable({ hotspots, onSelect, selected }) {
  if (!hotspots.length) return <p className="muted">Seçili filtrelerde kayıt yok.</p>
  const max = hotspots[0].score

  return (
    <ol className="hotspots">
      {hotspots.map((h, i) => (
        <li key={h.id}>
          <button type="button" className={selected === h.id ? 'active' : ''} onClick={() => onSelect(h)}>
            <span className="rank">{i + 1}</span>
            <span className="hs-body">
              <span className="hs-title">{h.location}</span>
              <span className="hs-meta">
                {h.count} kaza · {h.injury} yaralanmalı · {h.fatal} can kaybı · yoğun: {h.peakHour}
              </span>
              <span className="bar">
                <span style={{ width: `${(h.score / max) * 100}%` }} />
              </span>
            </span>
            <span className="score" title="Risk puanı">
              {h.score}
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
