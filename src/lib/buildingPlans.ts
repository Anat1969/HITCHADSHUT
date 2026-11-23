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
}

export const BUILDING_COLOR = '#9A6B3F' // bronze, as in PLANS-GH
export const PLANS_APP_URL = 'https://anat1969.github.io/PLANS-GH/'

let cache: Promise<BuildingPlan[]> | null = null
export function loadBuildingPlans(): Promise<BuildingPlan[]> {
  cache ??= fetch('/building-plans.json')
    .then((r) => (r.ok ? r.json() : { plans: [] }))
    .then((d) => (d.plans ?? []) as BuildingPlan[])
    .catch(() => [])
  return cache
}

export const fmtDate = (d: string | null) => (d ? d.split('-').reverse().join('.') : '')
