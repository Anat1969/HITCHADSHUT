import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Vite bundles the map worker (with its shared chunk) and gives us its URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { PlanModel } from '../lib/types'
import { bboxOf } from '../lib/geo'

export type ViewMode = 'today' | 'allowed' | 'after'

interface Props {
  model: PlanModel
  mode: ViewMode
  selectedLot: number | null
  onSelectLot: (lot: number | null) => void
}

maplibregl.setWorkerUrl(workerUrl)

// OpenFreeMap: free vector basemap, no key and no registration (openfreemap.org).
const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

export default function Plan3D({ model, mode, selectedLot, onSelectLot }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const [ready, setReady] = useState(false)
  const growth = useRef(0)
  const envGrowth = useRef(0)
  const anim = useRef<number | undefined>(undefined)
  const selectRef = useRef(onSelectLot)
  selectRef.current = onSelectLot

  useEffect(() => {
    if (!el.current) return
    const b = bboxOf(model.boundary)!
    const map = new maplibregl.Map({
      container: el.current,
      style: BASE_STYLE_URL,
      bounds: [
        [b[0], b[1]],
        [b[2], b[3]],
      ],
      fitBoundsOptions: { padding: 60 },
      pitch: 58,
      bearing: -24,
      maxPitch: 75,
      attributionControl: { compact: true },
      canvasContextAttributes: { antialias: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), 'top-left')

    map.on('load', () => {
      map.setLight({ anchor: 'map', position: [1.4, 215, 35], color: '#FFFFFF', intensity: 0.42 })
      map.addSource('context', { type: 'geojson', data: model.context })
      map.addSource('boundary', { type: 'geojson', data: model.boundary })
      map.addSource('massing', { type: 'geojson', data: model.massing })
      if (model.parcels) map.addSource('parcels', { type: 'geojson', data: model.parcels })
      if (model.demolish) map.addSource('demolish', { type: 'geojson', data: model.demolish })

      map.addLayer({
        id: 'context',
        type: 'fill-extrusion',
        source: 'context',
        paint: {
          'fill-extrusion-color': '#D2D2D0',
          'fill-extrusion-height': ['get', 'h'],
          'fill-extrusion-opacity': 0.85,
          'fill-extrusion-vertical-gradient': true,
        },
      })
      map.addLayer({
        id: 'boundary-fill',
        type: 'fill',
        source: 'boundary',
        paint: { 'fill-color': '#FFFFFF', 'fill-opacity': 0.35 },
      })
      map.addLayer({
        id: 'boundary-line',
        type: 'line',
        source: 'boundary',
        paint: { 'line-color': '#111111', 'line-width': 1.4, 'line-dasharray': [3, 2] },
      })
      if (model.parcels)
        map.addLayer({
          id: 'parcels',
          type: 'line',
          source: 'parcels',
          paint: { 'line-color': '#8A8A88', 'line-width': 0.8 },
        })
      if (model.demolish)
        map.addLayer({
          id: 'demolish',
          type: 'fill-extrusion',
          source: 'demolish',
          paint: {
            'fill-extrusion-color': '#5E5E5C',
            'fill-extrusion-height': ['get', 'h'],
            'fill-extrusion-opacity': 0.92,
            'fill-extrusion-vertical-gradient': true,
          },
        })
      map.addLayer({
        id: 'footprint',
        type: 'line',
        source: 'massing',
        filter: ['==', ['get', 'kind'], 'envelope'],
        paint: { 'line-color': '#5A5A58', 'line-width': 1, 'line-dasharray': [1, 2] },
      })
      map.addLayer({
        id: 'tower',
        type: 'fill-extrusion',
        source: 'massing',
        filter: ['in', ['get', 'kind'], ['literal', ['tower', 'podium']]],
        paint: {
          'fill-extrusion-color': '#9C9C9A',
          'fill-extrusion-height': 0,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.96,
          'fill-extrusion-vertical-gradient': true,
        },
      })

      map.addLayer({
        id: 'envelope',
        type: 'fill-extrusion',
        source: 'massing',
        filter: ['==', ['get', 'kind'], 'envelope'],
        paint: {
          'fill-extrusion-color': '#FFFFFF',
          'fill-extrusion-height': 0,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.24,
        },
      })
      const pick = (e: maplibregl.MapLayerMouseEvent) => {
        const lot = e.features?.[0]?.properties?.lot
        if (lot != null) selectRef.current(Number(lot))
      }
      // Opaque towers are drawn first, then the translucent envelope over them,
      // otherwise the envelope's depth hides the towers inside it.
      for (const id of ['tower', 'envelope']) {
        map.on('click', id, pick)
        map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'))
        map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''))
      }
      setReady(true)
    })
    return () => {
      if (anim.current) cancelAnimationFrame(anim.current)
      map.remove()
      mapRef.current = null
    }
  }, [model])

  // Animate towers rising and the permitted envelope appearing.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const target = mode === 'after' ? 1 : 0
    const envTarget = mode === 'today' ? 0 : 1
    const from = growth.current
    const envFrom = envGrowth.current
    const start = performance.now()
    const dur = 1100
    const ease = (x: number) => 1 - Math.pow(1 - x, 3)
    if (anim.current) cancelAnimationFrame(anim.current)
    const step = (now: number) => {
      const k = ease(Math.min(1, (now - start) / dur))
      const g = from + (target - from) * k
      const e = envFrom + (envTarget - envFrom) * k
      growth.current = g
      envGrowth.current = e
      map.setPaintProperty('tower', 'fill-extrusion-height', ['*', ['get', 'top'], g])
      map.setPaintProperty('tower', 'fill-extrusion-base', ['*', ['get', 'base'], g])
      map.setPaintProperty('envelope', 'fill-extrusion-height', ['*', ['get', 'top'], e])
      map.setPaintProperty('envelope', 'fill-extrusion-opacity', mode === 'after' ? 0.14 : 0.3)
      // Buildings to demolish stand in "today", sink while the plan rises.
      if (map.getLayer('demolish')) map.setPaintProperty('demolish', 'fill-extrusion-height', ['*', ['get', 'h'], 1 - Math.max(e, g)])
      if (k < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }, [mode, ready])

  // Highlight the selected lot in black.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const sel = selectedLot ?? -1
    map.setPaintProperty('tower', 'fill-extrusion-color', [
      'case',
      ['==', ['get', 'lot'], sel],
      '#141414',
      ['==', ['get', 'kind'], 'podium'],
      '#B5B5B3',
      ['interpolate', ['linear'], ['get', 'top'], 45, '#C4C4C2', 100, '#8E8E8C'],
    ])
    map.setPaintProperty('envelope', 'fill-extrusion-color', ['case', ['==', ['get', 'lot'], sel], '#DCDCDA', '#FFFFFF'])
    if (selectedLot != null) {
      const lot = model.lots.find((l) => l.lot === selectedLot)
      if (lot) map.easeTo({ center: lot.center, zoom: Math.max(map.getZoom(), 16.4), duration: 900 })
    }
  }, [selectedLot, ready, model])

  return <div ref={el} className="mag-map" role="img" aria-label="מודל תלת-ממדי של התוכנית: מבנים קיימים, המעטפת המותרת ונפח הבנייה לדוגמה" />
}
