import { useEffect } from 'react'
import L from 'leaflet'
import { useLeafletContext } from '@react-leaflet/core'
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, LayerGroup, useMap } from 'react-leaflet'
import { SEVERITY_COLORS } from '../api.js'

const ISTANBUL = { center: [41.03, 28.98], zoom: 10 }
// Sonuç sırası sunucudaki severities dizisiyle aynı: maddi, yaralanmalı, ölümlü, belirtilmemiş
const HEAT_WEIGHT = [0.4, 0.7, 1, 0.4]

function HeatLayer({ points }) {
  // Katman menüsünden açılıp kapanabilmesi için üst LayerGroup'a eklenir
  const { layerContainer, map } = useLeafletContext()
  useEffect(() => {
    const container = layerContainer ?? map
    const layer = L.heatLayer(
      points.map(([lat, lng, sev]) => [lat, lng, HEAT_WEIGHT[sev]]),
      { radius: 14, blur: 16, maxZoom: 15, minOpacity: 0.35 },
    )
    container.addLayer(layer)
    return () => container.removeLayer(layer)
  }, [layerContainer, map, points])
  return null
}

function FocusController({ focus }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], 15, { duration: 0.8 })
  }, [map, focus])
  return null
}

const dateFmt = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
const parseLocal = (t) => new Date(`${t}:00`)

export default function AccidentMap({ points, fatal, hotspots, focus }) {
  return (
    <MapContainer center={ISTANBUL.center} zoom={ISTANBUL.zoom} className="map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FocusController focus={focus} />
      <LayersControl position="topright">
        <LayersControl.Overlay checked name="Isı haritası">
          <LayerGroup>
            <HeatLayer points={points} />
          </LayerGroup>
        </LayersControl.Overlay>
        <LayersControl.Overlay checked name="Can kaybı olan kazalar">
          <LayerGroup>
            {fatal.map((a) => (
              <CircleMarker key={a.id} center={[a.lat, a.lng]} radius={5} pathOptions={{ color: '#0f172a', weight: 1.5, fillColor: SEVERITY_COLORS.Ölümlü, fillOpacity: 1 }}>
                <Popup>
                  <b>{dateFmt.format(parseLocal(a.t))}</b>
                  <br />
                  {a.title}
                </Popup>
              </CircleMarker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>
        <LayersControl.Overlay checked name="Risk noktaları">
          <LayerGroup>
            {hotspots.map((h, i) => (
              <CircleMarker key={h.id} center={[h.lat, h.lng]} radius={14} pathOptions={{ color: '#fbbf24', weight: 2, fillOpacity: 0.1 }}>
                <Popup>
                  <b>
                    #{i + 1} {h.location}
                  </b>
                  <br />
                  {h.count} kaza duyurusu · {h.injury} yaralanmalı · {h.fatal} can kaybı
                  <br />
                  En yoğun saat: {h.peakHour}
                </Popup>
              </CircleMarker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
  )
}
