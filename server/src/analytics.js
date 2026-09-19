export const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// Risk puanı: ölümlü kazalar en ağır, yaralanmalı kazalar orta ağırlıkta
export const riskScore = (a) => 1 + a.injured * 3 + a.dead * 10;

export function filterAccidents(accidents, q = {}) {
  const from = q.from ? Date.parse(q.from) : -Infinity;
  const to = q.to ? Date.parse(q.to) + 86400000 : Infinity; // bitiş günü dahil
  const list = (v) => (v ? String(v).split(',').filter(Boolean) : null);
  const types = list(q.type);
  const severities = list(q.severity);
  const weathers = list(q.weather);

  return accidents.filter((a) => {
    const t = Date.parse(a.date);
    return (
      (!q.city || a.city === q.city) &&
      t >= from &&
      t < to &&
      (!types || types.includes(a.type)) &&
      (!severities || severities.includes(a.severity)) &&
      (!weathers || weathers.includes(a.weather))
    );
  });
}

function countBy(accidents, keyFn, keys) {
  const map = new Map(keys.map((k) => [k, 0]));
  for (const a of accidents) {
    const k = keyFn(a);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map].map(([name, value]) => ({ name, value }));
}

export function computeStats(accidents, meta) {
  const totals = accidents.reduce(
    (t, a) => {
      t.accidents++;
      t.injured += a.injured;
      t.dead += a.dead;
      if (a.severity === 'Ölümlü') t.fatalAccidents++;
      if (a.hour >= 22 || a.hour <= 5) t.night++;
      return t;
    },
    { accidents: 0, injured: 0, dead: 0, fatalAccidents: 0, night: 0 },
  );

  return {
    totals,
    byHour: countBy(accidents, (a) => a.hour, [...Array(24).keys()]).map((d) => ({ ...d, name: `${String(d.name).padStart(2, '0')}:00` })),
    byWeekday: countBy(accidents, (a) => WEEKDAYS[a.weekday], WEEKDAYS),
    byMonth: countBy(accidents, (a) => MONTHS[new Date(a.date).getUTCMonth()], MONTHS),
    byType: countBy(accidents, (a) => a.type, meta.types).sort((x, y) => y.value - x.value),
    bySeverity: countBy(accidents, (a) => a.severity, meta.severities),
    byWeather: countBy(accidents, (a) => a.weather, meta.weathers),
  };
}

// Kazaları ~500 m'lik ızgara hücrelerinde toplayıp en riskli noktaları döndürür
export function computeHotspots(accidents, { limit = 10, cellSize = 0.005 } = {}) {
  const cells = new Map();
  for (const a of accidents) {
    const key = `${Math.round(a.lat / cellSize)}:${Math.round(a.lng / cellSize)}`;
    let c = cells.get(key);
    if (!c) {
      c = { key, count: 0, injured: 0, dead: 0, score: 0, latSum: 0, lngSum: 0, locations: new Map(), city: a.city, peakHours: new Array(24).fill(0) };
      cells.set(key, c);
    }
    c.count++;
    c.injured += a.injured;
    c.dead += a.dead;
    c.score += riskScore(a);
    c.latSum += a.lat;
    c.lngSum += a.lng;
    c.peakHours[a.hour]++;
    c.locations.set(a.location, (c.locations.get(a.location) ?? 0) + 1);
  }

  return [...cells.values()]
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((c) => {
      const peak = c.peakHours.indexOf(Math.max(...c.peakHours));
      return {
        id: c.key,
        city: c.city,
        location: [...c.locations].sort((x, y) => y[1] - x[1])[0][0],
        lat: +(c.latSum / c.count).toFixed(5),
        lng: +(c.lngSum / c.count).toFixed(5),
        count: c.count,
        injured: c.injured,
        dead: c.dead,
        score: c.score,
        peakHour: `${String(peak).padStart(2, '0')}:00-${String((peak + 1) % 24).padStart(2, '0')}:00`,
      };
    });
}
