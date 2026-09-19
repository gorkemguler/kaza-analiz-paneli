// İBB Açık Veri Portalı'ndan İstanbul kaza verilerini indirip server/data/ibb/ altına kaydeder.
//
//   npm run veri:ibb
//
// Kaynaklar (İBB Açık Veri Lisansı):
//   - Ulaşım Yönetim Merkezi Trafik Duyuru Verisi → "Kaza Bildirimi" kayıtları (koordinatlı)
//   - Yıllara Göre Ölümlü Yaralanmalı Trafik Kaza Sayısı (Türkiye / İstanbul)
import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'server/data/ibb')
const API = 'https://data.ibb.gov.tr/api/3/action'
const DUYURU_DATASET = 'ulasim-yonetim-merkezi-trafik-duyuru-verisi'
const YILLIK_RESOURCE = '0e844d97-297f-4686-b19e-cf4cf4a08d6f'

export const SEVERITIES = ['Maddi hasarlı', 'Yaralanmalı', 'Ölümlü', 'Belirtilmemiş']

// Duyuru başlığının ilk kelimesinden ana yol/aks adı
const ROADS = [
  [/^d-?100\b|^e-?5\b/i, 'D100 (E-5)'],
  [/^tem\b/i, 'TEM'],
  [/^o-?3\b/i, 'O-3'],
  [/^basın/i, 'Basın Ekspres'],
  [/^bağlantı/i, 'Bağlantı yolları'],
  [/^sahil|^s\.yolu/i, 'Sahil Yolu'],
  [/^büyükdere/i, 'Büyükdere Cad.'],
  [/^şile/i, 'Şile Yolu'],
  [/^vatan/i, 'Vatan Cad.'],
  [/^avrasya/i, 'Avrasya Tüneli'],
  [/^10\.? ?yıl/i, '10. Yıl Cad.'],
  [/^(kuzey çevre|kco)\b/i, 'Kuzey Çevre Otoyolu'],
]
export const ROAD_NAMES = [...ROADS.map((r) => r[1]), 'Diğer']

export function classifySeverity(title) {
  const t = title.toLocaleLowerCase('tr-TR')
  if (/can ?kayb|ölümlü/.test(t)) return 2
  if (/yaralanmal|yaralı/.test(t)) return 1
  if (/hasarlı/.test(t)) return 0
  return 3
}

export function classifyRoad(title) {
  const t = title.trim()
  const i = ROADS.findIndex(([re]) => re.test(t))
  return i < 0 ? ROADS.length : i
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ';') out.push(cur), (cur = '')
    else cur += ch
  }
  out.push(cur)
  return out
}

const minutesBetween = (a, b) => (Date.parse(b.replace(' ', 'T')) - Date.parse(a.replace(' ', 'T'))) / 60000

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  const body = await res.json()
  if (!body.success) throw new Error(`${url} başarısız yanıt döndü`)
  return body.result
}

async function importAnnouncements() {
  const pkg = await getJson(`${API}/package_show?id=${DUYURU_DATASET}`)
  const resource = pkg.resources.find((r) => r.format?.toUpperCase() === 'CSV')
  console.log(`↓ ${resource.name} indiriliyor (son güncelleme: ${resource.last_modified?.slice(0, 10)})`)
  const res = await fetch(resource.url)
  if (!res.ok) throw new Error(`CSV indirilemedi (${res.status})`)
  const text = (await res.text()).replace(/^﻿/, '')

  const [headerLine, ...lines] = text.split(/\r?\n/)
  const h = parseCsvLine(headerLine)
  const col = (name) => {
    const i = h.indexOf(name)
    if (i < 0) throw new Error(`CSV'de ${name} sütunu yok; veri formatı değişmiş olabilir`)
    return i
  }
  const C = {
    id: col('ANNOUNCEMENT_ID'), start: col('ANNOUNCEMENT_STARTING_DATETIME'), end: col('ANNOUNCEMENT_ENDING_DATETIME'),
    type: col('ANNOUNCEMENT_TYPE_DESC'), lanes: col('CLOSED_LANE'), lat: col('LATITUDE'), lng: col('LONGITUDE'), title: col('ANNOUNCEMENT_TITLE'),
  }

  const rows = []
  let skipped = 0
  for (const line of lines) {
    if (!line) continue
    const f = parseCsvLine(line)
    if (f[C.type] !== 'Kaza Bildirimi') continue
    const lat = Number(f[C.lat])
    const lng = Number(f[C.lng])
    // İstanbul sınırları dışında kalan hatalı koordinatları at
    if (!(lat > 40.7 && lat < 41.7 && lng > 27.9 && lng < 30)) {
      skipped++
      continue
    }
    const start = f[C.start].slice(0, 16)
    // Not: bitiş zamanı çoğunlukla duyurunun varsayılan yayın süresidir (~29/89 dk), gerçek müdahale süresi değildir
    const dur = f[C.end] ? minutesBetween(f[C.start], f[C.end]) : NaN
    const title = f[C.title].trim().replace(/\s+/g, ' ')
    rows.push([
      Number(f[C.id]),
      start,
      dur > 0 && dur < 24 * 60 ? Math.round(dur) : null,
      +lat.toFixed(5),
      +lng.toFixed(5),
      classifySeverity(title),
      /zincirl/i.test(title) ? 1 : 0,
      classifyRoad(title),
      Number(f[C.lanes]) || 0,
      title,
    ])
  }
  rows.sort((a, b) => (a[1] < b[1] ? -1 : 1))

  const out = {
    source: `https://data.ibb.gov.tr/dataset/${DUYURU_DATASET}`,
    license: 'İBB Açık Veri Lisansı',
    sourceUpdatedAt: resource.last_modified,
    processedAt: new Date().toISOString(),
    severities: SEVERITIES,
    roads: ROAD_NAMES,
    columns: ['id', 'zaman', 'sureDk', 'lat', 'lng', 'sonuc', 'zincirleme', 'yol', 'kapaliSerit', 'baslik'],
    rows,
  }
  const file = path.join(OUT_DIR, 'kazalar.json.gz')
  await fs.writeFile(file, zlib.gzipSync(JSON.stringify(out), { level: 9 }))
  const size = (await fs.stat(file)).size / 1024 / 1024
  console.log(`✔ ${rows.length.toLocaleString('tr-TR')} kaza kaydı (${rows[0][1].slice(0, 10)} → ${rows.at(-1)[1].slice(0, 10)}), ${size.toFixed(1)} MB; ${skipped} hatalı koordinat atlandı`)
}

async function importYearly() {
  const { records } = await getJson(`${API}/datastore_search?resource_id=${YILLIK_RESOURCE}&limit=100`)
  const pick = (r, key) => Number(r[Object.keys(r).find((k) => k.toLowerCase().replace(/\s/g, '') === key)])
  const years = records
    .map((r) => ({
      yil: Number(r.Yil),
      trYerlesim: pick(r, 'tr-yerlesimyeri'),
      istYerlesim: pick(r, 'ist-yerlesimyeri'),
      trDisi: pick(r, 'tr-yerlesimyeridisi'),
      istDisi: pick(r, 'ist-yerlesimyeridisi'),
    }))
    .sort((a, b) => a.yil - b.yil)
  if (years.some((y) => Object.values(y).some(Number.isNaN))) throw new Error('Yıllık tabloda beklenmeyen sütun adları')
  await fs.writeFile(
    path.join(OUT_DIR, 'yillik.json'),
    JSON.stringify({ source: 'https://data.ibb.gov.tr/dataset/yillara-gore-olumlu-yaralanmali-trafik-kaza-sayisi', license: 'İBB Açık Veri Lisansı', years }, null, 1),
  )
  console.log(`✔ Yıllık ölümlü-yaralanmalı kaza serisi: ${years[0].yil}–${years.at(-1).yil}`)
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  await importYearly()
  await importAnnouncements()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('Hata:', e.message)
    process.exit(1)
  })
}
