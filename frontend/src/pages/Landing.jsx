import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect } from 'react'

export default function Landing() {
  const { user, role } = useAuth()
  const navigate = useNavigate()

  // Already logged in → redirect
  useEffect(() => {
    if (user && role === 'teacher') navigate('/dashboard')
    if (user && role === 'student') navigate('/classroom')
  }, [user, role])

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden relative">

      {/* Corner decorations */}
      <img src="/assets/books2.png" alt=""
        className="absolute -top-4 -left-4 w-44 opacity-50 pointer-events-none"
        style={{ transform: 'rotate(-12deg)' }} />
      <img src="/assets/books1.png" alt=""
        className="absolute -bottom-4 -right-4 w-44 opacity-50 pointer-events-none"
        style={{ transform: 'rotate(10deg)' }} />
      <img src="/assets/ABC.png" alt=""
        className="absolute top-6 right-8 w-28 opacity-35 pointer-events-none"
        style={{ transform: 'rotate(8deg)' }} />

      {/* Card */}
      <div className="card-doodle relative z-10 w-[90%] max-w-md px-16 py-14 text-center"
           style={{ border: '3px solid #2e9dd1', boxShadow: '4px 5px 0 #2e9dd1, 8px 9px 0 rgba(46,157,209,0.18)' }}>

        <img src="/assets/books2.png" alt="" className="w-20 mx-auto mb-4 opacity-90" />

        <h1 className="font-hand text-5xl mb-1">
          Class<span className="text-sky-400">Write</span>
        </h1>
        <p className="font-hand text-sm text-sky-500 tracking-widest uppercase mb-10">
          Collaborative Writing Studio
        </p>
        <p className="font-hand text-xl text-ink-800 mb-7">Who are you joining as?</p>

        <div className="flex gap-5 justify-center">
          {/* Teacher card */}
          <button onClick={() => navigate('/login')}
            className="flex-1 rounded-[6%_10%_8%_12%/10%_8%_12%_6%] border-[2.5px] border-sky-200
                       bg-sky-50 p-6 cursor-pointer transition-all duration-200 text-center
                       hover:-translate-y-1 hover:border-apple-500 hover:bg-white"
            style={{ fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '4px 6px 0 #d63b3b'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <img src="/assets/teacher.svg" alt="Teacher" className="w-28 h-28 mx-auto mb-3 object-contain" />
            <span className="block font-hand text-xl font-semibold text-ink-900">Teacher</span>
            <span className="block font-hand text-base text-sky-500 mt-1">Create &amp; monitor</span>
          </button>

          {/* Student card */}
          <button onClick={() => navigate('/join')}
            className="flex-1 rounded-[6%_10%_8%_12%/10%_8%_12%_6%] border-[2.5px] border-sky-200
                       bg-sky-50 p-6 cursor-pointer transition-all duration-200 text-center
                       hover:-translate-y-1 hover:border-sky-400 hover:bg-white"
            style={{ fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '4px 6px 0 #2e9dd1'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <img src="/assets/student.svg" alt="Student" className="w-28 h-28 mx-auto mb-3 object-contain" />
            <span className="block font-hand text-xl font-semibold text-ink-900">Student</span>
            <span className="block font-hand text-base text-sky-500 mt-1">Write &amp; submit</span>
          </button>
        </div>
      </div>
    </div>
  )
}