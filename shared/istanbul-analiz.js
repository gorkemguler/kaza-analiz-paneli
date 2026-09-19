// İBB Ulaşım Yönetim Merkezi kaza duyuruları üzerinde filtre ve analizler.
// Saf JavaScript: hem Node API'si hem tarayıcıdaki statik panel (GitHub Pages) aynı kodu kullanır.

export const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
export const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

// Sıkıştırılmış satır biçimindeki ham veriyi ({ severities, roads, rows, ... }) analiz nesnelerine çevirir
export function prepareIstanbul(raw) {
  const accidents = raw.rows.map(([id, t, dur, lat, lng, sev, zin, road, lanes, title]) => {
    const [y, mo, d] = t.slice(0, 10).split('-').map(Number)
    return {
      id, t, dur, lat, lng, title, lanes,
      zincirleme: zin === 1,
      severity: raw.severities[sev],
      road: raw.roads[road],
      year: y,
      month: mo - 1,
      hour: Number(t.slice(11, 13)),
      weekday: (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7, // 0 = Pazartesi
      place: placeName(title),
    }
  })
  return {
    accidents,
    meta: {
      severities: raw.severities,
      roads: raw.roads,
      dateRange: { from: accidents[0].t.slice(0, 10), to: accidents.at(-1).t.slice(0, 10) },
      source: raw.source,
      license: raw.license,
      sourceUpdatedAt: raw.sourceUpdatedAt,
      count: accidents.length,
    },
  }
}

const list = (v) => (v ? String(v).split(',').filter(Boolean) : null)

export function filterAccidents(accidents, q = {}) {
  const severities = list(q.severity)
  const roads = list(q.road)
  return accidents.filter(
    (a) =>
      (!q.from || a.t >= q.from) &&
      (!q.to || a.t.slice(0, 10) <= q.to) &&
      (!severities || severities.includes(a.severity)) &&
      (!roads || roads.includes(a.road)),
  )
}

function countBy(accidents, keyFn, keys) {
  const map = new Map(keys.map((k) => [k, 0]))
  for (const a of accidents) {
    const k = keyFn(a)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map].map(([name, value]) => ({ name, value }))
}

export function computeStats(accidents, meta) {
  const years = [...new Set(accidents.map((a) => a.year))].sort()
  const grid = WEEKDAYS.map(() => new Array(24).fill(0))
  for (const a of accidents) grid[a.weekday][a.hour]++

  return {
    totals: {
      kaza: accidents.length,
      yaralanmali: accidents.filter((a) => a.severity === 'Yaralanmalı').length,
      olumlu: accidents.filter((a) => a.severity === 'Ölümlü').length,
      zincirleme: accidents.filter((a) => a.zincirleme).length,
      gece: accidents.filter((a) => a.hour >= 22 || a.hour <= 5).length,
    },
    byHour: countBy(accidents, (a) => a.hour, [...Array(24).keys()]).map((d) => ({ ...d, name: `${String(d.name).padStart(2, '0')}:00` })),
    byWeekday: countBy(accidents, (a) => WEEKDAYS[a.weekday], WEEKDAYS),
    byMonth: countBy(accidents, (a) => MONTHS[a.month], MONTHS),
    byYear: countBy(accidents, (a) => a.year, years).map((d) => ({ ...d, name: String(d.name) })),
    byRoad: countBy(accidents, (a) => a.road, meta.roads).filter((d) => d.value).sort((x, y) => y.value - x.value),
    bySeverity: countBy(accidents, (a) => a.severity, meta.severities),
    weekHourGrid: grid,
  }
}

// Duyuru başlığından yer adı: "D100 Çobançeşme-Sefaköy Yönü, sağ şerit ..." → "D100 Çobançeşme-Sefaköy"
export function placeName(title) {
  return title
    .split(/\s+yönü(?:nde)?(?![a-zçğıöşü])|,|\s+trafik kaza|\s+maddi hasarlı|\s+meydana gelen/i)[0]
    .replace(/\s+(sağ|sol|orta)\s+şerit.*$/i, '')
    .trim()
}

export const riskScore = (a) => 1 + (a.severity === 'Yaralanmalı' ? 3 : 0) + (a.severity === 'Ölümlü' ? 10 : 0)

// Kazaları ~500 m'lik ızgara hücrelerinde toplayıp en riskli noktaları döndürür
export function computeHotspots(accidents, { limit = 10, cellSize = 0.005 } = {}) {
  const cells = new Map()
  for (const a of accidents) {
    const key = `${Math.round(a.lat / cellSize)}:${Math.round(a.lng / cellSize)}`
    let c = cells.get(key)
    if (!c) {
      c = { key, count: 0, injury: 0, fatal: 0, score: 0, latSum: 0, lngSum: 0, places: new Map(), hours: new Array(24).fill(0) }
      cells.set(key, c)
    }
    c.count++
    if (a.severity === 'Yaralanmalı') c.injury++
    if (a.severity === 'Ölümlü') c.fatal++
    c.score += riskScore(a)
    c.latSum += a.lat
    c.lngSum += a.lng
    c.hours[a.hour]++
    c.places.set(a.place, (c.places.get(a.place) ?? 0) + 1)
  }

  return [...cells.values()]
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((c) => {
      const peak = c.hours.indexOf(Math.max(...c.hours))
      return {
        id: c.key,
        location: [...c.places].sort((x, y) => y[1] - x[1])[0][0],
        lat: +(c.latSum / c.count).toFixed(5),
        lng: +(c.lngSum / c.count).toFixed(5),
        count: c.count,
        injury: c.injury,
        fatal: c.fatal,
        score: c.score,
        peakHour: `${String(peak).padStart(2, '0')}:00-${String((peak + 1) % 24).padStart(2, '0')}:00`,
      }
    })
}
