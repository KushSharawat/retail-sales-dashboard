import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'
import data from './data/sales_summary.json'
import './App.css'

const ROWS = data.rows
const QUALITY = data.quality_report
const ALL = 'All'

const gbp = (v) => `£${Math.round(v).toLocaleString('en-GB')}`
const gbpShort = (v) => (v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`)
const unique = (key) => [ALL, ...[...new Set(ROWS.map((r) => r[key]))].sort()]

// Sum revenue/orders/units grouped by one field
function groupBy(rows, key) {
  const map = new Map()
  for (const r of rows) {
    const g = map.get(r[key]) ?? { name: r[key], revenue: 0, orders: 0, units: 0 }
    g.revenue += r.revenue
    g.orders += r.orders
    g.units += r.units
    map.set(r[key], g)
  }
  return [...map.values()]
}

function Filter({ label, value, options, onChange }) {
  return (
    <label className="filter">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  )
}

function Kpi({ label, value, sub }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

export default function App() {
  const [year, setYear] = useState(ALL)
  const [region, setRegion] = useState(ALL)
  const [channel, setChannel] = useState(ALL)
  const [category, setCategory] = useState(ALL)

  const years = useMemo(() => [ALL, ...new Set(ROWS.map((r) => r.month.slice(0, 4)))], [])

  // Rows matching every filter except year (used for YoY comparison)
  const baseRows = useMemo(() => ROWS.filter((r) =>
    (region === ALL || r.region === region) &&
    (channel === ALL || r.channel === channel) &&
    (category === ALL || r.category === category)
  ), [region, channel, category])

  const rows = useMemo(
    () => baseRows.filter((r) => year === ALL || r.month.startsWith(year)),
    [baseRows, year],
  )

  const totals = useMemo(() => rows.reduce(
    (t, r) => ({ revenue: t.revenue + r.revenue, orders: t.orders + r.orders, units: t.units + r.units }),
    { revenue: 0, orders: 0, units: 0 },
  ), [rows])

  const yoy = useMemo(() => {
    const rev = (y) => baseRows.filter((r) => r.month.startsWith(y)).reduce((s, r) => s + r.revenue, 0)
    const r24 = rev('2024'), r25 = rev('2025')
    return r24 ? ((r25 - r24) / r24) * 100 : 0
  }, [baseRows])

  const monthly = useMemo(() => groupBy(rows, 'month').sort((a, b) => a.name.localeCompare(b.name)), [rows])
  const byCategory = useMemo(() => groupBy(rows, 'category').sort((a, b) => b.revenue - a.revenue), [rows])
  const byRegion = useMemo(() => groupBy(rows, 'region').sort((a, b) => b.revenue - a.revenue), [rows])
  const byChannel = useMemo(() => groupBy(rows, 'channel'), [rows])
  const topProducts = useMemo(() => groupBy(rows, 'product').sort((a, b) => b.revenue - a.revenue).slice(0, 8), [rows])

  const reset = () => { setYear(ALL); setRegion(ALL); setChannel(ALL); setCategory(ALL) }

  return (
    <div className="page">
      <header>
        <div>
          <h1>UK Retail Sales Dashboard</h1>
          <p className="muted">Sales performance 2024–2025 · cleaned with Python (pandas), built with React + Recharts</p>
        </div>
      </header>

      <section className="filters card">
        <Filter label="Year" value={year} options={years} onChange={setYear} />
        <Filter label="Region" value={region} options={unique('region')} onChange={setRegion} />
        <Filter label="Channel" value={channel} options={unique('channel')} onChange={setChannel} />
        <Filter label="Category" value={category} options={unique('category')} onChange={setCategory} />
        <button onClick={reset}>Reset</button>
      </section>

      <section className="kpis">
        <Kpi label="Total revenue" value={gbp(totals.revenue)} />
        <Kpi label="Orders" value={totals.orders.toLocaleString('en-GB')} />
        <Kpi label="Units sold" value={totals.units.toLocaleString('en-GB')} />
        <Kpi label="Average order value" value={gbp(totals.orders ? totals.revenue / totals.orders : 0)} />
        <Kpi label="Revenue growth 2025 vs 2024" value={`${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}%`} sub="ignores the year filter" />
      </section>

      <section className="card">
        <h2>Monthly revenue</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={monthly} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={gbpShort} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => gbp(v)} />
            <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Revenue by category</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCategory} layout="vertical" margin={{ left: 30, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" tickFormatter={gbpShort} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => gbp(v)} />
              <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2>Revenue by region</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byRegion} margin={{ right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={gbpShort} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => gbp(v)} />
              <Bar dataKey="revenue" name="Revenue" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Top products</h2>
          <table>
            <thead><tr><th>Product</th><th>Revenue</th><th>Units</th></tr></thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={p.name}><td>{p.name}</td><td>{gbp(p.revenue)}</td><td>{p.units.toLocaleString('en-GB')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Online vs in-store</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byChannel} margin={{ right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={gbpShort} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => gbp(v)} />
              <Bar dataKey="revenue" name="Revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <h2 className="mt">Data cleaning summary</h2>
          <ul className="quality">
            <li>Raw rows: <b>{QUALITY.raw_rows.toLocaleString('en-GB')}</b></li>
            <li>Duplicates removed: <b>{QUALITY.duplicates_removed}</b></li>
            <li>Missing prices imputed (product median): <b>{QUALITY.missing_prices_imputed}</b></li>
            <li>Negative quantities corrected: <b>{QUALITY.negative_quantities_fixed}</b></li>
            <li>Missing regions labelled "Unknown": <b>{QUALITY.missing_regions_labelled}</b></li>
            <li>Clean rows: <b>{QUALITY.clean_rows.toLocaleString('en-GB')}</b></li>
          </ul>
        </div>
      </section>

      <footer className="muted">Synthetic dataset generated for portfolio purposes.</footer>
    </div>
  )
}
