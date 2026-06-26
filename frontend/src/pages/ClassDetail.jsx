import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import api from '../utils/api'

const TABS = ['assignments', 'live', 'submissions']

export default function ClassDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cls, setCls] = useState(null)
  const [tab, setTab] = useState('assignments')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/classes/${id}`)
      .then(r => setCls(r.data))
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="min-h-screen">
      <TopBar />
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-400 rounded-full animate-spin" />
      </div>
    </div>
  )

  if (!cls) return null

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <button onClick={() => navigate('/dashboard')}
          className="font-hand text-sky-400 text-base mb-4 hover:text-sky-500 transition-colors">
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
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`font-hand text-lg px-4 py-1.5 rounded-t-xl capitalize transition-colors
                ${tab === t ? 'bg-sky-400 text-white' : 'text-sky-400 hover:text-sky-500 hover:bg-sky-50'}`}>
              {t === 'live' ? '⬤ Live' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'assignments' && <AssignmentsTab classId={id} teacherId={cls.teacher_id} />}
        {tab === 'live'        && <LiveTab classId={id} />}
        {tab === 'submissions' && <SubmissionsTab classId={id} />}
      </main>
    </div>
  )
}

// ── Assignments tab ──────────────────────────────────────────
function AssignmentsTab({ classId }) {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'create' | 'edit'
  const [editTarget, setEditTarget] = useState(null)

  useEffect(() => { load() }, [classId])

  async function load() {
    const res = await api.get(`/classes/${classId}/assignments`)
    setAssignments(res.data)
    setLoading(false)
  }

  async function deleteAssignment(id) {
    if (!confirm('Delete this assignment? Students will lose access.')) return
    await api.delete(`/assignments/${id}`)
    setAssignments(a => a.filter(x => x.id !== id))
  }

  function onSaved(saved, isEdit) {
    if (isEdit) {
      setAssignments(a => a.map(x => x.id === saved.id ? saved : x))
    } else {
      setAssignments(a => [saved, ...a])
    }
    setView('list')
    setEditTarget(null)
  }

  if (loading) return <Loader />

  if (view === 'create') return (
    <AssignmentForm
      classId={classId}
      onSaved={s => onSaved(s, false)}
      onCancel={() => setView('list')}
    />
  )

  if (view === 'edit' && editTarget) return (
    <AssignmentForm
      classId={classId}
      existing={editTarget}
      onSaved={s => onSaved(s, true)}
      onCancel={() => { setView('list'); setEditTarget(null) }}
    />
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
                               text-sky-500 hover:border-sky-400 transition-colors">
                    ✏️ Edit
                  </button>
                  <button onClick={() => deleteAssignment(a.id)}
                    className="font-hand text-sm text-apple-400 hover:text-apple-500 transition-colors px-2">
                    🗑 Delete
                  </button>
                </div>
              </div>
              {/* Meta badges */}
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

// ── Assignment Form (create + edit) ─────────────────────────
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dropRef = useRef()
  const fileRef = useRef()

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
            width  = Math.round(width * ratio)
            height = Math.round(height * ratio)
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

  function addResource() {
    const v = resInput.trim()
    if (v) { setResources(r => [...r, v]); setResInput('') }
  }

  function addCriteria() {
    const v = critInput.trim()
    if (v) { setCriteria(c => [...c, v]); setCritInput('') }
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.question.trim()) {
      setError('Title and prompt are required'); return
    }
    setBusy(true); setError('')
    try {
      let res
      if (isEdit) {
        res = await api.put(`/assignments/${existing.id}`, { ...form, resources, criteria, images })
      } else {
        res = await api.post(`/classes/${classId}/assignments`, { ...form, resources, criteria, images })
      }
      onSaved(res.data)
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="font-hand text-sky-400 hover:text-sky-500 transition-colors">
          ← Back
        </button>
        <h2 className="font-hand text-2xl text-ink-900">
          {isEdit ? '✏️ Edit Assignment' : '📢 New Assignment'}
        </h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 font-hand text-apple-500 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="card-doodle p-8 flex flex-col gap-6">

        {/* Title */}
        <div>
          <label className="block font-hand text-sm uppercase tracking-widest text-ink-800 mb-1">Title</label>
          <input className="input-doodle" placeholder="e.g. Descriptive Writing"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>

        {/* Prompt */}
        <div>
          <label className="block font-hand text-sm uppercase tracking-widest text-ink-800 mb-1">Writing Prompt</label>
          <textarea className="input-doodle resize-none" rows={4}
            placeholder="What should students write about?"
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
                    className="ml-1 text-apple-400 hover:text-apple-500 font-bold">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input className="input-doodle" placeholder="https://… or resource name"
              value={resInput} onChange={e => setResInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addResource()} />
            <button onClick={addResource}
              className="btn-secondary px-4 flex-shrink-0 font-hand">+ Add</button>
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <label className="block font-hand text-sm uppercase tracking-widest text-ink-800 mb-2">
            🖼️ Resource Images
          </label>
          <div
            ref={dropRef}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); dropRef.current?.classList.add('border-sky-400') }}
            onDragLeave={() => dropRef.current?.classList.remove('border-sky-400')}
            onDrop={e => { e.preventDefault(); dropRef.current?.classList.remove('border-sky-400'); processFiles(e.dataTransfer.files) }}
            className="border-2 border-dashed border-sky-200 rounded-2xl p-8 text-center cursor-pointer
                       hover:border-sky-400 hover:bg-sky-50 transition-colors">
            <div className="text-3xl mb-2">🖼️</div>
            <p className="font-hand text-base text-ink-800 font-semibold">Drop images here or click to upload</p>
            <p className="font-hand text-xs text-sky-400 mt-1">PNG, JPG, GIF, WebP — up to 10 images</p>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => processFiles(e.target.files)} />
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mt-3">
              {images.map((src, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border-2 border-sky-100">
                  <img src={src} alt={`img ${i+1}`} className="w-full h-20 object-cover" />
                  <button onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-apple-500 text-white text-xs
                               opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Criteria */}
        <div>
          <label className="block font-hand text-sm uppercase tracking-widest text-ink-800 mb-2">
            ✅ Success Criteria
          </label>
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
              onKeyDown={e => e.key === 'Enter' && addCriteria()} />
            <button onClick={addCriteria}
              className="btn-secondary px-4 flex-shrink-0 font-hand">+ Add</button>
          </div>
        </div>

        {/* Mindmap / Notes */}
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

// ── Live tab ─────────────────────────────────────────────────
function LiveTab({ classId }) {
  const [work, setWork] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeKey, setActiveKey] = useState(null)

  useEffect(() => {
    api.get(`/classes/${classId}/live`).then(r => {
      setWork(r.data)
      const keys = Object.keys(r.data)
      if (keys.length) setActiveKey(keys[0])
    }).finally(() => setLoading(false))

    const interval = setInterval(() => {
      api.get(`/classes/${classId}/live`).then(r => {
        setWork(r.data)
        setActiveKey(prev => {
          const keys = Object.keys(r.data)
          if (!prev || !r.data[prev]) return keys[0] || null
          return prev
        })
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [classId])

  if (loading) return <Loader />

  const entries = Object.values(work)

  if (entries.length === 0) return (
    <div>
      <p className="font-hand text-base text-sky-400 mb-5">Auto-refreshes every 5 seconds</p>
      <Empty icon="/assets/live_progress.svg" message="No students are writing right now" />
    </div>
  )

  const active = activeKey ? work[activeKey] : entries[0]
  const wordCount = (active?.content || '').trim().split(/\s+/).filter(Boolean).length
  const charCount = (active?.content || '').length

  return (
    <div>
      <p className="font-hand text-base text-sky-400 mb-4">
        Auto-refreshes every 5 seconds · {entries.length} student{entries.length !== 1 ? 's' : ''} writing now
      </p>

      {/* Student tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {entries.map(w => {
          const key = `${w.student_name}_${w.assignment_id}`
          const wc  = (w.content || '').trim().split(/\s+/).filter(Boolean).length
          const isActive = key === activeKey || (!activeKey && w === entries[0])
          return (
            <button key={key} onClick={() => setActiveKey(key)}
              className={`font-hand text-base px-4 py-1.5 rounded-full border-2 transition-colors flex items-center gap-2
                ${isActive
                  ? 'bg-sky-400 text-white border-sky-400'
                  : 'border-sky-200 text-ink-800 hover:border-sky-400'}`}>
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              {w.student_name}
              <span className={`text-xs ${isActive ? 'text-sky-100' : 'text-sky-400'}`}>{wc}w</span>
            </button>
          )
        })}
      </div>

      {/* Active student preview */}
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
          <div className="bg-sky-50 rounded-xl px-5 py-4 font-serif text-sm text-ink-800 leading-relaxed
                          whitespace-pre-wrap min-h-[120px]"
               style={{ backgroundImage: 'repeating-linear-gradient(transparent,transparent 27px,rgba(46,157,209,0.08) 28px)' }}>
            {active.content || <span className="text-sky-300 italic">Nothing written yet…</span>}
          </div>
          <p className="font-hand text-xs text-sky-400 mt-2">
            {wordCount} word{wordCount !== 1 ? 's' : ''} · {charCount} character{charCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Submissions tab ───────────────────────────────────────────
function SubmissionsTab({ classId }) {
  const [subs, setSubs]   = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen]   = useState(null)
  const [openGroup, setOpenGroup] = useState(null)

  useEffect(() => {
    api.get(`/classes/${classId}/submissions`)
      .then(r => {
        setSubs(r.data)
        // open first group by default
        const ids = [...new Set(r.data.map(s => s.assignment_id))]
        if (ids.length) setOpenGroup(ids[0])
      })
      .finally(() => setLoading(false))
  }, [classId])

  if (loading) return <Loader />
  if (subs.length === 0) return <Empty icon="/assets/submissions.svg" message="No submissions yet" />

  // Group by assignment
  const groups = {}
  subs.forEach(s => {
    if (!groups[s.assignment_id]) groups[s.assignment_id] = []
    groups[s.assignment_id].push(s)
  })

  return (
    <div>
      <p className="font-hand text-base text-sky-400 mb-5">
        {subs.length} submission{subs.length !== 1 ? 's' : ''} — click an assignment to expand, then a name to read
      </p>

      <div className="flex flex-col gap-3">
        {Object.entries(groups).map(([aid, groupSubs]) => (
          <div key={aid} className="card-doodle overflow-hidden">
            {/* Group header */}
            <button
              onClick={() => setOpenGroup(og => og === +aid ? null : +aid)}
              className="w-full flex justify-between items-center px-6 py-4 hover:bg-sky-50 transition-colors">
              <span className="font-hand text-lg text-ink-900">
                📄 Assignment #{aid}
              </span>
              <div className="flex items-center gap-3">
                <span className="badge">{groupSubs.length} submission{groupSubs.length !== 1 ? 's' : ''}</span>
                <span className={`text-sky-400 transition-transform ${openGroup === +aid ? 'rotate-90' : ''}`}>▶</span>
              </div>
            </button>

            {/* Student rows */}
            {openGroup === +aid && (
              <div className="border-t border-sky-100">
                {groupSubs.map((s, i) => {
                  const wc = (s.content || '').trim().split(/\s+/).filter(Boolean).length
                  return (
                    <button key={i} onClick={() => setOpen(s)}
                      className="w-full flex justify-between items-center px-6 py-3 hover:bg-sky-50
                                 transition-colors border-b border-sky-50 last:border-0 text-left">
                      <span className="font-hand text-base text-ink-800 flex items-center gap-2">
                        <img src="/assets/student.svg" alt="" className="w-4 h-4 object-contain" />
                        {s.student_name}
                        <span className="font-hand text-xs text-sky-400">{wc} words</span>
                      </span>
                      <span className="font-hand text-xs text-sky-300">
                        {new Date(s.submitted_at).toLocaleString()}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Submission modal */}
      {open && (
        <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
             onClick={e => e.target === e.currentTarget && setOpen(null)}>
          <div className="card-doodle w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start p-8 pb-4 border-b border-sky-100">
              <div>
                <h3 className="font-hand text-2xl text-ink-900">{open.student_name}</h3>
                <p className="font-hand text-sm text-sky-400 mt-1">
                  Submitted {new Date(open.submitted_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setOpen(null)}
                className="w-9 h-9 rounded-full bg-sky-50 border-2 border-sky-200 flex items-center justify-center
                           font-hand text-lg text-sky-400 hover:border-apple-400 hover:text-apple-400 transition-colors">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-8">
              <pre className="font-serif text-sm text-ink-800 leading-relaxed whitespace-pre-wrap">
                {open.content}
              </pre>
              <p className="font-hand text-xs text-sky-300 mt-4 pt-4 border-t border-sky-100">
                {(open.content || '').trim().split(/\s+/).filter(Boolean).length} words ·{' '}
                {(open.content || '').length} characters
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Loader() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-400 rounded-full animate-spin" />
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