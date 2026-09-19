// EGM aylık bültenlerinden üretilen JSON dosyalarını (server/data/egm) okur ve API için hazırlar.
import fs from 'node:fs'
import path from 'node:path'
import { findIl } from './iller.js'

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export const periodLabel = (period) => {
  const [y, m] = period.split('-').map(Number)
  return `${AYLAR[m - 1]} ${y}`
}

function enrichProvinces(rows) {
  return rows.map((r) => {
    const il = findIl(r.il)
    if (!il) throw new Error(`EGM verisindeki "${r.il}" ili tanınmadı`)
    return { ...r, plaka: il.plaka, ad: il.ad }
  })
}

export function loadTurkiye(dir) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort() : []
  const months = files.map((f) => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    return { ...d, label: periodLabel(d.period), iller: { month: enrichProvinces(d.iller.month), ytd: enrichProvinces(d.iller.ytd) } }
  })
  const byPeriod = new Map(months.map((m) => [m.period, m]))

  return {
    periods: () => months.map((m) => ({ period: m.period, label: m.label })).reverse(),
    get: (period) => byPeriod.get(period),
    // Ülke geneli aylık seri (trend grafiği için)
    series: () =>
      months.map((m) => ({
        period: m.period,
        label: m.label,
        ...m.totals.month.toplam,
        olumluYaralanmaliKaza: m.totals.month.toplam.olumluKaza + m.totals.month.toplam.yaralanmaliKaza,
      })),
    // Tek bir ilin aylık serisi
    provinceSeries: (plaka) =>
      months.map((m) => {
        const r = m.iller.month.find((x) => x.plaka === plaka)
        return { period: m.period, label: m.label, ...r }
      }),
  }
}
