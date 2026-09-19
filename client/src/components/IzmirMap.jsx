import { useEffect } from 'react'
import L from 'leaflet'
import { useLeafletContext } from '@react-leaflet/core'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, LayersControl, LayerGroup, useMap } from 'react-leaflet'
import { fmt } from '../api.js'

const IZMIR = { center: [38.42, 27.14], zoom: 11 }

function HeatLayer({ points }) {
  const { layerContainer, map } = useLeafletContext()
  useEffect(() => {
    const container = layerContainer ?? map
    // Ağırlık olay sayısı; çok yoğun noktalar skalayı ezmesin diye kök alınır
    const max = Math.max(1, ...points.map((p) => p[2]))
    const layer = L.heatLayer(
      points.map(([lat, lng, n]) => [lat, lng, Math.sqrt(n / max)]),
      { radius: 18, blur: 20, maxZoom: 15, minOpacity: 0.35 },
    )
    container.addLayer(layer)
    return () => container.removeLayer(layer)
  }, [layerContainer, map, points])
  return null
}

function Focus({ line, top }) {
  const map = useMap()
  useEffect(() => {
    const coords = line ? line.flat() : top.map((s) => [s.lat, s.lng])
    if (coords.length) map.flyToBounds(coords, { duration: 0.8, padding: [30, 30] })
  }, [map, line, top])
  return null
}

export default function IzmirMap({ points, top, line }) {
  return (
    <MapContainer center={IZMIR.center} zoom={IZMIR.zoom} className="map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Focus line={line} top={top} />
      {line && <Polyline positions={line} pathOptions={{ color: '#fbbf24', weight: 4, opacity: 0.9 }} />}
      <LayersControl position="topright">
        <LayersControl.Overlay checked name="Isı haritası">
          <LayerGroup>
            <HeatLayer points={points} />
          </LayerGroup>
        </LayersControl.Overlay>
        <LayersControl.Overlay checked name="En riskli mevkiler">
          <LayerGroup>
            {top.map((s) => (
              <CircleMarker
                key={`${s.cadde}-${s.konum}`}
                center={[s.lat, s.lng]}
                radius={Math.min(18, 6 + Math.sqrt(s.count))}
                pathOptions={{ color: '#fbbf24', weight: 2, fillColor: '#fbbf24', fillOpacity: 0.15 }}
              >
                <Popup>
                  <b>{s.konum}</b>
                  <br />
                  {s.cadde}
                  <br />
                  {fmt(s.count)} olay · {fmt(s.olumlu)} ölümlü · {fmt(s.yaralanmali)} yaralanmalı
                </Popup>
              </CircleMarker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
  )
}
