// KGM'nin yıllık "Trafik Kazalarına Ait Özet Bilgiler" raporundaki tabloları JSON'a çevirir.
//
//   npm run veri:kgm-rapor
//   npm run veri:kgm-rapor -- rapor.pdf   (elle indirilmiş dosya)
//
// Bu rapor, EGM'nin aylık bültenlerinde olmayan iki şeyi verir:
//   - 30 gün içinde ölenler (aylık bültenler yalnızca kaza yerindeki ölümleri sayar)
//   - Taşıt-km başına risk ve Avrupa karşılaştırması
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'server/data/kgm')
const PDF_URL = 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Trafik/Trafik-kaza-ozetbilgi.pdf'
const SAYFA = 'https://www.kgm.gov.tr/Sayfalar/KGM/SiteTr/Trafik/TrafikKazalariOzeti.aspx'

const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'))
const isNum = (s) => /^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)

async function readLines(data) {
  const doc = await getDocument({ data, verbosity: 0 }).promise
  const pages = []
  for (let p = 1; p <= doc.numPages; p++) {
    const { items } = await (await doc.getPage(p)).getTextContent()
    const lines = []
    for (const it of items.filter((i) => i.str.trim()).sort((a, b) => b.transform[5] - a.transform[5])) {
      const y = it.transform[5]
      let line = lines.find((l) => Math.abs(l.y - y) < 4)
      if (!line) lines.push((line = { y, cells: [] }))
      line.cells.push({ text: it.str.trim(), x: it.transform[4] })
    }
    for (const l of lines) {
      l.cells.sort((a, b) => a.x - b.x)
      l.text = l.cells.map((c) => c.text).join(' ')
    }
    pages.push(lines)
  }
  return pages
}

// "TABLO 2.17" başlığından sonra gelen satırları okur: ilk hücre kalıba uymalı, en az `columns` sayı içermeli
function readTable(pages, tableNo, { label, columns, monotonic = false }) {
  const flat = pages.flat()
  const start = flat.findIndex((l) => l.text.replace(/\s+/g, '').includes(`TABLO${tableNo}`))
  if (start < 0) throw new Error(`${tableNo} numaralı tablo bulunamadı`)
  const rows = []
  for (const line of flat.slice(start + 1)) {
    const cells = line.cells.map((c) => c.text)
    const head = cells[0]
    const values = cells.slice(1).filter(isNum).map(num)
    // Tablo, sonraki tabloya/kaynak satırına gelince biter; aradaki başlık satırları atlanır
    if (rows.length && /^(TABLO|Kaynak|\(\d\))/.test(line.text)) break
    if (!label(head) || values.length < columns) continue
    // Yıl tablolarında yıl artmayı bırakmışsa tablo bitmiş, sonraki tablonun satırlarındayız
    if (monotonic && rows.length && Number(head) <= Number(rows.at(-1).ad)) break
    rows.push({ ad: head, degerler: values.slice(0, columns) })
  }
  if (!rows.length) throw new Error(`${tableNo} numaralı tabloda satır okunamadı`)
  return rows
}

const asObjects = (rows, key, columns) =>
  rows.map((r) => Object.fromEntries([[key, /^\d{4}$/.test(r.ad) ? Number(r.ad) : r.ad], ...columns.map((c, i) => [c, r.degerler[i]])]))

export async function parseKgmReport(data) {
  const pages = await readLines(data)
  const yil = Number(pages.flat().find((l) => /^\d{4} YILI/.test(l.text))?.text.slice(0, 4))
  if (!yil) throw new Error('Rapor yılı bulunamadı')

  const isYear = (s) => /^\d{4}$/.test(s)
  const isCountry = (s) => /^[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ .]{2,}$/.test(s)

  const yillik = asObjects(
    readTable(pages, '1.1', { label: isYear, columns: 8, monotonic: true }),
    'yil',
    ['arac', 'toplamKaza', 'olumluYaralanmaliKaza', 'maddiHasarliKaza', 'oluToplam', 'oluKazaYerinde', 'oluSonrasi', 'yarali'],
  )
  const tasitKm = asObjects(readTable(pages, '2.17', { label: isYear, columns: 4, monotonic: true }), 'yil', ['kaza', 'oluKazaYeri', 'oluToplam', 'yarali'])
  const kusur = asObjects(readTable(pages, '2.11', { label: isYear, columns: 5, monotonic: true }), 'yil', ['surucu', 'yaya', 'tasit', 'yol', 'yolcu'])
  const avrupa = asObjects(
    readTable(pages, '1.6', { label: isCountry, columns: 5 }),
    'ulke',
    ['olumluYaralanmaliKaza', 'olu', 'binKisiyeOtomobil', 'milyonOtomobileOlu', 'milyonKisiyeOlu'],
  )

  // Doğrulamalar: rakamlar kendi içinde tutarlı mı?
  const son = yillik.at(-1)
  if (son.yil !== yil) throw new Error(`Son satır ${son.yil}, rapor ${yil} yılına ait`)
  for (const r of yillik) {
    if (r.oluKazaYerinde + r.oluSonrasi !== r.oluToplam) throw new Error(`${r.yil}: kaza yeri + sonrası ölü sayısı toplamı tutmuyor`)
    if (r.olumluYaralanmaliKaza + r.maddiHasarliKaza !== r.toplamKaza) throw new Error(`${r.yil}: kaza sayıları toplamı tutmuyor`)
  }
  if (!avrupa.some((a) => a.ulke === 'TÜRKİYE')) throw new Error('Avrupa tablosunda Türkiye satırı yok')
  if (avrupa.length < 10 || tasitKm.length < 5 || kusur.length < 5) throw new Error('Tablolar beklenenden az satır içeriyor')
  for (const [ad, tablo] of [['taşıt-km', tasitKm], ['kusur oranları', kusur]]) {
    if (tablo.at(-1).yil !== yil) throw new Error(`${ad} tablosu ${tablo.at(-1).yil} yılında bitiyor, ${yil} bekleniyordu`)
  }

  return { yil, kaynak: SAYFA, pdf: PDF_URL, kurum: 'Karayolları Genel Müdürlüğü', yillik, tasitKm, kusur, avrupa }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  const local = process.argv.slice(2).find((a) => a.endsWith('.pdf'))
  const data = local
    ? new Uint8Array(await fs.readFile(local))
    : await (async () => {
        const res = await fetch(PDF_URL, { headers: { 'User-Agent': 'kaza-analiz-paneli (github.com/gorkemguler/kaza-analiz-paneli)' } })
        if (!res.ok) throw new Error(`Rapor indirilemedi (${res.status})`)
        return new Uint8Array(await res.arrayBuffer())
      })()

  const rapor = await parseKgmReport(data)
  const file = path.join(OUT_DIR, 'rapor.json')
  const content = JSON.stringify(rapor, null, 1) + '\n'
  if ((await fs.readFile(file, 'utf8').catch(() => null)) === content) {
    console.log(`✔ KGM raporu değişmemiş (${rapor.yil})`)
    return
  }
  await fs.writeFile(file, content)
  const son = rapor.yillik.at(-1)
  console.log(`✔ KGM ${rapor.yil} raporu: ${son.toplamKaza.toLocaleString('tr-TR')} kaza, ${son.oluToplam.toLocaleString('tr-TR')} ölü (${son.oluKazaYerinde.toLocaleString('tr-TR')} kaza yerinde)`)
  console.log(`  ${rapor.yillik.length} yıllık seri, ${rapor.avrupa.length} ülke karşılaştırması`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('Hata:', e.message)
    process.exit(1)
  })
}
