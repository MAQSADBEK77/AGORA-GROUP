import { useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_LABELS = { admin: 'Administrator', hamshira: 'Hamshira', radiolog: 'Radiolog' }

export default function Navbar() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    toast.success('Tizimdan chiqildi')
    navigate('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <h2 className="text-base font-semibold text-gray-700">
        Mammografiya AI Tizimi
      </h2>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <User size={16} className="text-gray-400" />
          <span className="font-medium text-gray-700">{user.full_name}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {ROLE_LABELS[user.role] || user.role}
          </span>
        </div>
        <button onClick={logout}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors">
          <LogOut size={16} />
          Chiqish
        </button>
      </div>
    </header>
  )
}
