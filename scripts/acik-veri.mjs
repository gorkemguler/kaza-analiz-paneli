// server/data altındaki işlenmiş verilerden herkesin kullanabileceği JSON/CSV dosyalarını üretir (acik-veri/).
//
//   npm run veri:yayinla
//
// Çıktı deterministiktir: kaynak veri değişmediyse dosyalar da değişmez (otomatik güncelleme boş commit atmaz).
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTurkiye } from '../server/src/turkiye.js'
import { loadIstanbul } from '../server/src/istanbul.js'
import zlib from 'node:zlib'
import { prepareIzmir } from '../shared/izmir-analiz.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'server/data')
const OUT = path.join(ROOT, 'acik-veri')
const REPO = 'gorkemguler/kaza-analiz-paneli'
export const BASE_URL = `https://raw.githubusercontent.com/${REPO}/main/acik-veri`

// RFC 4180 CSV; Excel'in Türkçe karakterleri doğru açması için UTF-8 BOM ile
function toCsv(columns, rows) {
  const cell = (v) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [columns, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

const json = (data) => JSON.stringify(data, null, 1) + '\n'

async function write(rel, content) {
  const file = path.join(OUT, rel)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, content)
  return { yol: rel, url: `${BASE_URL}/${rel}`, boyutKB: Math.ceil(Buffer.byteLength(content) / 1024) }
}

// JSON ve CSV'yi aynı satırlardan üret
async function table(rel, columns, rows) {
  return [
    await write(`${rel}.csv`, toCsv(columns, rows.map((r) => columns.map((c) => r[c])))),
    await write(`${rel}.json`, json(rows)),
  ]
}

async function egm() {
  const tr = loadTurkiye(path.join(DATA, 'egm'))
  const periods = tr.periods().map((p) => p.period).sort()
  const files = []

  // 1) Her bülten, PDF'teki tüm tablolarla birlikte
  for (const p of periods) {
    const d = tr.get(p)
    files.push(
      await write(`egm/bultenler/${p}.json`, json({
        donem: d.period,
        etiket: d.label,
        kaynak: d.source,
        genelToplamlar: d.totals,
        olusTuru: d.olusTuru,
        aracSayisi: d.aracSayisi,
        kusurUnsurlari: d.kusurUnsurlari,
        surucuKusurlari: d.surucuKusurlari,
        aracCinsleri: d.aracCinsleri,
        cezalar: d.cezalar,
        digerIslemler: [...d.digerIslemler, ...(d.digerIslemlerEk ?? [])],
        iller: {
          ay: d.iller.month.map(({ il, ...r }) => r),
          yilbasindanBeri: d.iller.ytd.map(({ il, ...r }) => r),
        },
      })),
    )
  }

  // 2) İl bazında aylık uzun tablo
  const ilRows = periods.flatMap((p) =>
    [...tr.get(p).iller.month]
      .sort((a, b) => a.plaka - b.plaka)
      .map((r) => ({
        donem: p,
        plaka: r.plaka,
        il: r.ad,
        olumlu_yaralanmali_kaza: r.olumluYaralanmaliKaza,
        maddi_hasarli_kaza: r.maddiHasarliKaza,
        olu: r.olu,
        yarali: r.yarali,
        // PDF'te boş bırakılıp TOPLAM satırından hesaplanan sütun(lar)
        hesaplanan_alan: r.hesaplanan?.map((f) => f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)).join(' ') ?? null,
      })),
  )
  files.push(...(await table('egm/iller-aylik', Object.keys(ilRows[0]), ilRows)))

  // 3) Ülke geneli aylık özet (yerleşim yeri / dışı ayrımıyla)
  const FIELDS = [
    ['toplamKaza', 'toplam_kaza'], ['olumluKaza', 'olumlu_kaza'], ['yaralanmaliKaza', 'yaralanmali_kaza'],
    ['maddiHasarliKaza', 'maddi_hasarli_kaza'], ['olu', 'olu'], ['yarali', 'yarali'],
  ]
  const ulkeRows = periods.map((p) => {
    const t = tr.get(p).totals.month
    const row = { donem: p }
    for (const [k, col] of FIELDS) row[col] = t.toplam[k]
    for (const [k, col] of FIELDS) row[`yerlesim_yeri_${col}`] = t.yerlesimYeri[k]
    for (const [k, col] of FIELDS) row[`yerlesim_yeri_disi_${col}`] = t.yerlesimYeriDisi[k]
    return row
  })
  files.push(...(await table('egm/ulke-aylik', Object.keys(ulkeRows[0]), ulkeRows)))

  // 4) Diğer tablolar tek uzun tabloda: dönem, tablo, kalem, sayı
  const TABLES = {
    olusTuru: 'kaza_olus_sekli',
    aracSayisi: 'karisan_arac_sayisi',
    kusurUnsurlari: 'kusur_unsurlari',
    surucuKusurlari: 'surucu_kusurlari',
    aracCinsleri: 'karisan_arac_cinsi',
    cezalar: 'trafik_cezalari',
    digerIslemler: 'diger_ekip_faaliyetleri',
    digerIslemlerEk: 'diger_ekip_faaliyetleri',
  }
  const kalemRows = periods.flatMap((p) => {
    const d = tr.get(p)
    return Object.entries(TABLES).flatMap(([key, tablo]) => (d[key] ?? []).map((r) => ({ donem: p, tablo, kalem: r.name, sayi: r.month })))
  })
  files.push(...(await table('egm/tablolar-aylik', ['donem', 'tablo', 'kalem', 'sayi'], kalemRows)))

  return {
    kimlik: 'egm-aylik-trafik-bultenleri',
    ad: 'EGM Aylık Trafik İstatistik Bültenleri (işlenmiş)',
    aciklama: 'Emniyet Genel Müdürlüğü Trafik Başkanlığı aylık PDF bültenlerinden çıkarılmış tablolar: ülke geneli toplamlar, 81 il, kaza oluş şekli, sürücü kusurları, araç cinsleri, cezalar. Her tablonun satır toplamı PDF’teki TOPLAM satırıyla doğrulanmıştır.',
    kaynak: 'https://trafik.gov.tr/istatistikler37',
    kaynakKurum: 'Emniyet Genel Müdürlüğü Trafik Başkanlığı',
    donemler: { ilk: periods[0], son: periods.at(-1), adet: periods.length },
    dosyalar: files,
  }
}

async function kgm() {
  const data = JSON.parse(await fs.readFile(path.join(DATA, 'kgm/kara-noktalar.json'), 'utf8'))
  const rows = data.noktalar.map((n) => ({ kara_nokta_no: n.kkno, il: n.il, ilce: n.ilce, bolge: n.bolge, km: n.km, enlem: n.lat, boylam: n.lng }))
  return {
    kimlik: 'kgm-kaza-kara-noktalari',
    ad: 'KGM kaza kara noktaları',
    aciklama: 'Karayolları Genel Müdürlüğü’nün belirlediği, iyileştirme çalışması yürütülen kaza kara noktaları. Koordinatlar Web Mercator’dan WGS84’e çevrilmiştir.',
    kaynak: data.kaynak,
    kaynakKurum: data.kurum,
    kapsam: { nokta: rows.length, il: new Set(rows.map((r) => r.il)).size },
    dosyalar: await table('kgm/kara-noktalar', Object.keys(rows[0]), rows),
  }
}

async function ibb() {
  const ist = loadIstanbul(path.join(DATA, 'ibb/kazalar.json.gz'))
  const yillik = JSON.parse(await fs.readFile(path.join(DATA, 'ibb/yillik.json'), 'utf8'))
  const files = []

  const rows = ist.accidents.map((a) => ({
    id: a.id,
    zaman: a.t,
    enlem: a.lat,
    boylam: a.lng,
    sonuc: a.severity,
    zincirleme: a.zincirleme ? 1 : 0,
    yol: a.road,
    kapali_serit: a.lanes,
    duyuru_metni: a.title,
  }))
  // Büyük dosya: yalnızca CSV (JSON hâli 2–3 kat büyük olurdu)
  files.push(await write('ibb/istanbul-kaza-duyurulari.csv', toCsv(Object.keys(rows[0]), rows.map(Object.values))))

  const yRows = yillik.years.map((y) => ({
    yil: y.yil,
    turkiye_yerlesim_yeri: y.trYerlesim,
    turkiye_yerlesim_yeri_disi: y.trDisi,
    istanbul_yerlesim_yeri: y.istYerlesim,
    istanbul_yerlesim_yeri_disi: y.istDisi,
  }))
  files.push(...(await table('ibb/yillik-olumlu-yaralanmali-kaza', Object.keys(yRows[0]), yRows)))

  return {
    kimlik: 'ibb-istanbul-kaza-duyurulari',
    ad: 'İstanbul konumlu kaza duyuruları (işlenmiş)',
    aciklama: 'İBB Ulaşım Yönetim Merkezi trafik duyurularından ayıklanmış “Kaza Bildirimi” kayıtları. Kaza sonucu ve yol adı duyuru metninden çıkarılmıştır; hatalı koordinatlar atılmıştır.',
    kaynak: ist.meta.source,
    kaynakKurum: 'İstanbul Büyükşehir Belediyesi',
    kaynakLisans: ist.meta.license,
    kaynakGuncelleme: ist.meta.sourceUpdatedAt?.slice(0, 10),
    kapsam: { ilk: ist.meta.dateRange.from, son: ist.meta.dateRange.to, kayit: rows.length },
    dosyalar: files,
  }
}

async function izmir() {
  const raw = JSON.parse(zlib.gunzipSync(await fs.readFile(path.join(DATA, 'izmir/olaylar.json.gz'))))
  const { events, meta } = prepareIzmir(raw)
  const rows = events.map((e) => ({
    tarih: e.tarih,
    saat: e.saat,
    tur: e.tur,
    cadde: e.cadde,
    istikamet: e.istikamet,
    konum: e.konum,
    mudahale_dk: e.mudahaleDk,
  }))
  const files = await table('izmir/izmir-kaza-ariza-olaylari', Object.keys(rows[0]), rows)

  // Konum eşleştirmesi OpenStreetMap türevi olduğu için ayrı dosyada ve ODbL ile paylaşılır
  const konum = JSON.parse(zlib.gunzipSync(await fs.readFile(path.join(DATA, 'izmir/konumlar.json.gz'))))
  const konumRows = konum.points.map((p) => ({ cadde: p.cadde, konum: p.konum, enlem: p.lat, boylam: p.lng, olay: p.olay, eslesme_uzakligi_km: p.uzaklikKm }))
  files.push(...(await table('izmir/mevki-konumlari', Object.keys(konumRows[0]), konumRows)))

  return {
    kimlik: 'izmir-kaza-ariza-olaylari',
    ad: 'İzmir kaza ve arıza olayları (işlenmiş)',
    aciklama: 'İzmir Ulaşım Merkezi’nin ana arterlerde kayda aldığı kaza ve arıza olayları. Tür adları tek biçime getirilmiş, müdahale süresi (olay saati → müdahale saati) hesaplanmıştır.',
    kaynak: meta.source,
    kaynakKurum: 'İzmir Büyükşehir Belediyesi',
    kaynakLisans: meta.license,
    kaynakGuncelleme: meta.sourceUpdatedAt?.slice(0, 10),
    kapsam: { ilk: meta.dateRange.from, son: meta.dateRange.to, kayit: rows.length, cadde: meta.streets.length },
    ekLisans: 'mevki-konumlari dosyaları OpenStreetMap türevidir ve ODbL ile paylaşılır (© OpenStreetMap katkıcıları)',
    dosyalar: files,
  }
}

async function main() {
  // README.md elle yazılır; üretilen klasörleri sıfırdan oluştur
  for (const dir of ['egm', 'kgm', 'ibb', 'izmir']) await fs.rm(path.join(OUT, dir), { recursive: true, force: true })
  const veriSetleri = [await egm(), await kgm(), await ibb(), await izmir()]
  await write('index.json', json({
    ad: 'Trafik Kaza Analiz Paneli: açık veri',
    aciklama: 'Kamu kurumlarının PDF ve açık veri portallarında yayımladığı trafik kazası verilerinin makinece okunabilir, doğrulanmış hâli.',
    depo: `https://github.com/${REPO}`,
    belgeler: `https://github.com/${REPO}/tree/main/acik-veri`,
    lisans: 'CC BY 4.0 (derleme); veriler kaynak kurumlara aittir, kullanırken kaynak gösterin',
    veriSetleri,
  }))
  const n = veriSetleri.reduce((s, v) => s + v.dosyalar.length, 0)
  console.log(`✔ acik-veri/: ${veriSetleri.length} veri seti, ${n} dosya`)
}

main().catch((e) => {
  console.error('Hata:', e.message)
  process.exit(1)
})
