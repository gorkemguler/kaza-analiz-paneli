// EGM Trafik Başkanlığı "Aylık Trafik İstatistik Bülteni" PDF'lerini yapılandırılmış JSON'a çevirir.
// PDF'teki metin parçaları y koordinatına göre satırlara, x koordinatına göre sütunlara ayrılır.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const MONTHS = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK']

const num = (s) => Number(String(s).replace(/\./g, ''))
const isNum = (s) => /^\d{1,3}(\.\d{3})*$/.test(s)

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
      line.cells.push({ text: it.str.trim(), x: it.transform[4], cx: it.transform[4] + it.width / 2 })
    }
    for (const l of lines) {
      l.cells.sort((a, b) => a.x - b.x)
      l.text = l.cells.map((c) => c.text).join(' ')
    }
    pages.push(lines)
  }
  return pages
}

// "BAŞLIK ¦ ay ¦ yıl" biçimindeki tabloları, başlık satırından TOPLAM satırına kadar okur
function labelTable(lines, header) {
  const start = lines.findIndex((l) => l.text.startsWith(header))
  if (start < 0) throw new Error(`Tablo bulunamadı: ${header}`)
  const rows = []
  const extra = [] // TOPLAM satırından sonra gelen, toplama dahil olmayan kalemler
  let total = null
  for (const l of lines.slice(start + 1)) {
    const nums = l.cells.filter((c) => isNum(c.text))
    const label = l.cells.filter((c) => !isNum(c.text)).map((c) => c.text).join(' ').trim()
    if (nums.length < 2 || /^(S\.N|[A-ZÇĞİÖŞÜ ]+ \d{4} )/.test(l.text)) {
      if (rows.length) break
      continue
    }
    const [month, ytd] = nums.slice(-2).map((c) => num(c.text))
    if (label === 'TOPLAM') {
      total = { month, ytd }
      continue
    }
    ;(total ? extra : rows).push({ name: label, month, ytd })
  }
  return { rows, total, extra }
}

function checkSum(name, { rows, total }) {
  if (!total) return
  for (const key of ['month', 'ytd']) {
    const sum = rows.reduce((s, r) => s + r[key], 0)
    if (sum !== total[key]) throw new Error(`${name}: satır toplamı (${sum}) TOPLAM (${total[key]}) ile tutmuyor`)
  }
}

const TOTAL_KEYS = {
  'TOPLAM KAZA SAYISI': 'toplamKaza',
  'ÖLÜMLÜ KAZA SAYISI': 'olumluKaza',
  'YARALANMALI KAZA SAYISI': 'yaralanmaliKaza',
  'MADDİ HASARLI KAZA SAYISI': 'maddiHasarliKaza',
  'ÖLÜ SAYISI': 'olu',
  'YARALI SAYISI': 'yarali',
}

function totalsTable(lines) {
  const blocks = []
  for (const l of lines) {
    const key = Object.keys(TOTAL_KEYS).find((k) => l.text.startsWith(k))
    if (!key) continue
    const [yerlesim, disi, toplam] = l.cells.filter((c) => isNum(c.text)).map((c) => num(c.text))
    if (key === 'TOPLAM KAZA SAYISI') blocks.push({ toplam: {}, yerlesimYeri: {}, yerlesimYeriDisi: {} })
    const b = blocks.at(-1)
    b.toplam[TOTAL_KEYS[key]] = toplam
    b.yerlesimYeri[TOTAL_KEYS[key]] = yerlesim
    b.yerlesimYeriDisi[TOTAL_KEYS[key]] = disi
  }
  if (blocks.length !== 2) throw new Error('Genel toplam tabloları okunamadı')
  return { month: blocks[0], ytd: blocks[1] }
}

// İl tablosu: her satırda iki il var, boş hücreler olabilir; sayılar sütun başlıklarının x konumuna göre eşlenir
const PROVINCE_FIELDS = ['olumluYaralanmaliKaza', 'maddiHasarliKaza', 'olu', 'yarali']

function provinceTable(lines) {
  const headerIdx = lines.findIndex((l) => l.text.startsWith('İLLER'))
  const header = lines[headerIdx]
  // Başlık iki satıra bölünmüş olabilir; her yarıda "İLLER" hücresinden sonraki 4 sütun merkezi
  const headerCells = lines.filter((l) => Math.abs(l.y - header.y) < 12).flatMap((l) => l.cells)
  const groups = headerCells.filter((c) => c.text === 'İLLER').map((c) => c.x).sort((a, b) => a - b)
  const colCenters = groups.map((gx, gi) => {
    const next = groups[gi + 1] ?? Infinity
    const cols = []
    for (const c of headerCells.filter((c) => c.x > gx + 5 && c.x < next - 5).sort((a, b) => a.x - b.x)) {
      if (!cols.length || c.cx - cols.at(-1) > 15) cols.push(c.cx)
    }
    return cols
  })

  const rows = []
  let total = null
  for (const l of lines.slice(headerIdx + 1)) {
    for (let g = 0; g < groups.length; g++) {
      const next = groups[g + 1] ?? Infinity
      const cells = l.cells.filter((c) => c.x >= groups[g] - 5 && c.x < next - 5)
      const name = cells.filter((c) => !isNum(c.text)).map((c) => c.text).join(' ')
      if (!name || !colCenters[g] || colCenters[g].length !== 4) continue
      const rec = { il: name }
      for (const f of PROVINCE_FIELDS) rec[f] = null
      for (const c of cells.filter((c) => isNum(c.text))) {
        const nearest = colCenters[g].reduce((best, cx, i) => (Math.abs(cx - c.cx) < Math.abs(colCenters[g][best] - c.cx) ? i : best), 0)
        rec[PROVINCE_FIELDS[nearest]] = num(c.text)
      }
      if (name === 'TOPLAM') total = rec
      else if (/^[A-ZÇĞİÖŞÜ.]+$/.test(name)) rows.push(rec)
    }
  }
  if (rows.length !== 81) throw new Error(`İl tablosunda 81 yerine ${rows.length} il okundu`)

  // PDF'te boş bırakılmış tek hücreyi TOPLAM satırından geri hesapla
  for (const f of PROVINCE_FIELDS) {
    const missing = rows.filter((r) => r[f] === null)
    if (missing.length === 1 && total?.[f] != null) {
      missing[0][f] = total[f] - rows.reduce((s, r) => s + (r[f] ?? 0), 0)
      missing[0].hesaplanan = [...(missing[0].hesaplanan ?? []), f]
    }
    const sum = rows.reduce((s, r) => s + (r[f] ?? 0), 0)
    if (total?.[f] != null && sum !== total[f]) throw new Error(`İl tablosu ${f}: toplam ${sum} ≠ ${total[f]}`)
  }
  return rows
}

function findPage(pages, predicate, what) {
  const p = pages.find((lines) => predicate(lines.map((l) => l.text).join('\n')))
  if (!p) throw new Error(`Sayfa bulunamadı: ${what}`)
  return p
}

export async function parseEgmPdf(data) {
  const pages = await readLines(data)
  const all = pages.flat().map((l) => l.text).join('\n')
  const m = all.match(new RegExp(`(\\d{4}) (${MONTHS.join('|')})`))
  if (!m) throw new Error('Bülten dönemi bulunamadı')
  const period = `${m[1]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}`

  const tables = {}
  const read = (key, header, page) => {
    const t = labelTable(page, header)
    checkSum(key, t)
    tables[key] = t.rows
    if (t.extra.length) tables[`${key}Ek`] = t.extra
  }
  const olusPage = findPage(pages, (t) => t.includes('KAZA OLUŞ TÜRÜ'), 'oluş türü')
  read('olusTuru', 'S.N KAZA OLUŞ TÜRÜ', olusPage)
  read('aracSayisi', 'KAZAYA KARIŞAN ARAÇ SAYISI', olusPage)
  const kusurPage = findPage(pages, (t) => t.includes('KUSUR UNSURLARI'), 'kusurlar')
  read('kusurUnsurlari', 'KUSUR UNSURLARI', kusurPage)
  read('surucuKusurlari', 'SÜRÜCÜ KUSURLARI', kusurPage)
  read('aracCinsleri', 'S.N ARAÇ CİNSLERİ', findPage(pages, (t) => t.includes('ARAÇ CİNSLERİ'), 'araç cinsleri'))
  const cezaPage = findPage(pages, (t) => t.includes('TRAFİK CEZA BİLGİSİ'), 'cezalar')
  read('cezalar', 'TRAFİK CEZA BİLGİSİ', cezaPage)
  read('digerIslemler', 'DİĞER İŞLEMLER', cezaPage)

  const ilPages = pages.filter((lines) => lines.some((l) => l.text.startsWith('İLLER')))
  if (ilPages.length !== 2) throw new Error('İl tabloları bulunamadı')

  return {
    period,
    totals: totalsTable(findPage(pages, (t) => t.includes('TOPLAM KAZA SAYISI'), 'genel toplamlar')),
    ...tables,
    iller: { month: provinceTable(ilPages[0]), ytd: provinceTable(ilPages[1]) },
  }
}
