import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Feature, Geometry } from 'geojson'
import MapView, { type MapFocus } from '../components/MapView'
import { useToast } from './toast'
import { fetchQuarters } from '../lib/data'
import { supabase } from '../lib/supabase'
import { centerOf, isNearAshdod } from '../lib/geo'
import { parseKmlFile } from '../lib/kml'
import { KIND_LABEL, STATUS_LABEL, STATUS_ORDER } from '../lib/labels'
import type { ProjectKind, ProjectStatus, Quarter } from '../lib/types'

interface Row {
  key: string
  include: boolean
  title: string
  planNumber: string
  description: string
  feature: Feature<Geometry>
}

const PLAN_KEY = /(pl_?num|plan_?no|plan_?number|mspr|מספר.?(תכנית|תוכנית)|^תכנית$|^תוכנית$)/i
const PLAN_RE = /(\d{3}-\d{7})|(\d{1,4}\/[\d֐-׿]{1,6}\/[\d֐-׿/]+)/

function htmlToText(raw: unknown): string {
  // togeojson returns HTML descriptions as { "@type": "html", value: "..." }
  const v = raw && typeof raw === 'object' && 'value' in raw ? (raw as { value: unknown }).value : raw
  if (typeof v !== 'string') return ''
  if (!/[<&]/.test(v)) return v.trim()
  const withBreaks = v.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html')
  return (doc.body.textContent ?? '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function toRow(f: Feature<Geometry>, i: number): Row {
  const props = (f.properties ?? {}) as Record<string, unknown>
  const name = typeof props.name === 'string' ? props.name.trim() : ''
  let planNumber = ''
  const extra: string[] = []
  for (const [k, v] of Object.entries(props)) {
    if (k === 'name' || k === 'description' || v == null || typeof v === 'object') continue
    if (!planNumber && PLAN_KEY.test(k)) planNumber = String(v).trim()
    else extra.push(`${k}: ${v}`)
  }
  if (!planNumber) planNumber = name.match(PLAN_RE)?.[0] ?? ''
  const desc = [htmlToText(props.description), extra.join('\n')].filter(Boolean).join('\n\n')
  return {
    key: `${i}`,
    include: true,
    title: name || `שטח ${i + 1}`,
    planNumber,
    description: desc,
    feature: f,
  }
}

export default function BulkImport() {
  const toast = useToast()
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')
  const [warn, setWarn] = useState('')
  const [kind, setKind] = useState<ProjectKind>('urban_renewal')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [quarterId, setQuarterId] = useState('')
  const [quarters, setQuarters] = useState<Quarter[]>([])
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [focus, setFocus] = useState<MapFocus>(null)

  useEffect(() => {
    fetchQuarters().then(setQuarters)
  }, [])

  async function onFile(file: File) {
    setError('')
    setWarn('')
    try {
      const fc = await parseKmlFile(file)
      const r = fc.features.map((f, i) => toRow(f as Feature<Geometry>, i))
      setRows(r)
      setFileName(file.name)
      const c = centerOf(fc)
      if (c && !isNearAshdod(c)) setWarn('המיקום של הקובץ נראה רחוק מאשדוד. בדקו שזה הקובץ הנכון.')
      setFocus({ type: 'project', project: { id: 'all', geojson: fc, center: c }, nonce: Date.now() })
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : 'לא הצלחנו לקרוא את הקובץ')
    }
  }

  const chosen = rows.filter((r) => r.include)

  const mapProjects = useMemo(
    () =>
      rows.map((r) => ({
        id: r.key,
        title: r.title,
        status: r.include ? status : ('completed' as ProjectStatus),
        geojson: { type: 'FeatureCollection' as const, features: [r.feature] },
        center: centerOf({ type: 'FeatureCollection', features: [r.feature] }),
      })),
    [rows, status],
  )

  function update(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  async function importAll() {
    if (!chosen.length) return
    setBusy(true)
    const payload = chosen.map((r) => {
      const geojson = { type: 'FeatureCollection' as const, features: [r.feature] }
      return {
        title: r.title.trim() || 'ללא שם',
        plan_number: r.planNumber.trim() || null,
        description: r.description || null,
        kind,
        status,
        quarter_id: quarterId || null,
        geojson,
        center: centerOf(geojson),
        published: false,
      }
    })
    const { error } = await supabase.from('plan_projects').insert(payload)
    setBusy(false)
    if (error) {
      toast('הייבוא נכשל')
      setError('הייבוא נכשל. נסו שוב, או ייבאו בקבוצות קטנות יותר.')
      return
    }
    toast(`נוצרו ${payload.length} טיוטות`)
    navigate('/admin')
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h2>ייבוא תוכניות מקובץ KML</h2>
          <p className="muted">כל צורה בקובץ הופכת לטיוטה נפרדת. אחר כך משלימים לכל טיוטה הסבר, שלב והדמיות, ומפרסמים.</p>
        </div>
        <Link className="btn" to="/admin">
          חזרה לפרויקטים
        </Link>
      </div>

      <div className="editor-layout">
        <div style={{ display: 'grid', gap: 18 }}>
          <div
            className={`dropzone${over ? ' over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              const f = e.dataTransfer.files[0]
              if (f) onFile(f)
            }}
          >
            <strong>{fileName ? `נטען: ${fileName}` : 'גררו לכאן קובץ KML או KMZ'}</strong>
            <span className="muted">למשל ייצוא שכבת תב"עות מה-GIS העירוני או מ-Google Earth</span>
            <button className="btn btn-sm" onClick={() => input.current?.click()}>
              {fileName ? 'קובץ אחר' : 'בחירת קובץ'}
            </button>
            <input
              ref={input}
              type="file"
              hidden
              accept=".kml,.kmz"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
                e.target.value = ''
              }}
            />
          </div>
          {error && <div className="notice notice-error">{error}</div>}
          {warn && <div className="notice notice-warn">{warn}</div>}

          {rows.length > 0 && (
            <div className="box">
              <div className="box-head">
                <h3>
                  {rows.length} צורות בקובץ · {chosen.length} נבחרו
                </h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: true })))}>
                    בחירת הכל
                  </button>
                  <button className="btn btn-sm" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: false })))}>
                    ניקוי
                  </button>
                </div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th>שם הפרויקט</th>
                    <th>מספר תוכנית</th>
                    <th className="hide-sm">צורה</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} onMouseEnter={() => setHover(r.key)} onMouseLeave={() => setHover(null)}>
                      <td>
                        <input type="checkbox" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} aria-label="לייבא" />
                      </td>
                      <td>
                        <input className="input" style={{ minHeight: 36 }} value={r.title} onChange={(e) => update(r.key, { title: e.target.value })} />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ minHeight: 36 }}
                          value={r.planNumber}
                          onChange={(e) => update(r.key, { planNumber: e.target.value })}
                        />
                      </td>
                      <td className="hide-sm muted" style={{ fontSize: 13 }}>
                        {r.feature.geometry.type === 'Point' ? 'נקודה' : r.feature.geometry.type.includes('Line') ? 'קו' : 'פוליגון'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="editor-side">
          <div className="box">
            <h3>תצוגה במפה</h3>
            <div className="mini-map">
              <MapView projects={mapProjects} hoverId={hover} focus={focus} />
            </div>
          </div>
          {rows.length > 0 && (
            <div className="box">
              <h3>ברירת מחדל לכל הטיוטות</h3>
              <label className="field">
                <span>סוג</span>
                <select className="select" value={kind} onChange={(e) => setKind(e.target.value as ProjectKind)}>
                  {(Object.keys(KIND_LABEL) as ProjectKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>שלב</span>
                <select className="select" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>רובע</span>
                <select className="select" value={quarterId} onChange={(e) => setQuarterId(e.target.value)}>
                  <option value="">לא צוין</option>
                  {quarters.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary" onClick={importAll} disabled={busy || !chosen.length}>
                {busy ? 'מייבא...' : `ייבוא ${chosen.length} כטיוטות`}
              </button>
              <small className="muted">הטיוטות לא יוצגו לתושבים עד שתפרסמו כל אחת.</small>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
