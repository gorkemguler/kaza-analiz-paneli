import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { SEVERITY_COLORS } from '../api.js'

const AXIS = { stroke: '#94a3b8', fontSize: 12, tickLine: false }
const TOOLTIP = {
  contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
  cursor: { fill: 'rgba(148,163,184,0.1)' },
}
// Kullanıcı 'hareketi azalt' tercih ettiyse grafik animasyonlarını kapat
const ANIMATE = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
const WEATHER_COLORS = { Açık: '#38bdf8', Yağmurlu: '#6366f1', Karlı: '#e2e8f0', Sisli: '#94a3b8' }

function ChartCard({ title, children, span = 1 }) {
  return (
    <div className={`card chart span-${span}`}>
      <h2>{title}</h2>
      <ResponsiveContainer width="100%" height={240}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function Donut({ data, colors }) {
  return (
    <PieChart>
      <Pie isAnimationActive={ANIMATE} data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
        {data.map((d) => (
          <Cell key={d.name} fill={colors[d.name]} />
        ))}
      </Pie>
      <Tooltip {...TOOLTIP} itemStyle={{ color: '#e2e8f0' }} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
    </PieChart>
  )
}

export default function Charts({ stats }) {
  return (
    <section className="charts">
      <ChartCard title="Saatlere göre kaza sayısı" span={3}>
        <BarChart data={stats.byHour}>
          <CartesianGrid stroke="#1e293b" vertical={false} />
          <XAxis dataKey="name" {...AXIS} interval={2} />
          <YAxis {...AXIS} axisLine={false} width={36} />
          <Tooltip {...TOOLTIP} />
          <Bar isAnimationActive={ANIMATE} dataKey="value" name="Kaza" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Haftanın günleri">
        <BarChart data={stats.byWeekday}>
          <CartesianGrid stroke="#1e293b" vertical={false} />
          <XAxis dataKey="name" {...AXIS} />
          <YAxis {...AXIS} axisLine={false} width={36} />
          <Tooltip {...TOOLTIP} />
          <Bar isAnimationActive={ANIMATE} dataKey="value" name="Kaza" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Aylık eğilim" span={2}>
        <LineChart data={stats.byMonth} margin={{ top: 8, right: 12 }}>
          <CartesianGrid stroke="#1e293b" vertical={false} />
          <XAxis dataKey="name" {...AXIS} />
          <YAxis {...AXIS} axisLine={false} width={36} />
          <Tooltip {...TOOLTIP} />
          <Line isAnimationActive={ANIMATE} dataKey="value" name="Kaza" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Kaza türleri">
        <BarChart data={stats.byType} layout="vertical" margin={{ left: 20 }}>
          <XAxis type="number" {...AXIS} />
          <YAxis type="category" dataKey="name" {...AXIS} width={110} axisLine={false} />
          <Tooltip {...TOOLTIP} />
          <Bar isAnimationActive={ANIMATE} dataKey="value" name="Kaza" fill="#3b82f6" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Kaza sonucu">
        <Donut data={stats.bySeverity} colors={SEVERITY_COLORS} />
      </ChartCard>

      <ChartCard title="Hava durumu">
        <Donut data={stats.byWeather} colors={WEATHER_COLORS} />
      </ChartCard>
    </section>
  )
}
