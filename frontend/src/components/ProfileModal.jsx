import { useState } from 'react'
import { X, User, Mail, Lock, Save, PenLine, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { API_BASE_URL } from '../api/axios'

const CAN_SIGN = ['radiolog', 'admin']

export default function ProfileModal({ user, onClose, onUpdated }) {
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    email:     user.email    || '',
    password:  '',
  })
  const [loading, setLoading] = useState(false)
  const [sigUploading, setSigUploading] = useState(false)
  const [sigVersion, setSigVersion] = useState(0)
  const canSign = CAN_SIGN.includes(user.role)

  async function uploadSignature(e) {
    const file = e.target.files[0]
    if (!file) return
    setSigUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post('/auth/me/signature', fd)
      localStorage.setItem('user', JSON.stringify(data))
      onUpdated(data)
      setSigVersion(v => v + 1)
      toast.success('Imzo yuklandi!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Imzo yuklashda xatolik')
    } finally {
      setSigUploading(false)
      e.target.value = ''
    }
  }

  async function removeSignature() {
    try {
      const { data } = await api.delete('/auth/me/signature')
      localStorage.setItem('user', JSON.stringify(data))
      onUpdated(data)
      setSigVersion(v => v + 1)
      toast.success("Imzo o'chirildi")
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xato')
    }
  }

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

          {canSign && (
            <div className="pt-1 border-t border-gray-100 dark:border-slate-700">
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 mt-3">
                <PenLine size={12} className="inline mr-1" /> Shaxsiy imzo
                <span className="text-gray-400 dark:text-slate-500 font-normal ml-1">
                  (PDF tashxis hisobotlarida ko'rsatiladi)
                </span>
              </label>
              {user.signature_path ? (
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3">
                  <img key={sigVersion} src={`${API_BASE_URL}/auth/signature/${user.id}?v=${sigVersion}`}
                    alt="Imzo" className="h-12 bg-white rounded border border-gray-200 dark:border-slate-600" />
                  <button type="button" onClick={removeSignature}
                    className="ml-auto text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200
                                  dark:border-slate-600 rounded-xl p-3 text-sm text-gray-500 dark:text-slate-400
                                  cursor-pointer hover:border-blue-400 transition-colors">
                  {sigUploading ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Upload size={14} /> PNG/JPG imzo rasmini yuklash</>
                  )}
                  <input type="file" accept=".png,.jpg,.jpeg" className="hidden"
                    disabled={sigUploading} onChange={uploadSignature} />
                </label>
              )}
            </div>
          )}

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
