import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts'
import { useApi, fmt, pct } from '../api.js'
import { Kpis, ChartCard, ChipGroup, Sources } from '../components/ui.jsx'
import { ANIMATE, AXIS, GRID, TOOLTIP, SERIES } from '../chart-theme.js'
import WeekHourGrid from '../components/WeekHourGrid.jsx'

const TYPE_COLORS = {
  Ölümlü: '#e66767',
  Yaralanmalı: '#c98500',
  Zincirleme: '#d95926',
  'Maddi hasarlı': '#3987e5',
  Takla: '#9085e9',
  'Arızalı araç': '#199e70',
  'Patlak lastik': '#6b7280',
  'Yakıtı biten': '#6b7280',
  'Araç yangını': '#6b7280',
  Diğer: '#6b7280',
}

function presets(to) {
  const last = Number(to.slice(0, 4))
  return [
    { label: 'Son 12 ay', from: `${last - 1}${to.slice(4)}`, to },
    { label: String(last - 1), from: `${last - 1}-01-01`, to: `${last - 1}-12-31` },
    { label: String(last - 2), from: `${last - 2}-01-01`, to: `${last - 2}-12-31` },
    { label: 'Tümü', from: '', to: '' },
  ]
}

function StreetTable({ streets, selected, onSelect }) {
  if (!streets.length) return <p className="muted">Seçili filtrelerde kayıt yok.</p>
  const max = streets[0].score
  return (
    <ol className="hotspots">
      {streets.map((s, i) => (
        <li key={s.cadde}>
          <button type="button" className={selected === s.cadde ? 'active' : ''} onClick={() => onSelect(selected === s.cadde ? null : s.cadde)}>
            <span className="rank">{i + 1}</span>
            <span className="hs-body">
              <span className="hs-title">{s.cadde}</span>
              <span className="hs-meta">
                {fmt(s.count)} olay · {fmt(s.olumlu)} ölümlü · {fmt(s.yaralanmali)} yaralanmalı · yoğun: {s.peakHour}
                {s.medyanMudahaleDk != null && ` · müdahale ${s.medyanMudahaleDk} dk`}
              </span>
              {s.enSikKonum && <span className="hs-meta">En sık nokta: {s.enSikKonum}</span>}
              <span className="bar">
                <span style={{ width: `${(s.score / max) * 100}%` }} />
              </span>
            </span>
            <span className="score" title="Risk puanı">
              {fmt(s.score)}
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}

export default function IzmirPage() {
  const meta = useApi('izmir/meta')
  const [filters, setFilters] = useState(null)
  const [street, setStreet] = useState(null)

  const active = filters ?? (meta.data && { ...presets(meta.data.dateRange.to)[0], type: [] })
  const query = active && { from: active.from, to: active.to, type: active.type, street }
  const stats = useApi(active && 'izmir/stats', query ?? {})
  const streets = useApi(active && 'izmir/streets', { ...(query ?? {}), street: null })

  const error = meta.error || stats.error || streets.error
  if (error) return <div className="error">Hata: {error.message}</div>
  if (!meta.data || !stats.data || !streets.data) return <p className="muted loading">Yükleniyor…</p>

  const m = meta.data
  const t = stats.data.totals
  const updated = new Date(m.sourceUpdatedAt).toLocaleDateString('tr-TR', { dateStyle: 'long' })
  const set = (key) => (v) => setFilters({ ...active, [key]: v })

  return (
    <>
      <div className="note">
        <b>Bu sayfa ne gösteriyor?</b> İzmir Ulaşım Merkezi’nin ana arterlerde kayda aldığı <b>{fmt(m.count)} kaza ve arıza olayı</b> (Aralık 2021’den bugüne). Kayıtlarda koordinat yok; olaylar cadde ve mevki adıyla tutuluyor. Bu veri, diğer sayfalardan farklı olarak <b>gerçek müdahale sürelerini</b> içeriyor. Kaynak en son {updated} tarihinde güncellenmiştir.
      </div>

      <section className="card filters">
        <div className="filter-row">
          <label>
            Başlangıç
            <input type="date" min={m.dateRange.from} max={m.dateRange.to} value={active.from} onChange={(e) => set('from')(e.target.value)} />
          </label>
          <label>
            Bitiş
            <input type="date" min={m.dateRange.from} max={m.dateRange.to} value={active.to} onChange={(e) => set('to')(e.target.value)} />
          </label>
          <div className="presets">
            {presets(m.dateRange.to).map((p) => (
              <button key={p.label} type="button" className={`chip ${active.from === p.from && active.to === p.to ? 'active' : ''}`} onClick={() => setFilters({ ...active, from: p.from, to: p.to })}>
                {p.label}
              </button>
            ))}
          </div>
          {street && (
            <button type="button" className="reset" onClick={() => setStreet(null)}>
              {street} seçili · temizle
            </button>
          )}
        </div>
        <ChipGroup label="Olay türü" options={m.types} selected={active.type} onChange={set('type')} colors={TYPE_COLORS} />
      </section>

      <Kpis
        items={[
          { label: 'Toplam olay', value: fmt(t.olay), note: `${fmt(t.ariza)} arıza, ${fmt(t.kaza)} kaza` },
          { label: 'Ölümlü kaza', value: fmt(t.olumlu), tone: 'danger' },
          { label: 'Yaralanmalı kaza', value: fmt(t.yaralanmali), tone: 'warn', note: pct(t.yaralanmali, t.kaza) + ' kazaların' },
          { label: 'Medyan müdahale süresi', value: t.medyanMudahaleDk != null ? `${t.medyanMudahaleDk} dk` : '–' },
          { label: 'Gece olayları (22:00–06:00)', value: pct(stats.data.byHour.filter((h) => Number(h.name.slice(0, 2)) >= 22 || Number(h.name.slice(0, 2)) <= 5).reduce((s, h) => s + h.value, 0), t.olay) },
        ]}
      />

      <section className="grid-main">
        <div className="card">
          <h2>En riskli 15 cadde</h2>
          <p className="subtitle">Risk puanı = 10 × ölümlü + 3 × yaralanmalı + 1 × diğer kazalar · Bir caddeye tıklayınca grafikler o caddeye göre süzülür</p>
          <StreetTable streets={streets.data} selected={street} onSelect={setStreet} />
        </div>
        <div className="card">
          <h2>Olay türleri{street && `: ${street}`}</h2>
          <ChartCard title="" height={420}>
            <BarChart data={stats.data.byType} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" {...AXIS} tickFormatter={(v) => v.toLocaleString('tr-TR')} />
              <YAxis type="category" dataKey="name" {...AXIS} width={110} axisLine={false} interval={0} />
              <Tooltip {...TOOLTIP} />
              <Bar isAnimationActive={ANIMATE} dataKey="value" name="Olay" fill="#3987e5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>
        </div>
      </section>

      <section className="charts">
        <ChartCard span={2} title={`Saatlere göre olaylar${street ? `: ${street}` : ''}`}>
          <BarChart data={stats.data.byHour}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" {...AXIS} interval={2} />
            <YAxis {...AXIS} axisLine={false} width={44} />
            <Tooltip {...TOOLTIP} />
            <Bar isAnimationActive={ANIMATE} dataKey="value" name="Olay" fill="#3987e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Yıllara göre medyan müdahale süresi" subtitle="Olayın kaydından ekibin müdahalesine geçen süre">
          <LineChart data={stats.data.responseByYear} margin={{ top: 8, right: 16 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" {...AXIS} />
            <YAxis {...AXIS} axisLine={false} width={40} unit=" dk" />
            <Tooltip {...TOOLTIP} formatter={(v) => `${v} dk`} />
            <Line isAnimationActive={ANIMATE} dataKey="value" name="Medyan süre" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ChartCard>

        <WeekHourGrid grid={stats.data.weekHourGrid} title="Gün ve saate göre olay yoğunluğu" unit="olay" />

        <ChartCard span={2} title="Yıllara göre olay sayısı">
          <BarChart data={stats.data.byYear}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" {...AXIS} />
            <YAxis {...AXIS} axisLine={false} width={52} tickFormatter={(v) => v.toLocaleString('tr-TR')} />
            <Tooltip {...TOOLTIP} />
            <Bar isAnimationActive={ANIMATE} dataKey="value" name="Olay" fill="#3987e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Aylara göre (mevsimsellik)">
          <BarChart data={stats.data.byMonth}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" {...AXIS} interval={1} />
            <YAxis {...AXIS} axisLine={false} width={44} />
            <Tooltip {...TOOLTIP} />
            <Bar isAnimationActive={ANIMATE} dataKey="value" name="Olay" fill="#3987e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </section>

      <Sources
        items={[
          { name: 'İzmir Açık Veri: İzmir İli Arızalı, Kazalı Araç Verileri', url: m.source, note: `${m.license}, son güncelleme ${updated}` },
          { name: 'İşlenmiş kayıtları CSV olarak indirin (açık veri)', url: 'https://github.com/gorkemguler/kaza-analiz-paneli/tree/main/acik-veri/izmir', note: 'Tür adları tek biçime getirilmiş, müdahale süreleri hesaplanmış' },
        ]}
      />
      <p className="footnote">
        Kayıtlar İzmir Ulaşım Merkezi’nin izlediği ana arterlerle sınırlıdır; il genelindeki tüm kazaları kapsamaz. Müdahale süresi, olay kaydı ile ekibin müdahale saati arasındaki farktır.
      </p>
    </>
  )
}
