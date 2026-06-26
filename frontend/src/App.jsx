import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import Landing          from './pages/Landing'
import TeacherLogin     from './pages/TeacherLogin'
import TeacherRegister  from './pages/TeacherRegister'
import StudentJoin      from './pages/StudentJoin'
import TeacherApp       from './pages/TeacherApp'
import StudentClassroom from './pages/StudentClassroom'

function RequireTeacher({ children }) {
  const { user, role, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user || role !== 'teacher') return <Navigate to="/" replace />
  return children
}

function RequireStudent({ children }) {
  const { user, role, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user || role !== 'student') return <Navigate to="/join" replace />
  return children
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-400 rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/"         element={<Landing />} />
        <Route path="/login"    element={<TeacherLogin />} />
        <Route path="/register" element={<TeacherRegister />} />
        <Route path="/join"     element={<StudentJoin />} />

        {/* Teacher — single shell, no sub-routes needed */}
        <Route path="/dashboard" element={<RequireTeacher><TeacherApp /></RequireTeacher>} />
        <Route path="/class/*"   element={<Navigate to="/dashboard" replace />} />

        {/* Student */}
        <Route path="/classroom" element={<RequireStudent><StudentClassroom /></RequireStudent>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}