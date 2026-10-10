import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import Login from './Login'
import ProjectsList from './ProjectsList'
import ProjectEditor from './ProjectEditor'
import BulkImport from './BulkImport'
import Moderation from './Moderation'
import { ToastProvider } from './toast'

export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [isStaff, setIsStaff] = useState<boolean | null>(null)
  const [pending, setPending] = useState(0)
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setIsStaff(null)
      return
    }
    supabase.rpc('is_staff').then(({ data, error }) => setIsStaff(!error && data === true))
  }, [session])

  const refreshPending = useCallback(() => {
    supabase
      .from('plan_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPending(count ?? 0))
  }, [])

  useEffect(() => {
    if (isStaff) refreshPending()
  }, [isStaff, refreshPending, location.pathname])

  if (session === undefined) return <div className="loading">טוען...</div>
  if (!session) return <Login />
  if (isStaff === null) return <div className="loading">בודק הרשאות...</div>
  if (!isStaff)
    return (
      <div className="login">
        <div className="box">
          <h3>החשבון אינו מורשה לניהול</h3>
          <p className="muted">
            נכנסת כ-<b dir="ltr">{session.user.email}</b>. כדי לקבל הרשאה, מנהל המערכת צריך להוסיף את החשבון לרשימת הצוות.
          </p>
          <button className="btn" onClick={() => supabase.auth.signOut()}>
            יציאה
          </button>
        </div>
      </div>
    )

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
              <button className="btn btn-sm" onClick={() => supabase.auth.signOut()}>
                יציאה
              </button>
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
