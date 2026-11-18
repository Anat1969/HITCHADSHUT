import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap, ExpressionSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection } from 'geojson'
import { bboxOf } from '../lib/geo'
import { BLUE_LINE } from '../lib/labels'
import { landUseColor } from '../lib/mapColors'

maplibregl.setWorkerUrl(workerUrl)

const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

/** today = existing buildings; approved = + approved plans; all = + plans still in planning. */
export type CityView = 'today' | 'approved' | 'all'
export type CityColor = 'stage' | 'use'
export type Stage = 'approved' | 'planning'

export interface CityPlan {
  plan_number: string
  title: string
  status: string
  stage: Stage
  kind: string
  units_existing: number | null
  units_planned: number | null
  center: [number, number] | null
  height_max: number | null
}

export interface CityTwinModel {
  built_at: string
  boundaries: FeatureCollection
  massing: FeatureCollection
  demolish: FeatureCollection
  context: FeatureCollection
  plans: CityPlan[]
}

export const STAGE_COLOR: Record<Stage, string> = { approved: '#3D3D3B', planning: '#4A6FD8' }

interface Props {
  twin: CityTwinModel
  view: CityView
  color: CityColor
  focus: string | null
  onPick: (planNumber: string | null) => void
}

// Growth of each stage's volumes: 0 = not built, 1 = built.
const stageFactor = (gA: number, gP: number): ExpressionSpecification => ['match', ['get', 'stage'], 'approved', gA, gP]

export default function CityMap3D({ twin, view, color, focus, onPick }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const [ready, setReady] = useState(false)
  const grow = useRef({ a: 0, p: 0 })
  const anim = useRef<number | undefined>(undefined)
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  useEffect(() => {
    if (!el.current) return
    // Opening view: the plans with homes (the port plan and the city-wide public plots plan would zoom the city out).
    const homes = new Set(twin.plans.filter((p) => p.kind !== 'infrastructure' && p.units_planned).map((p) => p.plan_number))
    const b =
      bboxOf({ type: 'FeatureCollection', features: twin.boundaries.features.filter((f) => homes.has(f.properties?.plan_number)) }) ??
      bboxOf(twin.boundaries)!
    const map = new maplibregl.Map({
      container: el.current,
      style: BASE_STYLE_URL,
      bounds: [
        [b[0], b[1]],
        [b[2], b[3]],
      ],
      fitBoundsOptions: { padding: 40 },
      pitch: 55,
      bearing: -24,
      maxPitch: 75,
      attributionControl: { compact: true },
      canvasContextAttributes: { antialias: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), 'top-left')
    // The page can switch to full screen: keep the canvas the size of its box.
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el.current)

    map.on('load', () => {
      map.setLight({ anchor: 'map', position: [1.4, 215, 35], color: '#FFFFFF', intensity: 0.42 })
      map.addSource('context', { type: 'geojson', data: twin.context })
      map.addSource('demolish', { type: 'geojson', data: twin.demolish })
      map.addSource('massing', { type: 'geojson', data: twin.massing })
      map.addSource('boundaries', { type: 'geojson', data: twin.boundaries })

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
        id: 'demolish',
        type: 'fill-extrusion',
        source: 'demolish',
        paint: {
          'fill-extrusion-color': '#8C8C8A',
          'fill-extrusion-height': ['get', 'h'],
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true,
        },
      })
      map.addLayer({
        id: 'boundary-fill',
        type: 'fill',
        source: 'boundaries',
        paint: { 'fill-color': BLUE_LINE, 'fill-opacity': 0.06 },
      })
      // The blue line of every plan: solid when approved, dashed while still in planning.
      map.addLayer({
        id: 'boundary-line',
        type: 'line',
        source: 'boundaries',
        filter: ['==', ['get', 'stage'], 'approved'],
        paint: { 'line-color': BLUE_LINE, 'line-width': 1.6 },
      })
      map.addLayer({
        id: 'boundary-line-planning',
        type: 'line',
        source: 'boundaries',
        filter: ['==', ['get', 'stage'], 'planning'],
        paint: { 'line-color': BLUE_LINE, 'line-width': 1.6, 'line-dasharray': [3, 2] },
      })
      // Approved volumes opaque; planned ones translucent (opacity is per layer, so two layers).
      for (const stage of ['approved', 'planning'] as Stage[]) {
        map.addLayer({
          id: `massing-${stage}`,
          type: 'fill-extrusion',
          source: 'massing',
          filter: ['==', ['get', 'stage'], stage],
          paint: {
            'fill-extrusion-color': STAGE_COLOR[stage],
            'fill-extrusion-height': 0,
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': stage === 'approved' ? 0.95 : 0.78,
            'fill-extrusion-vertical-gradient': true,
          },
        })
      }
      const pick = (e: maplibregl.MapLayerMouseEvent) => {
        const pn = e.features?.[0]?.properties?.plan_number
        if (pn) pickRef.current(String(pn))
      }
      for (const id of ['massing-approved', 'massing-planning', 'boundary-fill']) {
        map.on('click', id, pick)
        map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'))
        map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''))
      }
      setReady(true)
    })
    return () => {
      if (anim.current) cancelAnimationFrame(anim.current)
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [twin])

  // Views: the volumes of each stage rise, and the buildings that stage demolishes sink.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const to = { a: view === 'today' ? 0 : 1, p: view === 'all' ? 1 : 0 }
    const from = { ...grow.current }
    const start = performance.now()
    const ease = (x: number) => 1 - Math.pow(1 - x, 3)
    if (anim.current) cancelAnimationFrame(anim.current)
    const step = (now: number) => {
      const k = ease(Math.min(1, (now - start) / 1100))
      const a = from.a + (to.a - from.a) * k
      const p = from.p + (to.p - from.p) * k
      grow.current = { a, p }
      const f = stageFactor(a, p)
      for (const id of ['massing-approved', 'massing-planning']) {
        map.setPaintProperty(id, 'fill-extrusion-height', ['*', ['get', 'top'], f])
        map.setPaintProperty(id, 'fill-extrusion-base', ['*', ['coalesce', ['get', 'base'], 0], f])
      }
      map.setPaintProperty('demolish', 'fill-extrusion-height', ['*', ['get', 'h'], ['-', 1, f]])
      if (k < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }, [view, ready])

  // Colour by stage or by land use.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    for (const stage of ['approved', 'planning'] as Stage[])
      map.setPaintProperty(`massing-${stage}`, 'fill-extrusion-color', color === 'use' ? landUseColor(STAGE_COLOR[stage]) : STAGE_COLOR[stage])
  }, [color, ready])

  // Fly to one plan.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !focus) return
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: twin.boundaries.features.filter((f) => f.properties?.plan_number === focus),
    }
    const b = bboxOf(fc)
    if (b)
      map.fitBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        { padding: 80, pitch: 58, duration: 1200, maxZoom: 17 },
      )
  }, [focus, ready, twin])

  return (
    <div
      ref={el}
      className="city-map"
      role="img"
      aria-label="מודל תלת-ממדי של העיר: המבנים של היום, התוכניות המאושרות והתוכניות שבתכנון"
    />
  )
}
