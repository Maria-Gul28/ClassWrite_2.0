import { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [role,    setRole]    = useState(null)
  const [cls,     setCls]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token      = localStorage.getItem('cw_token')
    const stored     = localStorage.getItem('cw_user')
    const storedRole = localStorage.getItem('cw_role')
    const storedCls  = localStorage.getItem('cw_class')
    if (token && stored) {
      setUser(JSON.parse(stored))
      setRole(storedRole)
      if (storedCls) setCls(JSON.parse(storedCls))
    }
    setLoading(false)
  }, [])

  // ── Teacher auth ──
  async function teacherRegister(name, email, password) {
    const res = await api.post('/auth/register', { name, email, password })
    _saveTeacher(res.data)
    return res.data
  }

  async function teacherLogin(email, password) {
    const res = await api.post('/auth/login', { email, password })
    _saveTeacher(res.data)
    return res.data
  }

  function _saveTeacher({ token, teacher }) {
    localStorage.setItem('cw_token', token)
    localStorage.setItem('cw_user',  JSON.stringify(teacher))
    localStorage.setItem('cw_role',  'teacher')
    localStorage.removeItem('cw_class')
    setUser(teacher)
    setRole('teacher')
    setCls(null)
  }

  // ── Student auth — now includes PIN ──
  async function studentJoin(name, class_code, pin) {
    const res = await api.post('/auth/join', { name, class_code, pin })
    const { token, student, class: classObj, is_returning } = res.data
    localStorage.setItem('cw_token', token)
    localStorage.setItem('cw_user',  JSON.stringify(student))
    localStorage.setItem('cw_role',  'student')
    localStorage.setItem('cw_class', JSON.stringify(classObj))
    setUser(student)
    setRole('student')
    setCls(classObj)
    return { is_returning }
  }

  function logout() {
    localStorage.removeItem('cw_token')
    localStorage.removeItem('cw_user')
    localStorage.removeItem('cw_role')
    localStorage.removeItem('cw_class')
    setUser(null)
    setRole(null)
    setCls(null)
  }

  return (
    <AuthContext.Provider value={{ user, role, cls, loading, teacherRegister, teacherLogin, studentJoin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}