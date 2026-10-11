import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MapView, { type MapFocus } from '../components/MapView'
import ProjectDetail, { coverOf } from '../components/ProjectDetail'
import type { LonLat, ProjectKind, ProjectStatus, ProjectWithMedia, Quarter } from '../lib/types'
import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from '../lib/labels'
import { fetchPublishedProjects, fetchQuarters, geocodeAshdod, type GeocodeResult } from '../lib/data'
import { distanceMeters, formatDistance } from '../lib/geo'
import { mediaSrc } from '../lib/media'

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
  const [filtersOpen, setFiltersOpen] = useState(false)

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
    setSearching(true)
    setSearchMsg('')
    try {
      const r = await geocodeAshdod(q)
      if (!r.length) setSearchMsg('לא מצאנו את הכתובת באשדוד. נסו רחוב ומספר, או שם שכונה.')
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

  return (
    <div className={`shell${selected ? ' detail-open' : ''}`}>
      <aside className="panel" aria-label="פרויקטים">
        <div className="panel-scroll" ref={scrollRef}>
          {selected ? (
            <ProjectDetail project={selected} quarters={quarters} me={me} onBack={back} />
          ) : (
            <>
              <header className="brand">
                <div className="brand-top">
                  <h1>
                    מה נבנה <em>סביבי</em>
                  </h1>
                  <span className="city">אשדוד</span>
                </div>
                <p>
                  פרויקטי הבינוי וההתחדשות העירונית בעיר, במפה אחת ובשפה פשוטה. הקלידו כתובת כדי לראות מה מתוכנן לידכם, ושאלו את צוות
                  העירייה ישירות.
                </p>
              </header>

              <form className="search" onSubmit={search} role="search">
                <label className="visually-hidden" htmlFor="addr">
                  כתובת או שכונה
                </label>
                <div className="search-row">
                  <input
                    id="addr"
                    className="input"
                    placeholder="רחוב ומספר, או שם שכונה"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="street-address"
                  />
                  <button className="btn btn-primary" type="submit" disabled={searching}>
                    {searching ? 'מחפש...' : 'חיפוש'}
                  </button>
                </div>
                <button type="button" className="btn btn-sm" onClick={locate} style={{ justifySelf: 'start' }}>
                  המיקום שלי
                </button>
                {searchMsg && <div className="notice notice-info">{searchMsg}</div>}
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
                  <div className="here">
                    <span>
                      מציגים לפי קרבה ל: <b>{meLabel}</b>
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
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

              <div className="filters" data-open={filtersOpen}>
                <button
                  type="button"
                  className="btn btn-sm filters-toggle"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((v) => !v)}
                >
                  {filtersOpen ? 'הסתרת הסינון' : `סינון${activeFilters ? ` (${activeFilters})` : ''}`}
                </button>
                <div className="filters-body">
                  {me && (
                    <label className="switch">
                      <input type="checkbox" checked={nearOnly} onChange={(e) => setNearOnly(e.target.checked)} />
                      רק במרחק הליכה (עד ק"מ)
                    </label>
                  )}
                  <div style={{ display: 'grid', gap: 6 }}>
                    <span className="filters-label">שלב</span>
                    <div className="chips">
                      {STATUS_ORDER.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="chip"
                          aria-pressed={statuses.has(s)}
                          onClick={() => toggle(statuses, s, setStatuses)}
                        >
                          <span className="dot" style={{ background: STATUS_COLOR[s] }} />
                          {STATUS_LABEL[s]}
                          {statusCounts[s] ? <span className="muted">{statusCounts[s]}</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <span className="filters-label">סוג</span>
                    <div className="chips">
                      {KINDS.map((k) => (
                        <button key={k} type="button" className="chip" aria-pressed={kinds.has(k)} onClick={() => toggle(kinds, k, setKinds)}>
                          {KIND_LABEL[k]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {usedQuarters.length > 1 && (
                    <label className="field">
                      <span className="filters-label">רובע</span>
                      <select className="select" value={quarterId} onChange={(e) => setQuarterId(e.target.value)}>
                        <option value="">כל העיר</option>
                        {usedQuarters.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {activeFilters > 0 && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={clearFilters}>
                      ניקוי הסינון
                    </button>
                  )}
                </div>
              </div>

              {selectedId && projects && !selected && (
                <div className="notice notice-warn" style={{ margin: '14px 22px 0' }}>
                  הפרויקט שחיפשתם אינו זמין כרגע. אולי הוא עדיין בהכנה.
                </div>
              )}

              {projects === null ? (
                <div className="loading">טוען את המפה...</div>
              ) : loadError ? (
                <div className="empty">
                  <h3>לא הצלחנו לטעון את הפרויקטים</h3>
                  <p>בדקו את החיבור לאינטרנט ונסו שוב.</p>
                  <button className="btn" onClick={() => window.location.reload()}>
                    טעינה מחדש
                  </button>
                </div>
              ) : projects.length === 0 ? (
                <div className="empty">
                  <h3>המפה בהקמה</h3>
                  <p>הפרויקטים הראשונים יעלו כאן בקרוב, עם הדמיות, סרטונים ומקום לשאלות.</p>
                </div>
              ) : (
                <>
                  <div className="list-head">
                    <h2>{me ? 'הכי קרוב אליך' : 'כל הפרויקטים'}</h2>
                    <span className="muted" style={{ fontSize: 14 }}>
                      {filtered.length} פרויקטים
                    </span>
                  </div>
                  {filtered.length === 0 ? (
                    <div className="empty">
                      <h3>אין פרויקטים שמתאימים לבחירה</h3>
                      <button className="btn btn-sm" onClick={clearFilters}>
                        ניקוי הסינון
                      </button>
                    </div>
                  ) : (
                    <ul className="list">
                      {filtered.map((p) => {
                        const cover = coverOf(p)
                        const q = quarters.find((x) => x.id === p.quarter_id)
                        const d = me && p.center ? distanceMeters(me, p.center) : null
                        return (
                          <li key={p.id}>
                            <button
                              className={`card${hoverId === p.id ? ' is-hover' : ''}`}
                              onClick={() => open(p.id)}
                              onMouseEnter={() => setHoverId(p.id)}
                              onMouseLeave={() => setHoverId(null)}
                            >
                              {cover ? (
                                <img className="thumb" src={mediaSrc(cover) ?? ''} alt="" loading="lazy" />
                              ) : (
                                <div className="thumb thumb-empty">{KIND_LABEL[p.kind]}</div>
                              )}
                              <div>
                                <div className="status-line" style={{ color: STATUS_COLOR[p.status] }}>
                                  <span className="dot" style={{ background: STATUS_COLOR[p.status] }} />
                                  {STATUS_LABEL[p.status]}
                                </div>
                                <h3>{p.title}</h3>
                                <div className="meta">
                                  {d != null && <span className="dist">{formatDistance(d)}</span>}
                                  {q && <span>{q.name}</span>}
                                  {p.units_planned != null && <span>{p.units_planned.toLocaleString('he-IL')} דירות בתוכנית</span>}
                                </div>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}

              <div className="footer-links">
                <span>המידע מתעדכן על ידי עיריית אשדוד</span>
                <Link to="/admin">ניהול</Link>
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="map-wrap">
        <MapView
          projects={selected ? (projects ?? []) : filtered}
          selectedId={selected?.id}
          hoverId={hoverId}
          onSelect={open}
          onHover={setHoverId}
          me={me}
          meRadius={NEAR_METERS}
          focus={focus}
        />
        <div className="legend" aria-hidden>
          {STATUS_ORDER.map((s) => (
            <div key={s}>
              <span className="dot" style={{ background: STATUS_COLOR[s] }} />
              {STATUS_LABEL[s]}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
