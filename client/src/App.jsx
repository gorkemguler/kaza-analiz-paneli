import { useEffect, useState } from 'react'
import { getJson } from './api.js'
import Filters from './components/Filters.jsx'
import KpiCards from './components/KpiCards.jsx'
import AccidentMap from './components/AccidentMap.jsx'
import Charts from './components/Charts.jsx'
import HotspotTable from './components/HotspotTable.jsx'

const EMPTY_FILTERS = { city: '', from: '', to: '', type: [], severity: [], weather: [] }

export default function App() {
  const [meta, setMeta] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [focus, setFocus] = useState(null)

  useEffect(() => {
    getJson('meta').then(setMeta).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([getJson('stats', filters), getJson('hotspots', filters), getJson('accidents', filters)])
      .then(([stats, hotspots, accidents]) => {
        if (!cancelled) {
          setData({ stats, hotspots, accidents })
          setError('')
        }
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [filters])

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img src="/favicon.svg" alt="" width="32" height="32" />
          <div>
            <h1>Trafik Kaza Analiz Paneli</h1>
            <p>Kaza yoğunluğu, risk noktaları ve zaman örüntüleri</p>
          </div>
        </div>
        {meta?.synthetic && <span className="badge">Demo: sentetik veri</span>}
      </header>

      {error && <div className="error">Hata: {error}. API sunucusunun çalıştığından emin olun.</div>}

      {meta && <Filters meta={meta} value={filters} onChange={setFilters} onReset={() => setFilters(EMPTY_FILTERS)} />}

      {data && (
        <>
          <KpiCards totals={data.stats.totals} />
          <section className="grid-main">
            <div className="card map-card">
              <h2>Kaza yoğunluk haritası</h2>
              <AccidentMap accidents={data.accidents} hotspots={data.hotspots} city={filters.city} focus={focus} />
            </div>
            <div className="card">
              <h2>En riskli 10 nokta</h2>
              <HotspotTable hotspots={data.hotspots} onSelect={setFocus} selected={focus?.id} />
            </div>
          </section>
          <Charts stats={data.stats} />
        </>
      )}

      <footer className="footer">
        Risk puanı = kaza sayısı + 3 × yaralı + 10 × ölü. Veriler demo amaçlı üretilmiştir; gerçek kararlar için resmi kayıtlar kullanılmalıdır.
      </footer>
    </div>
  )
}
