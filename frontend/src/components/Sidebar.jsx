import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Upload, History, ShieldCheck, Activity } from 'lucide-react'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload',    icon: Upload,          label: 'Rasm Yuklash' },
  { to: '/history',   icon: History,         label: 'Bemor Tarixi' },
  { to: '/admin',     icon: ShieldCheck,     label: 'Admin Panel', adminOnly: true },
]

export default function Sidebar() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Activity className="text-blue-600" size={24} />
          <div>
            <h1 className="text-lg font-bold text-gray-900">MammoAI</h1>
            <p className="text-xs text-gray-500">Ko'krak saratoni aniqlash</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links
          .filter(l => !l.adminOnly || user.role === 'admin')
          .map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
      </nav>

      <div className="p-4 border-t border-gray-100 text-xs text-gray-400 text-center">
        © 2024 MammoAI
      </div>
    </aside>
  )
}
