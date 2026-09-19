import { useEffect, useMemo, useState } from 'react'
import { MapContainer, GeoJSON, useMap } from 'react-leaflet'
import { fmt } from '../api.js'

// Koyu zemin için tek tonlu mavi skala: düşük değer zemine yakın koyu, yüksek değer açık
const RAMP = ['#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb']

// Dağılım çok çarpık (İstanbul/Ankara çok yüksek) olduğu için eşit sayılı sınıflar (quantile) kullanılır
function quantileBreaks(values, classes) {
  const s = [...values].sort((a, b) => a - b)
  const breaks = []
  for (let i = 1; i < classes; i++) breaks.push(s[Math.floor((i / classes) * s.length)])
  // En küçük değere eşit ya da tekrar eden eşikler boş sınıf üretir
  return [...new Set(breaks)].filter((b) => b > s[0])
}

// Sınıf sayısı azaldığında da skalanın iki ucunu kullan
const rampColor = (i, n) => RAMP[n <= 1 ? RAMP.length - 1 : Math.round((i * (RAMP.length - 1)) / (n - 1))]

const TR_BOUNDS = [
  [35.8, 25.7],
  [42.1, 44.8],
]

// Kutu boyutu değiştikçe (ilk yerleşim, pencere boyutu) Türkiye'yi yeniden sığdır
function FitTurkey() {
  const map = useMap()
  useEffect(() => {
    const fit = () => {
      map.invalidateSize()
      map.fitBounds(TR_BOUNDS, { animate: false })
    }
    const ro = new ResizeObserver(fit)
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

let geoCache = null
function useGeo() {
  const [geo, setGeo] = useState(geoCache)
  useEffect(() => {
    if (!geoCache) fetch('/tr-iller.json').then((r) => r.json()).then((g) => setGeo((geoCache = g)))
  }, [])
  return geo
}

export default function ProvinceMap({ rows, metric, metricLabel, selected, onSelect }) {
  const geo = useGeo()
  const byPlaka = useMemo(() => new Map(rows.map((r) => [r.plaka, r])), [rows])
  const breaks = useMemo(() => quantileBreaks(rows.map((r) => r[metric]), RAMP.length), [rows, metric])
  const classes = breaks.length + 1
  const colorFor = (v) => rampColor(breaks.filter((b) => v >= b).length, classes)

  const style = (f) => {
    const r = byPlaka.get(f.properties.plaka)
    const isSel = f.properties.plaka === selected
    return {
      fillColor: r ? colorFor(r[metric]) : '#1e293b',
      fillOpacity: 1,
      color: isSel ? '#fbbf24' : '#0f172a',
      weight: isSel ? 2.5 : 0.8,
    }
  }

  const onEachFeature = (f, layer) => {
    const r = byPlaka.get(f.properties.plaka)
    if (!r) return
    layer.bindTooltip(
      `<b>${r.ad}</b><br/>${metricLabel}: <b>${fmt(r[metric])}</b><br/>Ölü: ${fmt(r.olu)} · Yaralı: ${fmt(r.yarali)}`,
      { sticky: true, className: 'map-tip' },
    )
    layer.on({
      click: () => onSelect(r.plaka === selected ? null : r.plaka),
      mouseover: (e) => e.target.setStyle({ weight: 2, color: '#e2e8f0' }),
      mouseout: (e) => e.target.setStyle(style(f)),
    })
  }

  const min = Math.min(...rows.map((r) => r[metric]))
  const legend = [min, ...breaks].map((lo, i, arr) => {
    const hi = arr[i + 1] - 1
    return { color: rampColor(i, classes), text: i === arr.length - 1 ? `${fmt(lo)}+` : hi === lo ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}` }
  })

  return (
    <div className="province-map">
      <MapContainer bounds={TR_BOUNDS} zoomSnap={0.1} className="map map-tr" scrollWheelZoom={false} attributionControl={false} zoomControl={false}>
        <FitTurkey />
        {geo && <GeoJSON key={`${metric}-${selected}-${rows.length}-${rows[0]?.[metric]}`} data={geo} style={style} onEachFeature={onEachFeature} />}
      </MapContainer>
      <div className="legend" aria-label={`${metricLabel} renk açıklaması`}>
        <span className="legend-title">{metricLabel}</span>
        <div className="legend-scale">
          {legend.map((l) => (
            <div key={l.text} className="legend-step">
              <i style={{ background: l.color }} />
              <span>{l.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
