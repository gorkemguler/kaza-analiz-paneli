// Demo amaçlı sentetik kaza verisi üretir.
// Konumlar gerçek kavşak/meydan koordinatlarıdır, kaza kayıtları ise rastgele üretilmiştir.
// Gerçek veriyle çalışmak için bu modül yerine bir CSV/veritabanı okuyucu koyulabilir (bkz. README).

export const CITIES = {
  Ankara: [
    { name: 'Kızılay Meydanı', lat: 39.9208, lng: 32.8541, weight: 9 },
    { name: 'Ulus Meydanı', lat: 39.9419, lng: 32.8543, weight: 6 },
    { name: 'AŞTİ Kavşağı', lat: 39.9180, lng: 32.8108, weight: 7 },
    { name: 'Kuğulu Park Kavşağı', lat: 39.9015, lng: 32.8610, weight: 4 },
    { name: 'Söğütözü Kavşağı', lat: 39.9110, lng: 32.8075, weight: 6 },
    { name: 'Dikmen Vadisi Girişi', lat: 39.8850, lng: 32.8420, weight: 3 },
    { name: 'Batıkent Metro Kavşağı', lat: 39.9690, lng: 32.7300, weight: 4 },
    { name: 'Eskişehir Yolu - ODTÜ', lat: 39.9000, lng: 32.7770, weight: 8 },
  ],
  İstanbul: [
    { name: 'Mecidiyeköy Kavşağı', lat: 41.0672, lng: 28.9950, weight: 10 },
    { name: 'Kadıköy Rıhtım', lat: 40.9910, lng: 29.0250, weight: 6 },
    { name: 'Aksaray Kavşağı', lat: 41.0110, lng: 28.9500, weight: 7 },
    { name: '15 Temmuz Köprüsü Girişi', lat: 41.0480, lng: 29.0300, weight: 9 },
    { name: 'Bakırköy Sahil Yolu', lat: 40.9780, lng: 28.8700, weight: 5 },
    { name: 'Ümraniye Kavşağı', lat: 41.0250, lng: 29.1100, weight: 6 },
    { name: 'Beşiktaş Barbaros Bulvarı', lat: 41.0430, lng: 29.0070, weight: 5 },
  ],
  İzmir: [
    { name: 'Konak Meydanı', lat: 38.4189, lng: 27.1287, weight: 8 },
    { name: 'Alsancak Liman Kavşağı', lat: 38.4400, lng: 27.1450, weight: 6 },
    { name: 'Bornova Kavşağı', lat: 38.4620, lng: 27.2160, weight: 5 },
    { name: 'Karşıyaka Çarşı', lat: 38.4560, lng: 27.1100, weight: 4 },
    { name: 'Çiğli Anadolu Caddesi', lat: 38.4900, lng: 27.0700, weight: 5 },
  ],
};

export const TYPES = ['Çarpışma', 'Arkadan çarpma', 'Yayaya çarpma', 'Devrilme', 'Tek taraflı', 'Motosiklet kazası'];
export const SEVERITIES = ['Maddi hasarlı', 'Yaralanmalı', 'Ölümlü'];
export const WEATHERS = ['Açık', 'Yağmurlu', 'Karlı', 'Sisli'];

// Deterministik sonuç için basit seed'li rastgele sayı üreteci (mulberry32)
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted(rand, items, weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Trafik yoğunluğuna benzeyen saat dağılımı: sabah ve akşam zirveleri
const HOUR_WEIGHTS = [1, 0.6, 0.5, 0.4, 0.4, 0.7, 1.5, 3.5, 5, 3.5, 2.8, 3, 3.4, 3.2, 3, 3.4, 4.2, 5.5, 6, 4.5, 3.2, 2.5, 2, 1.5];

export function generateAccidents({ count = 4000, seed = 42, start = '2025-01-01', end = '2025-12-31' } = {}) {
  const rand = rng(seed);
  const startMs = Date.parse(start);
  const days = Math.round((Date.parse(end) - startMs) / 86400000) + 1;
  const spots = Object.entries(CITIES).flatMap(([city, list]) => list.map((s) => ({ ...s, city })));
  const hours = [...Array(24).keys()];
  const accidents = [];

  for (let i = 0; i < count; i++) {
    const spot = weighted(rand, spots, spots.map((s) => s.weight));
    const day = new Date(startMs + Math.floor(rand() * days) * 86400000);
    const month = day.getUTCMonth();
    const winter = month === 11 || month <= 1;
    const hour = weighted(rand, hours, HOUR_WEIGHTS);
    const night = hour >= 22 || hour <= 5;

    const weather = weighted(rand, WEATHERS, winter ? [50, 25, 15, 10] : [80, 15, 0, 5]);
    const badWeather = weather !== 'Açık';
    const type = weighted(rand, TYPES, [30, 28, 12, 6, 12, 12]);

    // Gece, kötü hava, yaya ve motosiklet kazaları daha ağır sonuçlanır
    let risk = 1;
    if (night) risk += 0.8;
    if (badWeather) risk += 0.5;
    if (type === 'Yayaya çarpma' || type === 'Motosiklet kazası') risk += 1.2;
    if (type === 'Devrilme') risk += 0.8;
    const severity = weighted(rand, SEVERITIES, [70, 27 * risk, 1.5 * risk * risk]);

    const injured = severity === 'Maddi hasarlı' ? 0 : 1 + Math.floor(rand() * (type === 'Çarpışma' ? 4 : 2));
    const dead = severity === 'Ölümlü' ? 1 + (rand() < 0.15 ? 1 : 0) : 0;
    const vehicles = type === 'Tek taraflı' || type === 'Devrilme' || type === 'Yayaya çarpma' ? 1 : 2 + (rand() < 0.2 ? 1 : 0);

    // Kavşak merkezinden ~200 m içine dağıt
    const jitter = () => (rand() - 0.5) * 0.004;
    day.setUTCHours(hour, Math.floor(rand() * 60));

    accidents.push({
      id: i + 1,
      city: spot.city,
      location: spot.name,
      lat: +(spot.lat + jitter()).toFixed(5),
      lng: +(spot.lng + jitter()).toFixed(5),
      date: day.toISOString(),
      hour,
      weekday: (day.getUTCDay() + 6) % 7, // 0 = Pazartesi
      type,
      severity,
      weather,
      vehicles,
      injured,
      dead,
    });
  }
  return accidents;
}
