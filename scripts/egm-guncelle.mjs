// EGM aylık trafik bültenlerini indirip server/data/egm/YYYY-MM.json olarak kaydeder.
//
//   npm run veri:egm                 Sitedeki yeni bültenleri indirir (var olanları atlar)
//   npm run veri:egm -- --hepsi      Tüm bültenleri yeniden işler
//   npm run veri:egm -- bulten.pdf   Elle indirilmiş bir PDF'i işler
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEgmPdf } from './lib/egm-parser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'server/data/egm')
const RAW_DIR = path.join(ROOT, 'data/raw/egm')
const PAGE_URL = 'https://trafik.gov.tr/istatistikler37'
const BASE = 'https://trafik.gov.tr'
const UA = { 'User-Agent': 'Mozilla/5.0 (kaza-analiz-paneli)' }

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`${url} indirilemedi (${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

async function processPdf(data, source) {
  const result = await parseEgmPdf(data)
  const file = path.join(OUT_DIR, `${result.period}.json`)
  await fs.writeFile(file, JSON.stringify({ ...result, source }, null, 1))
  const t = result.totals.month.toplam
  const fixed = result.iller.month.concat(result.iller.ytd).filter((r) => r.hesaplanan)
  console.log(`✔ ${result.period}: ${t.toplamKaza.toLocaleString('tr-TR')} kaza, ${t.olu} ölü, ${t.yarali.toLocaleString('tr-TR')} yaralı`)
  for (const r of fixed) console.log(`  ↳ ${r.il}: PDF'te boş olan ${r.hesaplanan.join(', ')} TOPLAM satırından hesaplandı`)
  return result.period
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  await fs.mkdir(RAW_DIR, { recursive: true })
  const args = process.argv.slice(2)
  const localFiles = args.filter((a) => a.toLowerCase().endsWith('.pdf'))

  if (localFiles.length) {
    for (const f of localFiles) await processPdf(new Uint8Array(await fs.readFile(f)), path.basename(f))
    return
  }

  const html = await (await fetch(PAGE_URL, { headers: UA })).text()
  const links = [...new Set(html.match(/\/kurumlar\/trafik\.gov\.tr\/04-Istatistik\/Aylik\/\d{6}\/[^"']+\.pdf/gi) ?? [])]
  if (!links.length) throw new Error(`${PAGE_URL} sayfasında bülten bağlantısı bulunamadı; site yapısı değişmiş olabilir`)

  const existing = new Set((await fs.readdir(OUT_DIR)).map((f) => f.replace('.json', '')))
  let added = 0
  for (const link of links) {
    const ym = link.match(/Aylik\/(\d{4})(\d{2})\//)
    const period = `${ym[1]}-${ym[2]}`
    if (existing.has(period) && !args.includes('--hepsi')) continue
    const url = BASE + encodeURI(link)
    const rawFile = path.join(RAW_DIR, `${period}.pdf`)
    const data = await fetchBuffer(url)
    await fs.writeFile(rawFile, data)
    const parsed = await processPdf(data, url)
    if (parsed !== period) console.warn(`  ⚠ Bağlantı ${period} diyor ama PDF içeriği ${parsed} dönemine ait`)
    added++
  }
  console.log(added ? `${added} bülten işlendi.` : 'Yeni bülten yok, veriler güncel.')
}

main().catch((e) => {
  console.error('Hata:', e.message)
  process.exit(1)
})
