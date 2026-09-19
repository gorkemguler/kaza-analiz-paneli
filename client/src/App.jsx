import { useEffect, useState } from 'react'
import TurkiyePage from './pages/TurkiyePage.jsx'
import IstanbulPage from './pages/IstanbulPage.jsx'
import IzmirPage from './pages/IzmirPage.jsx'
import CanliPage from './pages/CanliPage.jsx'

const PAGES = [
  { hash: '#/', label: 'Türkiye geneli', subtitle: 'EGM aylık bültenleri, 81 il', Component: TurkiyePage },
  { hash: '#/istanbul', label: 'İstanbul kaza haritası', subtitle: 'İBB konumlu kaza duyuruları', Component: IstanbulPage },
  { hash: '#/izmir', label: 'İzmir kaza ve arıza', subtitle: 'İzmir UM, müdahale süreleriyle', Component: IzmirPage },
  { hash: '#/canli', label: 'Canlı olaylar', subtitle: 'TomTom, anlık', Component: CanliPage },
]

const currentPage = () => PAGES.find((p) => p.hash === window.location.hash) ?? PAGES[0]

export default function App() {
  const [page, setPage] = useState(currentPage)

  useEffect(() => {
    const onHash = () => {
      setPage(currentPage())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const { Component } = page

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img src="favicon.svg" alt="" width="32" height="32" />
          <div>
            <h1>Trafik Kaza Analiz Paneli</h1>
            <p>Resmi açık verilerle kaza yoğunluğu, risk noktaları ve eğilimler</p>
          </div>
        </div>
        <nav className="tabs" aria-label="Sayfalar">
          {PAGES.map((p) => (
            <a key={p.hash} href={p.hash} className={p === page ? 'active' : ''} aria-current={p === page ? 'page' : undefined}>
              <span>{p.label}</span>
              <small>{p.subtitle}</small>
            </a>
          ))}
        </nav>
      </header>

      <Component key={page.hash} />
    </div>
  )
}
