import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import { getSocket } from '../utils/socket'

const GRADES = ['1st Grade','2nd Grade','3rd Grade','4th Grade','5th Grade',
                '6th Grade','7th Grade','8th Grade','9th Grade','10th Grade',
                '11th Grade','12th Grade','Other']

// ── Main shell ────────────────────────────────────────────────
export default function TeacherApp() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Global data
  const [classes,     setClasses]     = useState([])
  const [assignments, setAssignments] = useState([]) // flat, all classes
  const [submissions, setSubmissions] = useState([])
  const [liveWork,    setLiveWork]    = useState({})
  const [loadingData, setLoadingData] = useState(true)

  // Navigation state
  const [page,          setPage]          = useState('overview')
  const [selectedClass, setSelectedClass] = useState(null) // class object
  const [classPage,     setClassPage]     = useState('assignments') // when inside a class

  useEffect(() => {
    loadAll()

    const socket = getSocket()

    socket.on('progress_update', (data) => {
      const key = `${data.student_name}_${data.assignment_id}`
      setLiveWork(prev => ({
        ...prev,
        [key]: {
          student_name:  data.student_name,
          assignment_id: data.assignment_id,
          class_id:      data.class_id,
          content:       data.content,
          last_updated:  data.last_updated,
          status:        'in_progress',
        }
      }))
    })

    socket.on('student_left', (data) => {
      const key = `${data.student_name}_${data.assignment_id}`
      setLiveWork(prev => { const n = { ...prev }; delete n[key]; return n })
    })

    // Fallback poll every 15s in case a socket event is missed
    const interval = setInterval(pollLive, 15000)

    return () => {
      socket.off('progress_update')
      socket.off('student_left')
      clearInterval(interval)
    }
  }, [])

  async function loadAll() {
    try {
      const res = await api.get('/classes')
      const cls = res.data
      setClasses(cls)
      // Load assignments + submissions for all classes
      const [aResults, sResults] = await Promise.all([
        Promise.all(cls.map(c => api.get(`/classes/${c.id}/assignments`).then(r => r.data).catch(() => []))),
        Promise.all(cls.map(c => api.get(`/classes/${c.id}/submissions`).then(r => r.data).catch(() => []))),
      ])
      setAssignments(aResults.flat())
      setSubmissions(sResults.flat())
      // Live work from first class if any
      if (cls.length) pollLive(cls)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingData(false)
    }
  }

  async function pollLive(cls_list = classes) {
    if (!cls_list.length) return
    try {
      const results = await Promise.all(
        cls_list.map(c => api.get(`/classes/${c.id}/live`).then(r => r.data).catch(() => ({})))
      )
      const merged = Object.assign({}, ...results)
      setLiveWork(merged)
    } catch {}
  }

  async function reloadClassAssignments(classId) {
    const res = await api.get(`/classes/${classId}/assignments`)
    setAssignments(prev => [...prev.filter(a => a.class_id !== classId), ...res.data])
  }

  async function reloadClassSubmissions(classId) {
    const res = await api.get(`/classes/${classId}/submissions`)
    setSubmissions(prev => [...prev.filter(s => s.class_id !== classId), ...res.data])
  }

  function handleLogout() {
    logout()
    navigate('/')
  }

  // Sidebar nav items
  const navItems = [
    { id: 'overview',     label: 'Overview',       icon: '/assets/bird_studying.svg',    dot: false },
    { id: 'classes',      label: 'Classes',         icon: '/assets/goose_with_books.svg', dot: false },
    { id: 'live',         label: 'Live Progress',   icon: '/assets/live_progress.svg',    dot: true  },
    { id: 'submissions',  label: 'Submissions',     icon: '/assets/submissions.svg',      dot: false },
  ]

  const activeWriters = Object.keys(liveWork).length

  return (
    <div className="min-h-screen flex">

      {/* ── Sidebar ── */}
      <aside className="w-60 flex-shrink-0 bg-white/90 border-r-2 border-sky-100 flex flex-col sticky top-0 h-screen overflow-y-auto">
        {/* Logo */}
        <div className="px-6 py-6 border-b-2 border-sky-100">
          <div className="flex items-center gap-2">
            <img src="/assets/ABC.png" alt="" className="h-7 w-auto opacity-85" />
            <span className="font-hand text-2xl">
              Class<span className="text-sky-400">Write</span>
            </span>
          </div>
          <p className="font-hand text-base text-sky-400 mt-1 ml-1">Teacher Dashboard</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 flex flex-col gap-1">
          <p className="font-hand text-xs uppercase tracking-widest text-sky-300 mb-2 px-3">Dashboard</p>

          {navItems.map(item => (
            <button key={item.id}
              onClick={() => { setPage(item.id); setSelectedClass(null) }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-hand text-base
                         transition-colors w-full text-left
                ${page === item.id && !selectedClass
                  ? 'bg-sky-400 text-white'
                  : 'text-ink-800 hover:bg-sky-50 hover:text-sky-500'}`}>
              {item.dot && (
                <span className={`w-2 h-2 rounded-full flex-shrink-0
                  ${activeWriters > 0 ? 'bg-green-400 animate-pulse' : 'bg-sky-200'}`} />
              )}
              <img src={item.icon} alt="" className="w-[50px] h-[50px] object-contain flex-shrink-0" />
              {item.label}
              {item.id === 'live' && activeWriters > 0 && (
                <span className="ml-auto bg-green-400 text-white text-xs font-hand rounded-full px-1.5 py-0.5">
                  {activeWriters}
                </span>
              )}
            </button>
          ))}

          {/* Classes list in sidebar */}
          {classes.length > 0 && (
            <>
              <p className="font-hand text-xs uppercase tracking-widest text-sky-300 mt-5 mb-2 px-3">
                My Classes
              </p>
              {classes.map(cls => (
                <button key={cls.id}
                  onClick={() => { setSelectedClass(cls); setClassPage('assignments'); setPage('class') }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl font-hand text-lg
                             transition-colors w-full text-left truncate
                    ${selectedClass?.id === cls.id
                      ? 'bg-sky-100 text-sky-600 border-l-4 border-sky-400'
                      : 'text-ink-800 hover:bg-sky-50 hover:text-sky-500'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-300 flex-shrink-0" />
                  <span className="truncate">{cls.name}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        {/* User + sign out */}
        <div className="px-4 py-5 border-t-2 border-sky-100">
          <div className="flex items-center gap-2 mb-3">
            <img src="/assets/teacher.svg" alt="" className="w-[50px] h-[50px] object-contain" />
            <span className="font-hand text-lg text-ink-800 truncate">{user?.name}</span>
          </div>
          <button onClick={handleLogout}
            className="w-full font-hand text-sm px-3 py-1.5 rounded-full border-2 border-sky-200
                       text-ink-800 hover:border-apple-500 hover:text-apple-500 transition-colors">
            Sign out
          </button>
        </div>

        {/* Deco */}
        <img src="/assets/goose_reading.svg" alt=""
             className="w-20 mx-auto mb-4 opacity-40 pointer-events-none" />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-8 py-10">

          {loadingData ? (
            <div className="flex justify-center py-32">
              <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-400 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {page === 'overview' && !selectedClass && (
                <OverviewPage
                  user={user}
                  classes={classes}
                  assignments={assignments}
                  submissions={submissions}
                  liveWork={liveWork}
                  onOpenClass={cls => { setSelectedClass(cls); setClassPage('assignments'); setPage('class') }}
                  onGoLive={() => setPage('live')}
                />
              )}

              {page === 'classes' && !selectedClass && (
                <ClassesPage
                  classes={classes}
                  submissions={submissions}
                  onClassCreated={cls => setClasses(c => [cls, ...c])}
                  onClassDeleted={id => {
                    setClasses(c => c.filter(x => x.id !== id))
                    setAssignments(a => a.filter(x => x.class_id !== id))
                    setSubmissions(s => s.filter(x => x.class_id !== id))
                  }}
                  onOpenClass={cls => { setSelectedClass(cls); setClassPage('assignments'); setPage('class') }}
                />
              )}

              {page === 'live' && !selectedClass && (
                <LivePage liveWork={liveWork} assignments={assignments} classes={classes} onPoll={pollLive} />
              )}

              {page === 'submissions' && !selectedClass && (
                <SubmissionsPage submissions={submissions} assignments={assignments} />
              )}

              {page === 'class' && selectedClass && (
                <ClassPage
                  cls={selectedClass}
                  classPage={classPage}
                  setClassPage={setClassPage}
                  assignments={assignments.filter(a => a.class_id === selectedClass.id)}
                  submissions={submissions.filter(s => s.class_id === selectedClass.id)}
                  liveWork={liveWork}
                  onBack={() => { setSelectedClass(null); setPage('classes') }}
                  onAssignmentsChange={() => reloadClassAssignments(selectedClass.id)}
                  onSubmissionsChange={() => reloadClassSubmissions(selectedClass.id)}
                  onPoll={pollLive}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────
function OverviewPage({ user, classes, assignments, submissions, liveWork, onOpenClass, onGoLive }) {
  const activeWriters = Object.keys(liveWork).length
  const recentSubs = [...submissions].sort((a,b) => new Date(b.submitted_at) - new Date(a.submitted_at)).slice(0,5)

  return (
    <div>
      <h1 className="page-title">Good day, {user?.name?.split(' ')[0]} ✨</h1>
      <p className="font-hand text-base text-sky-500 mt-2 mb-8">Your classroom, live</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { n: classes.length,     label: 'Classes' },
          { n: activeWriters,      label: 'Active Writers', live: true },
          { n: submissions.length, label: 'Submissions' },
        ].map(s => (
          <div key={s.label} className="card-doodle p-6 text-center">
            <div className="font-hand text-4xl text-ink-900 mb-1">{s.n}</div>
            <div className="font-hand text-sm text-sky-400 flex items-center justify-center gap-1">
              {s.live && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />}
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Active writers callout */}
      {activeWriters > 0 && (
        <button onClick={onGoLive}
          className="w-full card-doodle p-5 mb-8 flex items-center justify-between
                     hover:border-sky-400 transition-colors cursor-pointer text-left">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            <span className="font-hand text-lg text-ink-900">
              {activeWriters} student{activeWriters !== 1 ? 's' : ''} writing right now
            </span>
          </div>
          <span className="font-hand text-sky-400">View live →</span>
        </button>
      )}

      {/* Recent submissions */}
      <div className="card-doodle p-6 mb-8">
        <h2 className="font-hand text-xl text-ink-900 mb-4">
          <img src="/assets/submissions.svg" alt="" className="w-5 h-5 inline mr-2 opacity-70" />
          Recent Submissions
        </h2>
        {recentSubs.length === 0 ? (
          <p className="font-hand text-sky-400 text-center py-8">No submissions yet</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recentSubs.map((s, i) => {
              const a = assignments.find(x => x.id === s.assignment_id)
              return (
                <div key={i} className="flex justify-between items-start py-2 border-b border-sky-50 last:border-0">
                  <div>
                    <span className="font-hand text-base text-ink-900">{s.student_name}</span>
                    <span className="font-hand text-sm text-sky-400 ml-2">— {a?.title || `#${s.assignment_id}`}</span>
                    <p className="font-body text-xs text-sky-400 mt-0.5 line-clamp-1">
                      {String(s.content || '').substring(0, 100)}…
                    </p>
                  </div>
                  <span className="font-hand text-xs text-sky-300 flex-shrink-0 ml-4">
                    {new Date(s.submitted_at).toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Classes quick access */}
      {classes.length > 0 && (
        <div>
          <h2 className="font-hand text-xl text-ink-900 mb-4">Your Classes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(cls => (
              <button key={cls.id} onClick={() => onOpenClass(cls)}
                className="card-doodle p-5 text-left hover:-translate-y-1 transition-transform cursor-pointer group">
                <span className="badge mb-2 inline-block">{cls.grade}</span>
                <h3 className="font-hand text-lg text-ink-900 group-hover:text-sky-500 transition-colors">
                  {cls.name}
                </h3>
                <p className="font-hand text-sm text-sky-400 mt-1 tracking-widest">{cls.class_code}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Classes page ──────────────────────────────────────────────
function ClassesPage({ classes, submissions, onClassCreated, onClassDeleted, onOpenClass }) {
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ name: '', grade: '' })
  const [error, setError]         = useState('')
  const [busy, setBusy]           = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  async function createClass() {
    setError('')
    if (!form.name.trim() || !form.grade) { setError('Class name and grade are required'); return }
    setBusy(true)
    try {
      const res = await api.post('/classes', form)
      onClassCreated(res.data)
      setForm({ name: '', grade: '' })
      setShowForm(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create class')
    } finally {
      setBusy(false)
    }
  }

  async function deleteClass(cls) {
    try {
      await api.delete(`/classes/${cls.id}`)
      onClassDeleted(cls.id)
    } catch { alert('Failed to delete class') }
    finally { setDeleteTarget(null) }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code).catch(() => {})
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Classes</h1>
          <p className="font-hand text-base text-sky-500 mt-2">{classes.length} class{classes.length !== 1 ? 'es' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(s => !s); setError('') }}>
          {showForm ? 'Cancel' : '+ New class'}
        </button>
      </div>

      {showForm && (
        <div className="card-doodle p-8 mb-8 max-w-md">
          <h2 className="font-hand text-2xl text-ink-900 mb-5">Create a new class</h2>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 font-hand text-apple-500 text-sm mb-4">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-4">
            <div>
              <label className="block font-hand text-sm text-ink-800 uppercase tracking-widest mb-1">Class name</label>
              <input className="input-doodle" placeholder="e.g. 4th Grade English"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block font-hand text-sm text-ink-800 uppercase tracking-widest mb-1">Grade</label>
              <select className="input-doodle" value={form.grade}
                onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}>
                <option value="">Select grade…</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button className="btn-primary" onClick={createClass} disabled={busy}>
                {busy ? 'Creating…' : 'Create class'}
              </button>
              <button className="btn-secondary font-hand" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {classes.length === 0 ? (
        <div className="card-doodle p-16 text-center">
          <img src="/assets/bird_studying.svg" alt="" className="w-24 mx-auto mb-4 opacity-60" />
          <p className="font-hand text-xl text-sky-400 mb-2">No classes yet</p>
          <p className="font-hand text-base text-sky-300">Create your first class to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map(cls => {
            const subCount = submissions.filter(s => s.class_id === cls.id).length
            return (
              <ClassCard key={cls.id} cls={cls} subCount={subCount}
                onOpen={() => onOpenClass(cls)}
                onCopy={() => copyCode(cls.class_code)}
                onDelete={() => setDeleteTarget(cls)} />
            )
          })}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`Delete "${deleteTarget.name}"? This removes all assignments and submissions.`}
          onConfirm={() => deleteClass(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

// ── Class card ────────────────────────────────────────────────
function ClassCard({ cls, subCount, onOpen, onCopy, onDelete }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e) {
    e.stopPropagation(); onCopy()
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="card-doodle p-6 cursor-pointer hover:-translate-y-1 transition-transform duration-200 group"
         onClick={onOpen}>
      <span className="badge mb-3 inline-block">{cls.grade}</span>
      <h3 className="font-hand text-2xl text-ink-900 mb-4 group-hover:text-sky-500 transition-colors">
        {cls.name}
      </h3>
      <div className="flex items-center gap-2 mb-4" onClick={e => e.stopPropagation()}>
        <button onClick={handleCopy}
          className="class-code text-sm tracking-[0.25em] hover:bg-sky-500 transition-colors">
          {cls.class_code}
        </button>
        <span className="font-hand text-xs text-sky-400">{copied ? '✓ Copied!' : 'click to copy'}</span>
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-sky-100">
        <span className="font-hand text-xs text-sky-400">📬 {subCount} submitted</span>
        <button className="font-hand text-xs text-apple-400 hover:text-apple-500 transition-colors"
          onClick={e => { e.stopPropagation(); onDelete() }}>Delete</button>
      </div>
    </div>
  )
}

// ── Class detail page (inside sidebar shell) ──────────────────
function ClassPage({ cls, classPage, setClassPage, assignments, submissions, liveWork, onBack, onAssignmentsChange, onPoll }) {
  const classTabs = ['assignments', 'live', 'submissions']
  const classLiveWork = Object.fromEntries(
    Object.entries(liveWork).filter(([, w]) => w.class_id === cls.id)
  )

  return (
    <div>
      {/* Breadcrumb */}
      <button onClick={onBack} className="font-hand text-sky-400 text-base mb-4 hover:text-sky-500 transition-colors">
        ← All classes
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div>
          <h1 className="page-title">{cls.name}</h1>
          <div className="flex items-center gap-3 mt-3">
            <span className="badge">{cls.grade}</span>
            <span className="font-hand text-sm text-sky-400">Code:</span>
            <span className="class-code text-sm tracking-[0.25em]">{cls.class_code}</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mt-8 mb-6 border-b-2 border-sky-100 pb-2">
        {classTabs.map(t => (
          <button key={t} onClick={() => setClassPage(t)}
            className={`font-hand text-lg px-4 py-1.5 rounded-t-xl capitalize transition-colors
              ${classPage === t ? 'bg-sky-400 text-white' : 'text-sky-400 hover:text-sky-500 hover:bg-sky-50'}`}>
            {t === 'live' ? '⬤ Live' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {classPage === 'assignments' && (
        <AssignmentsTab classId={cls.id} assignments={assignments} onChanged={onAssignmentsChange} />
      )}
      {classPage === 'live' && (
        <LiveTab liveWork={classLiveWork} assignments={assignments} classes={[cls]} onPoll={onPoll} />
      )}
      {classPage === 'submissions' && (
        <SubmissionsTab submissions={submissions} assignments={assignments} />
      )}
    </div>
  )
}

// ── Assignments tab ───────────────────────────────────────────
function AssignmentsTab({ classId, assignments, onChanged }) {
  const [view, setView]         = useState('list')
  const [editTarget, setEditTarget] = useState(null)

  async function deleteAssignment(id) {
    if (!confirm('Delete this assignment? Students will lose access.')) return
    await api.delete(`/assignments/${id}`)
    onChanged()
  }

  if (view === 'create') return (
    <AssignmentForm classId={classId}
      onSaved={() => { onChanged(); setView('list') }}
      onCancel={() => setView('list')} />
  )
  if (view === 'edit' && editTarget) return (
    <AssignmentForm classId={classId} existing={editTarget}
      onSaved={() => { onChanged(); setView('list'); setEditTarget(null) }}
      onCancel={() => { setView('list'); setEditTarget(null) }} />
  )

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button className="btn-primary" onClick={() => setView('create')}>+ New assignment</button>
      </div>
      {assignments.length === 0 ? (
        <Empty icon="/assets/goose_with_books.svg" message="No assignments yet — create one above" />
      ) : (
        <div className="flex flex-col gap-4">
          {assignments.map(a => (
            <div key={a.id} className="card-doodle p-6">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h3 className="font-hand text-xl text-ink-900 mb-1">{a.title}</h3>
                  <p className="font-body text-sm text-sky-500 line-clamp-2">{a.question}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { setEditTarget(a); setView('edit') }}
                    className="font-hand text-sm px-3 py-1 rounded-full border-2 border-sky-200
                               text-sky-500 hover:border-sky-400 transition-colors">✏️ Edit</button>
                  <button onClick={() => deleteAssignment(a.id)}
                    className="font-hand text-sm text-apple-400 hover:text-apple-500 px-2">🗑 Delete</button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-sky-100">
                <span className="badge">📎 {a.resources?.length || 0} resources</span>
                <span className="badge">📋 {a.criteria?.length || 0} criteria</span>
                {a.images?.length > 0 && <span className="badge">🖼️ {a.images.length} images</span>}
                {a.mindmap && <span className="badge">🗺️ Notes</span>}
                <span className="font-hand text-xs text-sky-300 ml-auto">
                  {new Date(a.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Assignment form ───────────────────────────────────────────
function AssignmentForm({ classId, existing, onSaved, onCancel }) {
  const isEdit = !!existing
  const [form, setForm] = useState({
    title:    existing?.title    || '',
    question: existing?.question || '',
    mindmap:  existing?.mindmap  || '',
  })
  const [resources, setResources] = useState(existing?.resources || [])
  const [criteria,  setCriteria]  = useState(existing?.criteria  || [])
  const [images,    setImages]    = useState(existing?.images     || [])
  const [resInput,  setResInput]  = useState('')
  const [critInput, setCritInput] = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const dropRef = useState(null)
  const fileRef = { current: null }

  function compressImage(file) {
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = e => {
        const img = new Image()
        img.onload = () => {
          let { width, height } = img
          const MAX = 1200
          if (width > MAX || height > MAX) {
            const ratio = Math.min(MAX / width, MAX / height)
            width = Math.round(width * ratio); height = Math.round(height * ratio)
          }
          const canvas = document.createElement('canvas')
          canvas.width = width; canvas.height = height
          canvas.getContext('2d').drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.75))
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  function processFiles(files) {
    const remaining = 10 - images.length
    const toProcess = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, remaining)
    if (!toProcess.length) return
    Promise.all(toProcess.map(compressImage)).then(compressed => {
      setImages(prev => [...prev, ...compressed])
    })
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.question.trim()) { setError('Title and prompt are required'); return }
    setBusy(true); setError('')
    try {
      if (isEdit) {
        await api.put(`/assignments/${existing.id}`, { ...form, resources, criteria, images })
      } else {
        await api.post(`/classes/${classId}/assignments`, { ...form, resources, criteria, images })
      }
      onSaved()
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="font-hand text-sky-400 hover:text-sky-500 transition-colors">← Back</button>
        <h2 className="font-hand text-2xl text-ink-900">{isEdit ? '✏️ Edit Assignment' : '📢 New Assignment'}</h2>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 font-hand text-apple-500 text-sm mb-4">{error}</div>}

      <div className="card-doodle p-8 flex flex-col gap-6">
        <div>
          <label className="block font-hand text-sm uppercase tracking-widest text-ink-800 mb-1">Title</label>
          <input className="input-doodle" placeholder="e.g. Descriptive Writing"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label className="block font-hand text-sm uppercase tracking-widest text-ink-800 mb-1">Writing Prompt</label>
          <textarea className="input-doodle resize-none" rows={4} placeholder="What should students write about?"
            value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} />
        </div>

        {/* Resources */}
        <div>
          <label className="block font-hand text-sm uppercase tracking-widest text-ink-800 mb-2">
            🔗 Resources <span className="normal-case tracking-normal text-sky-400">(links or notes)</span>
          </label>
          {resources.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {resources.map((r, i) => (
                <span key={i} className="badge flex items-center gap-1">
                  📌 {r}
                  <button onClick={() => setResources(rs => rs.filter((_, j) => j !== i))}
                    className="ml-1 text-apple-400 font-bold hover:text-apple-500">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input className="input-doodle" placeholder="https://… or resource name"
              value={resInput} onChange={e => setResInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (resInput.trim() && (setResources(r => [...r, resInput.trim()]), setResInput('')))} />
            <button onClick={() => resInput.trim() && (setResources(r => [...r, resInput.trim()]), setResInput(''))}
              className="btn-secondary font-hand px-4 flex-shrink-0">+ Add</button>
          </div>
        </div>

        {/* Image upload */}
        <div>
          <label className="block font-hand text-sm uppercase tracking-widest text-ink-800 mb-2">🖼️ Resource Images</label>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); processFiles(e.dataTransfer.files) }}
            className="border-2 border-dashed border-sky-200 rounded-2xl p-8 text-center cursor-pointer hover:border-sky-400 hover:bg-sky-50 transition-colors">
            <div className="text-3xl mb-2">🖼️</div>
            <p className="font-hand text-base text-ink-800 font-semibold">Drop images here or click to upload</p>
            <p className="font-hand text-xs text-sky-400 mt-1">PNG, JPG, GIF, WebP — up to 10 images</p>
            <input type="file" accept="image/*" multiple className="hidden"
              ref={el => fileRef.current = el}
              onChange={e => processFiles(e.target.files)} />
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mt-3">
              {images.map((src, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border-2 border-sky-100">
                  <img src={src} alt={`img ${i+1}`} className="w-full h-20 object-cover" />
                  <button onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-apple-500 text-white text-xs
                               opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Criteria */}
        <div>
          <label className="block font-hand text-sm uppercase tracking-widest text-ink-800 mb-2">✅ Success Criteria</label>
          {criteria.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {criteria.map((c, i) => (
                <div key={i} className="flex items-center gap-2 bg-sky-50 rounded-xl px-4 py-2">
                  <span className="text-sky-400">◆</span>
                  <span className="font-body text-sm text-ink-800 flex-1">{c}</span>
                  <button onClick={() => setCriteria(cs => cs.filter((_, j) => j !== i))}
                    className="text-apple-400 hover:text-apple-500 text-xs font-bold">✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input className="input-doodle" placeholder="e.g. Clear introduction, vivid vocabulary…"
              value={critInput} onChange={e => setCritInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (critInput.trim() && (setCriteria(c => [...c, critInput.trim()]), setCritInput('')))} />
            <button onClick={() => critInput.trim() && (setCriteria(c => [...c, critInput.trim()]), setCritInput(''))}
              className="btn-secondary font-hand px-4 flex-shrink-0">+ Add</button>
          </div>
        </div>

        {/* Mindmap */}
        <div>
          <label className="block font-hand text-sm uppercase tracking-widest text-ink-800 mb-1">
            🗺️ Mindmap / Notes <span className="normal-case tracking-normal text-sky-400">(optional)</span>
          </label>
          <textarea className="input-doodle resize-none" rows={3}
            placeholder="Optional notes, vocabulary, or structure hints for students…"
            value={form.mindmap} onChange={e => setForm(f => ({ ...f, mindmap: e.target.value }))} />
        </div>

        <div className="flex gap-3 pt-2">
          <button className="btn-primary" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Saving…' : isEdit ? '💾 Save Changes' : '📢 Publish'}
          </button>
          <button className="btn-secondary font-hand" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Global Live page ──────────────────────────────────────────
// ── Helper: render text with new portion highlighted in green ──
function DiffedText({ oldText, newText }) {
  if (!newText) return <span className="text-sky-300 italic">Nothing written yet…</span>

  // Find common prefix length
  const minLen = Math.min(oldText.length, newText.length)
  let commonLen = 0
  while (commonLen < minLen && oldText[commonLen] === newText[commonLen]) {
    commonLen++
  }

  const unchanged = newText.slice(0, commonLen)
  const added     = newText.slice(commonLen)

  return (
    <>
      <span>{unchanged}</span>
      {added && (
        <span style={{
          backgroundColor: 'rgba(34,197,94,0.18)',
          color: '#15803d',
          borderRadius: '2px',
          padding: '0 1px',
        }}>
          {added}
        </span>
      )}
    </>
  )
}

function LivePage({ liveWork, assignments, classes, onPoll }) {
  const [activeKey,  setActiveKey]  = useState(null)
  const [snapshots,  setSnapshots]  = useState({}) // content at last "Check Progress"
  const [checking,   setChecking]   = useState(false)
  const [checkedAt,  setCheckedAt]  = useState(null)
  const entries = Object.values(liveWork)

  useEffect(() => {
    if (entries.length && (!activeKey || !liveWork[activeKey])) {
      setActiveKey(Object.keys(liveWork)[0])
    }
  }, [liveWork])

  async function checkProgress() {
    setChecking(true)
    try {
      // 1. Snapshot what's currently visible BEFORE fetching fresh data
      const newSnapshots = {}
      Object.keys(liveWork).forEach(key => {
        newSnapshots[key] = liveWork[key]?.content || ''
      })
      setSnapshots(newSnapshots)
      setCheckedAt(new Date())

      // 2. Now fetch fresh data — liveWork in parent will update via setState,
      //    triggering a re-render with new content diffed against the snapshots above
      if (onPoll) await onPoll(classes)
    } finally {
      setChecking(false)
    }
  }

  if (entries.length === 0) return (
    <div>
      <h1 className="page-title mb-2">⬤ Live Progress</h1>
      <p className="font-hand text-base text-sky-400 mb-8">Updates appear here as students write</p>
      <Empty icon="/assets/live_progress.svg" message="No students are writing right now" />
    </div>
  )

  const active      = activeKey ? liveWork[activeKey] : entries[0]
  const activeSnap  = activeKey ? (snapshots[activeKey] ?? null) : null
  const wordCount   = (active?.content || '').trim().split(/\s+/).filter(Boolean).length
  const charCount   = (active?.content || '').length

  // Count how many students have new text since last check
  const newWriters = entries.filter(w => {
    const key  = `${w.student_name}_${w.assignment_id}`
    const snap = snapshots[key]
    return snap !== undefined && (w.content || '') !== snap
  }).length

  return (
    <div>
      <h1 className="page-title mb-2">⬤ Live Progress</h1>

      {/* Header row: subtitle + check button */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <p className="font-hand text-base text-sky-400">
          {entries.length} student{entries.length !== 1 ? 's' : ''} writing now — click a name to view their work
        </p>
        <div className="flex items-center gap-3">
          {checkedAt && newWriters > 0 && (
            <span className="font-hand text-sm text-green-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              {newWriters} student{newWriters !== 1 ? 's' : ''} added new text
            </span>
          )}
          {checkedAt && (
            <span className="font-hand text-xs text-sky-300">
              Last checked {checkedAt.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={checkProgress}
            disabled={checking}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
            {checking ? (
              <>
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                Checking…
              </>
            ) : (
              <>✦ Check New Progress</>
            )}
          </button>
        </div>
      </div>

      {/* Student tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {entries.map(w => {
          const key      = `${w.student_name}_${w.assignment_id}`
          const wc       = (w.content || '').trim().split(/\s+/).filter(Boolean).length
          const isActive = key === activeKey
          const hasNew   = snapshots[key] !== undefined && (w.content || '') !== snapshots[key]
          return (
            <button key={key} onClick={() => setActiveKey(key)}
              className={`font-hand text-base px-4 py-1.5 rounded-full border-2 transition-colors flex items-center gap-2
                ${isActive ? 'bg-sky-400 text-white border-sky-400' : 'border-sky-200 text-ink-800 hover:border-sky-400'}`}>
              <span className={`w-2 h-2 rounded-full inline-block ${hasNew ? 'bg-green-400' : 'bg-sky-300'}`} />
              {w.student_name}
              <span className={`text-xs ${isActive ? 'text-sky-100' : 'text-sky-400'}`}>{wc}w</span>
              {hasNew && (
                <span className={`text-xs font-hand px-1.5 py-0.5 rounded-full
                  ${isActive ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
                  new
                </span>
              )}
            </button>
          )
        })}
      </div>

      {active && (
        <div className="card-doodle p-6">
          <div className="flex justify-between items-center mb-3">
            <span className="font-hand text-xl text-ink-900 flex items-center gap-2">
              <img src="/assets/student.svg" alt="" className="w-5 h-5 object-contain" />
              {active.student_name}
            </span>
            <span className="font-hand text-xs text-sky-300">
              Updated {new Date(active.last_updated).toLocaleTimeString()}
            </span>
          </div>

          {/* Legend — only show after a check has been done */}
          {activeSnap !== null && (
            <div className="flex items-center gap-4 mb-3">
              <span className="font-hand text-xs text-sky-400 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-sky-50 border border-sky-200" />
                Written before
              </span>
              <span className="font-hand text-xs text-green-700 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{backgroundColor:'rgba(34,197,94,0.25)'}} />
                Added since last check
              </span>
            </div>
          )}

          <div className="bg-sky-50 rounded-xl px-5 py-4 font-serif text-sm text-ink-800 leading-relaxed
                          whitespace-pre-wrap min-h-[120px]"
               style={{ backgroundImage: 'repeating-linear-gradient(transparent,transparent 27px,rgba(46,157,209,0.08) 28px)' }}>
            {activeSnap !== null
              ? <DiffedText oldText={activeSnap} newText={active.content || ''} />
              : (active.content || <span className="text-sky-300 italic">Nothing written yet…</span>)
            }
          </div>

          <p className="font-hand text-xs text-sky-400 mt-2">
            {wordCount} word{wordCount !== 1 ? 's' : ''} · {charCount} character{charCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Live tab (inside class) ───────────────────────────────────
function LiveTab({ liveWork, assignments, classes, onPoll }) {
  return <LivePage liveWork={liveWork} assignments={assignments} classes={classes} onPoll={onPoll} />
}

// ── Global Submissions page ───────────────────────────────────
function SubmissionsPage({ submissions, assignments }) {
  return (
    <div>
      <h1 className="page-title mb-2">Submissions</h1>
      <p className="font-hand text-base text-sky-400 mb-8">
        {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
      </p>
      <SubmissionsTab submissions={submissions} assignments={assignments} />
    </div>
  )
}

// ── Submissions tab ───────────────────────────────────────────
function SubmissionsTab({ submissions, assignments }) {
  const [open, setOpen]           = useState(null)
  const [openGroup, setOpenGroup] = useState(null)

  useEffect(() => {
    const ids = [...new Set(submissions.map(s => s.assignment_id))]
    if (ids.length) setOpenGroup(ids[0])
  }, [submissions])

  if (submissions.length === 0) return <Empty icon="/assets/submissions.svg" message="No submissions yet" />

  const groups = {}
  submissions.forEach(s => {
    if (!groups[s.assignment_id]) groups[s.assignment_id] = []
    groups[s.assignment_id].push(s)
  })

  return (
    <div>
      <div className="flex flex-col gap-3">
        {Object.entries(groups).map(([aid, groupSubs]) => {
          const a = assignments.find(x => x.id === +aid)
          return (
            <div key={aid} className="card-doodle overflow-hidden">
              <button onClick={() => setOpenGroup(og => og === +aid ? null : +aid)}
                className="w-full flex justify-between items-center px-6 py-4 hover:bg-sky-50 transition-colors">
                <span className="font-hand text-lg text-ink-900">📄 {a?.title || `Assignment #${aid}`}</span>
                <div className="flex items-center gap-3">
                  <span className="badge">{groupSubs.length} submission{groupSubs.length !== 1 ? 's' : ''}</span>
                  <span className={`text-sky-400 transition-transform ${openGroup === +aid ? 'rotate-90' : ''}`}>▶</span>
                </div>
              </button>
              {openGroup === +aid && (
                <div className="border-t border-sky-100">
                  {groupSubs.map((s, i) => {
                    const wc = String(s.content || '').trim().split(/\s+/).filter(Boolean).length
                    return (
                      <button key={i} onClick={() => setOpen(s)}
                        className="w-full flex justify-between items-center px-6 py-3 hover:bg-sky-50
                                   transition-colors border-b border-sky-50 last:border-0 text-left">
                        <span className="font-hand text-base text-ink-800 flex items-center gap-2">
                          <img src="/assets/student.svg" alt="" className="w-4 h-4 object-contain" />
                          {s.student_name}
                          <span className="font-hand text-xs text-sky-400">{wc} words</span>
                        </span>
                        <span className="font-hand text-xs text-sky-300">{new Date(s.submitted_at).toLocaleString()}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {open && (
        <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
             onClick={e => e.target === e.currentTarget && setOpen(null)}>
          <div className="card-doodle w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start p-8 pb-4 border-b border-sky-100">
              <div>
                <h3 className="font-hand text-2xl text-ink-900">{open.student_name}</h3>
                <p className="font-hand text-sm text-sky-400 mt-1">Submitted {new Date(open.submitted_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setOpen(null)}
                className="w-9 h-9 rounded-full bg-sky-50 border-2 border-sky-200 flex items-center justify-center
                           font-hand text-lg text-sky-400 hover:border-apple-400 hover:text-apple-400 transition-colors">✕</button>
            </div>
            <div className="overflow-y-auto p-8">
              <pre className="font-serif text-sm text-ink-800 leading-relaxed whitespace-pre-wrap">{open.content}</pre>
              <p className="font-hand text-xs text-sky-300 mt-4 pt-4 border-t border-sky-100">
                {String(open.content||'').trim().split(/\s+/).filter(Boolean).length} words · {String(open.content||'').length} characters
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="card-doodle w-full max-w-sm p-8 text-center">
        <p className="font-hand text-xl text-ink-900 mb-2">{message}</p>
        <p className="font-hand text-sm text-sky-400 mb-6">This cannot be undone.</p>
        <div className="flex gap-3 justify-center">
          <button className="btn-danger" onClick={onConfirm}>Yes, delete</button>
          <button className="btn-secondary font-hand" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function Empty({ icon, message }) {
  return (
    <div className="card-doodle p-16 text-center">
      <img src={icon} alt="" className="w-24 mx-auto mb-4 opacity-60" />
      <p className="font-hand text-xl text-sky-400">{message}</p>
    </div>
  )
}