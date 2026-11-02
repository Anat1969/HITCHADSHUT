// Metric 38 (זכויות שמש) of Shchuna 360 for every plan with volumes, from src/lib/shade.ts.
// node --experimental-strip-types scripts/shade-metric38.ts [slug ...]
// Reads each plan's model from Supabase (public read) and writes public/plans/<slug>/sun-metric38.json,
// which the shchuna-measure function reads as computed evidence for metric 38.
import { mkdirSync, writeFileSync } from 'node:fs'
import { metric38, type ShadeModel } from '../src/lib/shade.ts'

const URL = 'https://cbhexpybdggwzyakgagd.supabase.co/rest/v1/plan_models?select=plan_number,model'
const KEY = 'sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3'
const slug = (p: string) => p.replace(/^תמל\s*\/\s*/, 'tamal-').replace(/\s*\/\s*/g, '-')
const only = new Set(process.argv.slice(2))
const rows = (await (await fetch(URL, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json()) as { plan_number: string; model: ShadeModel & { massing?: { features: { properties: Record<string, unknown> | null }[] } } }[]
for (const { plan_number, model } of rows) {
  const s = slug(plan_number)
  if (only.size && !only.has(s)) continue
  if (!model?.massing?.features?.some((f) => f.properties?.kind === 'tower' || f.properties?.kind === 'podium')) continue
  const t0 = performance.now()
  const m = metric38(model)
  const out = {
    plan_number, metric: 38, ...m,
    method: 'שכבת השמש והצל של "מה נבנה סביבי" (src/lib/shade.ts): מיקום שמש לפי NOAA, בסטייה של 0.016 מעלות מ-NREL SPA; רשת של 2 מ\'. הבדיקה: docs/validation-shading.md',
    limits: 'חזיתות לא מחושבות. גובה הבניינים הקיימים משוער (OpenStreetMap או המפה העירונית). הקרקע שטוחה, בלי עצים.',
    computed_at: new Date().toISOString().slice(0, 10),
  }
  mkdirSync(`public/plans/${s}`, { recursive: true })
  writeFileSync(`public/plans/${s}/sun-metric38.json`, JSON.stringify(out, null, 1))
  console.log(`${plan_number.padEnd(12)} score ${m.score}/2  roofs ${m.roofs.passing}/${m.roofs.buildings} (${(m.roofs.share * 100).toFixed(0)}%)  open[${m.open.source}] ${m.open.mean0.toFixed(2)} -> ${m.open.mean1.toFixed(2)} h (-${(m.open.drop * 100).toFixed(1)}%)  ${Math.round(performance.now() - t0)} ms`)
}
