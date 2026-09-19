import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend, Cell } from 'recharts'
import { useApi, fmt, pct } from '../api.js'
import { Kpis, ChartCard, Sources } from '../components/ui.jsx'
import { ANIMATE, AXIS, GRID, TOOLTIP, SERIES } from '../chart-theme.js'
import KaraNoktalar from '../components/KaraNoktalar.jsx'

const KUSUR_ADLARI = { surucu: 'Sürücü', yaya: 'Yaya', tasit: 'Taşıt', yol: 'Yol', yolcu: 'Yolcu' }

export default function KgmPage() {
  const rapor = useApi('turkiye/kgm-rapor')
  const karaNoktalar = useApi('turkiye/kara-noktalar')

  const error = rapor.error || karaNoktalar.error
  if (error) return <div className="error">Hata: {error.message}</div>
  if (!rapor.data || !karaNoktalar.data) return <p className="muted loading">Yükleniyor…</p>

  const r = rapor.data
  const son = r.yillik.at(-1)
  const onceki = r.yillik.at(-2)
  const olumSerisi = r.yillik.map((y) => ({ name: String(y.yil), yerinde: y.oluKazaYerinde, toplam: y.oluToplam }))
  const riskSerisi = r.tasitKm.map((y) => ({ name: String(y.yil), value: y.oluToplam }))
  const kusur2025 = Object.entries(KUSUR_ADLARI).map(([key, ad]) => ({ name: ad, value: r.kusur.at(-1)[key] }))
  const avrupa = [...r.avrupa].sort((a, b) => b.milyonKisiyeOlu - a.milyonKisiyeOlu)
  const trSira = avrupa.findIndex((a) => a.ulke === 'TÜRKİYE') + 1
  const ortalama = avrupa.filter((a) => a.ulke !== 'TÜRKİYE').reduce((s, a) => s + a.milyonKisiyeOlu, 0) / (avrupa.length - 1)

  return (
    <>
      <div className="note">
        <b>Bu sayfa ne gösteriyor?</b> Karayolları Genel Müdürlüğü’nün <b>{r.yil} yılı trafik kazası özet raporu</b> ve resmi <b>kaza kara noktaları</b>. Bu rapor, aylık bültenlerde olmayan iki bilgiyi verir: kazadan sonraki <b>30 gün içinde</b> hayatını kaybedenler ve <b>araç-kilometre başına</b> risk. Türkiye’de kaza yerinde ölenlerin sayısı, gerçek can kaybının yalnızca {pct(son.oluKazaYerinde, son.oluToplam)}’idir.
      </div>

      <Kpis
        items={[
          { label: `${r.yil} toplam kaza`, value: fmt(son.toplamKaza), note: `${fmt(son.maddiHasarliKaza)} maddi hasarlı` },
          { label: 'Ölümlü-yaralanmalı kaza', value: fmt(son.olumluYaralanmaliKaza) },
          { label: 'Toplam can kaybı (30 gün)', value: fmt(son.oluToplam), tone: 'danger', note: `${fmt(son.oluKazaYerinde)} kaza yerinde, ${fmt(son.oluSonrasi)} sonrasında` },
          { label: 'Yaralı', value: fmt(son.yarali), tone: 'warn' },
          {
            label: `${onceki.yil} yılına göre can kaybı`,
            value: `${pct(Math.abs(son.oluToplam - onceki.oluToplam), onceki.oluToplam)} ${son.oluToplam > onceki.oluToplam ? 'arttı' : 'azaldı'}`,
            note: `${onceki.yil}: ${fmt(onceki.oluToplam)} kişi`,
          },
        ]}
      />

      <section className="charts">
        <ChartCard
          span={2}
          title="Yıllara göre can kaybı"
          subtitle="Kaza yerinde ölenler ile 30 gün içinde ölenlerin toplamı · Aylık bültenler yalnızca alttaki çizgiyi sayar"
        >
          <LineChart data={olumSerisi} margin={{ top: 8, right: 16 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" {...AXIS} />
            <YAxis {...AXIS} axisLine={false} width={52} tickFormatter={(v) => v.toLocaleString('tr-TR')} />
            <Tooltip {...TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line isAnimationActive={ANIMATE} dataKey="toplam" name="Toplam (30 gün)" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 3 }} />
            <Line isAnimationActive={ANIMATE} dataKey="yerinde" name="Kaza yerinde" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Yol riski" subtitle="100 milyon araç-km başına can kaybı · Trafik arttıkça kaza artar, bu ölçü artıştan arındırır">
          <LineChart data={riskSerisi} margin={{ top: 8, right: 16 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" {...AXIS} interval={1} />
            <YAxis {...AXIS} axisLine={false} width={36} />
            <Tooltip {...TOOLTIP} formatter={(v) => v.toLocaleString('tr-TR')} />
            <Line isAnimationActive={ANIMATE} dataKey="value" name="100 milyon araç-km'de ölü" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title={`Kazalara sebep olan kusurlar (${r.yil})`} subtitle="Ölümlü ve yaralanmalı kazalarda, yüzde" height={220}>
          <BarChart data={kusur2025} layout="vertical" margin={{ left: 8, right: 24 }}>
            <XAxis type="number" {...AXIS} unit="%" />
            <YAxis type="category" dataKey="name" {...AXIS} width={70} axisLine={false} interval={0} />
            <Tooltip {...TOOLTIP} formatter={(v) => `%${v.toLocaleString('tr-TR')}`} />
            <Bar isAnimationActive={ANIMATE} dataKey="value" name="Pay" fill="#3987e5" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard
          span={2}
          title="Avrupa karşılaştırması: bir milyon kişiye düşen can kaybı"
          subtitle={`Türkiye ${avrupa.length} ülke içinde ${trSira}. sırada · Türkiye ${fmt(avrupa[trSira - 1].milyonKisiyeOlu)}, diğer ülkelerin ortalaması ${fmt(Math.round(ortalama))}`}
          height={520}
        >
          <BarChart data={avrupa} layout="vertical" margin={{ left: 8, right: 24 }}>
            <XAxis type="number" {...AXIS} />
            <YAxis type="category" dataKey="ulke" {...AXIS} width={150} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
            <Tooltip {...TOOLTIP} formatter={(v, _n, p) => [`${v} kişi · ${fmt(p.payload.olu)} can kaybı`, 'Bir milyon kişide']} />
            <Bar isAnimationActive={ANIMATE} dataKey="milyonKisiyeOlu" name="Bir milyon kişide ölü" radius={[0, 4, 4, 0]}>
              {avrupa.map((a) => (
                <Cell key={a.ulke} fill={a.ulke === 'TÜRKİYE' ? '#e66767' : '#3987e5'} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      </section>

      <KaraNoktalar data={karaNoktalar.data} />

      <Sources
        items={[
          { name: `KGM: ${r.yil} Yılı Trafik Kazalarına Ait Özet Bilgiler`, url: r.kaynak, note: 'PDF rapordan otomatik çıkarıldı' },
          { name: 'KGM: Kaza Kara Nokta Haritası', url: karaNoktalar.data.kaynak, note: `${karaNoktalar.data.noktalar.length} nokta` },
          { name: 'Bu sayfadaki verileri JSON/CSV olarak indirin', url: 'https://github.com/gorkemguler/kaza-analiz-paneli/tree/main/acik-veri/kgm', note: 'Açık veri' },
        ]}
      />
      <p className="footnote">
        Raporun kaynakları TÜİK, EGM ve Jandarma Genel Komutanlığı’dır. Kara nokta, belirli bir kaza türünün yoğunlaştığı ve iyileştirme çalışması planlanan yol kesimini ifade eder; listede yer almayan yerlerin güvenli olduğu anlamına gelmez.
      </p>
    </>
  )
}
