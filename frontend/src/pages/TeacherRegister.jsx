import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthCard from '../components/AuthCard'

export default function TeacherRegister() {
  const { teacherRegister } = useAuth()
  const navigate = useNavigate()
  const [form, setForm]   = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy]   = useState(false)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setBusy(true)
    try {
      await teacherRegister(form.name.trim(), form.email.trim(), form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard title="Create account" subtitle="Start your classroom today">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 font-hand text-apple-500 text-base">
            {error}
          </div>
        )}

        <div>
          <label className="block font-hand text-lg text-ink-800 uppercase tracking-widest mb-1">Your name</label>
          <input className="input-doodle" placeholder="Maria Gul" value={form.name} onChange={set('name')} required />
        </div>
        <div>
          <label className="block font-hand text-lg text-ink-800 uppercase tracking-widest mb-1">Email</label>
          <input className="input-doodle" type="email" placeholder="you@school.edu" value={form.email} onChange={set('email')} required />
        </div>
        <div>
          <label className="block font-hand text-lg text-ink-800 uppercase tracking-widest mb-1">Password</label>
          <input className="input-doodle" type="password" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} required />
        </div>
        <div>
          <label className="block font-hand text-lg text-ink-800 uppercase tracking-widest mb-1">Confirm password</label>
          <input className="input-doodle" type="password" placeholder="Same again" value={form.confirm} onChange={set('confirm')} required />
        </div>

        <button className="btn-primary mt-2 justify-center" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account →'}
        </button>
        <p className="font-hand text-center text-sky-500 text-base">
          Already have an account?{' '}
          <Link to="/login" className="text-sky-400 underline">Sign in</Link>
        </p>
        <p className="font-hand text-center text-sky-400 text-sm">
          <Link to="/">← Back to home</Link>
        </p>
      </form>
    </AuthCard>
  )
}