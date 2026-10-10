import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'password' | 'link'>('password')
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setState('busy')
    if (mode === 'password') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        setError(error.message.includes('Invalid') ? 'האימייל או הסיסמה אינם נכונים' : 'הכניסה נכשלה. נסו שוב.')
        setState('idle')
      }
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/admin` },
      })
      if (error) {
        setError('לא הצלחנו לשלוח קישור. ודאו שהאימייל שייך לצוות.')
        setState('idle')
      } else setState('sent')
    }
  }

  return (
    <div className="login">
      <form className="box" onSubmit={submit}>
        <div>
          <h3>כניסת צוות העירייה</h3>
          <p className="muted">ניהול הפרויקטים, ההדמיות והתגובות במפה "מה נבנה סביבי".</p>
        </div>
        <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }} role="group" aria-label="שיטת כניסה">
          <button type="button" aria-pressed={mode === 'password'} onClick={() => setMode('password')}>
            סיסמה
          </button>
          <button type="button" aria-pressed={mode === 'link'} onClick={() => setMode('link')}>
            קישור למייל
          </button>
        </div>
        <label className="field">
          <span>אימייל</span>
          <input className="input" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        {mode === 'password' && (
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
          </label>
        )}
        {error && <div className="notice notice-error">{error}</div>}
        {state === 'sent' ? (
          <div className="notice notice-ok">נשלח קישור כניסה. פתחו את המייל באותו דפדפן.</div>
        ) : (
          <button className="btn btn-primary" disabled={state === 'busy'}>
            {state === 'busy' ? 'רגע...' : mode === 'password' ? 'כניסה' : 'שליחת קישור'}
          </button>
        )}
        <Link to="/" className="muted" style={{ fontSize: 14 }}>
          חזרה לאתר התושבים
        </Link>
      </form>
    </div>
  )
}
