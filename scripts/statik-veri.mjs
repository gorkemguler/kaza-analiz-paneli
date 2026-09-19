// Panelin sunucusuz (GitHub Pages) çalışması için verileri client/public/data altına statik dosyalar olarak yazar.
// `npm run dev` ve `npm run build` öncesinde otomatik çalışır; çıktı git'e eklenmez.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTurkiye } from '../server/src/turkiye.js'
import { readIstanbulRaw } from '../server/src/istanbul.js'
import zlib from 'node:zlib'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'server/data')
const OUT = path.join(ROOT, 'client/public/data')

async function write(rel, data) {
  const file = path.join(OUT, rel)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(data))
}

await fs.rm(OUT, { recursive: true, force: true })

// Türkiye: API uç noktalarıyla aynı yapıda hazır yanıtlar
const tr = loadTurkiye(path.join(DATA, 'egm'))
await write('turkiye/donemler.json', tr.periods())
await write('turkiye/seri.json', tr.series())
await write('turkiye/kara-noktalar.json', JSON.parse(await fs.readFile(path.join(DATA, 'kgm/kara-noktalar.json'), 'utf8')))
await write('turkiye/yillik.json', JSON.parse(await fs.readFile(path.join(DATA, 'ibb/yillik.json'), 'utf8')))
for (const { period } of tr.periods()) await write(`turkiye/donem/${period}.json`, tr.get(period))
for (let plaka = 1; plaka <= 81; plaka++) await write(`turkiye/il/${plaka}.json`, tr.provinceSeries(plaka))

// Canlı olaylar sayfası için il sorgu kutuları (TomTom bbox sınırı: 10.000 km²)
const geo = JSON.parse(await fs.readFile(path.join(ROOT, 'client/public/tr-iller.json'), 'utf8'))
const MAX_AREA = 9500
const iller = geo.features
  .map((f) => {
    const coords = f.geometry.coordinates.flat(f.geometry.type === 'MultiPolygon' ? 2 : 1)
    const lons = coords.map((c) => c[0])
    const lats = coords.map((c) => c[1])
    let [w, s, e, n] = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
    const [cx, cy] = [(w + e) / 2, (s + n) / 2]
    const kmPerLon = 111 * Math.cos((cy * Math.PI) / 180)
    const area = (e - w) * kmPerLon * ((n - s) * 111)
    // Büyük iller kutuya sığmaz: merkez çevresinde sınıra kadar küçült
    if (area > MAX_AREA) {
      const k = Math.sqrt(MAX_AREA / area)
      ;[w, e] = [cx - ((e - w) * k) / 2, cx + ((e - w) * k) / 2]
      ;[s, n] = [cy - ((n - s) * k) / 2, cy + ((n - s) * k) / 2]
    }
    return {
      plaka: f.properties.plaka,
      ad: f.properties.plaka === 3 ? 'Afyonkarahisar' : f.properties.ad,
      bbox: [w, s, e, n].map((v) => +v.toFixed(3)),
      kirpildi: area > MAX_AREA,
    }
  })
  .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))
await write('iller-bbox.json', iller)

// İstanbul: ham satırlar; filtre ve analizler tarayıcıda shared/istanbul-analiz.js ile yapılır
const raw = readIstanbulRaw(path.join(DATA, 'ibb/kazalar.json.gz'))
await write('istanbul/kazalar.json', raw)

// İzmir: ham satırlar; analizler tarayıcıda shared/izmir-analiz.js ile yapılır
const izmir = JSON.parse(zlib.gunzipSync(await fs.readFile(path.join(DATA, 'izmir/olaylar.json.gz'))))
await write('izmir/olaylar.json', izmir)
await write('izmir/konumlar.json', JSON.parse(zlib.gunzipSync(await fs.readFile(path.join(DATA, 'izmir/konumlar.json.gz')))))

const size = (await fs.stat(path.join(OUT, 'istanbul/kazalar.json'))).size / 1024 / 1024
console.log(`✔ Statik panel verisi: ${iller.length} il sorgu kutusu (${iller.filter((i) => i.kirpildi).length} kırpıldı), ${tr.periods().length} EGM bülteni, ${raw.rows.length.toLocaleString('tr-TR')} İstanbul + ${izmir.rows.length.toLocaleString('tr-TR')} İzmir kaydı (${size.toFixed(1)} MB)`)
