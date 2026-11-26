import type { Geometry } from 'geojson'

/** Building plans (תוכניות בינוי, תב/xxxx) from the PLANS-GH app: public/building-plans.json,
 *  made by scripts/sync-building-plans.py. Lots from the city GIS, decisions from the committee opinions. */
export interface BuildingPlan {
  plan_number: string
  title: string
  committee_date: string | null
  decision: string
  underlying_plan: string | null
  gush: string | null
  helka: string | null
  center: [number, number] | null
  geometry: Geometry | null
  /** From PLANS-GH building-twin.json (all building plans, not only the approved ones). */
  status?: 'אושרה' | 'בטיפול' | 'בהכנה'
  place?: string | null
  /** Where the geometry comes from: the detailed model, TABA volumes of the lots, the whole TABA, or GIS parcels. */
  source?: 'model' | 'lots' | 'taba' | 'parcels' | 'xplan' | 'municipal' | null
  /** Provenance in the shared standard: plan (from the plan's drawings), computed (estimate), verified (GIS). */
  prov?: 'plan' | 'computed' | 'verified' | null
  /** Detailed model: per building, floor blocks [ring (lng, lat), base m, top m]. */
  model?: { id: string; label?: string; s: [[number, number][], number, number][] }[]
  /** Estimated volume from table 5 of the TABA (lot x coverage, to the maximal height), for plans whose TABA has no plan_models. */
  estimate?: { lot: string; cat: string; base: number; top: number; floors: number; r: [number, number][]; ref: string }[]
}

export const BUILDING_COLOR = '#9A6B3F' // bronze, as in PLANS-GH
export const PLANS_APP_URL = 'https://anat1969.github.io/PLANS-GH/'

const getJson = (u: string) =>
  fetch(u)
    .then((r) => (r.ok ? r.json() : { plans: [] }))
    .catch(() => ({ plans: [] }))

/** All building plans: the twin export of PLANS-GH (43 plans, geometry and models), with the committee decision
 *  of the approved ones from building-plans.json. One record per building plan number, so nothing is drawn twice. */
let cache: Promise<BuildingPlan[]> | null = null
export function loadBuildingPlans(): Promise<BuildingPlan[]> {
  cache ??= Promise.all([getJson('/building-plans.json'), getJson('/building-twin.json')]).then(([a, b]) => {
    const key = (n: string) => n.replace(/\s+/g, '')
    const byNum = new Map<string, BuildingPlan>()
    for (const p of (a.plans ?? []) as BuildingPlan[]) byNum.set(key(p.plan_number), p)
    for (const t of (b.plans ?? []) as (Partial<BuildingPlan> & { plan_number: string; taba?: string | null })[]) {
      const k = key(t.plan_number), old = byNum.get(k)
      byNum.set(k, {
        plan_number: t.plan_number,
        title: old?.title ?? (t.place ? `תוכנית בינוי · ${t.place}` : `תוכנית בינוי ${t.plan_number}`),
        committee_date: old?.committee_date ?? null,
        decision: old?.decision ?? '',
        underlying_plan: old?.underlying_plan ?? t.taba ?? null,
        gush: old?.gush ?? null,
        helka: old?.helka ?? null,
        center: t.center ?? old?.center ?? null,
        geometry: t.source === 'model' || !old?.geometry ? (t.geometry ?? old?.geometry ?? null) : old.geometry,
        status: t.status,
        place: t.place ?? null,
        source: t.geometry ? t.source : old?.geometry ? 'parcels' : null,
        prov: t.prov ?? (old?.geometry ? 'verified' : null),
        model: t.model,
        estimate: t.estimate,
      })
    }
    return [...byNum.values()]
  })
  return cache
}

/** Detailed models as MapLibre extrusion features (one per floor block), and their footprints. */
export function modelFeatures(plans: BuildingPlan[]) {
  const blocks: GeoJSON.Feature[] = [], foot: [number, number][][] = []
  for (const p of plans)
    for (const b of p.model ?? [])
      b.s.forEach(([ring, y0, y1], i) => {
        if (i === 0) foot.push(ring)
        blocks.push({ type: 'Feature', properties: { plan_number: p.plan_number, building: b.label ?? b.id, base: y0, top: y1, prov: 'plan' }, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } })
      })
  // Table-5 estimates: only where there is no detailed model and no TABA volume in the city twin (an estimate, marked 'computed')
  for (const p of plans)
    if (!p.model?.length)
      for (const e of p.estimate ?? []) {
        foot.push(e.r)
        blocks.push({ type: 'Feature', properties: { plan_number: p.plan_number, building: 'מגרש ' + e.lot, base: e.base, top: e.top, prov: 'computed' }, geometry: { type: 'Polygon', coordinates: [[...e.r, e.r[0]]] } })
      }
  return { blocks, foot }
}

/** Point in ring (lng, lat). */
export function inRing(x: number, y: number, r: [number, number][]) {
  let c = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [ax, ay] = r[i], [bx, by] = r[j]
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) c = !c
  }
  return c
}

export const fmtDate = (d: string | null) => (d ? d.split('-').reverse().join('.') : '')
