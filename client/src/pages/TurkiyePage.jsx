import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts'
import { useApi, fmt, pct } from '../api.js'
import { Kpis, ChartCard, Segmented, Sources } from '../components/ui.jsx'
import { ANIMATE, AXIS, GRID, TOOLTIP, SERIES } from '../chart-theme.js'
import ProvinceMap from '../components/ProvinceMap.jsx'
import ProvinceTable from '../components/ProvinceTable.jsx'
import KaraNoktalar from '../components/KaraNoktalar.jsx'

const METRICS = [
  { value: 'olu', label: 'Ölü' },
  { value: 'yarali', label: 'Yaralı' },
  { value: 'olumluYaralanmaliKaza', label: 'Ölümlü-yaralanmalı kaza' },
  { value: 'maddiHasarliKaza', label: 'Maddi hasarlı kaza' },
]
const metricLabel = (m) => METRICS.find((x) => x.value === m).label

// Uzun etiketleri grafik ekseni için kısalt
const SHORT = {
  'Araç hızını yol, hava ve trafiğin gerektirdiği şartlara uydurmamak': 'Hızı şartlara uydurmamak',
  'Kavşak,geçit ve kaplamanın dar old.yerlerde geçiş önc.uymamak': 'Geçiş önceliğine uymamak',
  'Şerit izleme ve değiştirme kural.uymamak': 'Şerit kurallarına uymamak',
  'Doğrultu Değiştirme (dönüş) kurallarına uymamak': 'Dönüş kurallarına uymamak',
  'Manevraları düzenleyen genel şartlara uymamak': 'Manevra kurallarına uymamak',
  'Kırmızı ışık veya görevlinin dur işaretinde durmamak': 'Kırmızı ışıkta geçmek',
  'Taşıt giremez trafik işareti bulunan yerlere girmek': 'Girilmez yere girmek',
  'Trafik güvenliği ile ilgili diğer kurallara uymamak': 'Diğer güvenlik kuralları',
  'Yaya ve okul geçitlerinde yavaşlamamak, yayalara geçiş hakkı vermemek': 'Yayaya yol vermemek',
  'Alkollü olarak araç kullanmak': 'Alkollü araç kullanmak',
  'Aşırı hızla araç kullanmak': 'Aşırı hız',
  'Geçme yasağı olan yerlerden geçmek': 'Yasak yerde sollamak',
  'Hatalı şekilde veya yasak olan yerlere park etmek': 'Hatalı park',
}

function HBar({ title, subtitle, rows, scope, top = 10, span = 1 }) {
  const data = [...rows]
    .sort((a, b) => b[scope] - a[scope])
    .slice(0, top)
    .map((r) => ({ name: SHORT[r.name] ?? r.name, full: r.name, value: r[scope] }))
  return (
    <ChartCard title={title} subtitle={subtitle} span={span} height={Math.max(200, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" {...AXIS} tickFormatter={(v) => v.toLocaleString('tr-TR')} />
        <YAxis type="category" dataKey="name" {...AXIS} width={170} axisLine={false} interval={0} />
        <Tooltip {...TOOLTIP} labelFormatter={(_, p) => p?.[0]?.payload.full} />
        <Bar isAnimationActive={ANIMATE} dataKey="value" name="Sayı" fill="#3987e5" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartCard>
  )
}

export default function TurkiyePage() {
  const periods = useApi('turkiye/donemler')
  const [period, setPeriod] = useState(null)
  const [scope, setScope] = useState('month')
  const [metric, setMetric] = useState('olu')
  const [sortKey, setSortKey] = useState(null)
  const [selected, setSelected] = useState(null)

  const activePeriod = period ?? periods.data?.[0]?.period
  const donem = useApi(activePeriod && `turkiye/donem/${activePeriod}`)
  const seri = useApi('turkiye/seri')
  const ilSeri = useApi(selected && `turkiye/il/${selected}`)
  const yillik = useApi('turkiye/yillik')
  const karaNoktalar = useApi('turkiye/kara-noktalar')

  const d = donem.data
  const rows = d?.iller[scope] ?? []
  const selectedRow = rows.find((r) => r.plaka === selected)
  const scopeText = d ? (scope === 'month' ? d.label : `${d.period.slice(0, 4)} yılbaşından ${d.label} sonuna`) : ''

  // İBB'nin yıllık serisini 2012 = 100 olacak şekilde endeksle (Türkiye ve İstanbul ölçekleri çok farklı)
  const longTerm = useMemo(() => {
    const ys = yillik.data?.years
    if (!ys) return []
    const tr0 = ys[0].trYerlesim + ys[0].trDisi
    const ist0 = ys[0].istYerlesim + ys[0].istDisi
    return ys.map((y) => ({
      name: String(y.yil),
      tr: Math.round(((y.trYerlesim + y.trDisi) / tr0) * 100),
      ist: Math.round(((y.istYerlesim + y.istDisi) / ist0) * 100),
      trRaw: y.trYerlesim + y.trDisi,
      istRaw: y.istYerlesim + y.istDisi,
    }))
  }, [yillik.data])

  if (periods.error || donem.error) return <div className="error">Hata: {(periods.error || donem.error).message}</div>
  if (!d) return <p className="muted loading">Yükleniyor…</p>

  const t = d.totals[scope]
  const findRow = (rowsArr, prefix) => rowsArr.find((r) => r.name.startsWith(prefix))

  return (
    <>
      <section className="card toolbar">
        <label>
          Dönem
          <select value={activePeriod} onChange={(e) => setPeriod(e.target.value)}>
            {periods.data.map((p) => (
              <option key={p.period} value={p.period}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <Segmented
          label="Kapsam"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'month', label: 'Seçili ay' },
            { value: 'ytd', label: 'Yılbaşından beri' },
          ]}
        />
        <p className="toolbar-note">
          EGM Trafik Başkanlığı aylık bülteni · <b>{scopeText}</b>
        </p>
      </section>

      <Kpis
        items={[
          { label: 'Toplam kaza', value: fmt(t.toplam.toplamKaza), note: 'Tutanaksız anlaşmalı kazalar hariç' },
          { label: 'Ölümlü-yaralanmalı kaza', value: fmt(t.toplam.olumluKaza + t.toplam.yaralanmaliKaza) },
          { label: 'Ölü (kaza yerinde)', value: fmt(t.toplam.olu), tone: 'danger' },
          { label: 'Yaralı', value: fmt(t.toplam.yarali), tone: 'warn' },
          { label: 'Ölümlerin yerleşim yeri dışında olan payı', value: pct(t.yerlesimYeriDisi.olu, t.toplam.olu), note: `Kazaların yalnızca ${pct(t.yerlesimYeriDisi.toplamKaza, t.toplam.toplamKaza)}'i yerleşim yeri dışında` },
        ]}
      />

      <section className="grid-main">
        <div className="card">
          <div className="card-head">
            <h2>İllere göre dağılım</h2>
            <Segmented label="Harita ölçüsü" value={metric} onChange={setMetric} options={METRICS} />
          </div>
          <ProvinceMap rows={rows} metric={metric} metricLabel={metricLabel(metric)} selected={selected} onSelect={setSelected} />
        </div>
        <div className="card">
          <h2>İl tablosu</h2>
          <ProvinceTable rows={rows} sortKey={sortKey ?? metric} onSort={setSortKey} selected={selected} onSelect={setSelected} />
        </div>
      </section>

      {karaNoktalar.data && <KaraNoktalar data={karaNoktalar.data} />}

      <section className="charts">
        <ChartCard
          span={3}
          title={selectedRow ? `${selectedRow.ad}: aylık ${metricLabel(metric).toLocaleLowerCase('tr-TR')}` : `Türkiye geneli: aylık ${metricLabel(metric).toLocaleLowerCase('tr-TR')}`}
          subtitle={selectedRow ? 'Ülke geneline dönmek için aynı ile tekrar tıklayın' : 'Bir il seçmek için haritaya ya da tabloya tıklayın'}
        >
          <LineChart data={(selected ? ilSeri.data : seri.data) ?? []} margin={{ top: 8, right: 16 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} axisLine={false} width={56} tickFormatter={(v) => v.toLocaleString('tr-TR')} />
            <Tooltip {...TOOLTIP} />
            <Line isAnimationActive={ANIMATE} dataKey={metric} name={metricLabel(metric)} stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ChartCard>

        <HBar title="Kaza oluş şekli" subtitle="Ölümlü-yaralanmalı kazalar" rows={d.olusTuru} scope={scope} />
        <HBar title="Sürücü kusurları" subtitle="Ölümlü-yaralanmalı kazalarda, ilk 10" rows={d.surucuKusurlari} scope={scope} />
        <HBar title="Kazaya karışan araçlar" subtitle="Ölümlü-yaralanmalı kazalarda, ilk 10" rows={d.aracCinsleri} scope={scope} />
      </section>

      <Kpis
        items={[
          { label: 'Alkollü araç kullanan', value: fmt(findRow(d.digerIslemler, 'Alkollü')?.[scope]) },
          { label: 'Trafikten men edilen araç', value: fmt(findRow(d.digerIslemlerEk ?? [], 'Trafikten Men')?.[scope]) },
          { label: 'Sürücülere uygulanan ceza', value: fmt(findRow(d.cezalar, 'Sürücülere')?.[scope]) },
          { label: 'Plakaya uygulanan ceza', value: fmt(findRow(d.cezalar, 'Araç Plakasına')?.[scope]) },
          { label: 'Kusurların sürücüden kaynaklanan payı', value: pct(findRow(d.kusurUnsurlari, 'SÜRÜCÜ')?.[scope], d.kusurUnsurlari.reduce((s, r) => s + r[scope], 0)) },
        ]}
      />

      {longTerm.length > 0 && (
        <section className="charts">
          <ChartCard span={3} title="Uzun dönem: ölümlü-yaralanmalı kazalar (2012 = 100)" subtitle="Türkiye ve İstanbul farklı ölçekte olduğu için 2012 değerine göre endekslendi · Kaynak: İBB Açık Veri">
            <LineChart data={longTerm} margin={{ top: 8, right: 16 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} />
              <YAxis {...AXIS} axisLine={false} width={40} />
              <Tooltip
                {...TOOLTIP}
                formatter={(v, name, p) => [`${v} (${fmt(name === 'Türkiye' ? p.payload.trRaw : p.payload.istRaw)} kaza)`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line isAnimationActive={ANIMATE} dataKey="tr" name="Türkiye" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} />
              <Line isAnimationActive={ANIMATE} dataKey="ist" name="İstanbul" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartCard>
        </section>
      )}

      <Sources
        items={[
          { name: 'EGM Trafik Başkanlığı: Aylık Trafik İstatistik Bülteni', url: 'https://trafik.gov.tr/istatistikler37', note: `${periods.data.length} bülten, ${periods.data.at(-1).label} – ${periods.data[0].label}` },
          { name: 'Bu sayfadaki verileri JSON/CSV olarak indirin (açık veri)', url: 'https://github.com/gorkemguler/kaza-analiz-paneli/tree/main/acik-veri', note: 'PDF’lerden çıkarılmış, doğrulanmış, her gün otomatik güncellenir' },
          { name: 'KGM: Kaza Kara Nokta Haritası', url: 'https://yol.kgm.gov.tr/kazakaranoktaweb/', note: `${karaNoktalar.data?.noktalar.length ?? 0} resmi kara nokta` },
          { name: 'İBB Açık Veri: Yıllara Göre Ölümlü Yaralanmalı Trafik Kaza Sayısı', url: 'https://data.ibb.gov.tr/dataset/yillara-gore-olumlu-yaralanmali-trafik-kaza-sayisi', note: 'İBB Açık Veri Lisansı' },
        ]}
      />
      <p className="footnote">
        Ölü sayıları yalnızca kaza yerinde meydana gelen ölümleri kapsar; 30 günlük ölümleri içeren kesin rakamlar TÜİK tarafından yıllık yayımlanır. Aylık bülten bilgileri TÜİK yayınına kadar geçicidir.
        {rows.some((r) => r.hesaplanan) && ' * işaretli değer PDF’te boş bırakıldığı için TOPLAM satırından hesaplanmıştır.'}
      </p>
    </>
  )
}
