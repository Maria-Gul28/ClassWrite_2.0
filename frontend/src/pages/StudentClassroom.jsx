import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import TopBar from '../components/TopBar'
import api from '../utils/api'
import { getSocket, disconnectSocket } from '../utils/socket'

export default function StudentClassroom() {
  const { cls, user } = useAuth()
  const location = useLocation()
  const isReturning = location.state?.returning

  const [assignments,  setAssignments]  = useState([])
  const [submissions,  setSubmissions]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [active,       setActive]       = useState(null)
  const [view,         setView]         = useState('list')

  useEffect(() => {
    Promise.all([
      api.get('/student/assignments'),
      api.get('/student/submissions'),
    ]).then(([aRes, sRes]) => {
      setAssignments(aRes.data)
      setSubmissions(sRes.data)
    }).finally(() => setLoading(false))

    // Join the class room so the server can route events to this class
    if (cls?.id) {
      const socket = getSocket()
      function joinRoom() {
        socket.emit('join_room', { class_id: cls.id })
      }
      socket.on('connect', joinRoom)
      if (socket.connected) joinRoom()
      return () => socket.off('connect', joinRoom)
    }
  }, [])

  const submittedIds = new Set(submissions.map(s => s.assignment_id))

  function onSubmitted(assignmentId, content) {
    setSubmissions(prev => {
      const existing = prev.findIndex(s => s.assignment_id === assignmentId)
      const sub = { assignment_id: assignmentId, content, submitted_at: new Date().toISOString() }
      if (existing !== -1) { const n = [...prev]; n[existing] = sub; return n }
      return [...prev, sub]
    })
    setActive(null)
    setView('list')
  }

  if (loading) return (
    <div className="min-h-screen">
      <TopBar />
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-400 rounded-full animate-spin" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <div className="flex flex-1">

        {/* Sidebar */}
        <nav className="w-56 flex-shrink-0 bg-white/80 border-r-2 border-sky-100 px-4 py-8 flex flex-col gap-1">
          <p className="font-hand text-xs uppercase tracking-widest text-sky-400 mb-3 px-2">Classroom</p>
          <SidebarBtn icon="/assets/goose_with_books.svg" label="Assignments"
            active={view === 'list'}
            onClick={() => { setView('list'); setActive(null) }} />
          <SidebarBtn icon="/assets/goose_reading.svg" label="My Work"
            active={view === 'mywork'}
            onClick={() => { setView('mywork'); setActive(null) }}
            badge={submissions.length || null} />
          <img src="/assets/bird_studying.svg" alt="" className="w-20 mx-auto mt-auto opacity-50" />
        </nav>

        {/* Main */}
        <main className="flex-1 max-w-3xl mx-auto px-6 py-10 w-full">

          {/* Welcome back banner */}
          {isReturning && view === 'list' && !active && (
            <div className="card-doodle px-6 py-4 mb-6 flex items-center gap-3 border-sky-300">
              <span className="text-2xl">👋</span>
              <p className="font-hand text-lg text-sky-500">Welcome back! Your past submissions are saved under My Work.</p>
            </div>
          )}

          {/* Class header */}
          {view === 'list' && !active && (
            <div className="mb-8">
              <h1 className="page-title">{cls?.name || 'Your class'}</h1>
              <div className="flex items-center gap-3 mt-3">
                <span className="badge">{cls?.grade}</span>
                <span className="font-hand text-sm text-sky-400">Code:</span>
                <span className="class-code text-sm tracking-[0.25em]">{cls?.class_code}</span>
              </div>
            </div>
          )}

          {view === 'list' && !active && (
            <AssignmentList
              assignments={assignments}
              submittedIds={submittedIds}
              onOpen={a => { setActive(a); setView('write') }} />
          )}

          {view === 'write' && active && (
            <WritingView
              assignment={active}
              isSubmitted={submittedIds.has(active.id)}
              onBack={() => { setActive(null); setView('list') }}
              onSubmitted={onSubmitted} />
          )}

          {view === 'mywork' && (
            <MyWorkView submissions={submissions} assignments={assignments} />
          )}
        </main>
      </div>
    </div>
  )
}

// ── Sidebar button ────────────────────────────────────────────
function SidebarBtn({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl font-hand text-base transition-colors w-full text-left
        ${active ? 'bg-sky-400 text-white' : 'text-ink-800 hover:bg-sky-50 hover:text-sky-500'}`}>
      <img src={icon} alt="" className="w-[50px] h-[50px] object-contain flex-shrink-0" />
      {label}
      {badge > 0 && (
        <span className={`ml-auto text-xs font-hand px-2 py-0.5 rounded-full
          ${active ? 'bg-white/30 text-white' : 'bg-sky-100 text-sky-500'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

// ── Assignment list ───────────────────────────────────────────
function AssignmentList({ assignments, submittedIds, onOpen }) {
  if (assignments.length === 0) return (
    <div className="card-doodle p-16 text-center">
      <img src="/assets/goose_reading.svg" alt="" className="w-24 mx-auto mb-4 opacity-60" />
      <p className="font-hand text-xl text-sky-400">No assignments yet</p>
      <p className="font-hand text-base text-sky-300 mt-1">Your teacher will post one soon!</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {assignments.map(a => (
        <div key={a.id}
          className="card-doodle p-6 cursor-pointer hover:-translate-y-1 transition-transform duration-200 group"
          onClick={() => onOpen(a)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-hand text-xl text-ink-900 group-hover:text-sky-500 transition-colors mb-1">
                {a.title}
              </h3>
              <p className="font-body text-base text-sky-400 line-clamp-2">{a.question}</p>
            </div>
            {submittedIds.has(a.id)
              ? <span className="badge flex-shrink-0">✓ Submitted</span>
              : <span className="font-hand text-base text-sky-400 flex-shrink-0">Click to write →</span>}
          </div>
          {(a.resources?.length > 0 || a.criteria?.length > 0 || a.images?.length > 0) && (
            <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-sky-100">
              {a.resources?.length > 0 && <span className="badge text-xs">🔗 {a.resources.length} resources</span>}
              {a.criteria?.length  > 0 && <span className="badge text-xs">✅ {a.criteria.length} criteria</span>}
              {a.images?.length    > 0 && <span className="badge text-xs">🖼️ {a.images.length} images</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Writing view ──────────────────────────────────────────────
function WritingView({ assignment, isSubmitted, onBack, onSubmitted }) {
  const { cls, user } = useAuth()
  const [content,   setContent]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(true)
  const [submitted, setSubmitted] = useState(isSubmitted)
  const [busy,      setBusy]      = useState(false)
  const [slide,     setSlide]     = useState(0)
  const images = assignment.images || []

  // Emit via socket in real-time, debounced to 600ms
  useEffect(() => {
    if (!content && saved) return
    setSaved(false)
    const t = setTimeout(() => {
      setSaving(true)
      const socket = getSocket()
      // Real-time socket emit so teacher sees it instantly
      socket.emit('update_progress', {
        student_id:    user?.id,
        student_name:  user?.name,
        assignment_id: assignment.id,
        class_id:      cls?.id,
        content,
      })
      // HTTP fallback — persists to DB in case socket drops
      api.post('/update_progress', {
        assignment_id: assignment.id,
        class_id:      cls?.id,
        content,
      }).catch(() => {}).finally(() => { setSaving(false); setSaved(true) })
    }, 600)
    return () => clearTimeout(t)
  }, [content])

  // Join and leave assignment via socket so teacher roster updates
  useEffect(() => {
    const socket = getSocket()
    socket.emit('join_assignment', {
      student_id:    user?.id,
      student_name:  user?.name,
      assignment_id: assignment.id,
      class_id:      cls?.id,
    })
    return () => {
      socket.emit('leave_assignment', {
        student_id:    user?.id,
        student_name:  user?.name,
        assignment_id: assignment.id,
        class_id:      cls?.id,
      })
    }
  }, [assignment.id])

  async function handleSubmit() {
    if (!content.trim()) { alert('Please write something first!'); return }
    setBusy(true)
    try {
      await api.post('/student/submit', { assignment_id: assignment.id, content })
      setSubmitted(true)
      onSubmitted(assignment.id, content)
    } catch (e) {
      alert(e.response?.data?.error || 'Submit failed')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <button onClick={onBack}
        className="font-hand text-sky-400 text-base mb-5 hover:text-sky-500 transition-colors">
        ← Back to assignments
      </button>

      {/* Prompt */}
      <div className="card-doodle p-6 mb-5">
        <h2 className="font-hand text-2xl text-ink-900 mb-3">{assignment.title}</h2>
        <p className="font-body text-base text-ink-800 leading-relaxed whitespace-pre-wrap">{assignment.question}</p>
      </div>

      {/* Criteria */}
      {assignment.criteria?.length > 0 && (
        <div className="card-doodle p-6 mb-5">
          <h3 className="font-hand text-lg text-ink-900 mb-3">✅ Success Criteria</h3>
          <div className="flex flex-col gap-2">
            {assignment.criteria.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-sky-400 mt-0.5">◆</span>
                <span className="font-body text-base text-ink-800 leading-relaxed">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resources */}
      {assignment.resources?.length > 0 && (
        <div className="card-doodle p-6 mb-5">
          <h3 className="font-hand text-lg text-ink-900 mb-3">🔗 Resources</h3>
          <div className="flex flex-wrap gap-2">
            {assignment.resources.map((r, i) => (
              <a key={i} href={r.startsWith('http') ? r : '#'} target="_blank" rel="noopener noreferrer"
                className="font-hand text-base px-3 py-1.5 rounded-full bg-sky-50 border-2 border-sky-200
                           text-sky-500 hover:border-sky-400 hover:bg-white transition-colors">
                🔗 {r}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Image slideshow */}
      {images.length > 0 && (
        <div className="card-doodle p-6 mb-5">
          <h3 className="font-hand text-lg text-ink-900 mb-3">
            🖼️ Resource Images
            <span className="font-hand text-sm text-sky-400 ml-2 normal-case tracking-normal">
              {images.length} image{images.length !== 1 ? 's' : ''}
            </span>
          </h3>
          <div className="relative overflow-hidden rounded-xl bg-sky-50">
            <div className="overflow-hidden">
              <div className="flex transition-transform duration-300"
                   style={{ transform: `translateX(-${slide * 100}%)` }}>
                {images.map((src, i) => (
                  <div key={i} className="w-full flex-shrink-0">
                    <img src={src} alt={`Resource ${i+1}`}
                         className="w-full max-h-72 object-contain mx-auto" draggable={false} />
                  </div>
                ))}
              </div>
            </div>
            {images.length > 1 && (
              <>
                <button onClick={() => setSlide(s => Math.max(0, s-1))} disabled={slide === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full
                             bg-sky-400 border-2 border-sky-400 font-hand text-white text-lg
                             flex items-center justify-center disabled:opacity-30 hover:bg-sky-500">‹</button>
                <button onClick={() => setSlide(s => Math.min(images.length-1, s+1))} disabled={slide === images.length-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full
                             bg-sky-400 border-2 border-sky-400 font-hand text-white text-lg
                             flex items-center justify-center disabled:opacity-30 hover:bg-sky-500">›</button>
                <div className="flex justify-center gap-1.5 mt-3 pb-3">
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setSlide(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${i === slide ? 'bg-sky-400' : 'bg-sky-200'}`} />
                  ))}
                </div>
                <p className="text-center font-hand text-xs text-sky-400 pb-2">{slide+1} / {images.length}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Teacher notes */}
      {assignment.mindmap && (
        <div className="card-doodle p-6 mb-5">
          <h3 className="font-hand text-lg text-ink-900 mb-3">🗺️ Notes from Teacher</h3>
          <p className="font-body text-base text-ink-800 leading-relaxed whitespace-pre-wrap bg-sky-50 rounded-xl px-4 py-3">
            {assignment.mindmap}
          </p>
        </div>
      )}

      {/* Writing area */}
      <div className="card-doodle p-6">
        <h3 className="font-hand text-xl text-ink-900 mb-4">✍️ Your writing</h3>
        <textarea
          className="w-full min-h-[300px] resize-y px-5 py-4 rounded-xl border-2 border-sky-200
                     bg-white font-serif text-base text-ink-800 leading-[1.75] outline-none
                     focus:border-sky-400 transition-colors"
          style={{ backgroundImage: 'repeating-linear-gradient(transparent,transparent 27px,rgba(46,157,209,0.08) 28px)' }}
          placeholder="Start writing here…"
          value={content}
          onChange={e => setContent(e.target.value)}
          disabled={submitted} />

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 font-hand text-base text-sky-400">
            <span className={`w-2 h-2 rounded-full transition-colors
              ${saving ? 'bg-apple-400 animate-pulse' : saved ? 'bg-sky-400' : 'bg-sky-200'}`} />
            {saving ? 'Saving…' : saved ? 'All changes saved' : 'Unsaved'}
          </div>
          {submitted
            ? <span className="badge font-hand text-base">✓ Submitted</span>
            : <button className="btn-primary" onClick={handleSubmit} disabled={busy}>
                {busy ? 'Submitting…' : '📤 Submit'}
              </button>}
        </div>
      </div>
    </div>
  )
}

// ── My Work view ──────────────────────────────────────────────
function MyWorkView({ submissions, assignments }) {
  const [open, setOpen] = useState(null)

  if (submissions.length === 0) return (
    <div>
      <h1 className="page-title mb-8">My Work</h1>
      <div className="card-doodle p-16 text-center">
        <img src="/assets/goose_reading.svg" alt="" className="w-24 mx-auto mb-4 opacity-60" />
        <p className="font-hand text-xl text-sky-400">No submissions yet</p>
        <p className="font-hand text-base text-sky-300 mt-1">Submit an assignment to see it here</p>
      </div>
    </div>
  )

  return (
    <div>
      <h1 className="page-title mb-8">My Work</h1>
      <div className="flex flex-col gap-4">
        {submissions.map((s, i) => {
          const a  = assignments.find(x => x.id === s.assignment_id)
          const wc = (s.content || '').trim().split(/\s+/).filter(Boolean).length
          return (
            <div key={i} className="card-doodle p-6 cursor-pointer hover:-translate-y-0.5 transition-transform"
                 onClick={() => setOpen(s)}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-hand text-lg text-ink-900">{a?.title || `Assignment #${s.assignment_id}`}</h3>
                <span className="badge">✓ Submitted</span>
              </div>
              <p className="font-serif text-base text-ink-800 line-clamp-3 leading-relaxed">
                {(s.content || '').substring(0, 200)}{s.content?.length > 200 ? '…' : ''}
              </p>
              <div className="flex justify-between mt-3 pt-3 border-t border-sky-100">
                <span className="font-hand text-sm text-sky-400">{wc} words</span>
                <span className="font-hand text-sm text-sky-300">{new Date(s.submitted_at).toLocaleString()}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Full submission modal */}
      {open && (
        <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
             onClick={e => e.target === e.currentTarget && setOpen(null)}>
          <div className="card-doodle w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start p-8 pb-4 border-b border-sky-100">
              <div>
                <h3 className="font-hand text-2xl text-ink-900">
                  {assignments.find(a => a.id === open.assignment_id)?.title || `Assignment #${open.assignment_id}`}
                </h3>
                <p className="font-hand text-sm text-sky-400 mt-1">
                  Submitted {new Date(open.submitted_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setOpen(null)}
                className="w-9 h-9 rounded-full bg-sky-50 border-2 border-sky-200 flex items-center justify-center
                           font-hand text-lg text-sky-400 hover:border-apple-400 hover:text-apple-400 transition-colors">✕</button>
            </div>
            <div className="overflow-y-auto p-8">
              <pre className="font-serif text-base text-ink-800 leading-relaxed whitespace-pre-wrap">{open.content}</pre>
              <p className="font-hand text-sm text-sky-300 mt-4 pt-4 border-t border-sky-100">
                {(open.content||'').trim().split(/\s+/).filter(Boolean).length} words
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}