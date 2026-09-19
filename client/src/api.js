export const SEVERITY_COLORS = {
  'Maddi hasarlı': '#60a5fa',
  Yaralanmalı: '#f59e0b',
  Ölümlü: '#ef4444',
}

function toQuery(filters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    const v = Array.isArray(value) ? value.join(',') : value
    if (v) params.set(key, v)
  }
  return params.toString()
}

export async function getJson(path, filters = {}) {
  const qs = toQuery(filters)
  const res = await fetch(`/api/${path}${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(`${path} yüklenemedi (${res.status})`)
  return res.json()
}
