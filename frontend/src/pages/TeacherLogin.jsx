import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthCard from '../components/AuthCard'

export default function TeacherLogin() {
  const { teacherLogin } = useAuth()
  const navigate = useNavigate()
  const [form, setForm]   = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy]   = useState(false)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await teacherLogin(form.email.trim(), form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard title="Teacher sign in" subtitle="Welcome back to your classroom">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 font-hand text-apple-500 text-base">
            {error}
          </div>
        )}

        <div>
          <label className="block font-hand text-sm text-ink-800 uppercase tracking-widest mb-1">Email</label>
          <input className="input-doodle" type="email" placeholder="you@school.edu"
            value={form.email} onChange={set('email')} required />
        </div>
        <div>
          <label className="block font-hand text-sm text-ink-800 uppercase tracking-widest mb-1">Password</label>
          <input className="input-doodle" type="password" placeholder="Your password"
            value={form.password} onChange={set('password')} required
            onKeyDown={e => e.key === 'Enter' && handleSubmit(e)} />
        </div>

        <button className="btn-primary mt-2 justify-center" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in →'}
        </button>
        <p className="font-hand text-center text-sky-500 text-base">
          New here?{' '}
          <Link to="/register" className="text-sky-400 underline">Create an account</Link>
        </p>
        <p className="font-hand text-center text-sky-400 text-sm">
          <Link to="/">← Back to home</Link>
        </p>
      </form>
    </AuthCard>
  )
}