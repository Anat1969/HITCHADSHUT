import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAllProjects, fetchQuarters } from '../lib/data'
import { supabase } from '../lib/supabase'
import type { ProjectWithMedia, Quarter } from '../lib/types'
import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL } from '../lib/labels'
import { useToast } from './toast'

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' })

export default function ProjectsList() {
  const [projects, setProjects] = useState<ProjectWithMedia[] | null>(null)
  const [quarters, setQuarters] = useState<Quarter[]>([])
  const [q, setQ] = useState('')
  const [show, setShow] = useState<'all' | 'published' | 'draft'>('all')
  const toast = useToast()

  const load = () => fetchAllProjects().then(setProjects)
  useEffect(() => {
    load()
    fetchQuarters().then(setQuarters)
  }, [])

  const list = useMemo(() => {
    const term = q.trim()
    return (projects ?? []).filter(
      (p) =>
        (show === 'all' || (show === 'published') === p.published) &&
        (!term || p.title.includes(term) || p.plan_number?.includes(term) || p.address?.includes(term)),
    )
  }, [projects, q, show])

  async function togglePublish(p: ProjectWithMedia) {
    if (!p.published && !p.center) {
      toast('אי אפשר לפרסם פרויקט בלי מיקום במפה')
      return
    }
    const { error } = await supabase.from('plan_projects').update({ published: !p.published }).eq('id', p.id)
    if (error) toast('השמירה נכשלה')
    else {
      toast(p.published ? 'הפרויקט הוסתר מהתושבים' : 'הפרויקט פורסם במפה')
      load()
    }
  }

  const drafts = (projects ?? []).filter((p) => !p.published).length

  return (
    <>
      <div className="admin-head">
        <div>
          <h2>פרויקטים</h2>
          {projects && (
            <p className="muted">
              {projects.length} פרויקטים · {projects.length - drafts} מפורסמים · {drafts} טיוטות
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn" to="/admin/import">
            ייבוא מקובץ KML
          </Link>
          <Link className="btn btn-primary" to="/admin/new">
            פרויקט חדש
          </Link>
        </div>
      </div>

      <div className="box">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 320 }} placeholder="חיפוש לפי שם, תוכנית או כתובת" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">
            {(
              [
                ['all', 'הכל'],
                ['published', 'מפורסמים'],
                ['draft', 'טיוטות'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} className="chip" aria-pressed={show === k} onClick={() => setShow(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {projects === null ? (
          <p className="muted">טוען...</p>
        ) : projects.length === 0 ? (
          <div className="empty">
            <h3>עוד אין פרויקטים</h3>
            <p>
              הדרך המהירה להתחיל: ייבוא קובץ KML של תוכניות. כל צורה בקובץ הופכת לטיוטה, ואז משלימים לכל אחת הסבר, שלב והדמיות.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link className="btn btn-primary" to="/admin/import">
                ייבוא KML
              </Link>
              <Link className="btn" to="/admin/new">
                פרויקט ידני
              </Link>
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>פרויקט</th>
                <th>שלב</th>
                <th className="hide-sm">רובע</th>
                <th className="hide-sm">חומרים</th>
                <th>במפה</th>
                <th className="hide-sm">עודכן</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const renders = p.plan_media.filter((m) => m.kind === 'render').length
                const videos = p.plan_media.filter((m) => m.kind === 'video' || m.kind === 'video_link').length
                const missing = [!p.center && 'מיקום', !p.summary && 'תקציר', !renders && 'הדמיה'].filter(Boolean)
                return (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/admin/p/${p.id}`} className="row-title" style={{ color: 'var(--ink)' }}>
                        {p.title}
                      </Link>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {KIND_LABEL[p.kind]}
                        {p.plan_number ? ` · ${p.plan_number}` : ''}
                        {missing.length > 0 && <span style={{ color: 'var(--warn)' }}> · חסר: {missing.join(', ')}</span>}
                      </div>
                    </td>
                    <td>
                      <span className="badge">
                        <span className="dot" style={{ background: STATUS_COLOR[p.status] }} />
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="hide-sm">{quarters.find((x) => x.id === p.quarter_id)?.name ?? <span className="muted">לא צוין</span>}</td>
                    <td className="hide-sm muted" style={{ fontSize: 14 }}>
                      {renders} הדמיות · {videos} סרטונים
                    </td>
                    <td>
                      <label className="switch">
                        <input type="checkbox" checked={p.published} onChange={() => togglePublish(p)} aria-label="פרסום במפה" />
                      </label>
                    </td>
                    <td className="hide-sm muted">{dateFmt.format(new Date(p.updated_at))}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="btn btn-sm" to={`/admin/p/${p.id}`}>
                          עריכה
                        </Link>
                        {p.published && (
                          <Link className="btn btn-sm btn-ghost" to={`/p/${p.id}`} target="_blank">
                            צפייה
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
