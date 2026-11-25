import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import * as maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import '@maplibre/maplibre-gl-leaflet'

maplibregl.setWorkerUrl(workerUrl)

// The same vector basemap as the 3D maps (OpenFreeMap, no key), with every label layer removed:
// a style without labels, not a layer that hides them (Map Interaction Standard, section 8 of the spec).
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
const FALLBACK_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

let styleCache: Promise<StyleSpecification> | null = null
export function quietStyle(): Promise<StyleSpecification> {
  styleCache ??= fetch(STYLE_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((s: StyleSpecification) => ({ ...s, layers: s.layers.filter((l) => l.type !== 'symbol') }))
  return styleCache
}

/** Quiet, label-free basemap for Leaflet maps. Falls back to OSM raster (with labels) only if the style cannot load. */
export default function QuietBase() {
  const map = useMap()
  useEffect(() => {
    let layer: L.Layer | null = null
    let dead = false
    quietStyle()
      .then((style) => {
        if (dead) return
        layer = L.maplibreGL({ style, attributionControl: false, interactive: false } as L.LeafletMaplibreGLOptions)
        layer.getAttribution = () => ATTRIBUTION
        layer.addTo(map)
      })
      .catch(() => {
        if (dead) return
        layer = L.tileLayer(FALLBACK_TILES, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' })
        layer.addTo(map)
      })
    return () => {
      dead = true
      layer?.remove()
    }
  }, [map])
  return null
}
