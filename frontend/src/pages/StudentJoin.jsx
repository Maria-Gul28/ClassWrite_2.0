import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthCard from '../components/AuthCard'

export default function StudentJoin() {
  const { studentJoin } = useAuth()
  const navigate = useNavigate()
  const [form, setForm]   = useState({ name: '', class_code: '', pin: '' })
  const [error, setError] = useState('')
  const [busy, setBusy]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim())       { setError('Please enter your name'); return }
    if (!form.class_code.trim()) { setError('Please enter the class code'); return }
    if (!/^\d{4}$/.test(form.pin)) { setError('PIN must be exactly 4 digits'); return }
    setBusy(true)
    try {
      const result = await studentJoin(form.name.trim(), form.class_code.trim(), form.pin)
      navigate('/classroom', { state: { returning: result.is_returning } })
    } catch (err) {
      setError(err.response?.data?.error || 'Could not join class')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard title="Join a class" subtitle="Enter your details to enter the classroom">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 font-hand text-apple-500 text-base">
            {error}
          </div>
        )}

        <div>
          <label className="block font-hand text-sm text-ink-800 uppercase tracking-widest mb-1">Your name</label>
          <input className="input-doodle" placeholder="Sara Khan"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required />
        </div>

        <div>
          <label className="block font-hand text-sm text-ink-800 uppercase tracking-widest mb-1">Class code</label>
          <input className="input-doodle font-hand text-xl tracking-widest text-center"
            placeholder="ABC123" maxLength={6}
            value={form.class_code}
            onChange={e => setForm(f => ({ ...f, class_code: e.target.value.toUpperCase() }))}
            required />
          <p className="font-hand text-2xl text-sky-400 text-center mt-1">6-character code — ask your teacher</p>
        </div>

        <div>
          <label className="block font-hand text-sm text-ink-800 uppercase tracking-widest mb-1">4-digit PIN</label>
          <input className="input-doodle font-hand text-xl tracking-widest text-center"
            placeholder="••••" maxLength={4} type="password" inputMode="numeric"
            value={form.pin}
            onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
            required />
          <p className="font-hand text-2xl text-sky-400 text-center mt-1">
            First time? Pick any 4 digits — remember them for next time!
          </p>
        </div>

        <button className="btn-primary mt-2 justify-center" disabled={busy}>
          {busy ? 'Entering…' : 'Enter classroom →'}
        </button>
        <p className="font-hand text-center text-sky-400 text-sm">
          <Link to="/">← Back to home</Link>
        </p>
      </form>
    </AuthCard>
  )
}