// Validation of src/lib/shade.ts (see docs/validation-shading.md).
// node --experimental-strip-types scripts/shade-validate.ts <spa-ref.json> <model.json>
// spa-ref.json: NREL SPA positions from pvlib (scripts/shade-spa-ref.py). model.json: a plan_models.model.
import { readFileSync } from 'node:fs'
import { sunPosition, makeRaster, heights, shadeAt, sunHours, mask, receptorStats, neighbourMask, type Season, type ShadeModel } from '../src/lib/shade.ts'

const [refPath, modelPath] = process.argv.slice(2)
const ref = JSON.parse(readFileSync(refPath, 'utf8'))
let dAz = 0, dEl = 0
for (const r of ref.rows) {
  const p = sunPosition(r.ms, ref.lat, ref.lon)
  dAz = Math.max(dAz, Math.abs(((p.az - r.az + 540) % 360) - 180)); dEl = Math.max(dEl, Math.abs(p.el - r.el))
}
console.log(`1. sun vs NREL SPA, ${ref.rows.length} positions: max |d az| ${dAz.toFixed(4)} deg, max |d el| ${dEl.toFixed(4)} deg`)

// 2. Analytic shadow: a 20 x 20 m block, 60 m high, sun due south at 30 deg -> shadow 60 / tan 30 = 103.92 m north.
const sq = (cx: number, cy: number, s: number) => [[[cx - s, cy - s], [cx + s, cy - s], [cx + s, cy + s], [cx - s, cy + s], [cx - s, cy - s]]]
const lat0 = 31.8, deg = (m: number) => m / 110574
const blk = { type: 'Polygon', coordinates: [sq(34.65, lat0, deg(10)).map((p) => p.map(([x, y]) => [34.65 + (x - 34.65) * 110574 / (111320 * Math.cos(lat0 * Math.PI / 180)), y]))][0] }
const test: ShadeModel = { context: { features: [] }, massing: { features: [{ geometry: blk, properties: { kind: 'tower', top: 60 } }] }, boundary: { features: [{ geometry: blk, properties: {} }] } }
for (const cell of [2, 1, 0.5]) {
  const r = makeRaster(test, 160, cell)
  const H = heights(r, test, 'after'), sh = shadeAt(r, H, 180, 30)
  const ic = Math.floor(-r.x0 / r.cell)
  let top = -Infinity
  for (let j = 0; j < r.h; j++) if (sh[j * r.w + ic] && !H[j * r.w + ic]) top = Math.max(top, r.y0 + (j + 1) * r.cell)
  const len = top - 10
  console.log(`2. shadow length, cell ${cell} m: ${len.toFixed(2)} m (exact 103.92, error ${(len - 103.92).toFixed(2)} m)`)
}

// 3. Plan: grid sensitivity (winter, 2 m vs 1 m), then the study numbers per season at 2 m.
if (modelPath) {
  const model = JSON.parse(readFileSync(modelPath, 'utf8')) as ShadeModel
  const run = (cell: number, season: Season) => {
    const r = makeRaster(model, 220, cell, 2_000_000)
    const H0 = heights(r, model, 'today'), H1 = heights(r, model, 'after')
    const t0 = performance.now()
    const h0 = sunHours(r, H0, season), h1 = sunHours(r, H1, season)
    const ms = performance.now() - t0
    const inside = mask(r, model.boundary)
    const nb = receptorStats(r, 'nb', 'neighbours', neighbourMask(r, inside), H0, H1, h0, h1)
    const op = receptorStats(r, 'open', 'open', mask(r, model.parcels, (p) => p.cat === 'open'), H0, H1, h0, h1)
    return { r, nb, op, ms }
  }
  for (const cell of [2, 1]) {
    const { r, nb, ms } = run(cell, 'winter')
    console.log(`3. winter, cell ${r.cell} m (${r.w}x${r.h}): neighbours ${Math.round(nb.area)} m2, mean ${nb.mean0.toFixed(2)} -> ${nb.mean1.toFixed(2)} h, lose >=1h ${(nb.lost1h * 100).toFixed(1)}%, ${Math.round(ms)} ms`)
  }
  for (const season of ['winter', 'equinox', 'summer'] as Season[]) {
    const { nb, op } = run(2, season)
    console.log(`4. ${season}: neighbours mean ${nb.mean0.toFixed(2)} -> ${nb.mean1.toFixed(2)} h, lose >=1h ${(nb.lost1h * 100).toFixed(1)}%, >=2h ${(nb.two0 * 100).toFixed(1)}% -> ${(nb.two1 * 100).toFixed(1)}% (ratio ${(nb.two1 / nb.two0).toFixed(3)}); open spaces ${Math.round(op.area)} m2 mean ${op.mean1.toFixed(2)} h, >=2h ${(op.two1 * 100).toFixed(1)}%`)
  }
}
