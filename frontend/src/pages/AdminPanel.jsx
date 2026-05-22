import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Trash2, ShieldCheck, User, Mail, Lock } from 'lucide-react'
import api from '../api/axios'

const ROLE_LABELS = { admin: 'Administrator', hamshira: 'Hamshira', radiolog: 'Radiolog' }
const ROLE_COLORS = {
  admin:    'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  hamshira: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  radiolog: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
}

export default function AdminPanel() {
  const navigate  = useNavigate()
  const user      = JSON.parse(localStorage.getItem('user') || '{}')
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ full_name: '', email: '', password: '', role: 'hamshira' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user.role !== 'admin') navigate('/dashboard')
    else loadUsers()
  }, [])

  async function loadUsers() {
    try {
      const { data } = await api.get('/auth/users')
      setUsers(data)
    } finally { setLoading(false) }
  }

  async function addUser(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/auth/register', form)
      toast.success("Foydalanuvchi qo'shildi")
      setShowForm(false)
      setForm({ full_name: '', email: '', password: '', role: 'hamshira' })
      loadUsers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xato')
    } finally { setSubmitting(false) }
  }

  async function deleteUser(id) {
    if (!confirm("O'chirishni tasdiqlaysizmi?")) return
    try {
      await api.delete(`/auth/users/${id}`)
      toast.success("O'chirildi")
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (err) { toast.error(err.response?.data?.detail || 'Xato') }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShieldCheck className="text-purple-600" size={26} /> Admin Panel
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Foydalanuvchilar boshqaruvi</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} /> Yangi foydalanuvchi
        </button>
      </div>

      {showForm && (
        <div className="card border border-blue-100 dark:border-blue-900/50 animate-slide-up">
          <h3 className="font-bold text-gray-800 dark:text-white mb-5">Yangi foydalanuvchi qo'shish</h3>
          <form onSubmit={addUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
                <User size={12} className="inline mr-1" /> Ism familiya
              </label>
              <input className="input" required placeholder="Ali Valiyev"
                value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
                <Mail size={12} className="inline mr-1" /> Email
              </label>
              <input type="email" className="input" required placeholder="ali@shifoxona.uz"
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
                <Lock size={12} className="inline mr-1" /> Parol
              </label>
              <input type="password" className="input" required placeholder="Kamida 8 belgi"
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Rol</label>
              <select className="input" value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="hamshira">Hamshira</option>
                <option value="radiolog">Radiolog</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Qo\'shilmoqda...' : 'Qo\'shish'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Bekor</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h3 className="font-bold text-gray-800 dark:text-white">
            Foydalanuvchilar ({users.length} ta)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-900/50">
              <tr>
                {['Foydalanuvchi', 'Email', 'Rol', 'Holat', ''].map(h => (
                  <th key={h} className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Yuklanmoqda...</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                        <User size={14} className="text-white" />
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">{u.full_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${ROLE_COLORS[u.role] || ''}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      u.is_active
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}>
                      {u.is_active ? 'Faol' : 'Bloklangan'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {u.id !== user.id && (
                      <button onClick={() => deleteUser(u.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg
                                   text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
                                   transition-all ml-auto">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
