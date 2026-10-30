import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlanModel } from '../lib/types'
import { SEASONS, seasonTime, shadeAt, sunPosition, type Raster, type Receptor, type Season, type ShadeModel } from '../lib/shade'
import { BLUE_LINE } from '../lib/labels'

interface Result {
  r: Raster
  H0: Float32Array
  H1: Float32Array
  h0: Float32Array
  h1: Float32Array
  inside: Uint8Array
  stats: Receptor[]
  season: Season
}
type View = 'today' | 'after' | 'diff'
const VIEWS: { id: View; label: string }[] = [
  { id: 'today', label: 'היום' },
  { id: 'after', label: 'אחרי' },
  { id: 'diff', label: 'מה השתנה' },
]
const pct = (x: number) => `${Math.round(x * 100)}%`
const hrs = (x: number) => x.toFixed(1)

/** Sun hours: deep blue-grey (no sun) to warm light (full day). */
function sunColor(t: number): [number, number, number] {
  const a = [38, 52, 74], b = [246, 214, 120]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
/** Change in sun hours: red for loss, green for gain, paper for no change. */
function diffColor(d: number): [number, number, number] {
  const t = Math.min(1, Math.abs(d) / 4)
  const p = [236, 236, 234], c = d < 0 ? [190, 40, 40] : [46, 140, 80]
  return [p[0] + (c[0] - p[0]) * t, p[1] + (c[1] - p[1]) * t, p[2] + (c[2] - p[2]) * t]
}

export default function ShadeStudy({ model }: { model: PlanModel }) {
  const [season, setSeason] = useState<Season>('winter')
  const [view, setView] = useState<View>('diff')
  const [hour, setHour] = useState(10)
  const [playing, setPlaying] = useState(false)
  const [res, setRes] = useState<Result | null>(null)
  const [busy, setBusy] = useState(true)
  const canvas = useRef<HTMLCanvasElement>(null)
  const dayLen = useMemo(() => {
    const ss = SEASONS.find((s) => s.id === season)!
    let rise = 12, set = 12
    for (let t = 4; t < 21; t += 0.25) {
      const el = sunPosition(seasonTime(season, t), 31.8, 34.65).el
      if (el > 0) { rise = Math.min(rise, t); set = Math.max(set, t) }
    }
    return { rise, set, label: ss.date }
  }, [season])

  useEffect(() => {
    setBusy(true)
    const w = new Worker(new URL('../lib/shade.worker.ts', import.meta.url), { type: 'module' })
    const sm = { context: model.context, demolish: model.demolish, massing: model.massing, boundary: model.boundary, parcels: model.parcels } as unknown as ShadeModel
    w.onmessage = (e: MessageEvent<Result>) => { setRes(e.data); setBusy(false); w.terminate() }
    w.onerror = () => { setBusy(false); w.terminate() }
    w.postMessage({ model: sm, season })
    return () => w.terminate()
  }, [model, season])

  useEffect(() => {
    if (!playing) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setHour((h) => (h + 0.25 > dayLen.set ? Math.ceil(dayLen.rise) : h + 0.25)), 220)
    return () => clearInterval(id)
  }, [playing, dayLen])

  // Draw: sun hours (or change), buildings, the plan's blue line, and the shade at the chosen hour.
  useEffect(() => {
    const c = canvas.current
    if (!c || !res) return
    const { r, H0, H1, h0, h1, inside } = res
    c.width = r.w; c.height = r.h
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(r.w, r.h)
    const H = view === 'today' ? H0 : H1
    const sun = sunPosition(seasonTime(season, hour), r.lat0, r.lon0)
    const sh = shadeAt(r, H, sun.az, sun.el)
    const day = dayLen.set - dayLen.rise
    for (let j = 0; j < r.h; j++)
      for (let i = 0; i < r.w; i++) {
        const k = j * r.w + i, o = ((r.h - 1 - j) * r.w + i) * 4
        let col: [number, number, number]
        if (H[k] > 0) col = view === 'after' && H0[k] === 0 ? [214, 131, 74] : [118, 118, 116]
        else if (view === 'diff') col = H0[k] > 0 ? [205, 205, 203] : diffColor(h1[k] - h0[k])
        else col = sunColor(Math.min(1, (view === 'today' ? h0[k] : h1[k]) / Math.max(1, day)))
        if (view !== 'diff' && sh[k] && H[k] === 0) col = [col[0] * 0.62, col[1] * 0.62, col[2] * 0.66]
        // blue line: a cell inside whose neighbour is outside
        const edge = inside[k] && ((i > 0 && !inside[k - 1]) || (i < r.w - 1 && !inside[k + 1]) || (j > 0 && !inside[k - r.w]) || (j < r.h - 1 && !inside[k + r.w]))
        if (edge) col = [0x1d, 0x4e, 0xd8]
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
  }, [res, view, hour, season, dayLen])

  const nb = res?.stats.find((s) => s.key === 'neighbours')
  const open = res?.stats.find((s) => s.key === 'open' && s.area > 0)
  const hh = Math.floor(hour), mm = Math.round((hour - hh) * 60)
  return (
    <section className="mag-chapter mag-sun" id="sun" aria-labelledby="h-sun">
      <div>
        <h2 id="h-sun">שמש וצל</h2>
      </div>
      <div>
        <p className="lead">איפה הבניינים החדשים מטילים צל, היום ואחרי</p>
        <div className="sun-controls">
          <div className="mag-modes static" role="group" aria-label="עונה">
            {SEASONS.map((s) => (
              <button key={s.id} aria-pressed={season === s.id} onClick={() => setSeason(s.id)}>
                {s.label} · {s.date}
              </button>
            ))}
          </div>
          <div className="mag-modes static" role="group" aria-label="תצוגה">
            {VIEWS.map((v) => (
              <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="sun-map">
          <canvas ref={canvas} aria-label="מפת שעות שמש סביב התוכנית" />
          {busy && <div className="sun-busy">מחשב את מסלול השמש...</div>}
        </div>
        {view !== 'diff' && (
          <div className="sun-clock">
            <button onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>{playing ? 'עצירה' : 'הנפשת הצל'}</button>
            <input
              type="range" min={Math.ceil(dayLen.rise)} max={Math.floor(dayLen.set)} step={0.25} value={hour}
              onChange={(e) => { setPlaying(false); setHour(Number(e.target.value)) }} aria-label="שעה ביום"
            />
            <b>{String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}</b>
          </div>
        )}
        <div className="sun-legend">
          {view === 'diff' ? (
            <>
              <span><i style={{ background: 'rgb(190,40,40)' }} />פחות שמש (4 שעות ויותר)</span>
              <span><i style={{ background: 'rgb(236,236,234)' }} />בלי שינוי</span>
              <span><i style={{ background: 'rgb(46,140,80)' }} />יותר שמש</span>
              <span><i style={{ background: 'rgb(214,131,74)' }} />בניין חדש</span>
            </>
          ) : (
            <>
              <span><i style={{ background: 'rgb(38,52,74)' }} />בלי שמש ישירה</span>
              <span><i style={{ background: 'rgb(246,214,120)' }} />שמש כל היום</span>
              <span><i style={{ background: 'rgb(118,118,116)' }} />בניין</span>
              <span><i style={{ background: BLUE_LINE }} />גבול התוכנית</span>
            </>
          )}
        </div>

        {nb && (
          <ul className="sun-facts">
            <li>
              <b>{pct(nb.lost1h)}</b> מהקרקע סביב התוכנית מאבדים שעת שמש או יותר ב-{dayLen.label}.
              <span> ממוצע: {hrs(nb.mean0)} שעות היום, {hrs(nb.mean1)} אחרי. <em className="chip">מחושב</em></span>
            </li>
            {season === 'equinox' && (
              <li>
                שטח עם שעתיים שמש לפחות ב-21 במרץ: <b>{pct(nb.two0)}</b> היום, <b>{pct(nb.two1)}</b> אחרי
                (יחס {nb.two0 ? (nb.two1 / nb.two0).toFixed(2) : '-'}).
                <span> לפי BRE 209 (בריטניה), יחס מתחת ל-0.8 הוא פגיעה מורגשת. <em className="chip">מחושב</em></span>
              </li>
            )}
            {open && (
              <li>
                השטחים הפתוחים בתוכנית: <b>{hrs(open.mean1)}</b> שעות שמש בממוצע ב-{dayLen.label}
                {season === 'equinox' && <>, ו-<b>{pct(open.two1)}</b> מהם מקבלים שעתיים לפחות (המלצת BRE 209: חצי לפחות)</>}.
                <span> <em className="chip">מחושב</em></span>
              </li>
            )}
          </ul>
        )}
        <details className="sun-method">
          <summary>איך זה חושב, ועד כמה אפשר לסמוך</summary>
          <p>
            מיקום השמש לפי משוואות NOAA, בסטייה של עד 0.02 מעלות מול אלגוריתם NREL SPA. הצל מחושב על רשת של 2 מ', בטעות של עד 2 מ' באורך הצל.
            הבדיקה המלאה: docs/validation-shading.md בריפו.
          </p>
          <p>
            הבניינים הקיימים: {model.sources?.context ?? 'מפת הרקע'}. הנפחים החדשים: {model.sources?.lots ?? 'המודל של התוכנית'}.
            הקרקע נחשבת שטוחה, ועצים לא נכללים. זו השוואה בין היום לאחרי ולא חוות דעת של יועץ.
          </p>
        </details>
      </div>
    </section>
  )
}
