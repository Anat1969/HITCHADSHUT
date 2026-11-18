import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import CityMap3D, { STAGE_COLOR, type CityColor, type CityPlan, type CityTwinModel, type CityView } from '../components/CityMap3D'
import { supabase } from '../lib/supabase'
import { LAND_USE, STATUS_LABEL } from '../lib/labels'
import type { ProjectStatus } from '../lib/types'
import '../styles/city.css'

const VIEWS: { id: CityView; label: string; note: string }[] = [
  { id: 'today', label: 'היום', note: 'המבנים של היום, כולל אלה שהתוכניות עתידות להרוס. הקו הכחול הוא הגבול של כל תוכנית.' },
  {
    id: 'approved',
    label: 'מאושר',
    note: 'התוכניות שכבר אושרו (כולל היתר ובביצוע) נבנות על המפה, והמבנים שהן הורסות יורדים. הנפחים הם הערכה לפי טבלת הזכויות.',
  },
  {
    id: 'all',
    label: 'מאושר ובתכנון',
    note: 'נוספות גם התוכניות שעוד לא אושרו, בכחול שקוף ובקו מקווקו. הן עוד יכולות להשתנות.',
  },
]

const fmt = (n: number) => n.toLocaleString('he-IL')
const planPath = (pn: string) => `/plan/${encodeURIComponent(pn)}`

interface Totals {
  plans: number
  existing: number
  planned: number
  heightMax: number
}

function totals(plans: CityPlan[]): Totals {
  const res = plans.filter((p) => p.units_planned != null && p.units_existing != null)
  return {
    plans: plans.length,
    existing: res.reduce((s, p) => s + (p.units_existing ?? 0), 0),
    planned: res.reduce((s, p) => s + (p.units_planned ?? 0), 0),
    heightMax: Math.max(0, ...plans.map((p) => p.height_max ?? 0)),
  }
}

export default function CityTwin() {
  const [params, setParams] = useSearchParams()
  const view = (VIEWS.find((v) => v.id === params.get('view'))?.id ?? 'all') as CityView
  const color: CityColor = params.get('color') === 'use' ? 'use' : 'stage'
  const [twin, setTwin] = useState<CityTwinModel | null>(null)
  const [error, setError] = useState(false)
  const [picked, setPicked] = useState<string | null>(params.get('focus'))
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [full, setFull] = useState(false)
  const [film, setFilm] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = 'מודל העיר | מה נבנה סביבי'
    supabase
      .from('city_twin')
      .select('model')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e || !data) setError(true)
        else setTwin(data.model as CityTwinModel)
      })
  }, [])

  // Full screen: the browser API where it exists, otherwise the stage fills the window.
  useEffect(() => {
    const f = () => setFull(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])
  const toggleFull = async () => {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenElement) return void document.exitFullscreen()
    if (full) return setFull(false)
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen()
        return
      } catch {
        /* fall back to the window */
      }
    }
    setFull(true)
  }

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v == null) next.delete(k)
    else next.set(k, v)
    setParams(next, { replace: true })
  }

  const plans = useMemo(() => twin?.plans ?? [], [twin])
  const approved = useMemo(() => plans.filter((p) => p.stage === 'approved'), [plans])
  const planning = useMemo(() => plans.filter((p) => p.stage === 'planning'), [plans])
  const tA = totals(approved)
  const tP = totals(planning)
  // Units in the compared plans: today, after the approved plans, and after all of them.
  const today = tA.existing + tP.existing
  const afterApproved = tA.planned + tP.existing
  const afterAll = tA.planned + tP.planned
  const outOfCompare = plans.filter((p) => p.units_planned == null || p.units_existing == null)
  const pickedPlan = plans.find((p) => p.plan_number === picked) ?? null
  const viewInfo = VIEWS.find((v) => v.id === view)!
  const usesInModel = useMemo(() => {
    const cats = new Set(twin?.massing.features.map((f) => f.properties?.cat).filter(Boolean))
    return Object.keys(LAND_USE).filter((k) => cats.has(k))
  }, [twin])

  return (
    <div className="city" dir="rtl">
      <TopBar context="מודל העיר" />
      <header className="city-head">
        <div>
          <h1>מודל העיר</h1>
          <p>כל התוכניות במודל אחד: מה יש היום, מה כבר אושר ומה עוד בתכנון.</p>
        </div>
        <div className="city-controls">
          <div className="city-seg" role="group" aria-label="מה רואים">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => set('view', v.id === 'all' ? null : v.id)}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="city-seg" role="group" aria-label="צבע לפי">
            <button type="button" aria-pressed={color === 'stage'} onClick={() => set('color', null)}>
              צבע לפי שלב
            </button>
            <button type="button" aria-pressed={color === 'use'} onClick={() => set('color', 'use')}>
              לפי ייעוד
            </button>
          </div>
          <button type="button" className="city-btn" aria-pressed={summaryOpen} onClick={() => setSummaryOpen((v) => !v)}>
            סיכום
          </button>
          <button type="button" className="city-btn" onClick={toggleFull}>
            {full ? 'יציאה ממסך מלא' : 'מסך מלא'}
          </button>
          <button type="button" className="city-btn" onClick={() => setFilm(true)}>
            סרטון
          </button>
        </div>
      </header>
      {film && (
        <div className="city-film" role="dialog" aria-label="סרטון מודל העיר" onClick={() => setFilm(false)}>
          <video src="/media/city-film.mp4" controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
          <div className="city-film-bar" onClick={(e) => e.stopPropagation()}>
            <a href="/media/city-film.mp4" download="מודל-העיר-אשדוד.mp4">הורדת הסרטון</a>
            <button type="button" onClick={() => setFilm(false)}>
              סגירה
            </button>
          </div>
        </div>
      )}

      <div ref={stageRef} className={`city-stage${full ? ' is-full' : ''}`}>
        {twin ? (
          <CityMap3D twin={twin} view={view} color={color} focus={picked} onPick={setPicked} />
        ) : (
          <div className="city-map city-wait">{error ? 'מודל העיר אינו זמין כרגע' : 'טוען את מודל העיר...'}</div>
        )}

        {full && (
          <div className="city-float-controls">
            <div className="city-seg" role="group" aria-label="מה רואים">
              {VIEWS.map((v) => (
                <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => set('view', v.id === 'all' ? null : v.id)}>
                  {v.label}
                </button>
              ))}
            </div>
            <button type="button" className="city-btn" aria-pressed={summaryOpen} onClick={() => setSummaryOpen((v) => !v)}>
              סיכום
            </button>
            <button type="button" className="city-btn" onClick={toggleFull}>
              יציאה ממסך מלא
            </button>
          </div>
        )}

        <div className="city-legend">
          <p>{viewInfo.note}</p>
          {color === 'stage' ? (
            <ul>
              <li>
                <i style={{ background: '#D2D2D0' }} />
                מבנים היום
              </li>
              <li>
                <i style={{ background: STAGE_COLOR.approved }} />
                מאושר
              </li>
              <li>
                <i style={{ background: STAGE_COLOR.planning, opacity: 0.78 }} />
                בתכנון
              </li>
            </ul>
          ) : (
            <ul>
              {usesInModel.map((k) => (
                <li key={k}>
                  <i style={{ background: LAND_USE[k].color }} />
                  {LAND_USE[k].label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {pickedPlan && (
          <div className="city-card" role="dialog" aria-label={pickedPlan.title}>
            <button type="button" className="city-x" onClick={() => setPicked(null)} aria-label="סגירה">
              סגירה
            </button>
            <span className={`city-tag ${pickedPlan.stage}`}>{pickedPlan.stage === 'approved' ? 'מאושר' : 'בתכנון'}</span>
            <h2>{pickedPlan.title}</h2>
            <p className="city-pn">
              תוכנית {pickedPlan.plan_number} · {STATUS_LABEL[pickedPlan.status as ProjectStatus] ?? pickedPlan.status}
            </p>
            {pickedPlan.units_planned != null ? (
              <p>
                {pickedPlan.units_existing != null && <>{fmt(pickedPlan.units_existing)} דירות היום · </>}
                {fmt(pickedPlan.units_planned)} דירות בתוכנית
              </p>
            ) : (
              <p>תוכנית בלי מגורים</p>
            )}
            <Link to={planPath(pickedPlan.plan_number)}>לעמוד התוכנית</Link>
          </div>
        )}

        {summaryOpen && twin && (
          <aside className="city-summary" aria-label="סיכום">
            <div className="city-summary-head">
              <h2>סיכום</h2>
              <button type="button" className="city-x" onClick={() => setSummaryOpen(false)}>
                סגירה
              </button>
            </div>

            <div className="city-cards">
              {(
                [
                  ['approved', 'מאושר', tA],
                  ['planning', 'בתכנון', tP],
                ] as const
              ).map(([id, label, t]) => (
                <section key={id} className={`city-stat ${id}`}>
                  <h3>{label}</h3>
                  <b>{t.plans}</b> תוכניות
                  <dl>
                    <dt>דירות היום</dt>
                    <dd>{fmt(t.existing)}</dd>
                    <dt>דירות בתוכניות</dt>
                    <dd>{fmt(t.planned)}</dd>
                    <dt>תוספת</dt>
                    <dd>{fmt(t.planned - t.existing)}</dd>
                    <dt>גובה מרבי</dt>
                    <dd>{t.heightMax ? `${Math.round(t.heightMax)} מ'` : '-'}</dd>
                  </dl>
                </section>
              ))}
            </div>

            <h3 className="city-sub">דירות במתחמים, היום ואחרי</h3>
            <div className="city-bars">
              {(
                [
                  ['היום', today],
                  ['אחרי המאושר', afterApproved],
                  ['אחרי הכול', afterAll],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="city-bar">
                  <span>{label}</span>
                  <i style={{ width: `${(100 * n) / Math.max(afterAll, 1)}%` }} />
                  <b>{fmt(n)}</b>
                </div>
              ))}
            </div>
            <p className="city-src">
              מקור: מספרי הדירות לפי הוראות כל תוכנית, ודירות היום לפי מסמכי התוכנית ו-data.gov.il. הגובה המרבי לפי טבלאות הזכויות, והנפחים במודל הם
              הערכה.
              {outOfCompare.length > 0 && <> לא נכללו בהשוואה: {outOfCompare.map((p) => p.title).join(', ')} (בלי מגורים, או בלי מספר דירות היום).</>}
            </p>

            <h3 className="city-sub">כל התוכניות</h3>
            <table className="city-table">
              <thead>
                <tr>
                  <th>תוכנית</th>
                  <th>שלב</th>
                  <th>דירות</th>
                </tr>
              </thead>
              <tbody>
                {[...approved, ...planning].map((p) => (
                  <tr key={p.plan_number}>
                    <td>
                      <button type="button" className="city-link" onClick={() => setPicked(p.plan_number)}>
                        {p.title}
                      </button>
                      <small>{p.plan_number}</small>
                    </td>
                    <td>
                      <span className={`city-tag ${p.stage}`}>{p.stage === 'approved' ? 'מאושר' : 'בתכנון'}</span>
                    </td>
                    <td>
                      {p.units_planned != null ? (
                        <>
                          {p.units_existing != null ? `${fmt(p.units_existing)} ← ` : ''}
                          {fmt(p.units_planned)}
                        </>
                      ) : (
                        'בלי מגורים'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </aside>
        )}
      </div>
    </div>
  )
}
