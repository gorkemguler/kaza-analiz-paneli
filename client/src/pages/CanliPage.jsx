import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet'
import { fmt } from '../api.js'
import { Kpis, ChipGroup, Segmented } from '../components/ui.jsx'
import { TOMTOM_KEY, CITIES, CATEGORIES, MAGNITUDE, fetchIncidents, fetchCaption } from '../tomtom.js'

const REFRESH_MS = 5 * 60 * 1000
const DEFAULT_HIDDEN = ['Sıkışıklık', 'Yol çalışması']
const CATEGORY_NAMES = [...new Set(Object.values(CATEGORIES).sort((a, b) => a.priority - b.priority).map((c) => c.name))]
const CATEGORY_COLORS = Object.fromEntries(Object.values(CATEGORIES).map((c) => [c.name, c.color]))

const timeFmt = new Intl.DateTimeFormat('tr-TR', { timeStyle: 'short' })
const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' })

function sinceText(iso) {
  if (!iso) return ''
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (min < 1) return 'az önce'
  if (min < 60) return `${min} dk önce`
  if (min < 24 * 60) return `${Math.floor(min / 60)} sa önce`
  return dateTimeFmt.format(new Date(iso))
}

function FitCity({ city, focus }) {
  const map = useMap()
  useEffect(() => {
    const [w, s, e, n] = city.bbox
    map.fitBounds([[s, w], [n, e]], { animate: false })
  }, [map, city])
  useEffect(() => {
    if (focus) map.flyTo(focus.coords[0], 15, { duration: 0.8 })
  }, [map, focus])
  return null
}

function IncidentPopup({ inc }) {
  return (
    <Popup>
      <b>{inc.categoryName}</b>
      {inc.magnitude > 0 && inc.magnitude < 4 && <> · {MAGNITUDE[inc.magnitude]} gecikme</>}
      <br />
      {inc.description}
      <br />
      {[inc.from, inc.to].filter(Boolean).join(' → ')}
      {inc.delayMin > 0 && (
        <>
          <br />
          Gecikme: {inc.delayMin} dk
        </>
      )}
      {inc.start && (
        <>
          <br />
          Başlangıç: {dateTimeFmt.format(new Date(inc.start))}
        </>
      )}
    </Popup>
  )
}

function SetupNotice() {
  return (
    <div className="card setup">
      <h2>TomTom anahtarı tanımlı değil</h2>
      <p>Bu sayfa anlık trafik olaylarını TomTom Traffic API’den çeker. Derleme sırasında <code>VITE_TOMTOM_KEY</code> ortam değişkeni bulunamadı.</p>
      <ul>
        <li>
          <b>GitHub Pages için:</b> depo ayarlarında <code>TOMTOM_API_KEY</code> adlı bir Actions secret tanımlayın.
        </li>
        <li>
          <b>Yerelde:</b> <code>client/.env.local</code> dosyasına <code>VITE_TOMTOM_KEY=...</code> satırını ekleyin.
        </li>
      </ul>
    </div>
  )
}

export default function CanliPage() {
  const [cityId, setCityId] = useState('istanbul')
  const [state, setState] = useState({ incidents: null, error: null, at: null, loading: false })
  const [visible, setVisible] = useState(CATEGORY_NAMES.filter((n) => !DEFAULT_HIDDEN.includes(n)))
  const [focus, setFocus] = useState(null)
  const [caption, setCaption] = useState('© TomTom')
  const city = CITIES.find((c) => c.id === cityId)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const incidents = await fetchIncidents(city)
      setState({ incidents, error: null, at: new Date(), loading: false })
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }))
    }
  }, [city])

  useEffect(() => {
    if (!TOMTOM_KEY) return
    fetchCaption().then(setCaption)
  }, [])

  // Şehir değişince yükle; sekme görünürken 5 dakikada bir yenile (kota için arka planda yenileme yok)
  useEffect(() => {
    if (!TOMTOM_KEY) return
    load()
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const shown = useMemo(() => (state.incidents ?? []).filter((i) => visible.includes(i.categoryName)), [state.incidents, visible])

  if (!TOMTOM_KEY) return <SetupNotice />

  const all = state.incidents ?? []
  const count = (name) => all.filter((i) => i.categoryName === name).length

  return (
    <>
      <div className="note">
        <b>Anlık trafik olayları.</b> Kaza, arızalı araç ve yol kapanmaları TomTom’dan <b>doğrudan tarayıcınıza</b> gelir ve 5 dakikada bir yenilenir. TomTom lisansı gereği bu veriler <b>saklanmaz ve arşivlenmez</b>; geçmiş analizler için Türkiye ve İstanbul sayfalarındaki resmi verileri kullanın.
      </div>

      <section className="card toolbar">
        <Segmented
          label="Şehir"
          value={cityId}
          onChange={(id) => {
            setCityId(id)
            setFocus(null)
          }}
          options={CITIES.map((c) => ({ value: c.id, label: c.name }))} />
        <button type="button" className="chip" onClick={load} disabled={state.loading}>
          {state.loading ? 'Yükleniyor…' : '↻ Yenile'}
        </button>
        <p className="toolbar-note">
          {state.at ? (
            <>
              Son güncelleme <b>{timeFmt.format(state.at)}</b>
            </>
          ) : (
            'Yükleniyor…'
          )}
        </p>
      </section>

      {state.error && <div className="error">Hata: {state.error.message}</div>}

      <Kpis
        items={[
          { label: 'Aktif kaza', value: fmt(count('Kaza')), tone: 'danger' },
          { label: 'Arızalı araç', value: fmt(count('Arızalı araç')), tone: 'warn' },
          { label: 'Kapalı yol / şerit', value: fmt(count('Yol kapalı') + count('Şerit kapalı')) },
          { label: 'Sıkışıklık', value: fmt(count('Sıkışıklık')), note: `${fmt(all.filter((i) => i.magnitude === 3).length)} ağır gecikmeli olay` },
          { label: 'Toplam gecikme', value: `${fmt(all.reduce((s, i) => s + i.delayMin, 0))} dk`, note: 'Tüm olayların neden olduğu' },
        ]}
      />

      <section className="card filters">
        <ChipGroup label="Olay türü" options={CATEGORY_NAMES} selected={visible} onChange={setVisible} colors={CATEGORY_COLORS} />
      </section>

      <section className="grid-main">
        <div className="card">
          <h2>{city.name}: anlık olay haritası</h2>
          <MapContainer center={[41, 29]} zoom={10} className="map" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitCity city={city} focus={focus} />
            {shown.map((inc) =>
              inc.isLine ? (
                <Polyline key={inc.id} positions={inc.coords} pathOptions={{ color: inc.color, weight: inc.category === 6 ? 3 + inc.magnitude : 5, opacity: 0.9 }}>
                  <IncidentPopup inc={inc} />
                </Polyline>
              ) : null,
            )}
            {shown.map((inc) => (
              <CircleMarker
                key={`${inc.id}-p`}
                center={inc.coords[0]}
                radius={inc.category === 1 ? 8 : 6}
                pathOptions={{ color: '#0f172a', weight: 1.5, fillColor: inc.color, fillOpacity: 1 }}
              >
                <IncidentPopup inc={inc} />
              </CircleMarker>
            ))}
          </MapContainer>
          <p className="attribution">
            Trafik olay verisi:{' '}
            <a href="https://www.tomtom.com" target="_blank" rel="noreferrer">
              {caption}
            </a>
          </p>
        </div>
        <div className="card">
          <h2>Olaylar ({fmt(shown.length)})</h2>
          {state.incidents && !shown.length && <p className="muted">Seçili türlerde aktif olay yok.</p>}
          <ol className="hotspots incidents">
            {shown.slice(0, 100).map((inc) => (
              <li key={inc.id}>
                <button type="button" className={focus?.id === inc.id ? 'active' : ''} onClick={() => setFocus(inc)}>
                  <span className="rank" style={{ background: inc.color }} aria-hidden="true" />
                  <span className="hs-body">
                    <span className="hs-title">
                      {inc.categoryName}
                      {inc.roads.length > 0 && <span className="muted"> · {inc.roads.join(', ')}</span>}
                    </span>
                    <span className="hs-meta">{[inc.from, inc.to].filter(Boolean).join(' → ') || inc.description}</span>
                    <span className="hs-meta">
                      {inc.description !== inc.categoryName && `${inc.description} · `}
                      {inc.delayMin > 0 && `${inc.delayMin} dk gecikme · `}
                      {sinceText(inc.start)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  )
}
