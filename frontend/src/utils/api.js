import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Attach stored token to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('cw_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// On 401, clear token and redirect to /
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cw_token')
      localStorage.removeItem('cw_user')
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

export default api