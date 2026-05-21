import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Trash2, ShieldCheck } from 'lucide-react'
import api from '../api/axios'

const ROLE_LABELS = { admin: 'Administrator', hamshira: 'Hamshira', radiolog: 'Radiolog' }
const ROLE_COLORS = { admin: 'bg-purple-100 text-purple-700', hamshira: 'bg-blue-100 text-blue-700', radiolog: 'bg-teal-100 text-teal-700' }

export default function AdminPanel() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    if (user.role !== 'admin') { navigate('/dashboard'); }
  }, [])

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'hamshira' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    try {
      const { data } = await api.get('/auth/users')
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }

  async function addUser(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/auth/register', form)
      toast.success('Foydalanuvchi qo\'shildi')
      setShowForm(false)
      setForm({ full_name: '', email: '', password: '', role: 'hamshira' })
      loadUsers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xato yuz berdi')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteUser(id) {
    if (!confirm('Foydalanuvchini o\'chirishni tasdiqlaysizmi?')) return
    try {
      await api.delete(`/auth/users/${id}`)
      toast.success('O\'chirildi')
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xato')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-purple-600" size={22} />
          <h2 className="text-xl font-semibold text-gray-800">Admin Panel</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Foydalanuvchi qo'shish
        </button>
      </div>

      {showForm && (
        <div className="card border border-blue-200">
          <h3 className="font-medium text-gray-800 mb-4">Yangi foydalanuvchi</h3>
          <form onSubmit={addUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ism familiya</label>
              <input className="input" required placeholder="Ali Valiyev"
                value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" className="input" required placeholder="ali@hospital.uz"
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Parol</label>
              <input type="password" className="input" required placeholder="Kamida 8 ta belgi"
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
              <select className="input" value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="hamshira">Hamshira</option>
                <option value="radiolog">Radiolog</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Qo\'shilmoqda...' : 'Qo\'shish'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Bekor</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Ism', 'Email', 'Rol', 'Holat', 'Amallar'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Yuklanmoqda...</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-5 py-3.5 font-medium text-gray-900">{u.full_name}</td>
                <td className="px-5 py-3.5 text-gray-500">{u.email}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs px-2 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.is_active ? 'Faol' : 'Bloklangan'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {u.id !== user.id && (
                    <button onClick={() => deleteUser(u.id)}
                      className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
