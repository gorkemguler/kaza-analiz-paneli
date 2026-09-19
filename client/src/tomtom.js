// TomTom Traffic Incident Details API (v5) istemcisi.
//
// Lisans notu: TomTom şartları (md. 11.4, 11.6) sonuçların saklanmasını, birden çok kullanıcıya sunmak için
// önbelleğe alınmasını ve türetilmiş veritabanı oluşturulmasını yasaklar. Bu yüzden veri her ziyaretçinin
// tarayıcısında anlık çekilir; hiçbir yere (sunucu, depo, localStorage) kaydedilmez.
//
// Anahtar derleme sırasında VITE_TOMTOM_KEY ortam değişkeninden gelir (GitHub Secret: TOMTOM_API_KEY).
// Tarayıcıda göründüğü için TomTom panelinde alan adı kısıtlaması (domain whitelist) açık olmalıdır.
export const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_KEY

// Sorgu kutuları 81 ilin sınırlarından üretilir (scripts/statik-veri.mjs); kota için il başına tek istek
export const QUICK = [34, 6, 35, 16, 7, 41] // İstanbul, Ankara, İzmir, Bursa, Antalya, Kocaeli

// TomTom iconCategory kodları
export const CATEGORIES = {
  1: { name: 'Kaza', color: '#ef4444', priority: 0 },
  14: { name: 'Arızalı araç', color: '#f59e0b', priority: 1 },
  8: { name: 'Yol kapalı', color: '#a855f7', priority: 2 },
  7: { name: 'Şerit kapalı', color: '#c084fc', priority: 3 },
  3: { name: 'Tehlikeli durum', color: '#fb923c', priority: 4 },
  9: { name: 'Yol çalışması', color: '#94a3b8', priority: 5 },
  6: { name: 'Sıkışıklık', color: '#38bdf8', priority: 6 },
  0: { name: 'Diğer', color: '#64748b', priority: 7 },
}
// Sis, yağmur, buzlanma, rüzgâr, sel → hava kaynaklı
for (const c of [2, 4, 5, 10, 11]) CATEGORIES[c] = { name: 'Hava koşulu', color: '#22d3ee', priority: 4 }

export const MAGNITUDE = ['Bilinmiyor', 'Hafif', 'Orta', 'Ağır', 'Belirsiz']

const FIELDS =
  '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,length,delay,roadNumbers,lastReportTime}}}'

const startMs = (i) => (i.start ? Date.parse(i.start) : 0)

async function request(il, language) {
  const params = new URLSearchParams({
    key: TOMTOM_KEY,
    bbox: il.bbox.join(','),
    fields: FIELDS,
    language,
    timeValidityFilter: 'present',
  })
  return fetch(`https://api.tomtom.com/traffic/services/5/incidentDetails?${params}`)
}

export async function fetchIncidents(il) {
  let res = await request(il, 'tr-TR')
  // Türkçe desteklenmiyorsa İngilizceye düş
  if (res.status === 400) res = await request(il, 'en-GB')
  if (res.status === 403) throw new Error('TomTom anahtarı bu alan adında yetkili değil ya da geçersiz (403)')
  if (res.status === 429) throw new Error('TomTom günlük/saniyelik istek sınırı aşıldı (429); biraz sonra tekrar deneyin')
  if (!res.ok) throw new Error(`TomTom yanıt vermedi (${res.status})`)
  const { incidents = [] } = await res.json()

  return incidents
    .map(({ properties: p, geometry: g }) => {
      // TomTom koordinatları [boylam, enlem]; Leaflet [enlem, boylam] ister
      const coords = g.type === 'Point' ? [[g.coordinates[1], g.coordinates[0]]] : g.coordinates.map(([lng, lat]) => [lat, lng])
      const cat = CATEGORIES[p.iconCategory] ?? CATEGORIES[0]
      return {
        id: p.id,
        category: p.iconCategory,
        categoryName: cat.name,
        color: cat.color,
        priority: cat.priority,
        magnitude: p.magnitudeOfDelay ?? 0,
        description: p.events?.map((e) => e.description).filter(Boolean).join(' · ') || cat.name,
        from: p.from,
        to: p.to,
        roads: p.roadNumbers ?? [],
        delayMin: p.delay ? Math.round(p.delay / 60) : 0,
        lengthKm: p.length ? p.length / 1000 : 0,
        start: p.startTime,
        lastReport: p.lastReportTime,
        coords,
        isLine: g.type !== 'Point',
      }
    })
    .sort((a, b) => a.priority - b.priority || startMs(b) - startMs(a) || b.delayMin - a.delayMin)
}

// TomTom şartları gereği telif ibaresi Copyright API'den alınır
export async function fetchCaption() {
  try {
    const res = await fetch(`https://api.tomtom.com/map/2/copyrights/caption.json?key=${TOMTOM_KEY}`)
    return (await res.json()).copyrightsCaption || '© TomTom'
  } catch {
    return '© TomTom'
  }
}
