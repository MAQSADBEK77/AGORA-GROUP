import { useEffect, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const INACTIVITY_LIMIT_MS = 20 * 60 * 1000 // 20 daqiqa harakatsizlikdan keyin — PHI xavfsizligi

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')
  const navigate = useNavigate()
  const timerRef = useRef(null)

  useEffect(() => {
    if (!token) return

    function logout() {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      toast.error('Harakatsizlik sababli tizimdan chiqarildingiz')
      navigate('/login')
    }
    function resetTimer() {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(logout, INACTIVITY_LIMIT_MS)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      clearTimeout(timerRef.current)
      events.forEach(ev => window.removeEventListener(ev, resetTimer))
    }
  }, [token, navigate])

  if (!token) return <Navigate to="/login" replace />
  return children
}
