import { useEffect, useMemo, useState } from 'react'
import type { PlanModel } from '../lib/types'
import { BLUE_LINE, LAND_USE } from '../lib/labels'
import { FAM, ORDER, planSlug, sums, type Evolution, type Fam } from './LandUseEvolution'

/** public/plans/<slug>/evolution-map.json, written by scripts/approved-overlay.py and scripts/existing-parcels.py. */
interface Img {
  image: string
  corners: [number, number][] // TL, TR, BR, BL of the image, lon/lat
  size_px: [number, number]
  boundary_on_blue_pct: number
  scale: number
  note: string
  certainty: 'approved' | 'approved_partial'
}
interface Geo { type: string; coordinates: unknown }
interface Feat { geometry: Geo | null; properties: Record<string, unknown> | null }
interface FC { features: Feat[] }
interface EvoMap {
  kind: 'images' | 'vector' | 'parcels'
  images?: Img[]
  approved?: FC
  buildings?: FC
  parcels?: FC
  note?: string
  certainty?: string
}
type Step = 'approved' | 'boundary' | 'split' | 'use' | 'demolish' | 'lines' | 'volume' | 'result'

const R = Math.PI / 180
const rings = (g: Geo | null): number[][][][] =>
  !g ? [] : g.type === 'Polygon' ? [g.coordinates as number[][][]] : g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]) : []
const fmt = (n: number) => Math.round(n).toLocaleString('he-IL')
const pctOf = (x: number, t: number) => `${Math.round((x / t) * 100)}%`

export default function TashritEvolution({ model, planNumber }: { model: PlanModel; planNumber: string }) {
  const slug = planSlug(planNumber)
  const [map, setMap] = useState<EvoMap | null>(null)
  const [ev, setEv] = useState<Evolution | null>(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    let live = true
    const get = (f: string) =>
      fetch(`/plans/${slug}/${f}`).then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null)).catch(() => null)
    Promise.all([get('evolution-map.json'), get('evolution.json')]).then(([m, e]) => {
      if (!live) return
      setMap(m); setEv(e)
    })
    return () => { live = false }
  }, [slug])

  // Local metres around the plan: x east, y south (SVG down).
  const geo = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const f of model.boundary.features)
      for (const poly of rings(f.geometry as Geo))
        for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
    const lon0 = (x0 + x1) / 2, lat0 = (y0 + y1) / 2, kx = 111320 * Math.cos(lat0 * R), ky = 110574
    const P = (p: number[]): [number, number] => [(p[0] - lon0) * kx, -(p[1] - lat0) * ky]
    const w = (x1 - x0) * kx, h = (y1 - y0) * ky, m = Math.max(w, h) * 0.12
    const path = (g: Geo | null) => rings(g).map((poly) => poly.map((r) => 'M' + r.map((p) => P(p).map((v) => v.toFixed(1)).join(' ')).join('L') + 'Z').join('')).join('')
    return { P, path, vb: `${-w / 2 - m} ${-h / 2 - m} ${w + 2 * m} ${h + 2 * m}`, fs: Math.max(w, h) / 45 }
  }, [model])

  const steps = useMemo(() => {
    const s: Step[] = ['approved', 'boundary', 'split', 'use']
    if (model.demolish?.features?.length || map?.buildings?.features?.length) s.push('demolish')
    if (model.massing?.features?.some((f) => f.properties?.kind === 'envelope')) s.push('lines')
    if (model.massing?.features?.some((f) => f.properties?.kind === 'tower' || f.properties?.kind === 'podium')) s.push('volume')
    s.push('result')
    return s
  }, [model, map])
  const cur = steps[Math.min(step, steps.length - 1)]
  const at = (s: Step) => steps.indexOf(s) <= step && steps.includes(s)

  useEffect(() => {
    if (!map) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setStep(steps.length - 1); return }
    setStep(0)
    const id = setTimeout(() => setPlaying(true), 1200)
    return () => clearTimeout(id)
  }, [map, steps.length])
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setStep((s) => (s >= steps.length - 1 ? (setPlaying(false), s) : s + 1)), 3200)
    return () => clearInterval(id)
  }, [playing, steps.length])

  if (!map || !ev) return null

  const a = sums(ev.approved), p = sums(ev.proposed)
  const fams = ORDER.filter((k) => a[k] > 0 || p[k] > 0)
  const deltas = fams.map((k) => ({ k, d: p[k] / ev.proposed_total - a[k] / ev.approved_total })).sort((x, y) => x.d - y.d)
  const gain = deltas[deltas.length - 1], loss = deltas[0]
  const lots = model.parcels?.features ?? []
  const demolish = model.demolish?.features?.length ? model.demolish.features : map.buildings?.features ?? []
  const s = model.summary
  const approvedTitle = map.kind === 'parcels' ? 'המצב הקיים' : 'המצב המאושר'
  const topApproved = fams.filter((k) => a[k] > 0).sort((x, y) => a[y] - a[x]).slice(0, 3)
    .map((k) => `${FAM[k].label} ${pctOf(a[k], ev.approved_total)}`).join(', ')

  const TEXT: Record<Step, { t: string; b: string }> = {
    approved: map.kind === 'parcels'
      ? { t: approvedTitle, b: `${map.parcels?.features.length ?? 0} חלקות רשומות ובניינים קיימים, מהמפה העירונית. הייעוד המאושר לפי טבלה 3.2: ${topApproved}.` }
      : { t: approvedTitle, b: `${map.kind === 'images' ? 'התשריט המאושר עצמו, מעוגן לקו הכחול של התוכנית.' : map.note ?? ''} הייעוד המאושר: ${topApproved}.` },
    boundary: { t: 'גבול התוכנית', b: `${(ev.proposed_total / 1000).toFixed(1)} דונם בתוך הקו הכחול.` },
    split: { t: 'חלוקה חדשה', b: `${lots.length} תאי שטח חדשים במקום ${map.kind === 'parcels' ? `${map.parcels?.features.length ?? 0} חלקות` : `${ev.approved.length} ייעודים`}.` },
    use: { t: 'ייעוד חדש', b: `${FAM[gain.k].label}: מ-${pctOf(a[gain.k], ev.approved_total)} ל-${pctOf(p[gain.k], ev.proposed_total)}. ${FAM[loss.k].label}: מ-${pctOf(a[loss.k], ev.approved_total)} ל-${pctOf(p[loss.k], ev.proposed_total)}.` },
    demolish: { t: 'הריסה', b: `${demolish.length} בניינים מסומנים להריסה${s?.units_before_est ? `, כ-${fmt(s.units_before_est)} דירות` : ''}.` },
    lines: { t: 'קווי בניין', b: 'המעטפת שבתוכה מותר לבנות מעל הקרקע, לפי התשריט.' },
    volume: { t: 'נפח', b: `עד ${s?.height_max ? fmt(s.height_max) + ' מ\'' : 'הגובה המרבי'}${s?.floors_max ? `, ${s.floors_max} קומות` : ''}. מיקום הבניינים במגרש הוא המחשה.` },
    result: { t: 'המצב המוצע', b: s?.units_after ? `${s.units_before_est ? `מכ-${fmt(s.units_before_est)} דירות ` : ''}ל-${fmt(s.units_after)} דירות.` : 'התוכנית כפי שהוגשה.' },
  }

  const imgs = map.images ?? []
  const certainty = map.kind === 'images'
    ? `לפי התשריט המאושר. ${imgs.map((i) => `${i.note}: ${i.boundary_on_blue_pct}% מהקו הכחול תואם`).join('; ')}`
    : map.kind === 'vector' ? `הערכה: ${map.note}` : 'המצב הקיים ולא המאושר: תשריט המצב המאושר של התוכנית עוד לא נמצא'
  const chip = map.kind === 'images' ? 'לפי התשריט המאושר' : map.kind === 'vector' ? 'הערכה' : 'המצב הקיים'

  return (
    <section className="mag-chapter tevo" id="tashrit" aria-labelledby="h-tevo">
      <div>
        <h2 id="h-tevo">מתשריט לתשריט</h2>
      </div>
      <div>
        <p className="lead">{TEXT[cur].t}</p>
        <p className="tevo-text">{TEXT[cur].b}</p>
        <div className="tevo-map">
          <svg viewBox={geo.vb} role="img" aria-label={`מפת התוכנית: ${TEXT[cur].t}`}>
            <defs>
              <clipPath id="tevo-clip">
                {model.boundary.features.map((f, i) => <path key={i} d={geo.path(f.geometry as Geo)} />)}
              </clipPath>
              <pattern id="tevo-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="4" stroke="#C9A100" strokeWidth="1.6" />
              </pattern>
            </defs>
            {/* context buildings */}
            <g opacity={0.5}>
              {(model.context?.features ?? []).map((f, i) => <path key={i} d={geo.path(f.geometry as Geo)} fill="#CFCFCD" />)}
            </g>
            {/* approved state */}
            <g className="tevo-l" style={{ opacity: at('use') ? 0.18 : 1 }}>
              {imgs.map((im, i) => {
                const [TL, TR, , BL] = im.corners.map(geo.P)
                const [W, H] = im.size_px
                const m = [(TR[0] - TL[0]) / W, (TR[1] - TL[1]) / W, (BL[0] - TL[0]) / H, (BL[1] - TL[1]) / H, TL[0], TL[1]]
                return (
                  <g key={i} clipPath={at('boundary') ? 'url(#tevo-clip)' : undefined}>
                    <image href={`/plans/${slug}/${im.image}`} width={W} height={H} transform={`matrix(${m.map((v) => v.toFixed(5)).join(' ')})`} preserveAspectRatio="none" />
                  </g>
                )
              })}
              {(map.approved?.features ?? []).map((f, i) => (
                <path key={i} d={geo.path(f.geometry)} fill={FAM[(f.properties?.fam as Fam) ?? 'other'].color} stroke="#555" strokeWidth={geo.fs / 12} />
              ))}
              {(map.parcels?.features ?? []).map((f, i) => (
                <path key={i} d={geo.path(f.geometry)} fill="#EFEDE6" stroke="#8A8A88" strokeWidth={geo.fs / 14} />
              ))}
            </g>
            {/* existing buildings and demolition */}
            <g className="tevo-l" style={{ opacity: at('demolish') && cur !== 'demolish' ? 0 : 1 }}>
              {demolish.map((f, i) => (
                <path key={i} d={geo.path(f.geometry as Geo)} fill={cur === 'demolish' ? 'url(#tevo-hatch)' : '#6E6E6C'} stroke={cur === 'demolish' ? '#C9A100' : 'none'} strokeWidth={geo.fs / 10} />
              ))}
            </g>
            {/* proposed lots: outlines from "split", fills from "use" */}
            <g>
              {lots.map((f, i) => {
                const cat = (f.properties as { cat?: string } | null)?.cat ?? ''
                return (
                  <path key={i} d={geo.path(f.geometry as Geo)} className="tevo-l"
                    fill={LAND_USE[cat]?.color ?? '#DDD'} fillOpacity={at('use') ? 0.85 : 0}
                    stroke="#1A1A1A" strokeWidth={geo.fs / 9} strokeOpacity={at('split') ? 1 : 0} />
                )
              })}
            </g>
            {/* envelopes and volumes */}
            <g className="tevo-l" style={{ opacity: at('lines') ? 1 : 0 }}>
              {(model.massing?.features ?? []).filter((f) => f.properties?.kind === 'envelope').map((f, i) => (
                <path key={i} d={geo.path(f.geometry as Geo)} fill="none" stroke="#111" strokeWidth={geo.fs / 9} strokeDasharray={`${geo.fs / 2} ${geo.fs / 3}`} />
              ))}
            </g>
            <g className="tevo-l" style={{ opacity: at('volume') ? 1 : 0 }}>
              {(model.massing?.features ?? []).filter((f) => f.properties?.kind === 'tower' || f.properties?.kind === 'podium').map((f, i) => (
                <path key={i} d={geo.path(f.geometry as Geo)} fill="#2B2B2A" fillOpacity={f.properties?.kind === 'tower' ? 0.55 : 0.25} stroke="#111" strokeWidth={geo.fs / 12} />
              ))}
            </g>
            {/* the blue line */}
            <g className="tevo-l" style={{ opacity: at('boundary') ? 1 : 0 }}>
              {model.boundary.features.map((f, i) => (
                <path key={i} d={geo.path(f.geometry as Geo)} fill="none" stroke={BLUE_LINE} strokeWidth={geo.fs / 4} />
              ))}
            </g>
          </svg>
        </div>
        <nav className="tevo-steps" aria-label="שלבי האבולוציה">
          {steps.map((st, i) => (
            <button key={st} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : ''} onClick={() => { setPlaying(false); setStep(i) }}>
              {TEXT[st].t}
            </button>
          ))}
        </nav>
        <div className="tevo-ctrl">
          <button onClick={() => { setPlaying(false); setStep((v) => Math.max(0, v - 1)) }}>הקודם</button>
          <button aria-pressed={playing} onClick={() => { if (step >= steps.length - 1) setStep(0); setPlaying((v) => !v) }}>{playing ? 'עצירה' : 'הפעלה'}</button>
          <button onClick={() => { setPlaying(false); setStep((v) => Math.min(steps.length - 1, v + 1)) }}>הבא</button>
        </div>
        <p className="evo-src">{certainty}. <em className="chip">{chip}</em></p>
      </div>
    </section>
  )
}
