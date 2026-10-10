import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'
import JSZip from 'jszip'

/** Parse a .kml or .kmz file into a GeoJSON FeatureCollection (KML is always WGS84). */
export async function parseKmlFile(file: File): Promise<FeatureCollection> {
  const name = file.name.toLowerCase()
  let text: string
  if (name.endsWith('.kmz') || file.type === 'application/vnd.google-earth.kmz') {
    const zip = await JSZip.loadAsync(file)
    const kmlEntry =
      zip.file('doc.kml') ?? Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith('.kml'))
    if (!kmlEntry) throw new Error('לא נמצא קובץ KML בתוך קובץ ה-KMZ')
    text = await kmlEntry.async('text')
  } else {
    text = await file.text()
  }
  const doc = new DOMParser().parseFromString(text, 'text/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('הקובץ אינו KML תקין')
  const fc = kmlToGeoJSON(doc) as FeatureCollection
  const features = fc.features.filter((f): f is Feature<Geometry> => !!f.geometry)
  if (!features.length) throw new Error('לא נמצאו צורות או נקודות בקובץ')
  return { type: 'FeatureCollection', features: features.map(cleanFeature) }
}

/** Drop KML styling props that bloat the record; keep name, description and data fields. */
function cleanFeature(f: Feature<Geometry>): Feature<Geometry> {
  const drop = /^(styleUrl|styleHash|styleMapHash|stroke|stroke-opacity|stroke-width|fill|fill-opacity|icon|icon-.*|label-.*|visibility)$/
  const props: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(f.properties ?? {})) if (!drop.test(k)) props[k] = v
  return { type: 'Feature', geometry: stripZ(f.geometry), properties: props }
}

function stripZ(g: Geometry): Geometry {
  const fix = (c: unknown): unknown =>
    Array.isArray(c) && typeof c[0] === 'number' ? [c[0], c[1]] : Array.isArray(c) ? c.map(fix) : c
  if (g.type === 'GeometryCollection') return { ...g, geometries: g.geometries.map(stripZ) }
  return { ...g, coordinates: fix((g as { coordinates: unknown }).coordinates) } as Geometry
}

