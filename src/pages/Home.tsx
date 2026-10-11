import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MapView, { type MapFocus } from '../components/MapView'
import ProjectDetail, { coverOf } from '../components/ProjectDetail'
import type { Feedback, LonLat, ProjectKind, ProjectStatus, ProjectWithMedia, Quarter } from '../lib/types'
import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from '../lib/labels'
import { fetchLatestAnswered, fetchPublishedProjects, fetchQuarters, geocodeAshdod, type GeocodeResult } from '../lib/data'
import { distanceMeters, formatDistance } from '../lib/geo'
import { mediaSrc } from '../lib/media'
import '../styles/front.css'

const KINDS = Object.keys(KIND_LABEL) as ProjectKind[]
const NEAR_METERS = 1000

export default function Home() {
  const { id: selectedId } = useParams()
  const navigate = useNavigate()

  const [projects, setProjects] = useState<ProjectWithMedia[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [quarters, setQuarters] = useState<Quarter[]>([])

  const [kinds, setKinds] = useState<Set<ProjectKind>>(new Set())
  const [statuses, setStatuses] = useState<Set<ProjectStatus>>(new Set())
  const [quarterId, setQuarterId] = useState('')
  const [nearOnly, setNearOnly] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [answered, setAnswered] = useState<Feedback[]>([])

  const [me, setMe] = useState<LonLat | null>(null)
  const [meLabel, setMeLabel] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchMsg, setSearchMsg] = useState('')

  const [hoverId, setHoverId] = useState<string | null>(null)
  const [focus, setFocus] = useState<MapFocus>(null)
  const nonce = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchPublishedProjects()
      .then(setProjects)
      .catch(() => {
        setLoadError(true)
        setProjects([])
      })
    fetchQuarters().then(setQuarters).catch(() => {})
    fetchLatestAnswered(1).then(setAnswered).catch(() => {})
  }, [])

  const selected = useMemo(() => projects?.find((p) => p.id === selectedId) ?? null, [projects, selectedId])

  // Fly to a project when it is opened (also from a shared link).
  useEffect(() => {
    if (selected) setFocus({ type: 'project', project: selected, nonce: ++nonce.current })
    scrollRef.current?.scrollTo({ top: 0 })
  }, [selected])

  useEffect(() => {
    document.title = selected ? `${selected.title} | מה נבנה סביבי` : 'מה נבנה סביבי | אשדוד'
  }, [selected])

  const filtered = useMemo(() => {
    if (!projects) return []
    let list = projects.filter(
      (p) =>
        (!kinds.size || kinds.has(p.kind)) &&
        (!statuses.size || statuses.has(p.status)) &&
        (!quarterId || p.quarter_id === quarterId),
    )
    if (me) {
      const withD = list.map((p) => ({ p, d: p.center ? distanceMeters(me, p.center) : Infinity }))
      withD.sort((a, b) => a.d - b.d)
      list = withD.filter((x) => !nearOnly || x.d <= NEAR_METERS).map((x) => x.p)
    }
    return list
  }, [projects, kinds, statuses, quarterId, me, nearOnly])

  const activeFilters = kinds.size + statuses.size + (quarterId ? 1 : 0) + (nearOnly ? 1 : 0)

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    setter(n)
  }

  const clearFilters = () => {
    setKinds(new Set())
    setStatuses(new Set())
    setQuarterId('')
    setNearOnly(false)
  }

  const open = useCallback(
    (id: string) => {
      const p = projects?.find((x) => x.id === id)
      if (p?.story && p.plan_number) navigate(`/plan/${p.plan_number}`)
      else navigate(`/p/${id}`)
    },
    [navigate, projects],
  )
  const back = useCallback(() => navigate('/'), [navigate])

  const placeMe = (point: LonLat, label: string) => {
    setMe(point)
    setMeLabel(label)
    setResults(null)
    setNearOnly(false)
    setFocus({ type: 'point', point, zoom: 15, nonce: ++nonce.current })
    if (selectedId) navigate('/')
  }

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q.length < 2) return
    const hit = (projects ?? []).find((p) =>
      [p.title, p.address, p.plan_number].some((v) => v && (v.includes(q) || q.includes(v))),
    )
    if (hit) {
      setSearchMsg('')
      open(hit.id)
      return
    }
    setSearching(true)
    setSearchMsg('')
    try {
      const r = await geocodeAshdod(q)
      if (!r.length) setSearchMsg('לא מצאנו כתובת או פרויקט בשם הזה. נסו רחוב ומספר, שם שכונה או מספר תוכנית.')
      else if (r.length === 1) placeMe(r[0].point, r[0].label)
      else setResults(r)
    } catch {
      setSearchMsg('החיפוש אינו זמין כרגע. אפשר להשתמש בכפתור "המיקום שלי".')
    } finally {
      setSearching(false)
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setSearchMsg('הדפדפן לא מאפשר איתור מיקום.')
      return
    }
    setSearchMsg('מאתרים את המיקום שלך...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSearchMsg('')
        placeMe([pos.coords.longitude, pos.coords.latitude], 'המיקום שלי')
      },
      () => setSearchMsg('לא הצלחנו לאתר מיקום. אפשר להקליד כתובת במקום.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const statusCounts = useMemo(() => {
    const c: Partial<Record<ProjectStatus, number>> = {}
    for (const p of projects ?? []) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [projects])

  const usedQuarters = useMemo(() => {
    const ids = new Set((projects ?? []).map((p) => p.quarter_id).filter(Boolean))
    return quarters.filter((q) => ids.has(q.id))
  }, [projects, quarters])

  const featured = filtered[0] ?? null
  const rest = filtered.slice(1)
  const featuredCover = featured ? coverImage(featured) : null
  const today = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date())

  if (selected)
    return (
      <div className="fp fp-article">
        <div className="fp-wrap fp-narrow" ref={scrollRef}>
          <ProjectDetail project={selected} quarters={quarters} me={me} onBack={back} />
        </div>
      </div>
    )

  return (
    <div className="fp">
      <div className="fp-wrap">
        <header className="fp-top">
          <span>אשדוד · מה נבנה סביבי</span>
          <span>
            {today}
            {projects && projects.length > 0 ? ` · ${projects.length} פרויקטים` : ''}
          </span>
        </header>

        <section className="fp-head">
          <h1>
            מה נבנה
            <br />
            ברחוב <span className="serif">שלך?</span>
          </h1>
          <form className="fp-search" onSubmit={search} role="search">
            <label className="fp-label" htmlFor="addr">
              הכתובת שלך, שם שכונה או שם פרויקט
            </label>
            <div className="fp-pill">
              <input
                id="addr"
                placeholder="רחוב ומספר"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="street-address"
              />
              <button type="submit" disabled={searching}>
                {searching ? 'מחפש...' : 'לחפש'}
              </button>
            </div>
            <button type="button" className="fp-link" onClick={locate}>
              או לפי המיקום שלי
            </button>
            {searchMsg && <div className="fp-msg">{searchMsg}</div>}
            {results && (
              <ul className="search-results" aria-label="תוצאות חיפוש">
                {results.map((r, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => placeMe(r.point, r.label)}>
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {me && (
              <div className="fp-here">
                <span>
                  לפי קרבה ל: <b>{meLabel}</b>
                </span>
                {me && (
                  <label className="fp-near">
                    <input type="checkbox" checked={nearOnly} onChange={(e) => setNearOnly(e.target.checked)} />
                    רק עד ק"מ
                  </label>
                )}
                <button
                  type="button"
                  className="fp-link light"
                  onClick={() => {
                    setMe(null)
                    setNearOnly(false)
                    setFocus({ type: 'all', nonce: ++nonce.current })
                  }}
                >
                  ניקוי
                </button>
              </div>
            )}
          </form>
        </section>

        {selectedId && projects && !selected && <div className="fp-msg">הפרויקט שחיפשתם אינו זמין כרגע. אולי הוא עדיין בהכנה.</div>}

        {projects === null ? (
          <div className="loading">טוען את הפרויקטים...</div>
        ) : loadError ? (
          <div className="fp-empty">
            <h3>לא הצלחנו לטעון את הפרויקטים</h3>
            <button className="btn" onClick={() => window.location.reload()}>
              טעינה מחדש
            </button>
          </div>
        ) : (
          <section className="fp-grid">
            <article className="fp-cover">
              {featured ? (
                <>
                  <button className="fp-render" onClick={() => open(featured.id)} aria-label={`לכתבה: ${featured.title}`}>
                    {featuredCover ? <img src={featuredCover} alt="" /> : <span className="fp-render-empty">{KIND_LABEL[featured.kind]}</span>}
                    <span className="fp-render-tag">{featured.plan_number ? `תוכנית ${featured.plan_number}` : 'הדמיה'}</span>
                  </button>
                  <span className="fp-status">{STATUS_LABEL[featured.status]}</span>
                  <h2 onClick={() => open(featured.id)}>{featured.title}</h2>
                  {featured.summary && <p className="fp-deck">{featured.summary}</p>}
                  <button className="fp-more" onClick={() => open(featured.id)}>
                    {featured.story ? 'לכתבה המלאה, למודל התלת-ממדי ולשאלות השכנים' : 'לכל הפרטים ולשאלות השכנים'}
                  </button>
                </>
              ) : (
                <div className="fp-empty">
                  <h3>{projects.length ? 'אין פרויקטים שמתאימים לבחירה' : 'המפה בהקמה'}</h3>
                  {activeFilters > 0 && (
                    <button className="btn btn-sm" onClick={clearFilters}>
                      ניקוי הסינון
                    </button>
                  )}
                </div>
              )}
            </article>

            <nav className="fp-list" aria-label="עוד בסביבה">
              <span className="fp-label rule">{me ? 'עוד קרוב אליך' : 'עוד בעיר'}</span>
              {rest.length === 0 ? (
                <p className="fp-soon">פרויקטים נוספים יעלו כאן בקרוב, עם הדמיות, סרטונים ומקום לשאלות.</p>
              ) : (
                <ol>
                  {rest.map((p, i) => {
                    const d = me && p.center ? distanceMeters(me, p.center) : null
                    return (
                      <li key={p.id}>
                        <button
                          className={hoverId === p.id ? 'is-hover' : ''}
                          onClick={() => open(p.id)}
                          onMouseEnter={() => setHoverId(p.id)}
                          onMouseLeave={() => setHoverId(null)}
                        >
                          <span className="n">{String(i + 2).padStart(2, '0')}</span>
                          <span className="t">
                            <small>
                              {STATUS_LABEL[p.status]}
                              {d != null ? ` · ${formatDistance(d)}` : ''}
                            </small>
                            {p.title}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              )}
            </nav>

            <aside className={`fp-mapcol${mapOpen ? ' is-open' : ''}`}>
              <div className="fp-label rule fp-maphead">
                <span>המפה · מבט על</span>
                <button type="button" className="fp-link" onClick={() => setMapOpen((v) => !v)}>
                  {mapOpen ? 'סגירה' : 'למפה המלאה'}
                </button>
              </div>
              <div className="fp-map">
                <MapView
                  projects={filtered}
                  hoverId={hoverId}
                  onSelect={open}
                  onHover={setHoverId}
                  me={me}
                  meRadius={NEAR_METERS}
                  focus={focus}
                />
              </div>
              <div className="fp-swatches" role="group" aria-label="סינון לפי שלב">
                {STATUS_ORDER.map((st) => (
                  <button
                    key={st}
                    type="button"
                    aria-pressed={statuses.has(st)}
                    onClick={() => toggle(statuses, st, setStatuses)}
                    title={statusCounts[st] ? `${statusCounts[st]} פרויקטים` : undefined}
                  >
                    <i style={{ background: STATUS_COLOR[st] }} />
                    {STATUS_LABEL[st]}
                  </button>
                ))}
              </div>
              <div className="fp-kinds" role="group" aria-label="סינון לפי סוג">
                {KINDS.map((k) => (
                  <button key={k} type="button" aria-pressed={kinds.has(k)} onClick={() => toggle(kinds, k, setKinds)}>
                    {KIND_LABEL[k]}
                  </button>
                ))}
                {usedQuarters.length > 1 && (
                  <select value={quarterId} onChange={(e) => setQuarterId(e.target.value)} aria-label="רובע">
                    <option value="">כל העיר</option>
                    {usedQuarters.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name}
                      </option>
                    ))}
                  </select>
                )}
                {activeFilters > 0 && (
                  <button type="button" className="fp-link" onClick={clearFilters}>
                    ניקוי
                  </button>
                )}
              </div>
            </aside>
          </section>
        )}

        <section className="fp-band" aria-label="השכנים שואלים">
          <span className="fp-label">השכנים שואלים</span>
          {answered.length > 0 ? (
            <>
              <q>{answered[0].body}</q>
              <span className="a">העירייה עונה: {answered[0].reply}</span>
            </>
          ) : (
            <>
              <q>מה זה אומר עליי, על הרחוב ועל הבית שלי?</q>
              <span className="a">כל עמוד פרויקט פתוח לשאלות. צוות העירייה עונה, והתשובות מתפרסמות לכולם.</span>
            </>
          )}
        </section>

        <footer className="fp-foot">
          <span>המידע מתעדכן על ידי עיריית אשדוד</span>
          <Link to="/admin">ניהול</Link>
        </footer>
      </div>
    </div>
  )
}

function coverImage(p: ProjectWithMedia): string | null {
  const c = coverOf(p)
  if (c) return mediaSrc(c)
  const d = [...p.plan_media].filter((m) => m.kind === 'drawing').sort((a, b) => a.sort - b.sort)[0]
  return d ? mediaSrc(d) : null
}
