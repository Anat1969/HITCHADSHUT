import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MapView, { type MapFocus } from '../components/MapView'
import ProjectDetail from '../components/ProjectDetail'
import MediaManager from './MediaManager'
import { useToast } from './toast'
import { fetchProject, fetchQuarters } from '../lib/data'
import { MEDIA_BUCKET, supabase } from '../lib/supabase'
import { centerOf, isNearAshdod } from '../lib/geo'
import { parseKmlFile } from '../lib/kml'
import { uploadMediaFile } from '../lib/upload'
import { KIND_LABEL, STATUS_LABEL, STATUS_MEANING, STATUS_ORDER, TRACK_LABEL } from '../lib/labels'
import type { Media, Project, ProjectKind, ProjectStatus, ProjectWithMedia, Quarter, RenewalTrack } from '../lib/types'

type Form = Omit<Project, 'id' | 'created_at' | 'updated_at'>

const EMPTY: Form = {
  title: '',
  kind: 'urban_renewal',
  renewal_track: null,
  status: 'planning',
  plan_number: null,
  quarter_id: null,
  address: null,
  summary: null,
  description: null,
  public_benefits: null,
  units_existing: null,
  units_planned: null,
  floors: null,
  expected_completion: null,
  developer: null,
  contact_info: null,
  geojson: null,
  center: null,
  cover_media_id: null,
  published: false,
}

const FORM_KEYS = Object.keys(EMPTY) as (keyof Form)[]

export default function ProjectEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const isNew = !id

  const [form, setForm] = useState<Form>(EMPTY)
  const [media, setMedia] = useState<Media[]>([])
  const [loaded, setLoaded] = useState(isNew)
  const [notFound, setNotFound] = useState(false)
  const [quarters, setQuarters] = useState<Quarter[]>([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pendingKml, setPendingKml] = useState<File | null>(null)
  const [kmlMsg, setKmlMsg] = useState<{ type: 'ok' | 'warn' | 'error'; text: string } | null>(null)
  const [focus, setFocus] = useState<MapFocus>(null)
  const [showPreview, setShowPreview] = useState(false)
  const nonce = useRef(0)
  const kmlInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchQuarters().then(setQuarters)
  }, [])

  const load = async () => {
    if (!id) return
    const p = await fetchProject(id)
    if (!p) {
      setNotFound(true)
      return
    }
    const f = {} as Record<string, unknown>
    for (const k of FORM_KEYS) f[k] = p[k]
    setForm(f as Form)
    setMedia(p.plan_media)
    setLoaded(true)
    return p
  }

  useEffect(() => {
    if (isNew) {
      setForm(EMPTY)
      setMedia([])
      setLoaded(true)
      return
    }
    load().then((p) => {
      if (p) setFocus({ type: 'project', project: p, nonce: ++nonce.current })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const reloadMedia = async () => {
    if (!id) return
    const { data } = await supabase.from('plan_media').select('*').eq('project_id', id)
    setMedia((data ?? []) as Media[])
  }

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }
  const text = (key: keyof Form) => ({
    value: (form[key] as string | null) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, (e.target.value || null) as never),
  })
  const num = (key: 'units_existing' | 'units_planned') => ({
    value: form[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/[^\d]/g, '')
      set(key, v === '' ? null : Number(v))
    },
  })

  async function onKml(file: File) {
    setKmlMsg(null)
    try {
      const fc = await parseKmlFile(file)
      const center = centerOf(fc)
      if (!center) throw new Error('לא נמצאו קואורדינטות בקובץ')
      setForm((f) => {
        const firstName = fc.features.find((x) => typeof x.properties?.name === 'string')?.properties?.name as string | undefined
        return { ...f, geojson: fc, center, title: f.title || firstName || f.title }
      })
      setDirty(true)
      setPendingKml(file)
      setFocus({ type: 'project', project: { id: 'draft', geojson: fc, center }, nonce: ++nonce.current })
      const near = isNearAshdod(center)
      setKmlMsg(
        near
          ? { type: 'ok', text: `נטענו ${fc.features.length} צורות מהקובץ. שמרו כדי לעדכן.` }
          : { type: 'warn', text: 'הקובץ נטען, אבל המיקום נראה רחוק מאשדוד. בדקו שזה הקובץ הנכון.' },
      )
    } catch (e) {
      setKmlMsg({ type: 'error', text: e instanceof Error ? e.message : 'לא הצלחנו לקרוא את הקובץ' })
    }
  }

  function clearShape() {
    setForm((f) => ({ ...f, geojson: null }))
    setPendingKml(null)
    setDirty(true)
    setKmlMsg({ type: 'warn', text: 'הגבולות הוסרו. הנקודה במפה נשארה. שמרו כדי לעדכן.' })
  }

  async function save(publish?: boolean) {
    if (form.title.trim().length < 2) {
      toast('צריך שם לפרויקט')
      return
    }
    const next = { ...form, title: form.title.trim(), published: publish ?? form.published }
    if (next.published && !next.center) {
      toast('כדי לפרסם צריך מיקום: העלו KML או לחצו על המפה')
      return
    }
    setSaving(true)
    try {
      let projectId = id
      if (isNew) {
        const { data, error } = await supabase.from('plan_projects').insert(next).select('id').single()
        if (error) throw error
        projectId = data.id as string
      } else {
        const { error } = await supabase.from('plan_projects').update(next).eq('id', id!)
        if (error) throw error
      }
      if (pendingKml && projectId) {
        const old = media.filter((m) => m.kind === 'kml')
        await uploadMediaFile(projectId, pendingKml, { kind: 'kml', caption: 'גבולות התוכנית', sort: 0 })
        if (old.length) {
          await supabase.from('plan_media').delete().in('id', old.map((m) => m.id))
          const paths = old.map((m) => m.storage_path).filter(Boolean) as string[]
          if (paths.length) await supabase.storage.from(MEDIA_BUCKET).remove(paths)
        }
        setPendingKml(null)
      }
      setForm(next)
      setDirty(false)
      toast(next.published ? 'נשמר ומפורסם במפה' : 'נשמר כטיוטה')
      if (isNew) navigate(`/admin/p/${projectId}`, { replace: true })
      else reloadMedia()
    } catch {
      toast('השמירה נכשלה. נסו שוב.')
    } finally {
      setSaving(false)
    }
  }

  async function setCover(mediaId: string | null) {
    setForm((f) => ({ ...f, cover_media_id: mediaId }))
    if (id) await supabase.from('plan_projects').update({ cover_media_id: mediaId }).eq('id', id)
  }

  async function removeProject() {
    if (!id || !confirm(`למחוק את "${form.title}" לצמיתות, כולל כל ההדמיות והתגובות?`)) return
    const paths = media.map((m) => m.storage_path).filter(Boolean) as string[]
    const { error } = await supabase.from('plan_projects').delete().eq('id', id)
    if (error) {
      toast('המחיקה נכשלה')
      return
    }
    if (paths.length) await supabase.storage.from(MEDIA_BUCKET).remove(paths)
    setDirty(false)
    toast('הפרויקט נמחק')
    navigate('/admin')
  }

  const mapProjects = useMemo(
    () => (form.center || form.geojson ? [{ id: id ?? 'draft', title: form.title || 'הפרויקט', status: form.status, geojson: form.geojson, center: form.center }] : []),
    [form.center, form.geojson, form.status, form.title, id],
  )

  const preview: ProjectWithMedia = useMemo(
    () => ({ ...form, id: id ?? 'draft', created_at: '', updated_at: '', plan_media: media }),
    [form, id, media],
  )

  if (notFound)
    return (
      <div className="box">
        <h3>הפרויקט לא נמצא</h3>
        <Link to="/admin">חזרה לרשימה</Link>
      </div>
    )
  if (!loaded) return <div className="loading">טוען...</div>

  return (
    <>
      <div className="admin-head">
        <div>
          <Link to="/admin" className="muted" style={{ fontSize: 14 }}>
            כל הפרויקטים
          </Link>
          <h2>{isNew ? 'פרויקט חדש' : form.title || 'ללא שם'}</h2>
          {!isNew && (
            <span className="badge" style={{ marginTop: 6 }}>
              {form.published ? 'מפורסם במפה' : 'טיוטה, לא מוצג לתושבים'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => save()} disabled={saving}>
            {saving ? 'שומר...' : dirty || isNew ? 'שמירה' : 'נשמר'}
          </button>
          {form.published ? (
            <button className="btn" onClick={() => save(false)} disabled={saving}>
              הסתרה מהמפה
            </button>
          ) : (
            <button className="btn btn-accent" onClick={() => save(true)} disabled={saving}>
              שמירה ופרסום
            </button>
          )}
        </div>
      </div>

      <div className="editor-layout">
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="box">
            <h3>מה התושבים יראו</h3>
            <label className="field">
              <span>שם הפרויקט</span>
              <input className="input" {...text('title')} placeholder="לדוגמה: מתחם הרצל, רובע ב׳" />
            </label>
            <label className="field">
              <span>במשפט אחד: מה קורה כאן</span>
              <textarea className="textarea" style={{ minHeight: 70 }} {...text('summary')} placeholder="מה ייבנה, למי, ומה ישתנה ברחוב. בלי מונחים מקצועיים." />
              <small>המשפט הזה מופיע בראש כרטיס הפרויקט. כתבו כאילו אתם מסבירים לשכנים.</small>
            </label>
            <label className="field">
              <span>מה השכונה מקבלת</span>
              <textarea className="textarea" {...text('public_benefits')} placeholder="גן ילדים, שצ״פ, הרחבת מדרכה, חניון ציבורי, מבנה קהילתי..." />
            </label>
            <label className="field">
              <span>הסבר מורחב</span>
              <textarea className="textarea" style={{ minHeight: 140 }} {...text('description')} />
            </label>
          </div>

          <div className="box">
            <h3>סוג ושלב</h3>
            <div className="grid-2">
              <label className="field">
                <span>סוג</span>
                <select className="select" value={form.kind} onChange={(e) => set('kind', e.target.value as ProjectKind)}>
                  {(Object.keys(KIND_LABEL) as ProjectKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              {form.kind === 'urban_renewal' ? (
                <label className="field">
                  <span>מסלול</span>
                  <select
                    className="select"
                    value={form.renewal_track ?? ''}
                    onChange={(e) => set('renewal_track', (e.target.value || null) as RenewalTrack | null)}
                  >
                    <option value="">לא צוין</option>
                    {(Object.keys(TRACK_LABEL) as RenewalTrack[]).map((k) => (
                      <option key={k} value={k}>
                        {TRACK_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div />
              )}
              <label className="field span-2">
                <span>השלב הנוכחי</span>
                <select className="select" value={form.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <small>התושבים יראו: {STATUS_MEANING[form.status]}</small>
              </label>
            </div>
          </div>

          <div className="box">
            <h3>פרטים ומספרים</h3>
            <div className="grid-2">
              <label className="field">
                <span>רובע</span>
                <select className="select" value={form.quarter_id ?? ''} onChange={(e) => set('quarter_id', e.target.value || null)}>
                  <option value="">לא צוין</option>
                  {quarters.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>כתובת או מתחם</span>
                <input className="input" {...text('address')} />
              </label>
              <label className="field">
                <span>דירות היום</span>
                <input className="input" inputMode="numeric" {...num('units_existing')} />
              </label>
              <label className="field">
                <span>דירות בתוכנית</span>
                <input className="input" inputMode="numeric" {...num('units_planned')} />
              </label>
              <label className="field">
                <span>קומות</span>
                <input className="input" {...text('floors')} placeholder="לדוגמה: 9 עד 24" />
              </label>
              <label className="field">
                <span>מועד סיום משוער</span>
                <input className="input" {...text('expected_completion')} placeholder="לדוגמה: 2030" />
              </label>
              <label className="field">
                <span>מספר תוכנית</span>
                <input className="input" {...text('plan_number')} />
              </label>
              <label className="field">
                <span>יזם</span>
                <input className="input" {...text('developer')} />
              </label>
              <label className="field span-2">
                <span>לפרטים נוספים</span>
                <textarea className="textarea" style={{ minHeight: 70 }} {...text('contact_info')} placeholder="מנהלת ההתחדשות העירונית, טלפון, שעות קבלת קהל, קישור למבא״ת..." />
              </label>
            </div>
          </div>

          {isNew ? (
            <div className="box">
              <h3>הדמיות וסרטונים</h3>
              <p className="muted">שמרו את הפרויקט פעם אחת, ואז אפשר להעלות הדמיות, סרטונים ומסמכים.</p>
            </div>
          ) : (
            <MediaManager projectId={id!} media={media} coverId={form.cover_media_id} onChange={reloadMedia} onCover={setCover} />
          )}

          {!isNew && (
            <div className="box">
              <h3>מחיקה</h3>
              <p className="muted">כדי רק להסתיר מהתושבים, עדיף "הסתרה מהמפה". מחיקה אינה ניתנת לביטול.</p>
              <button className="btn btn-danger" style={{ justifySelf: 'start' }} onClick={removeProject}>
                מחיקת הפרויקט
              </button>
            </div>
          )}
        </div>

        <div className="editor-side">
          <div className="box">
            <div className="box-head">
              <h3>מיקום וגבולות</h3>
              {form.geojson && (
                <button className="btn btn-ghost btn-sm" onClick={clearShape}>
                  הסרת הגבולות
                </button>
              )}
            </div>
            <div className="mini-map">
              <MapView
                projects={mapProjects}
                focus={focus}
                interactiveTooltips={false}
                onMapClick={(p) => {
                  setForm((f) => ({ ...f, center: p }))
                  setDirty(true)
                }}
              />
            </div>
            <p className="muted" style={{ fontSize: 14 }}>
              העלו קובץ KML או KMZ של גבולות התוכנית. בלי קובץ, לחצו על המפה כדי להציב נקודה. לחיצה על המפה מזיזה גם את הנקודה של קובץ קיים.
            </p>
            <button className="btn" onClick={() => kmlInput.current?.click()}>
              {form.geojson ? 'החלפת קובץ KML' : 'העלאת קובץ KML / KMZ'}
            </button>
            <input
              ref={kmlInput}
              type="file"
              hidden
              accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onKml(f)
                e.target.value = ''
              }}
            />
            {kmlMsg && <div className={`notice notice-${kmlMsg.type === 'ok' ? 'ok' : kmlMsg.type === 'warn' ? 'warn' : 'error'}`}>{kmlMsg.text}</div>}
            {!form.center && <div className="notice notice-info">עדיין אין מיקום. בלי מיקום אי אפשר לפרסם.</div>}
          </div>

          <div className="box">
            <div className="box-head">
              <h3>תצוגה מקדימה</h3>
              <button className="btn btn-sm" onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? 'הסתרה' : 'איך זה נראה לתושבים'}
              </button>
            </div>
            {showPreview && (
              <div style={{ maxHeight: 640, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
                <ProjectDetail project={preview} quarters={quarters} me={null} onBack={() => setShowPreview(false)} preview />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
