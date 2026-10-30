import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import '../styles/magazine.css'
import { supabase } from '../lib/supabase'
import type { ChapterLayout, Media, PlanModel, ProjectWithMedia, StoryChapter, StoryFact } from '../lib/types'
import Plan3D, { type ViewMode } from '../components/Plan3D'
import UnitsCompare from '../components/UnitsCompare'
import ShadeStudy from '../components/ShadeStudy'
import FeedbackSection from '../components/FeedbackSection'
import TopBar from '../components/TopBar'
import { embedUrl, mediaSrc } from '../lib/media'
import { planNumberCandidates } from '../lib/data'
import { LAND_USE } from '../lib/labels'

const MODES: { id: ViewMode; label: string; note: string }[] = [
  { id: 'today', label: 'היום', note: 'המבנים הקיימים סביב, וגבולות התוכנית בקו מקווקו. רוב המגרשים עוד לא בנויים.' },
  {
    id: 'allowed',
    label: 'המותר',
    note: 'המעטפת השקופה היא השטח והגובה שמותר לבנות בכל מגרש: קווי הבניין מהתשריט והגובה המרבי מטבלה 5.',
  },
  {
    id: 'after',
    label: 'אחרי',
    note: 'נפח בנייה לדוגמה, שמחושב משטחי הבנייה בטבלה 5. הוא זהה לנפח בתוכנית הקודמת. מה שמשתנה הוא מספר הדירות בתוכו.',
  },
]

const nf = new Intl.NumberFormat('he-IL')

function Cert({ c }: { c: StoryFact['certainty'] }) {
  return <span className={`mag-cert ${c}`}>{c === 'plan' ? 'לפי התוכנית' : 'הערכה'}</span>
}

function Fact({ f }: { f: StoryFact }) {
  return (
    <div className="mag-fact">
      <span className="v">{f.value}</span>
      {f.unit && <span className="u">{f.unit}</span>}
      <span className="l">{f.label}</span>
      <Cert c={f.certainty} />
    </div>
  )
}

const AUTO_LAYOUT: Record<string, ChapterLayout> = {
  headline: 'quote',
  why: 'columns',
  before: 'image',
  after: 'image',
  weigh: 'dark',
  gets: 'columns',
}

function layoutOf(ch: StoryChapter): ChapterLayout {
  if (ch.layout) return ch.layout
  if (AUTO_LAYOUT[ch.id]) return AUTO_LAYOUT[ch.id]
  if (ch.pros || ch.questions) return 'dark'
  return 'classic'
}

function Chapter({
  ch,
  n,
  reviewed,
  layout,
  img,
  flip,
}: {
  ch: StoryChapter
  n: number
  reviewed: boolean
  layout: ChapterLayout
  img?: Media | null
  flip?: boolean
}) {
  const src = img ? mediaSrc(img) : null
  const lay = layout === 'image' && !src ? 'classic' : layout
  return (
    <section className={`mag-chapter lay-${lay}${flip ? ' flip' : ''}`} id={ch.id} aria-labelledby={`h-${ch.id}`}>
      {lay === 'image' && src && (
        <figure className="mag-figure">
          <img src={src} alt={img?.caption ?? ''} loading="lazy" />
          {img?.caption && <figcaption>{img.caption}</figcaption>}
        </figure>
      )}
      <div className="mag-chead">
        <div className="num" aria-hidden>
          {String(n).padStart(2, '0')}
        </div>
        <h2 id={`h-${ch.id}`}>
          {ch.title}
          {ch.draft && !reviewed && <span className="mag-tag">טיוטה לאישור</span>}
        </h2>
      </div>
      <div className="mag-cbody">
        {ch.lead && <p className="lead">{ch.lead}</p>}
        {ch.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
        {ch.bullets && (
          <ul>
            {ch.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
        {ch.facts && ch.id !== 'numbers' && (
          <div className="facts">
            {ch.facts.map((f, i) => (
              <Fact key={i} f={f} />
            ))}
          </div>
        )}
        {(ch.pros || ch.questions) && (
          <div className="mag-two">
            {ch.pros && (
              <div>
                <h3>מה מרוויחים</h3>
                <ul>
                  {ch.pros.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
            {ch.questions && (
              <div>
                <h3>שווה לשאול</h3>
                <ul>
                  {ch.questions.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {ch.steps && (
          <ol className="mag-steps">
            {ch.steps.map((s, i) => (
              <li key={i}>
                <div>
                  <b>{s.title}</b>
                  <span>{s.text}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
        {ch.terms && (
          <dl className="mag-terms">
            {ch.terms.map((t) => (
              <div key={t.term}>
                <dt>{t.term}</dt>
                <dd>{t.def}</dd>
              </div>
            ))}
          </dl>
        )}
        {ch.sources && ch.sources.length > 0 && <div className="mag-src">מקור: {ch.sources.join(' · ')}</div>}
      </div>
    </section>
  )
}

function fileLabel(src: string | null): string {
  const ext = src?.match(/\.([a-z0-9]{2,5})(\?|$)/i)?.[1]?.toLowerCase()
  if (ext === 'xls' || ext === 'xlsx') return 'Excel'
  return ext === 'pdf' || !ext ? 'PDF' : ext.toUpperCase()
}

export default function PlanStory() {
  const { planNumber } = useParams()
  const [project, setProject] = useState<ProjectWithMedia | null | undefined>(undefined)
  const [model, setModel] = useState<PlanModel | null>(null)
  const [modelError, setModelError] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [mode, setMode] = useState<ViewMode>('after')
  const [lot, setLot] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('plan_projects')
      .select('*, plan_media!plan_media_project_id_fkey(*)')
      .in('plan_number', planNumberCandidates(planNumber ?? ''))
      .then(({ data }) => {
        const rows = (data ?? []) as ProjectWithMedia[]
        setProject(rows.find((r) => r.story) ?? rows[0] ?? null)
      })
    try {
      setIsStaff(localStorage.getItem('mnv-admin') === '1')
    } catch {
      /* storage unavailable */
    }
  }, [planNumber])

  // A model is a static file (model_url) or a row in plan_models, built in the database.
  useEffect(() => {
    if (!project?.story) return
    const load: Promise<PlanModel | null> = project.model_url
      ? fetch(project.model_url).then((r) => (r.ok ? r.json() : Promise.reject()))
      : Promise.resolve(
          supabase
            .from('plan_models')
            .select('model')
            .eq('plan_number', project.plan_number ?? '')
            .maybeSingle()
            .then(({ data, error }) => {
              if (error) throw error
              return (data?.model as PlanModel) ?? null
            }),
        )
    load
      .then((m) => (m ? setModel(m) : setModelError(true)))
      .catch(() => setModelError(true))
  }, [project?.model_url, project?.plan_number, project?.story])

  useEffect(() => {
    if (model && !model.massing?.features?.length) setMode('today')
  }, [model])

  useEffect(() => {
    if (project?.story) document.title = `${project.story.headline} | ${project.story.kicker}`
  }, [project?.story])

  const story = project?.story
  const numbers = story?.chapters.find((c) => c.id === 'numbers')
  const selected = useMemo(() => model?.lots.find((l) => l.lot === lot) ?? null, [model, lot])
  const modeInfo = MODES.find((m) => m.id === mode)!
  // Without lots and envelopes (KML 3D or table 5 + SHP) the model shows today only.
  const hasMassing = !!model?.massing?.features?.length
  // Land uses present in the model, in the palette's order, for the colour legend.
  const landUses = useMemo(() => {
    const cats = new Set<string>()
    for (const f of [...(model?.massing?.features ?? []), ...(model?.parcels?.features ?? [])]) {
      const c = (f.properties as { cat?: string } | null)?.cat
      if (c) cats.add(c)
    }
    return Object.keys(LAND_USE).filter((k) => cats.has(k))
  }, [model])
  const modes = hasMassing ? MODES : MODES.filter((m) => m.id === 'today')
  const modeNote =
    model?.ui?.modes?.[mode] ??
    (hasMassing || !model
      ? modeInfo.note
      : 'היום: גבול המתחם בקו מקווקו והבניינים הקיימים סביבו. המותר והנפח החדש יוצגו כשיעלו הוראות התוכנית ותשריט מצב מוצע.')
  const lotChecks = model?.checks ?? []

  async function setPublished(v: boolean) {
    if (!project || !story) return
    setBusy(true)
    const { error } = await supabase
      .from('plan_projects')
      .update({ published: v, story: { ...story, reviewed: v ? true : story.reviewed } })
      .eq('id', project.id)
    setBusy(false)
    if (!error) setProject({ ...project, published: v, story: { ...story, reviewed: v ? true : story.reviewed } })
  }

  if (project === undefined) return <div className="mag"><div className="loading">טוען את התוכנית...</div></div>
  if (!project || !story)
    return (
      <div className="mag">
        <TopBar context={`תוכנית ${planNumber}`} />
        <div className="mag-wrap">
          <div className="mag-hero">
            <h1>התוכנית עוד לא פורסמה</h1>
            <p className="mag-deck">העמוד של תוכנית {planNumber} נמצא בהכנה אצל צוות העירייה.</p>
          </div>
        </div>
      </div>
    )

  const media = [...(project.plan_media ?? [])].sort((a, b) => a.sort - b.sort)
  const renders = media.filter((m) => m.kind === 'render')
  const videos = media.filter((m) => m.kind === 'video' || m.kind === 'video_link')
  const drawings = media.filter((m) => m.kind === 'drawing')
  // Chapters in the "image" composition take renders first, then drawing sheets.
  const pictures = [...renders, ...drawings]
  let imgIdx = 0
  let flipNext = false
  const cover = renders.find((m) => m.id === project.cover_media_id) ?? renders[0] ?? drawings[0] ?? null
  let n = 0
  return (
    <div className="mag" dir="rtl">
      <TopBar context={`תוכנית ${story.plan_number}`} />
      <div className="mag-wrap">

        {!project.published && isStaff && (
          <div className="mag-draft" role="status">
            <b>טיוטה לבדיקה. רק צוות העירייה רואה את העמוד.</b>
            <span>הטקסטים נכתבו מתוך הוראות התוכנית. כדאי לעבור על כל פרק מול המקור לפני פרסום.</span>
            {lotChecks.length > 0 && (
              <ul>
                {lotChecks.map((c, i) => (
                  <li key={i}>
                    מגרש {c.lot}: {c.text}
                  </li>
                ))}
              </ul>
            )}
            <button className="btn btn-sm" onClick={() => setPublished(true)} disabled={busy}>
              {busy ? 'רגע...' : 'פרסום לתושבים'}
            </button>
          </div>
        )}
        {project.published && isStaff && (
          <div className="mag-draft" role="status">
            <b>העמוד מפורסם לתושבים.</b>
            <div className="mag-draft-actions">
              <Link className="btn btn-sm" to={`/admin/p/${project.id}#media`}>
                העלאת הדמיות וסרטונים
              </Link>
              <Link className="btn btn-sm" to={`/admin/p/${project.id}`}>
                עריכת הפרויקט
              </Link>
              <button className="btn btn-sm" onClick={() => setPublished(false)} disabled={busy}>
                החזרה לטיוטה
              </button>
            </div>
          </div>
        )}

        <section className="mag-cover">
          {cover && <img className="mag-cover-img" src={mediaSrc(cover) ?? ''} alt="" />}
          <div className="mag-cover-text">
            <span className="mag-label">{story.kicker}</span>
            <h1>
              {story.headline_serif && story.headline.includes(story.headline_serif) ? (
                <>
                  {story.headline.split(story.headline_serif)[0]}
                  <span className="serif">{story.headline_serif}</span>
                  {story.headline.split(story.headline_serif)[1]}
                </>
              ) : (
                story.headline
              )}
            </h1>
            <p className="mag-deck">{story.deck}</p>
            <div className="mag-meta">
              <span className="mag-pill light">{story.status.label}</span>
              {story.level === 'basic' && <span className="mag-pill">עמוד בסיסי</span>}
              <span>{story.status.text}</span>
            </div>
          </div>
        </section>

        <nav className="mag-index" aria-label="תוכן העניינים">
          <a href="#model">המודל</a>
          {hasMassing && <a href="#sun">שמש וצל</a>}
          {(renders.length > 0 || videos.length > 0) && <a href="#renders">הדמיות</a>}
          {story.chapters.map((ch) => (
            <a key={ch.id} href={`#${ch.id}`}>
              {ch.title}
            </a>
          ))}
          <a href="#docs">מסמכים</a>
          <a href="#voice">שאלות</a>
        </nav>

        <section className="mag-stage" id="model" aria-label="המודל התלת-ממדי">
          {model ? (
            <Plan3D model={model} mode={mode} selectedLot={lot} onSelectLot={setLot} />
          ) : (
            <div className="mag-map" style={{ display: 'grid', placeItems: 'center' }}>
              {modelError ? 'המודל אינו זמין כרגע' : 'בונה את המודל...'}
            </div>
          )}
          <div className="mag-modes" role="group" aria-label="מצב תצוגה">
            {modes.map((m) => (
              <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="mag-mode-note">
            {modeNote}
            <div className="mag-legend">
              <span>
                <i style={{ background: '#D2D2D0' }} />
                קיים
              </span>
              {model?.demolish && (
                <span>
                  <i style={{ background: '#5E5E5C' }} />
                  {model.ui?.demolish_label ?? 'להריסה'}
                </span>
              )}
              {hasMassing && (
                <>
                  <span>
                    <i style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #8A8A88' }} />
                    מותר
                  </span>
                  {landUses.length === 0 && (
                    <span>
                      <i style={{ background: 'linear-gradient(180deg,#C4C4C2,#8E8E8C)' }} />
                      נפח לדוגמה
                    </span>
                  )}
                </>
              )}
              {landUses.map((k) => (
                <span key={k}>
                  <i style={{ background: LAND_USE[k].color }} />
                  {LAND_USE[k].label}
                </span>
              ))}
            </div>
          </div>
          {model && (
            <aside className="mag-lot" aria-live="polite">
              {selected ? (
                <>
                  <button className="close" onClick={() => setLot(null)}>
                    סגירה
                  </button>
                  {selected.panel ? (
                    <>
                      <span className="mag-label">{selected.title ?? 'מגרש'}</span>
                      <h3>{selected.lot}</h3>
                      <dl>
                        {selected.panel.map((r) => (
                          <div key={r.label}>
                            <dt>{r.label}</dt>
                            <dd>{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                      {selected.note && <span style={{ fontSize: 12, color: '#555555', lineHeight: 1.5 }}>{selected.note}</span>}
                    </>
                  ) : (
                    <>
                      <span className="mag-label">מגרש</span>
                      <h3>{selected.lot}</h3>
                      <dl>
                        <div>
                          <dt>קומות</dt>
                          <dd>{selected.floors_above}</dd>
                        </div>
                        <div>
                          <dt>גובה מרבי</dt>
                          <dd>{selected.height_m} מ׳</dd>
                        </div>
                        <div>
                          <dt>שטח המגרש</dt>
                          <dd>{nf.format(selected.lot_size)} מ"ר</dd>
                        </div>
                        <div>
                          <dt>תכסית מרבית</dt>
                          <dd>{selected.coverage_pct}%</dd>
                        </div>
                        <div>
                          <dt>מרתפים</dt>
                          <dd>{selected.floors_below}+ קומות</dd>
                        </div>
                        <div>
                          <dt>דירות קטנות</dt>
                          <dd>{selected.small_75_min} לפחות</dd>
                        </div>
                      </dl>
                      {selected.units_before_est != null && <UnitsCompare lot={selected} />}
                      <span style={{ fontSize: 12, color: '#555555', lineHeight: 1.5 }}>
                        אותו בניין, יותר דירות. משמאל: דירות עד 75 מ"ר באפור כהה, עד 55 מ"ר בשחור. מספר הדירות היום וגודל הדירה הממוצע הם
                        הערכה לפי הערה 3 לטבלה 5.
                        {selected.mixed && ' במגרש יש גם חזית מסחרית לרחוב.'}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="mag-label">
                    {model.ui?.summary_label ?? `${model.summary.lots} מגרשים · ${nf.format(model.summary.units_after)} דירות`}
                  </span>
                  <p className="hint">
                    {model.ui?.hint ?? 'לחצו על מגדל כדי לראות מה התוכנית משנה במגרש: אותו בניין, ועוד כמה דירות.'}
                  </p>
                </>
              )}
            </aside>
          )}
        </section>

        {numbers?.facts && (
          <div className="mag-band" aria-label="במספרים">
            {numbers.facts.map((f, i) => (
              <Fact key={i} f={f} />
            ))}
          </div>
        )}

        {model && hasMassing && <ShadeStudy model={model} />}

        {(renders.length > 0 || videos.length > 0 || isStaff) && (
          <section className="mag-gallery" id="renders" aria-label="הדמיות וסרטונים">
            <div className="mag-gallery-head">
              <span className="mag-label">איך זה ייראה</span>
              {isStaff && (
                <Link className="mag-pill light" to={`/admin/p/${project.id}#media`}>
                  העלאת הדמיות וסרטונים
                </Link>
              )}
            </div>
            {renders.length > 0 && (
              <div className={`mag-renders n${Math.min(renders.length, 4)}`}>
                {renders.map((m, i) => (
                  <figure key={m.id} className={i === 0 ? 'lead' : ''}>
                    <a href={mediaSrc(m) ?? '#'} target="_blank" rel="noreferrer">
                      <img src={mediaSrc(m) ?? ''} alt={m.caption ?? ''} loading="lazy" />
                    </a>
                    {m.caption && <figcaption>{m.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
            {videos.map((m) => {
              const src = mediaSrc(m)
              const embed = m.kind === 'video_link' && src ? embedUrl(src) : null
              return (
                <figure key={m.id} className="mag-video">
                  {m.kind === 'video' && src ? (
                    <video src={src} controls preload="metadata" playsInline />
                  ) : embed ? (
                    <iframe src={embed} title={m.caption || project.title} allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" />
                  ) : src ? (
                    <a href={src} target="_blank" rel="noreferrer">
                      לצפייה בסרטון
                    </a>
                  ) : null}
                  {m.caption && <figcaption>{m.caption}</figcaption>}
                </figure>
              )
            })}
            {renders.length === 0 && videos.length === 0 && (
              <p className="mag-empty-media">עוד אין הדמיות או סרטונים לתוכנית. כשיעלו, הם יופיעו כאן לתושבים.</p>
            )}
          </section>
        )}

        {story.chapters.map((ch) => {
          n++
          const layout = layoutOf(ch)
          const img = layout === 'image' ? pictures[imgIdx++ % Math.max(pictures.length, 1)] ?? null : null
          if (layout === 'image') flipNext = !flipNext
          return <Chapter key={ch.id} ch={ch} n={n} reviewed={story.reviewed} layout={layout} img={img} flip={layout === 'image' && !flipNext} />
        })}

        {(() => {
          const sheets = media.filter((m) => m.kind === 'drawing')
          const files = media.filter((m) => m.kind === 'document' || m.kind === 'kml')
          if (!sheets.length && !files.length) return null
          n++
          return (
            <section className="mag-chapter" id="docs">
              <div>
                <div className="num" aria-hidden>
                  {String(n).padStart(2, '0')}
                </div>
                <h2>המסמכים המקוריים</h2>
              </div>
              <div>
                <p className="lead">כל מה שכתוב כאן נשען על המסמכים הרשמיים. אפשר לפתוח ולבדוק.</p>
                {sheets.length > 0 && (
                  <div className="mag-sheets">
                    {sheets.map((m) => (
                      <a key={m.id} href={mediaSrc(m) ?? '#'} target="_blank" rel="noreferrer">
                        <img src={mediaSrc(m) ?? ''} alt={m.caption ?? ''} loading="lazy" />
                        <span>{m.caption}</span>
                      </a>
                    ))}
                  </div>
                )}
                {files.length > 0 && (
                  <ul className="mag-files">
                    {files.map((m) => (
                      <li key={m.id}>
                        <a href={mediaSrc(m) ?? '#'} target="_blank" rel="noreferrer" download={m.kind === 'kml' ? true : undefined}>
                          {m.caption}
                        </a>
                        <span>{m.kind === 'kml' ? 'KML, נפתח ב-Google Earth' : fileLabel(mediaSrc(m))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )
        })()}

        <section className="mag-chapter" id="voice">
          <div>
            <div className="num" aria-hidden>
              {String(n + 1).padStart(2, '0')}
            </div>
            <h2>השאלות שלכם</h2>
          </div>
          <div className="mag-voice">
            <FeedbackSection projectId={project.id} canPost={project.published} />
          </div>
        </section>

        <footer className="mag-foot">
          <span>{story.disclaimer}</span>
          <a href={story.mavat_url} target="_blank" rel="noreferrer">
            מסמכי התוכנית המלאים באתר תכנון זמין
          </a>
          <span className="mag-label">
            {story.official_name} · {story.plan_number}
          </span>
        </footer>
      </div>
    </div>
  )
}
