// Karayolları Genel Müdürlüğü'nün resmi "kaza kara noktaları" listesini indirir.
//
//   npm run veri:kgm
//
// Kaynak: KGM Kaza Kara Nokta Haritası (https://yol.kgm.gov.tr/kazakaranoktaweb/) arkasındaki açık servis.
// Kara nokta: belirli bir kaza türünün yoğunlaştığı, iyileştirme çalışması planlanan yol kesimi.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'server/data/kgm')
const URL = 'https://yol.kgm.gov.tr/services/api/gis/blackspots'
const SAYFA = 'https://yol.kgm.gov.tr/kazakaranoktaweb/'

// Web Mercator (EPSG:3857) → WGS84
const R = 20037508.34
const toLng = (x) => (x / R) * 180
const toLat = (y) => (Math.atan(Math.exp(((y / R) * 180 * Math.PI) / 180)) * 360) / Math.PI - 90

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  const res = await fetch(URL, { headers: { 'User-Agent': 'kaza-analiz-paneli (github.com/gorkemguler/kaza-analiz-paneli)' } })
  if (!res.ok) throw new Error(`KGM servisi yanıt vermedi (${res.status})`)
  const list = await res.json()
  if (!Array.isArray(list) || !list.length) throw new Error('KGM servisinden beklenen listede veri gelmedi')

  const noktalar = list
    .map((b) => {
      const [x, y] = b.geom?.coordinates ?? []
      if (typeof x !== 'number' || typeof y !== 'number') throw new Error(`Koordinat okunamadı: ${b.kkno}`)
      const [il, ilce] = String(b.il ?? '').split('/')
      return {
        kkno: b.kkno,
        il: il?.trim() ?? null,
        ilce: ilce?.trim() ?? null,
        bolge: b.bolgeno ? Number(b.bolgeno) : null,
        km: b.km ?? null,
        lat: +toLat(y).toFixed(5),
        lng: +toLng(x).toFixed(5),
      }
    })
    .sort((a, b) => (a.il ?? '').localeCompare(b.il ?? '', 'tr') || String(a.kkno).localeCompare(String(b.kkno)))

  const disarida = noktalar.filter((n) => n.lat < 35.5 || n.lat > 42.5 || n.lng < 25 || n.lng > 45)
  if (disarida.length) throw new Error(`${disarida.length} nokta Türkiye sınırları dışında çıktı; koordinat dönüşümü hatalı olabilir`)

  const out = {
    aciklama: 'KGM tarafından belirlenen, iyileştirme çalışması yürütülen kaza kara noktaları',
    kaynak: SAYFA,
    kurum: 'Karayolları Genel Müdürlüğü',
    noktalar,
  }
  const file = path.join(OUT_DIR, 'kara-noktalar.json')
  const content = JSON.stringify(out, null, 1) + '\n'
  if ((await fs.readFile(file, 'utf8').catch(() => null)) === content) {
    console.log(`✔ KGM kara noktaları değişmemiş (${noktalar.length} nokta)`)
    return
  }
  await fs.writeFile(file, content)
  console.log(`✔ ${noktalar.length} kaza kara noktası (${new Set(noktalar.map((n) => n.il)).size} il)`)
}

main().catch((e) => {
  console.error('Hata:', e.message)
  process.exit(1)
})
