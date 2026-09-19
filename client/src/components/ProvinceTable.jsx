import { useMemo, useState } from 'react'
import { fmt } from '../api.js'

const COLUMNS = [
  { key: 'olumluYaralanmaliKaza', label: 'Ölümlü-yaral. kaza' },
  { key: 'maddiHasarliKaza', label: 'Maddi hasarlı' },
  { key: 'olu', label: 'Ölü' },
  { key: 'yarali', label: 'Yaralı' },
]

export default function ProvinceTable({ rows, sortKey, onSort, selected, onSelect }) {
  const [query, setQuery] = useState('')
  const sorted = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    return rows
      .filter((r) => !q || r.ad.toLocaleLowerCase('tr-TR').includes(q))
      .sort((a, b) => (sortKey === 'ad' ? a.ad.localeCompare(b.ad, 'tr') : b[sortKey] - a[sortKey]))
  }, [rows, sortKey, query])

  return (
    <div className="province-table">
      <input type="search" placeholder="İl ara…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="İl ara" />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>
                <button type="button" className={sortKey === 'ad' ? 'sorted' : ''} onClick={() => onSort('ad')}>
                  İl
                </button>
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="num">
                  <button type="button" className={sortKey === c.key ? 'sorted' : ''} onClick={() => onSort(c.key)}>
                    {c.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.plaka} className={selected === r.plaka ? 'selected' : ''} onClick={() => onSelect(r.plaka === selected ? null : r.plaka)}>
                <td className="muted">{i + 1}</td>
                <td>
                  {r.ad}
                  {r.hesaplanan && (
                    <span className="flag" title="Bu değer PDF'te boş bırakılmış, TOPLAM satırından hesaplandı">
                      *
                    </span>
                  )}
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="num">
                    {fmt(r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
