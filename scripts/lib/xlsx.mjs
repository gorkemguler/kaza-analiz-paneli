// Küçük XLSX okuyucu: dosyayı açar, ilk sayfanın hücrelerini satır dizilerine çevirir.
// (Tam bir XLSX kütüphanesi yerine, bu projedeki basit tabloları okumaya yetecek kadarı.)
import { unzipSync, strFromU8 } from 'fflate'

const EXCEL_EPOCH = Date.UTC(1899, 11, 30)

// Excel tarih/saat seri numarasını Date'e çevirir (tam sayı = gün, ondalık = günün kesri)
export const serialToDate = (n) => new Date(EXCEL_EPOCH + Math.round(n * 86400) * 1000)

const decode = (s) =>
  s.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, (m, code) =>
    code === 'amp' ? '&' : code === 'lt' ? '<' : code === 'gt' ? '>' : code === 'quot' ? '"' : code === 'apos' ? "'" : String.fromCharCode(Number(code.slice(1))),
  )

const textOf = (xml) => decode([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''))

// "B12" → 1 (sütun indeksi)
function columnIndex(ref) {
  let n = 0
  for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export function readXlsx(buffer) {
  const files = unzipSync(new Uint8Array(buffer))
  const file = (name) => (files[name] ? strFromU8(files[name]) : null)

  const shared = file('xl/sharedStrings.xml')
  const strings = shared ? [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : []

  const sheetName = Object.keys(files).find((f) => /^xl\/worksheets\/sheet1\.xml$/.test(f)) ?? Object.keys(files).find((f) => f.startsWith('xl/worksheets/'))
  if (!sheetName) throw new Error('XLSX içinde sayfa bulunamadı')

  const rows = []
  for (const [, attrs, body] of file(sheetName).matchAll(/<row([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowIndex = Number(attrs.match(/r="(\d+)"/)?.[1] ?? rows.length + 1) - 1
    const cells = []
    for (const [, cellAttrs, cellBody] of body.matchAll(/<c([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = cellAttrs.match(/r="([A-Z]+\d+)"/)?.[1]
      const type = cellAttrs.match(/t="([^"]+)"/)?.[1]
      const raw = cellBody ?? ''
      let value = null
      if (type === 's') value = strings[Number(raw.match(/<v>(\d+)<\/v>/)?.[1])]
      else if (type === 'inlineStr') value = textOf(raw)
      else {
        const v = raw.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        if (v != null && v !== '') value = type === 'str' ? decode(v) : Number(v)
      }
      if (value != null && value !== '') cells[ref ? columnIndex(ref) : cells.length] = value
    }
    rows[rowIndex] = cells
  }
  return rows.filter(Boolean)
}
