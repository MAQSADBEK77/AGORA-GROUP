import { useNavigate } from 'react-router-dom'
import { LogOut, Sun, Moon, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTheme } from '../context/ThemeContext'

const ROLE_LABELS = { admin: 'Administrator', hamshira: 'Hamshira', radiolog: 'Radiolog' }
const ROLE_COLORS = {
  admin:    'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  hamshira: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  radiolog: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
}

export default function Navbar() {
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    toast.success('Tizimdan chiqildi')
    navigate('/login')
  }

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex flex-col">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
            Mammografiya AI Tizimi
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500">Ko'krak saraton erta aniqlash</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Dark mode toggle */}
        <button onClick={toggle}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-700
                     hover:bg-gray-200 dark:hover:bg-slate-600 transition-all duration-200">
          {dark
            ? <Sun size={16} className="text-amber-400" />
            : <Moon size={16} className="text-slate-600" />}
        </button>

        {/* User info */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <User size={15} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 leading-none mb-0.5">
              {user.full_name}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] || ''}`}>
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>
        </div>

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
  )
}
