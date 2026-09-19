import { useEffect, useState } from 'react'

export const SEVERITY_COLORS = {
  'Maddi hasarlı': '#3987e5',
  Yaralanmalı: '#c98500',
  Ölümlü: '#e66767',
  Belirtilmemiş: '#6b7280',
}

export const fmt = (n) => (n == null ? '–' : n.toLocaleString('tr-TR'))
export const pct = (a, b) => (b ? `%${((a / b) * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}` : '–')

function toQuery(params) {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    const v = Array.isArray(value) ? value.join(',') : value
    if (v) q.set(key, v)
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function getJson(path, params = {}) {
  const res = await fetch(`/api/${path}${toQuery(params)}`)
  if (!res.ok) throw new Error(`${path} yüklenemedi (${res.status})`)
  return res.json()
}

// Parametreler değiştikçe veriyi yeniden çeker; eski isteklerin sonucunu yok sayar
export function useApi(path, params = {}) {
  const key = path ? path + toQuery(params) : null
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
