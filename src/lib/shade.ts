// Sun and shade study for a plan: where the plan's buildings cast shade, today and after.
// Sun position: NOAA solar calculator equations (Meeus), with atmospheric refraction.
// Checked against NREL SPA (pvlib) in docs/validation-shading.md.
// Shade: a height raster swept along the sun direction (one pass per sun position), flat ground.
// Plain TypeScript with no browser APIs, so the validation script runs it in Node.

type Pos = number[]
type Ring = Pos[]
interface Geometry { type: string; coordinates: unknown }
interface Feature { geometry: Geometry | null; properties: Record<string, unknown> | null }
interface FC { features: Feature[] }

export interface ShadeModel {
  context: FC
  demolish?: FC
  massing: FC
  boundary: FC
  parcels?: FC
}

const R = Math.PI / 180

/** Apparent sun position: azimuth from north clockwise, elevation above the horizon, in degrees. */
export function sunPosition(ms: number, lat: number, lon: number): { az: number; el: number } {
  const jd = ms / 86400000 + 2440587.5
  const T = (jd - 2451545) / 36525
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T)
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)
  const C =
    Math.sin(M * R) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * R) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * R) * 0.000289
  const omega = 125.04 - 1934.136 * T
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * R)
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60
  const eps = eps0 + 0.00256 * Math.cos(omega * R)
  const dec = Math.asin(Math.sin(eps * R) * Math.sin(lambda * R))
  const y = Math.tan((eps / 2) * R) ** 2
  const eot =
    (4 / R) *
    (y * Math.sin(2 * L0 * R) -
      2 * e * Math.sin(M * R) +
      4 * e * y * Math.sin(M * R) * Math.cos(2 * L0 * R) -
      0.5 * y * y * Math.sin(4 * L0 * R) -
      1.25 * e * e * Math.sin(2 * M * R))
  const minutes = (((ms % 86400000) + 86400000) % 86400000) / 60000
  const tst = minutes + eot + 4 * lon
  const ha = (tst / 4 - 180) * R
  const la = lat * R
  const cz = Math.min(1, Math.max(-1, Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha)))
  const zen = Math.acos(cz)
  let az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(dec) * Math.cos(la)) / R + 180
  az = ((az % 360) + 360) % 360
  const el = 90 - zen / R
  return { az, el: el + refraction(el) }
}

function refraction(el: number): number {
  if (el > 85) return 0
  const te = Math.tan(el * R)
  let r: number
  if (el > 5) r = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5
  else if (el > -0.575) r = 1735 + el * (-518.2 + el * (103.4 + el * (-12.79 + el * 0.711)))
  else r = -20.774 / te
  return r / 3600
}

export type Season = 'winter' | 'equinox' | 'summer'
/** Study days. Israel: UTC+2 in winter and on 21 March (summer time starts late March), UTC+3 in June. */
export const SEASONS: { id: Season; label: string; date: string; month: number; day: number; utc: number }[] = [
  { id: 'winter', label: 'חורף', date: '21 בדצמבר', month: 11, day: 21, utc: 2 },
  { id: 'equinox', label: 'אביב וסתיו', date: '21 במרץ', month: 2, day: 21, utc: 2 },
  { id: 'summer', label: 'קיץ', date: '21 ביוני', month: 5, day: 21, utc: 3 },
]
/** UTC milliseconds for a local clock hour on the season's day. */
export function seasonTime(season: Season, hour: number, year = 2026): number {
  const s = SEASONS.find((x) => x.id === season)!
  return Date.UTC(year, s.month, s.day) + (hour - s.utc) * 3600000
}

// ---------- geometry ----------

function rings(g: Geometry | null): Ring[][] {
  if (!g) return []
  if (g.type === 'Polygon') return [g.coordinates as Ring[]]
  if (g.type === 'MultiPolygon') return g.coordinates as Ring[][]
  return []
}

export interface Raster {
  w: number
  h: number
  cell: number
  /** Local metres of the south-west corner; x east, y north. */
  x0: number
  y0: number
  lat0: number
  lon0: number
}

export function makeRaster(model: ShadeModel, margin = 220, cell = 2, maxCells = 450_000): Raster {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const f of model.boundary.features)
    for (const poly of rings(f.geometry))
      for (const p of poly[0]) {
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1])
      }
  const lat0 = (minY + maxY) / 2, lon0 = (minX + maxX) / 2
  const kx = 111320 * Math.cos(lat0 * R), ky = 110574
  const x0 = (minX - lon0) * kx - margin, y0 = (minY - lat0) * ky - margin
  const W = (maxX - minX) * kx + 2 * margin, H = (maxY - minY) * ky + 2 * margin
  while ((W / cell) * (H / cell) > maxCells) cell *= 1.25
  return { w: Math.ceil(W / cell), h: Math.ceil(H / cell), cell, x0, y0, lat0, lon0 }
}

/** Local metres of a lon/lat point. */
export function toLocal(r: Raster, p: Pos): [number, number] {
  return [(p[0] - r.lon0) * 111320 * Math.cos(r.lat0 * R), (p[1] - r.lat0) * 110574]
}

/** Calls fn(index) for every cell whose centre is inside the polygon (even-odd, holes included). */
function fillPolygon(r: Raster, poly: Ring[], fn: (i: number) => void) {
  const pts = poly.map((ring) => ring.map((p) => toLocal(r, p)))
  let lo = Infinity, hi = -Infinity
  for (const p of pts[0]) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]) }
  const j0 = Math.max(0, Math.floor((lo - r.y0) / r.cell)), j1 = Math.min(r.h - 1, Math.ceil((hi - r.y0) / r.cell))
  const xs: number[] = []
  for (let j = j0; j <= j1; j++) {
    const yc = r.y0 + (j + 0.5) * r.cell
    xs.length = 0
    for (const ring of pts)
      for (let k = 0, n = ring.length; k < n; k++) {
        const a = ring[k], b = ring[(k + 1) % n]
        if (a[1] <= yc !== b[1] <= yc) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
      }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - r.x0) / r.cell - 0.5)), i1 = Math.min(r.w - 1, Math.floor((xs[k + 1] - r.x0) / r.cell - 0.5))
      for (let i = i0; i <= i1; i++) fn(j * r.w + i)
    }
  }
}

export type State = 'today' | 'after'

/** Height of the tallest roof over each cell, in metres. */
export function heights(r: Raster, model: ShadeModel, state: State): Float32Array {
  const H = new Float32Array(r.w * r.h)
  const put = (fc: FC | undefined, height: (p: Record<string, unknown>) => number) => {
    for (const f of fc?.features ?? []) {
      const h = height(f.properties ?? {})
      if (!(h > 0)) continue
      for (const poly of rings(f.geometry)) fillPolygon(r, poly, (i) => { if (H[i] < h) H[i] = h })
    }
  }
  put(model.context, (p) => Number(p.h))
  if (state === 'today') put(model.demolish, (p) => Number(p.h))
  else put(model.massing, (p) => (p.kind === 'envelope' ? 0 : Number(p.top)))
  return H
}

/** 1 where a cell is inside the polygons of fc (optionally filtered), else 0. */
export function mask(r: Raster, fc: FC | undefined, keep: (p: Record<string, unknown>) => boolean = () => true): Uint8Array {
  const m = new Uint8Array(r.w * r.h)
  for (const f of fc?.features ?? []) {
    if (!keep(f.properties ?? {})) continue
    for (const poly of rings(f.geometry)) fillPolygon(r, poly, (i) => { m[i] = 1 })
  }
  return m
}

/**
 * Shade for one sun position: out[i] = 1 when the cell's own surface is in shade.
 * Sweep from the sun side: S = max(H, S(upsun neighbour) - step * tan(el)), linear interpolation across the minor axis.
 */
export function shadeAt(r: Raster, H: Float32Array, az: number, el: number, out = new Uint8Array(r.w * r.h)): Uint8Array {
  if (el <= 0) return out.fill(1)
  const sx = Math.sin(az * R), sy = Math.cos(az * R) // towards the sun; x east, y north (row j grows north)
  const tanE = Math.tan(el * R)
  const S = new Float32Array(r.w * r.h)
  const { w, h } = r
  if (Math.abs(sx) >= Math.abs(sy)) {
    const di = sx > 0 ? 1 : -1, fj = sy / Math.abs(sx), drop = r.cell * Math.hypot(1, fj) * tanE
    const start = di > 0 ? w - 1 : 0
    for (let i = start; i >= 0 && i < w; i -= di) {
      const ui = i + di
      for (let j = 0; j < h; j++) {
        const k = j * w + i
        let up = 0
        if (ui >= 0 && ui < w) {
          const uj = j + fj, j0 = Math.floor(uj), t = uj - j0
          const a = j0 >= 0 && j0 < h ? S[j0 * w + ui] : 0, b = j0 + 1 >= 0 && j0 + 1 < h ? S[(j0 + 1) * w + ui] : 0
          up = a + (b - a) * t - drop
        }
        out[k] = up > H[k] + 0.05 ? 1 : 0
        S[k] = up > H[k] ? up : H[k]
      }
    }
  } else {
    const dj = sy > 0 ? 1 : -1, fi = sx / Math.abs(sy), drop = r.cell * Math.hypot(1, fi) * tanE
    const start = dj > 0 ? h - 1 : 0
    for (let j = start; j >= 0 && j < h; j -= dj) {
      const uj = j + dj
      for (let i = 0; i < w; i++) {
        const k = j * w + i
        let up = 0
        if (uj >= 0 && uj < h) {
          const ui = i + fi, i0 = Math.floor(ui), t = ui - i0
          const a = i0 >= 0 && i0 < w ? S[uj * w + i0] : 0, b = i0 + 1 >= 0 && i0 + 1 < w ? S[uj * w + i0 + 1] : 0
          up = a + (b - a) * t - drop
        }
        out[k] = up > H[k] + 0.05 ? 1 : 0
        S[k] = up > H[k] ? up : H[k]
      }
    }
  }
  return out
}

/** Hours of direct sun per cell over the day, sampled every `stepMin` minutes while the sun is up. */
export function sunHours(r: Raster, H: Float32Array, season: Season, stepMin = 10): Float32Array {
  const hours = new Float32Array(r.w * r.h)
  const sh = new Uint8Array(r.w * r.h)
  const dt = stepMin / 60
  for (let t = 3 + dt / 2; t < 21; t += dt) {
    const { az, el } = sunPosition(seasonTime(season, t), r.lat0, r.lon0)
    if (el <= 0) continue
    shadeAt(r, H, az, el, sh)
    for (let i = 0; i < hours.length; i++) if (!sh[i]) hours[i] += dt
  }
  return hours
}

export interface Receptor { key: string; label: string; area: number; mean0: number; mean1: number; lost1h: number; two0: number; two1: number }

/**
 * Ground statistics for one season: mean sun hours before and after, share of the area that loses an hour or more,
 * and the share that gets at least two hours (the BRE 209 test for open spaces, meant for 21 March).
 */
export function receptorStats(r: Raster, key: string, label: string, m: Uint8Array, H0: Float32Array, H1: Float32Array, h0: Float32Array, h1: Float32Array): Receptor {
  let n = 0, s0 = 0, s1 = 0, lost = 0, t0 = 0, t1 = 0
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || H0[i] > 0 || H1[i] > 0) continue // ground in both states only
    n++; s0 += h0[i]; s1 += h1[i]
    if (h0[i] - h1[i] >= 1) lost++
    if (h0[i] >= 2) t0++
    if (h1[i] >= 2) t1++
  }
  const a = r.cell * r.cell
  return { key, label, area: n * a, mean0: n ? s0 / n : 0, mean1: n ? s1 / n : 0, lost1h: n ? lost / n : 0, two0: n ? t0 / n : 0, two1: n ? t1 / n : 0 }
}

/** Ring of ground around the plan: within `dist` metres of the boundary (square dilation), outside it. */
export function neighbourMask(r: Raster, inside: Uint8Array, dist = 100): Uint8Array {
  const d = Math.round(dist / r.cell), { w, h } = r
  const rows = new Uint8Array(inside.length), m = new Uint8Array(inside.length)
  // Separable max filter with a running count: rows, then columns.
  for (let j = 0; j < h; j++) {
    let c = 0
    for (let i = -d; i < w; i++) {
      if (i + d < w && inside[j * w + i + d]) c++
      if (i - d - 1 >= 0 && inside[j * w + i - d - 1]) c--
      if (i >= 0 && c > 0) rows[j * w + i] = 1
    }
  }
  for (let i = 0; i < w; i++) {
    let c = 0
    for (let j = -d; j < h; j++) {
      if (j + d < h && rows[(j + d) * w + i]) c++
      if (j - d - 1 >= 0 && rows[(j - d - 1) * w + i]) c--
      if (j >= 0 && c > 0 && !inside[j * w + i]) m[j * w + i] = 1
    }
  }
  return m
}
