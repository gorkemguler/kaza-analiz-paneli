// İzmir Büyükşehir Belediyesi açık verisinden kaza ve arıza kayıtlarını indirip server/data/izmir altına kaydeder.
//
//   npm run veri:izmir
//
// Kaynak: "İzmir İli Arızalı, Kazalı Araç Verileri" (İzmir Ulaşım Merkezi kayıtları, İzmir Açık Veri Lisansı)
import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { readXlsx, serialToDate } from './lib/xlsx.mjs'
import { TYPES, normalizeType } from '../shared/izmir-analiz.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'server/data/izmir')
const API = 'https://acikveri.bizizmir.com/api/3/action'
const DATASET = 'izmir-ili-arizali-kazali-arac-verileri'

const pad = (n) => String(n).padStart(2, '0')
const dateStr = (serial) => serialToDate(serial).toISOString().slice(0, 10)
const timeStr = (serial) => {
  const d = serialToDate(serial)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
const minutesOfDay = (serial) => {
  const d = serialToDate(serial)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  const pkg = await (await fetch(`${API}/package_show?id=${DATASET}`)).json()
  if (!pkg.success) throw new Error('İzmir açık veri portalı yanıt vermedi')
  const resource = pkg.result.resources.find((r) => r.format?.toUpperCase() === 'XLSX')
  console.log(`↓ ${resource.name} indiriliyor (son güncelleme: ${resource.last_modified?.slice(0, 10)})`)

  const res = await fetch(resource.url)
  if (!res.ok) throw new Error(`Dosya indirilemedi (${res.status})`)
  const table = readXlsx(await res.arrayBuffer())

  const header = table[0].map((h) => String(h).trim())
  const col = (name) => {
    const i = header.indexOf(name)
    if (i < 0) throw new Error(`Sütun bulunamadı: ${name}; veri yapısı değişmiş olabilir`)
    return i
  }
  const C = { tarih: col('TARIH'), cadde: col('CADDE'), istikamet: col('ISTIKAMET'), konum: col('KONUM'), tur: col('TUR'), kaza: col('KAZA_ZAMANI'), mudahale: col('MUDAHALE_ZAMANI') }

  const streets = []
  const streetIndex = new Map()
  const rows = []
  let skipped = 0

  for (const r of table.slice(1)) {
    const tarih = r[C.tarih]
    const tur = normalizeType(r[C.tur])
    if (typeof tarih !== 'number' || !tur) {
      skipped++
      continue
    }
    const cadde = String(r[C.cadde] ?? '').trim() || 'Bilinmiyor'
    if (!streetIndex.has(cadde)) {
      streetIndex.set(cadde, streets.length)
      streets.push(cadde)
    }
    // Müdahale süresi: gece yarısını geçen kayıtlarda fark negatif çıkar
    let sure = null
    if (typeof r[C.kaza] === 'number' && typeof r[C.mudahale] === 'number') {
      let d = minutesOfDay(r[C.mudahale]) - minutesOfDay(r[C.kaza])
      if (d < 0) d += 24 * 60
      if (d <= 600) sure = d
    }
    rows.push([
      dateStr(tarih),
      typeof r[C.kaza] === 'number' ? timeStr(r[C.kaza]) : null,
      sure,
      streetIndex.get(cadde),
      TYPES.indexOf(tur),
      String(r[C.konum] ?? '').trim(),
      String(r[C.istikamet] ?? '').trim(),
    ])
  }
  rows.sort((a, b) => (a[0] === b[0] ? String(a[1]).localeCompare(String(b[1])) : a[0].localeCompare(b[0])))

  const out = {
    source: `https://acikveri.bizizmir.com/dataset/${DATASET}`,
    license: 'İzmir Açık Veri Lisansı',
    sourceUpdatedAt: resource.last_modified,
    types: TYPES,
    streets,
    columns: ['tarih', 'saat', 'mudahaleDk', 'cadde', 'tur', 'konum', 'istikamet'],
    rows,
  }

  // gzip çıktısı Node sürümüne göre değişebilir; içerik aynıysa dosyaya dokunma
  const file = path.join(OUT_DIR, 'olaylar.json.gz')
  const content = JSON.stringify(out)
  const previous = await fs.readFile(file).then((b) => zlib.gunzipSync(b).toString(), () => null)
  if (previous === content) {
    console.log(`✔ İzmir verisi değişmemiş (${rows.length.toLocaleString('tr-TR')} kayıt)`)
    return
  }
  await fs.writeFile(file, zlib.gzipSync(content, { level: 9 }))
  console.log(`✔ ${rows.length.toLocaleString('tr-TR')} kayıt (${rows[0][0]} → ${rows.at(-1)[0]}), ${streets.length} cadde; ${skipped} eksik satır atlandı`)
}

main().catch((e) => {
  console.error('Hata:', e.message)
  process.exit(1)
})
