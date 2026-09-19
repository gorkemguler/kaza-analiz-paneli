import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { useApi, fmt, pct, SEVERITY_COLORS } from '../api.js'
import { Kpis, ChartCard, ChipGroup, Sources } from '../components/ui.jsx'
import { ANIMATE, AXIS, GRID, TOOLTIP } from '../chart-theme.js'
import AccidentMap from '../components/AccidentMap.jsx'
import HotspotTable from '../components/HotspotTable.jsx'
import WeekHourGrid from '../components/WeekHourGrid.jsx'

function presets(to) {
  const last = Number(to.slice(0, 4))
  return [
    { label: 'Son 12 ay', from: `${last - 1}${to.slice(4)}`, to },
    { label: String(last - 1), from: `${last - 1}-01-01`, to: `${last - 1}-12-31` },
    { label: String(last - 2), from: `${last - 2}-01-01`, to: `${last - 2}-12-31` },
    { label: 'Tümü', from: '', to: '' },
  ]
}

function Filters({ meta, value, onChange }) {
  const set = (key) => (v) => onChange({ ...value, [key]: v })
  const { from: min, to: max } = meta.dateRange
  return (
    <section className="card filters">
      <div className="filter-row">
        <label>
          Başlangıç
          <input type="date" min={min} max={max} value={value.from} onChange={(e) => set('from')(e.target.value)} />
        </label>
        <label>
          Bitiş
          <input type="date" min={min} max={max} value={value.to} onChange={(e) => set('to')(e.target.value)} />
        </label>
        <div className="presets">
          {presets(max).map((p) => (
            <button key={p.label} type="button" className={`chip ${value.from === p.from && value.to === p.to ? 'active' : ''}`} onClick={() => onChange({ ...value, from: p.from, to: p.to })}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <ChipGroup label="Kaza sonucu" options={meta.severities} selected={value.severity} onChange={set('severity')} colors={SEVERITY_COLORS} />
      <ChipGroup label="Yol" options={meta.roads} selected={value.road} onChange={set('road')} />
    </section>
  )
}

function Charts({ stats, lastDate }) {
  return (
    <section className="charts">
      <ChartCard title="Saatlere göre kaza duyurusu" span={2}>
        <BarChart data={stats.byHour}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="name" {...AXIS} interval={2} />
          <YAxis {...AXIS} axisLine={false} width={44} />
          <Tooltip {...TOOLTIP} />
          <Bar isAnimationActive={ANIMATE} dataKey="value" name="Kaza" fill="#3987e5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
      <ChartCard title="Kaza sonucu" subtitle="Duyuru metninden çıkarıldı">
        <PieChart>
          <Pie isAnimationActive={ANIMATE} data={stats.bySeverity} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
            {stats.bySeverity.map((d) => (
              <Cell key={d.name} fill={SEVERITY_COLORS[d.name]} />
            ))}
          </Pie>
          <Tooltip {...TOOLTIP} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ChartCard>

      <WeekHourGrid grid={stats.weekHourGrid} />

      <ChartCard title="Yıllara göre kaza duyurusu" subtitle={`Son yıl yalnızca ${new Date(lastDate).toLocaleDateString('tr-TR', { dateStyle: 'long' })} tarihine kadar olan kayıtları içerir`} span={2}>
        <BarChart data={stats.byYear}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="name" {...AXIS} />
          <YAxis {...AXIS} axisLine={false} width={52} tickFormatter={(v) => v.toLocaleString('tr-TR')} />
          <Tooltip {...TOOLTIP} />
          <Bar isAnimationActive={ANIMATE} dataKey="value" name="Kaza" fill="#3987e5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
      <ChartCard title="Aylara göre (mevsimsellik)">
        <BarChart data={stats.byMonth}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="name" {...AXIS} interval={1} />
          <YAxis {...AXIS} axisLine={false} width={44} />
          <Tooltip {...TOOLTIP} />
          <Bar isAnimationActive={ANIMATE} dataKey="value" name="Kaza" fill="#3987e5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Yollara göre" span={3} height={Math.max(200, stats.byRoad.length * 28)}>
        <BarChart data={stats.byRoad} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" {...AXIS} tickFormatter={(v) => v.toLocaleString('tr-TR')} />
          <YAxis type="category" dataKey="name" {...AXIS} width={150} axisLine={false} interval={0} />
          <Tooltip {...TOOLTIP} />
          <Bar isAnimationActive={ANIMATE} dataKey="value" name="Kaza" fill="#3987e5" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>
    </section>
  )
}

export default function IstanbulPage() {
  const meta = useApi('istanbul/meta')
  const [filters, setFilters] = useState(null)
  const [focus, setFocus] = useState(null)

  // Varsayılan: verideki son 12 ay
  const active = filters ?? (meta.data && { ...presets(meta.data.dateRange.to)[0], severity: [], road: [] })
  const query = active && { from: active.from, to: active.to, severity: active.severity, road: active.road }
  const stats = useApi(active && 'istanbul/stats', query ?? {})
  const hotspots = useApi(active && 'istanbul/hotspots', query ?? {})
  const points = useApi(active && 'istanbul/points', query ?? {})

  const error = meta.error || stats.error || hotspots.error || points.error
  if (error) return <div className="error">Hata: {error.message}</div>
  if (!meta.data || !stats.data || !hotspots.data || !points.data) return <p className="muted loading">Yükleniyor…</p>

  const t = stats.data.totals
  const m = meta.data
  const updated = new Date(m.sourceUpdatedAt).toLocaleDateString('tr-TR', { dateStyle: 'long' })

  return (
    <>
      <div className="note">
        <b>Bu sayfa ne gösteriyor?</b> İBB Ulaşım Yönetim Merkezi’nin 2013’ten beri yayımladığı <b>{fmt(m.count)} konumlu kaza duyurusu</b>. Duyurular ağırlıkla ana arterlerde ve kamera görüş alanındaki kazaları kapsar; tüm kazaların resmi kaydı değildir. Kaza sonucu duyuru metninden çıkarılmıştır. Veri İBB tarafından en son {updated} tarihinde güncellenmiştir.
      </div>

      <Filters meta={m} value={active} onChange={setFilters} />

      <Kpis
        items={[
          { label: 'Kaza duyurusu', value: fmt(t.kaza) },
          { label: 'Yaralanmalı', value: fmt(t.yaralanmali), tone: 'warn', note: pct(t.yaralanmali, t.kaza) },
          { label: 'Can kaybı olan', value: fmt(t.olumlu), tone: 'danger' },
          { label: 'Zincirleme kaza', value: pct(t.zincirleme, t.kaza) },
          { label: 'Gece (22:00–06:00)', value: pct(t.gece, t.kaza) },
        ]}
      />

      <section className="grid-main">
        <div className="card">
          <h2>Kaza yoğunluk haritası</h2>
          <AccidentMap points={points.data.points} fatal={points.data.fatal} hotspots={hotspots.data} focus={focus} />
        </div>
        <div className="card">
          <h2>En riskli 10 nokta</h2>
          <HotspotTable hotspots={hotspots.data} onSelect={setFocus} selected={focus?.id} />
        </div>
      </section>

      <Charts stats={stats.data} lastDate={m.dateRange.to} />

      <Sources
        items={[
          { name: 'İBB Açık Veri: Ulaşım Yönetim Merkezi Trafik Duyuru Verisi', url: m.source, note: `${m.license}, son güncelleme ${updated}` },
          { name: 'İşlenmiş kaza kayıtlarını CSV olarak indirin (açık veri)', url: 'https://github.com/gorkemguler/kaza-analiz-paneli/tree/main/acik-veri/ibb', note: 'Sonuç ve yol sınıflandırmasıyla' },
        ]}
      />
      <p className="footnote">Risk puanı = kaza sayısı + 3 × yaralanmalı kaza + 10 × can kaybı olan kaza. Noktalar ~500 m’lik hücrelerde toplanır.</p>
    </>
  )
}
