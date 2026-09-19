import { useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'

const TURKIYE = [
  [36, 26],
  [42, 44.5],
]

function Focus({ spot }) {
  const map = useMap()
  useEffect(() => {
    if (spot) map.flyTo([spot.lat, spot.lng], 13, { duration: 0.8 })
    else map.fitBounds(TURKIYE, { animate: false })
  }, [map, spot])
  return null
}

export default function KaraNoktalar({ data }) {
  const [selected, setSelected] = useState(null)
  const spots = data.noktalar

  return (
    <section className="grid-main">
      <div className="card">
        <div className="card-head">
          <h2>Resmi kaza kara noktaları</h2>
          <span className="subtitle">
            Karayolları Genel Müdürlüğü’nün belirlediği, iyileştirme çalışması yürütülen {spots.length} yol kesimi
          </span>
        </div>
        <MapContainer bounds={TURKIYE} className="map" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Focus spot={selected} />
          {spots.map((s) => (
            <CircleMarker
              key={s.kkno + s.km}
              center={[s.lat, s.lng]}
              radius={selected?.kkno === s.kkno ? 11 : 7}
              pathOptions={{ color: '#0f172a', weight: 1.5, fillColor: '#e66767', fillOpacity: 1 }}
              eventHandlers={{ click: () => setSelected(s) }}
            >
              <Popup>
                <b>
                  {s.il}
                  {s.ilce && ` / ${s.ilce}`}
                </b>
                <br />
                Kara nokta no: {s.kkno}
                <br />
                Kilometre: {s.km} · {s.bolge}. Bölge
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        <p className="attribution">
          Kaynak:{' '}
          <a href={data.kaynak} target="_blank" rel="noreferrer">
            KGM Kaza Kara Nokta Haritası
          </a>{' '}
          · Kara nokta, belirli bir kaza türünün yoğunlaştığı yol kesimidir.
        </p>
      </div>
      <div className="card">
        <h2>Kara nokta listesi</h2>
        <ol className="hotspots">
          {spots.map((s) => (
            <li key={s.kkno + s.km}>
              <button type="button" className={selected?.kkno === s.kkno ? 'active' : ''} onClick={() => setSelected(selected?.kkno === s.kkno ? null : s)}>
                <span className="rank" style={{ background: '#e66767' }} aria-hidden="true" />
                <span className="hs-body">
                  <span className="hs-title">
                    {s.il}
                    {s.ilce && ` / ${s.ilce}`}
                  </span>
                  <span className="hs-meta">
                    Kara nokta {s.kkno} · km {s.km} · {s.bolge}. Bölge
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
