import { useEffect } from 'react'
import L from 'leaflet'
import { useLeafletContext } from '@react-leaflet/core'
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, LayerGroup, useMap } from 'react-leaflet'
import { SEVERITY_COLORS } from '../api.js'

const CITY_VIEWS = {
  '': { center: [39.6, 30.5], zoom: 6 },
  Ankara: { center: [39.925, 32.8], zoom: 12 },
  İstanbul: { center: [41.03, 29.0], zoom: 11 },
  İzmir: { center: [38.44, 27.14], zoom: 12 },
}

const HEAT_WEIGHT = { 'Maddi hasarlı': 0.4, Yaralanmalı: 0.7, Ölümlü: 1 }

function HeatLayer({ points }) {
  // Katman menüsünden açılıp kapanabilmesi için üst LayerGroup'a eklenir
  const { layerContainer, map } = useLeafletContext()
  useEffect(() => {
    const container = layerContainer ?? map
    const layer = L.heatLayer(
      points.map((a) => [a.lat, a.lng, HEAT_WEIGHT[a.severity]]),
      { radius: 18, blur: 20, maxZoom: 14, minOpacity: 0.35 },
    )
    container.addLayer(layer)
    return () => container.removeLayer(layer)
  }, [layerContainer, map, points])
  return null
}

function ViewController({ city, focus }) {
  const map = useMap()
  useEffect(() => {
    const v = CITY_VIEWS[city] ?? CITY_VIEWS['']
    map.flyTo(v.center, v.zoom, { duration: 0.8 })
  }, [map, city])
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], 16, { duration: 0.8 })
  }, [map, focus])
  return null
}

const dateFmt = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

export default function AccidentMap({ accidents, hotspots, city, focus }) {
  const serious = accidents.filter((a) => a.severity === 'Ölümlü')
  const v = CITY_VIEWS['']

  return (
    <MapContainer center={v.center} zoom={v.zoom} className="map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ViewController city={city} focus={focus} />
      <LayersControl position="topright">
        <LayersControl.Overlay checked name="Isı haritası">
          <LayerGroup>
            <HeatLayer points={accidents} />
          </LayerGroup>
        </LayersControl.Overlay>
        <LayersControl.Overlay checked name="Ölümlü kazalar">
          <LayerGroup>
            {serious.map((a) => (
              <CircleMarker key={a.id} center={[a.lat, a.lng]} radius={4} pathOptions={{ color: SEVERITY_COLORS.Ölümlü, fillOpacity: 0.9, weight: 1 }}>
                <Popup>
                  <b>{a.location}</b>
                  <br />
                  {a.type} · {dateFmt.format(new Date(a.date))}
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
                  <b>#{i + 1} {h.location}</b>
                  <br />
                  {h.count} kaza · {h.injured} yaralı · {h.dead} ölü
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
