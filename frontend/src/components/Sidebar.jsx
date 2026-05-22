import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Upload, ClipboardList, History, ShieldCheck, Activity } from 'lucide-react'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',        roles: ['admin','hamshira','radiolog'] },
  { to: '/upload',    icon: Upload,          label: 'Rasm Yuklash',     roles: ['admin','hamshira'] },
  { to: '/review',    icon: ClipboardList,   label: 'Ko\'rib Chiqish',  roles: ['admin','radiolog'] },
  { to: '/history',   icon: History,         label: 'Bemor Tarixi',     roles: ['admin','hamshira','radiolog'] },
  { to: '/admin',     icon: ShieldCheck,     label: 'Admin Panel',      roles: ['admin'] },
]

export default function Sidebar() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  return (
    <aside className="w-64 bg-white dark:bg-slate-800 border-r border-gray-100 dark:border-slate-700 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl
                          flex items-center justify-center shadow-md">
            <Activity size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-none">MammoAI</h1>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">v2.0 — AI Diagnostika</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        <p className="section-title px-3 pt-2">Menyu</p>
        {links
          .filter(l => l.roles.includes(user.role))
          .map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-slate-200'
                }`}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 dark:border-slate-700">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20
                        rounded-xl p-3 text-center">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">MammoAI</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">© 2026 Agora Group</p>
        </div>
      </div>
    </aside>
  )
}
