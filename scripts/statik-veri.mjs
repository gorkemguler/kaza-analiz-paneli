// Panelin sunucusuz (GitHub Pages) çalışması için verileri client/public/data altına statik dosyalar olarak yazar.
// `npm run dev` ve `npm run build` öncesinde otomatik çalışır; çıktı git'e eklenmez.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTurkiye } from '../server/src/turkiye.js'
import { readIstanbulRaw } from '../server/src/istanbul.js'

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
await write('turkiye/yillik.json', JSON.parse(await fs.readFile(path.join(DATA, 'ibb/yillik.json'), 'utf8')))
for (const { period } of tr.periods()) await write(`turkiye/donem/${period}.json`, tr.get(period))
for (let plaka = 1; plaka <= 81; plaka++) await write(`turkiye/il/${plaka}.json`, tr.provinceSeries(plaka))

// İstanbul: ham satırlar; filtre ve analizler tarayıcıda shared/istanbul-analiz.js ile yapılır
const raw = readIstanbulRaw(path.join(DATA, 'ibb/kazalar.json.gz'))
await write('istanbul/kazalar.json', raw)

const size = (await fs.stat(path.join(OUT, 'istanbul/kazalar.json'))).size / 1024 / 1024
console.log(`✔ Statik panel verisi: ${tr.periods().length} EGM bülteni, ${raw.rows.length.toLocaleString('tr-TR')} İstanbul kaydı (${size.toFixed(1)} MB)`)
