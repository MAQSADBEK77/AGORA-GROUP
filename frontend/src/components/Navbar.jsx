import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Sun, Moon, User, Bell, AlertTriangle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTheme } from '../context/ThemeContext'
import ProfileModal from './ProfileModal'
import api from '../api/axios'

const ROLE_LABELS = { admin: 'Administrator', hamshira: 'Hamshira', radiolog: 'Radiolog' }
const ROLE_COLORS = {
  admin:    'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  hamshira: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  radiolog: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
}

export default function Navbar() {
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const [user, setUser]         = useState(() => JSON.parse(localStorage.getItem('user') || '{}'))
  const [showProfile, setShowProfile] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const isDoctor = ['radiolog', 'admin'].includes(user.role)
  const bellRef = useRef(null)

  // Notification polling — 20 soniyada bir tekshiradi
  useEffect(() => {
    if (!isDoctor) return
    let prev = 0

    const check = async () => {
      try {
        const [{ data: stats }, { data: notifs }] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/notifications?limit=10'),
        ])
        const cnt = stats.pending_count || 0
        if (cnt > prev && prev !== 0) {
          toast(`🔔 ${cnt - prev} ta yangi mammografiya yuklandi!`, {
            duration: 5000,
            icon: '🩻',
            style: { background: '#1e40af', color: '#fff', fontWeight: 600 },
          })
        }
        prev = cnt
        setPendingCount(cnt)
        setNotifications(notifs)
      } catch {}
    }

    check()
    const id = setInterval(check, 20000)
    return () => clearInterval(id)
  }, [isDoctor])

  // Tashqarida bosilsa bildirishnoma panelini yopish
  useEffect(() => {
    if (!showNotifications) return
    const onClickOutside = e => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowNotifications(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showNotifications])

  function goToNotification(n) {
    setShowNotifications(false)
    navigate(`/review/${n.image_id}`)
  }

  function timeAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'hozirgina'
    if (mins < 60) return `${mins} daq. oldin`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} soat oldin`
    return `${Math.floor(hrs / 24)} kun oldin`
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    toast.success('Tizimdan chiqildi')
    navigate('/login')
  }

  function onProfileUpdated(updated) {
    setUser(updated)
  }

  return (
    <>
      <header className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-6 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
            Mammografiya AI Tizimi
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500">Ko'krak saraton erta aniqlash</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification bell */}
          {isDoctor && (
            <div className="relative" ref={bellRef}>
              <button onClick={() => setShowNotifications(s => !s)}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl
                           bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all">
                <Bell size={16} className="text-gray-600 dark:text-slate-300" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white
                                   text-xs font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-11 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-800
                                border border-gray-100 dark:border-slate-700 rounded-2xl shadow-2xl z-50 animate-slide-up">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-white">Bildirishnomalar</h4>
                    {pendingCount > 0 && <span className="badge-pending text-xs">{pendingCount} ta kutmoqda</span>}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Bell size={26} className="text-gray-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-gray-400 dark:text-slate-500">Yangi bildirishnoma yo'q</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                      {notifications.map(n => (
                        <button key={n.image_id} onClick={() => goToNotification(n)}
                          className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            n.urgent ? 'bg-red-100 dark:bg-red-900/40' : 'bg-blue-100 dark:bg-blue-900/40'
                          }`}>
                            {n.urgent
                              ? <AlertTriangle size={14} className="text-red-600 dark:text-red-400" />
                              : <Clock size={14} className="text-blue-600 dark:text-blue-400" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
                              {n.patient_name || `Bemor #${n.patient_id}`}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">
                              {n.urgent ? n.reason : 'Yangi yuklandi'} • {timeAgo(n.uploaded_at)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setShowNotifications(false); navigate('/review') }}
                    className="w-full text-center text-sm text-blue-600 dark:text-blue-400 py-2.5 hover:underline font-medium border-t border-gray-100 dark:border-slate-700">
                    Barchasini ko'rish →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Dark mode */}
          <button onClick={toggle}
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all">
            {dark
              ? <Sun size={16} className="text-amber-400" />
              : <Moon size={16} className="text-slate-600" />}
          </button>

          {/* User info — click to open profile */}
          <button onClick={() => setShowProfile(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl
                       hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <User size={15} className="text-white" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 leading-none mb-0.5">
                {user.full_name}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] || ''}`}>
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
          </button>

          {/* Logout */}
          <button onClick={logout}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400
                       hover:text-red-500 dark:hover:text-red-400 transition-colors px-2 py-1.5 rounded-lg
                       hover:bg-red-50 dark:hover:bg-red-900/20">
            <LogOut size={16} />
            <span className="hidden sm:inline">Chiqish</span>
          </button>
        </div>
      </header>

      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onUpdated={onProfileUpdated}
        />
      )}
    </>
  )
}
