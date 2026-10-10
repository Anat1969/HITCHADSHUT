import type { FeatureCollection, Geometry, Position } from 'geojson'
import type { LonLat } from './types'

export const ASHDOD_CENTER: [number, number] = [31.8014, 34.6435] // [lat, lon]
export const ASHDOD_BOUNDS: [[number, number], [number, number]] = [
  [31.735, 34.585],
  [31.87, 34.725],
]

function eachPosition(g: Geometry, cb: (p: Position) => void) {
  const walk = (c: unknown) => {
    if (!Array.isArray(c)) return
    if (typeof c[0] === 'number') cb(c as Position)
    else c.forEach(walk)
  }
  if (g.type === 'GeometryCollection') g.geometries.forEach((x) => eachPosition(x, cb))
  else walk((g as { coordinates: unknown }).coordinates)
}

export function bboxOf(fc: FeatureCollection): [number, number, number, number] | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const f of fc.features) {
    if (!f.geometry) continue
    eachPosition(f.geometry, ([x, y]) => {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    })
  }
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null
}

/** Center as [lon, lat]: middle of the bounding box. */
export function centerOf(fc: FeatureCollection): LonLat | null {
  const b = bboxOf(fc)
  return b ? [round6((b[0] + b[2]) / 2), round6((b[1] + b[3]) / 2)] : null
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Distance in meters between two [lon, lat] points. */
export function distanceMeters(a: LonLat, b: LonLat): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(b[0] - a[0])
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function formatDistance(m: number): string {
  if (m < 150) return 'ממש לידך'
  if (m < 1000) return `כ-${Math.round(m / 50) * 50} מטר ממך`
  return `כ-${(m / 1000).toFixed(1)} ק"מ ממך`
}

export function walkingMinutes(m: number): number {
  return Math.max(1, Math.round(m / 80))
}

/** Is a point inside the general Ashdod area? Used to sanity-check KML uploads. */
export function isNearAshdod([lon, lat]: LonLat): boolean {
  return lat > 31.6 && lat < 31.95 && lon > 34.5 && lon < 34.85
}
