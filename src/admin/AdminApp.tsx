import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ProjectsList from './ProjectsList'
import ProjectEditor from './ProjectEditor'
import BulkImport from './BulkImport'
import Moderation from './Moderation'
import { ToastProvider } from './toast'

export const ADMIN_FLAG = 'mnv-admin'

export default function AdminApp() {
  const [pending, setPending] = useState(0)
  const location = useLocation()

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_FLAG, '1')
    } catch {
      /* storage unavailable */
    }
  }, [])

  const refreshPending = useCallback(() => {
    supabase
      .from('plan_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPending(count ?? 0))
  }, [])

  useEffect(() => {
    refreshPending()
  }, [refreshPending, location.pathname])

  return (
    <ToastProvider>
      <div className="admin">
        <header className="admin-top">
          <div className="admin-top-inner">
            <h1>מה נבנה סביבי · ניהול</h1>
            <nav className="tabs" aria-label="ניהול">
              <NavLink to="/admin" end>
                פרויקטים
              </NavLink>
              <NavLink to="/admin/import">ייבוא KML</NavLink>
              <NavLink to="/admin/feedback">
                תגובות תושבים
                {pending > 0 && <span className="count">{pending}</span>}
              </NavLink>
            </nav>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link className="btn btn-sm" to="/" target="_blank">
                לאתר התושבים
              </Link>
            </div>
          </div>
        </header>
        <main className="admin-main">
          <Routes>
            <Route index element={<ProjectsList />} />
            <Route path="new" element={<ProjectEditor />} />
            <Route path="p/:id" element={<ProjectEditor />} />
            <Route path="import" element={<BulkImport />} />
            <Route path="feedback" element={<Moderation onChange={refreshPending} />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  )
}
