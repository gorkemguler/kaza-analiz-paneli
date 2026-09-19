// İzmir Ulaşım Merkezi kaza/arıza kayıtları üzerinde filtre ve analizler.
// Saf JavaScript: hem içe aktarma betiği hem tarayıcıdaki panel aynı kodu kullanır.

export const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
export const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

// Kayıtlardaki tür adları tutarsız yazılmış (büyük/küçük harf, "Kaza" eki); tek biçime indirgenir
export const TYPES = ['Ölümlü', 'Yaralanmalı', 'Zincirleme', 'Maddi hasarlı', 'Takla', 'Arızalı araç', 'Patlak lastik', 'Yakıtı biten', 'Araç yangını', 'Diğer']
export const ACCIDENT_TYPES = ['Ölümlü', 'Yaralanmalı', 'Zincirleme', 'Maddi hasarlı', 'Takla']

const TYPE_MAP = {
  'ölümlü': 'Ölümlü',
  'ölümlü kaza': 'Ölümlü',
  'yaralanmalı kaza': 'Yaralanmalı',
  'yaralanmalı': 'Yaralanmalı',
  'zincirleme kaza': 'Zincirleme',
  'maddi hasarlı': 'Maddi hasarlı',
  'takla atan': 'Takla',
  'arızalı': 'Arızalı araç',
  'patlak lastik': 'Patlak lastik',
  'yakıtı biten': 'Yakıtı biten',
  'yakıt bitimi': 'Yakıtı biten',
  'yangın': 'Araç yangını',
  'yanan araç': 'Araç yangını',
}

export function normalizeType(raw) {
  if (!raw) return null
  const key = String(raw).trim().toLocaleLowerCase('tr-TR')
  return TYPE_MAP[key] ?? 'Diğer'
}

export function prepareIzmir(raw) {
  const events = raw.rows.map(([tarih, saat, mudahaleDk, cadde, tur, konum, istikamet]) => {
    const [y, mo, d] = tarih.split('-').map(Number)
    return {
      tarih,
      saat,
      mudahaleDk,
      cadde: raw.streets[cadde],
      tur: raw.types[tur],
      konum,
      istikamet,
      year: y,
      month: mo - 1,
      hour: saat ? Number(saat.slice(0, 2)) : null,
      weekday: (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7, // 0 = Pazartesi
      isAccident: ACCIDENT_TYPES.includes(raw.types[tur]),
    }
  })
  return {
    events,
    meta: {
      types: raw.types,
      streets: [...raw.streets].sort((a, b) => a.localeCompare(b, 'tr')),
      dateRange: { from: events[0].tarih, to: events.at(-1).tarih },
      source: raw.source,
      license: raw.license,
      sourceUpdatedAt: raw.sourceUpdatedAt,
      count: events.length,
    },
  }
}

const list = (v) => (v ? String(v).split(',').filter(Boolean) : null)

export function filterEvents(events, q = {}) {
  const types = list(q.type)
  const streets = list(q.street)
  return events.filter(
    (e) =>
      (!q.from || e.tarih >= q.from) &&
      (!q.to || e.tarih <= q.to) &&
      (!types || types.includes(e.tur)) &&
      (!streets || streets.includes(e.cadde)),
  )
}

function countBy(events, keyFn, keys) {
  const map = new Map(keys.map((k) => [k, 0]))
  for (const e of events) {
    const k = keyFn(e)
    if (k != null) map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map].map(([name, value]) => ({ name, value }))
}

export const median = (nums) => {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  return s[s.length >> 1]
}

// Risk puanı: ölümlü ve yaralanmalı olaylar ağır basar
export const riskScore = (e) => (e.tur === 'Ölümlü' ? 10 : e.tur === 'Yaralanmalı' ? 3 : e.isAccident ? 1 : 0)

export function computeStats(events, meta) {
  const years = [...new Set(events.map((e) => e.year))].sort()
  const grid = WEEKDAYS.map(() => new Array(24).fill(0))
  for (const e of events) if (e.hour != null) grid[e.weekday][e.hour]++
  const count = (tur) => events.filter((e) => e.tur === tur).length

  return {
    totals: {
      olay: events.length,
      kaza: events.filter((e) => e.isAccident).length,
      olumlu: count('Ölümlü'),
      yaralanmali: count('Yaralanmalı'),
      ariza: events.filter((e) => !e.isAccident).length,
      medyanMudahaleDk: median(events.map((e) => e.mudahaleDk).filter((d) => d != null)),
    },
    byHour: countBy(events, (e) => e.hour, [...Array(24).keys()]).map((d) => ({ ...d, name: `${String(d.name).padStart(2, '0')}:00` })),
    byWeekday: countBy(events, (e) => WEEKDAYS[e.weekday], WEEKDAYS),
    byMonth: countBy(events, (e) => MONTHS[e.month], MONTHS),
    byYear: countBy(events, (e) => e.year, years).map((d) => ({ ...d, name: String(d.name) })),
    byType: countBy(events, (e) => e.tur, meta.types).filter((d) => d.value),
    weekHourGrid: grid,
    // Müdahale süresi yıllara göre: ekip performansının tek gerçek göstergesi
    responseByYear: years.map((y) => ({
      name: String(y),
      value: median(events.filter((e) => e.year === y && e.mudahaleDk != null).map((e) => e.mudahaleDk)) ?? 0,
    })),
  }
}

// Caddelere göre risk sıralaması; her cadde için en yoğun saat ve medyan müdahale süresi
export function computeStreets(events, { limit = 15 } = {}) {
  const map = new Map()
  for (const e of events) {
    let c = map.get(e.cadde)
    if (!c) map.set(e.cadde, (c = { cadde: e.cadde, count: 0, kaza: 0, olumlu: 0, yaralanmali: 0, score: 0, hours: new Array(24).fill(0), durs: [], konumlar: new Map() }))
    c.count++
    if (e.isAccident) c.kaza++
    if (e.tur === 'Ölümlü') c.olumlu++
    if (e.tur === 'Yaralanmalı') c.yaralanmali++
    c.score += riskScore(e)
    if (e.hour != null) c.hours[e.hour]++
    if (e.mudahaleDk != null) c.durs.push(e.mudahaleDk)
    if (e.konum) c.konumlar.set(e.konum, (c.konumlar.get(e.konum) ?? 0) + 1)
  }
  return [...map.values()]
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, limit)
    .map((c) => {
      const peak = c.hours.indexOf(Math.max(...c.hours))
      const top = [...c.konumlar].sort((x, y) => y[1] - x[1])[0]
      return {
        cadde: c.cadde,
        count: c.count,
        kaza: c.kaza,
        olumlu: c.olumlu,
        yaralanmali: c.yaralanmali,
        score: c.score,
        medyanMudahaleDk: median(c.durs),
        peakHour: `${String(peak).padStart(2, '0')}:00-${String((peak + 1) % 24).padStart(2, '0')}:00`,
        enSikKonum: top ? `${top[0]} (${top[1]})` : null,
      }
    })
}
