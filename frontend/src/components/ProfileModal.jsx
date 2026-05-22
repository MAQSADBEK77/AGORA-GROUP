import { useState } from 'react'
import { X, User, Mail, Lock, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'

export default function ProfileModal({ user, onClose, onUpdated }) {
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    email:     user.email    || '',
    password:  '',
  })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {}
      if (form.full_name !== user.full_name) payload.full_name = form.full_name
      if (form.email     !== user.email)     payload.email     = form.email
      if (form.password)                     payload.password  = form.password

      if (!Object.keys(payload).length) {
        toast('Hech narsa o\'zgarmadi')
        setLoading(false)
        return
      }

      const { data } = await api.put('/auth/profile', payload)
      localStorage.setItem('user', JSON.stringify(data))
      toast.success('Profil yangilandi!')
      onUpdated(data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xato yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <User size={18} /> Profilni tahrirlash
          </h2>
          <button onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
              <User size={12} className="inline mr-1" /> Ism familiya
            </label>
            <input className="input" value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Ism Familiya" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
              <Mail size={12} className="inline mr-1" /> Email
            </label>
            <input type="email" className="input" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@shifoxona.uz" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
              <Lock size={12} className="inline mr-1" /> Yangi parol
              <span className="text-gray-400 dark:text-slate-500 font-normal ml-1">(o'zgartirmasangiz bo'sh qoldiring)</span>
            </label>
            <input type="password" className="input" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              <Save size={15} />
              {loading ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Bekor</button>
          </div>
        </form>
      </div>
    </div>
  )
}
