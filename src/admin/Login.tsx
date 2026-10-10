import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(error.message.includes('Invalid') ? 'האימייל או הסיסמה אינם נכונים' : 'הכניסה נכשלה. נסו שוב.')
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="box" onSubmit={submit}>
        <div>
          <h3>כניסת צוות העירייה</h3>
          <p className="muted">ניהול הפרויקטים, ההדמיות והתגובות במפה "מה נבנה סביבי".</p>
        </div>
        <label className="field">
          <span>אימייל</span>
          <input className="input" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="field">
          <span>סיסמה</span>
          <input
            className="input"
            type="password"
            dir="ltr"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <small>אותה סיסמה של מערכות העירייה האחרות שמחוברות למסד הנתונים ASHDODMAP.</small>
        </label>
        {error && <div className="notice notice-error">{error}</div>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'רגע...' : 'כניסה'}
        </button>
        <Link to="/" className="muted" style={{ fontSize: 14 }}>
          חזרה לאתר התושבים
        </Link>
      </form>
    </div>
  )
}
