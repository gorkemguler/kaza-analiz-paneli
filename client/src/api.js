import { useEffect, useState } from 'react'
import { prepareIstanbul, filterAccidents, computeStats, computeHotspots } from '../../shared/istanbul-analiz.js'

export const SEVERITY_COLORS = {
  'Maddi hasarlı': '#3987e5',
  Yaralanmalı: '#c98500',
  Ölümlü: '#e66767',
  Belirtilmemiş: '#6b7280',
}

export const fmt = (n) => (n == null ? '–' : n.toLocaleString('tr-TR'))
export const pct = (a, b) => (b ? `%${((a / b) * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}` : '–')

// Panel sunucusuz çalışır (GitHub Pages): veriler derleme sırasında üretilen statik dosyalardan okunur.
// Göreli yol, sitenin hangi alt dizinde yayımlandığından bağımsız çalışmasını sağlar.
async function fetchJson(file) {
  const res = await fetch(`data/${file}`)
  if (!res.ok) throw new Error(`${file} yüklenemedi (${res.status})`)
  return res.json()
}

// İstanbul verisi bir kez indirilir, filtreler ve analizler tarayıcıda hesaplanır
let istanbulPromise = null
const istanbul = () => (istanbulPromise ??= fetchJson('istanbul/kazalar.json').then(prepareIstanbul))

const ISTANBUL = {
  meta: async () => (await istanbul()).meta,
  stats: async (q) => {
    const { accidents, meta } = await istanbul()
    return computeStats(filterAccidents(accidents, q), meta)
  },
  hotspots: async (q) => computeHotspots(filterAccidents((await istanbul()).accidents, q), { limit: 10 }),
  points: async (q) => {
    const { accidents, meta } = await istanbul()
    const list = filterAccidents(accidents, q)
    return {
      points: list.map((a) => [a.lat, a.lng, meta.severities.indexOf(a.severity)]),
      fatal: list.filter((a) => a.severity === 'Ölümlü').map(({ id, lat, lng, t, title }) => ({ id, lat, lng, t, title })),
    }
  },
}

const normalize = (params) =>
  Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v]).filter(([, v]) => v))

export function getJson(path, params = {}) {
  const [area, ...rest] = path.split('/')
  if (area === 'turkiye') return fetchJson(`${path}.json`)
  if (area === 'istanbul' && ISTANBUL[rest[0]]) return ISTANBUL[rest[0]](normalize(params))
  return Promise.reject(new Error(`Bilinmeyen veri yolu: ${path}`))
}

// Parametreler değiştikçe veriyi yeniden yükler; eski isteklerin sonucunu yok sayar
export function useApi(path, params = {}) {
  const key = path ? path + JSON.stringify(normalize(params)) : null
  const [state, setState] = useState({ data: null, error: null, key: null })
  useEffect(() => {
    if (!key) return
    let cancelled = false
    getJson(path, params)
      .then((data) => !cancelled && setState({ data, error: null, key }))
      .catch((error) => !cancelled && setState((s) => ({ ...s, error, key })))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return { data: state.data, error: state.error, loading: state.key !== key }
}
