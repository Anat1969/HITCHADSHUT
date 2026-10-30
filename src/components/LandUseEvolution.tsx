import { useEffect, useMemo, useState } from 'react'
import { LAND_USE } from '../lib/labels'

interface Row { use: string; m2: number }
interface Evolution { plan_number: string; source: string; approved: Row[]; approved_total: number; proposed: Row[]; proposed_total: number }

/** Folder name of a plan under public/plans: תמל/2022 -> tamal-2022, 3/03/104/66 -> 3-03-104-66. */
export function planSlug(planNumber: string): string {
  return planNumber.replace(/^תמל\s*\/\s*/, 'tamal-').replace(/\s*\/\s*/g, '-')
}

type Fam = 'residential' | 'mixed' | 'commerce' | 'public' | 'open' | 'private_open' | 'road' | 'other'
const FAM: Record<Fam, { label: string; color: string }> = {
  residential: { label: 'מגורים', color: LAND_USE.residential.color },
  mixed: { label: 'מעורב', color: LAND_USE.mixed.color },
  commerce: { label: 'מסחר ותעסוקה', color: LAND_USE.commerce.color },
  public: { label: 'מבני ציבור', color: LAND_USE.public.color },
  open: { label: 'שטח ציבורי פתוח', color: LAND_USE.open.color },
  private_open: { label: 'שטח פרטי פתוח', color: '#A9CB8F' },
  road: { label: 'דרך, שביל וחניה', color: LAND_USE.road.color },
  other: { label: 'אחר', color: '#CFCFCD' },
}
const ORDER: Fam[] = ['residential', 'mixed', 'commerce', 'public', 'open', 'private_open', 'road', 'other']

/** Same families as scripts/evolution-compare.py. */
function fam(u: string): Fam {
  if (/חני/.test(u) && !u.includes('מסחר')) return 'road'
  if (u.includes('מעורב')) return 'mixed'
  if (u.includes('מגורים')) return /מסחר|ציבור|תעסוקה|משרדים/.test(u) ? 'mixed' : 'residential'
  if (/פרטי פתוח|שפ"פ/.test(u)) return 'private_open'
  if (/ציבורי פתוח|שצ"פ|כיכר|ככר/.test(u)) return 'open'
  if (/מסחר|תעסוקה/.test(u)) return /מבנים ומוסדות ציבור/.test(u) ? 'mixed' : 'commerce'
  if (u.includes('ציבור')) return 'public'
  if (/דרך|דרכים|שביל/.test(u)) return 'road'
  return 'other'
}
function sums(rows: Row[]): Record<Fam, number> {
  const s = Object.fromEntries(ORDER.map((k) => [k, 0])) as Record<Fam, number>
  for (const r of rows) s[fam(r.use)] += r.m2
  return s
}
const fmt = (n: number) => Math.round(n).toLocaleString('he-IL')
const pct = (x: number) => `${Math.round(x * 100)}%`

export default function LandUseEvolution({ planNumber }: { planNumber: string }) {
  const [ev, setEv] = useState<Evolution | null>(null)
  const [after, setAfter] = useState(false)
  useEffect(() => {
    let live = true
    fetch(`/plans/${planSlug(planNumber)}/evolution.json`)
      .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null))
      .then((d) => live && setEv(d))
      .catch(() => {})
    return () => { live = false }
  }, [planNumber])
  // Show the approved state first, then let the bar move to the proposed one.
  useEffect(() => {
    if (!ev) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setAfter(true); return }
    const id = setTimeout(() => setAfter(true), 900)
    return () => clearTimeout(id)
  }, [ev])

  const data = useMemo(() => {
    if (!ev) return null
    const a = sums(ev.approved), p = sums(ev.proposed)
    const fams = ORDER.filter((k) => a[k] > 0 || p[k] > 0)
    // The headline treats housing and mixed housing as one family: a residential plot that gains shops is not lost housing.
    const merged = (s: Record<Fam, number>) => ({ ...s, residential: s.residential + s.mixed, mixed: 0 })
    const ma = merged(a), mp = merged(p)
    const deltas = fams.filter((k) => k !== 'mixed').map((k) => ({ k, d: mp[k] / ev.proposed_total - ma[k] / ev.approved_total })).sort((x, y) => x.d - y.d)
    return { a, p, ma, mp, fams, loss: deltas[0], gain: deltas[deltas.length - 1] }
  }, [ev])
  if (!ev || !data) return null
  const { a, p, ma, mp, fams, loss, gain } = data
  const share = (s: Record<Fam, number>, k: Fam, t: number) => (s[k] / t) * 100
  const cur = after ? p : a, curT = after ? ev.proposed_total : ev.approved_total

  return (
    <section className="mag-chapter mag-evo" id="evolution" aria-labelledby="h-evo">
      <div>
        <h2 id="h-evo">מה התוכנית עשתה לקרקע</h2>
      </div>
      <div>
        <p className="lead">
          {gain.d <= 0.005 && loss.d >= -0.005
            ? 'חלוקת הקרקע כמעט לא השתנתה'
            : [gain, loss]
                .filter((x) => Math.abs(x.d) > 0.005)
                .map((x, i) => (
                  <span key={x.k}>
                    {i > 0 && '. '}
                    <b>{x.k === 'residential' ? 'מגורים (כולל מעורב)' : FAM[x.k].label}</b>: מ-{pct(ma[x.k] / ev.approved_total)} ל-{pct(mp[x.k] / ev.proposed_total)} משטח התוכנית
                  </span>
                ))}
        </p>
        <div className="evo-toggle mag-modes static" role="group" aria-label="מצב">
          <button aria-pressed={!after} onClick={() => setAfter(false)}>מצב מאושר</button>
          <button aria-pressed={after} onClick={() => setAfter(true)}>מצב מוצע</button>
        </div>
        <div className="evo-bar" role="img" aria-label={`חלוקת ${fmt(curT)} מ"ר לפי ייעוד, ${after ? 'מצב מוצע' : 'מצב מאושר'}`}>
          {fams.map((k) => (
            <i key={k} style={{ width: `${share(cur, k, curT)}%`, background: FAM[k].color }} title={FAM[k].label} />
          ))}
        </div>
        <table className="evo-table">
          <thead>
            <tr><th>ייעוד</th><th>מאושר</th><th>מוצע</th><th>שינוי</th></tr>
          </thead>
          <tbody>
            {fams.map((k) => {
              const d = p[k] - a[k]
              return (
                <tr key={k}>
                  <td><i style={{ background: FAM[k].color }} />{FAM[k].label}</td>
                  <td>{fmt(a[k])}</td>
                  <td>{fmt(p[k])}</td>
                  <td className={d > 1 ? 'up' : d < -1 ? 'down' : ''}><bdi dir="ltr">{Math.abs(d) <= 1 ? '-' : `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}`}</bdi></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="evo-src">
          מ"ר, {ev.source}.{' '}
          {Math.abs(ev.proposed_total - ev.approved_total) <= 0.002 * ev.approved_total
            ? `שטח התוכנית זהה בשני המצבים: ${fmt(ev.approved_total)} מ"ר.`
            : `שטח התוכנית: ${fmt(ev.approved_total)} מ"ר במאושר, ${fmt(ev.proposed_total)} במוצע.`}{' '}
          <em className="chip">לפי התוכנית</em>
        </p>
      </div>
    </section>
  )
}
