import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function TopBar({ title }) {
  const { user, role, cls, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b-2 border-sky-200 px-8 h-[70px] flex items-center justify-between"
            style={{ boxShadow: 'none' }}>
      {/* Squiggly bottom border */}
      <style>{`
        header::after {
          content: '';
          position: absolute;
          bottom: -6px; left: 0; right: 0; height: 6px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='6'%3E%3Cpath d='M0 3 Q5 0 10 3 Q15 6 20 3 Q25 0 30 3 Q35 6 40 3' fill='none' stroke='%232e9dd1' stroke-width='1.5'/%3E%3C/svg%3E");
          background-repeat: repeat-x;
          background-size: 40px 6px;
        }
      `}</style>

      {/* Logo */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(role === 'teacher' ? '/dashboard' : '/classroom')}>
        <img src="/assets/ABC.png" alt="" className="h-8 w-auto opacity-85" />
        <span className="font-hand text-3xl">
          Class<span className="text-sky-400">Write</span>
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* User badge */}
        <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-[999px] px-4 py-1.5">
          <img
            src={role === 'teacher' ? '/assets/teacher.svg' : '/assets/student.svg'}
            alt="" className="w-8 h-8 object-contain mx-1" />
          <span className="font-hand text-base text-ink-800">
            {user?.name}
            {role === 'student' && cls && <span className="text-sky-400 ml-2">· {cls.name}</span>}
          </span>
        </div>

        {/* Sign out */}
        <button onClick={handleLogout}
          className="font-hand text-base px-4 py-1.5 rounded-[999px] border-2 border-sky-200
                     text-ink-800 bg-transparent hover:border-apple-500 hover:text-apple-500 transition-colors">
          Sign out
        </button>
      </div>
    </header>
  )
}