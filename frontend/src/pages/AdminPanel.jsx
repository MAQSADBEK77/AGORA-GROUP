import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Trash2, ShieldCheck, User, Mail, Lock, Edit2, X, Save, ImageOff, AlertTriangle, ScrollText, ChevronDown, ChevronUp, FileDown, Image as ImageIcon, Upload } from 'lucide-react'
import api, { API_BASE_URL } from '../api/axios'

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
  const [editUser, setEditUser] = useState(null)
  const [editForm, setEditForm] = useState({ full_name: '', email: '', password: '' })
  const [uploadStats, setUploadStats] = useState(null)
  const [clearing, setClearing]       = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [logs, setLogs]           = useState([])
  const [logsOpen, setLogsOpen]   = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [hasLogo, setHasLogo]         = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoVersion, setLogoVersion]     = useState(0)

  useEffect(() => {
    if (user.role !== 'admin') navigate('/dashboard')
    else { loadUsers(); loadUploadStats(); checkLogo() }
  }, [])

  async function checkLogo() {
    try {
      await api.get('/admin/clinic-logo')
      setHasLogo(true)
    } catch {
      setHasLogo(false)
    }
  }

  async function uploadLogo(e) {
    const file = e.target.files[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post('/admin/clinic-logo', fd)
      setHasLogo(true)
      setLogoVersion(v => v + 1)
      toast.success('Logotip yuklandi!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Yuklashda xatolik')
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  async function removeLogo() {
    try {
      await api.delete('/admin/clinic-logo')
      setHasLogo(false)
      toast.success("Logotip o'chirildi")
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xato')
    }
  }

  async function loadLogs() {
    setLogsLoading(true)
    try {
      const { data } = await api.get('/admin/logs?limit=150')
      setLogs(data)
    } catch {
      toast.error('Audit-log yuklanmadi')
    } finally {
      setLogsLoading(false)
    }
  }

  function toggleLogs() {
    const next = !logsOpen
    setLogsOpen(next)
    if (next && logs.length === 0) loadLogs()
  }

  async function exportCsv() {
    try {
      const res = await api.get('/export/reviews.csv', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'mammoai_diagnozlar.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('CSV eksport qilishda xatolik')
    }
  }

  async function loadUsers() {
    try {
      const { data } = await api.get('/auth/users')
      setUsers(data)
    } finally { setLoading(false) }
  }

  async function loadUploadStats() {
    try {
      const { data } = await api.get('/admin/uploads/stats')
      setUploadStats(data)
    } catch {}
  }

  async function clearUploads() {
    setClearing(true)
    try {
      const { data } = await api.delete('/admin/uploads/clear')
      toast.success(`${data.deleted_images} ta rasm o'chirildi`)
      setUploadStats({ uploaded_count: 0 })
      setShowClearConfirm(false)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xato')
    } finally { setClearing(false) }
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

  function openEdit(u) {
    setEditUser(u)
    setEditForm({ full_name: u.full_name, email: u.email, password: '' })
  }

  async function saveEdit(e) {
    e.preventDefault()
    try {
      const payload = {}
      if (editForm.full_name !== editUser.full_name) payload.full_name = editForm.full_name
      if (editForm.email     !== editUser.email)     payload.email     = editForm.email
      if (editForm.password)                          payload.password  = editForm.password
      if (!Object.keys(payload).length) { toast('Hech narsa o\'zgarmadi'); return }
      const { data } = await api.put(`/auth/users/${editUser.id}`, payload)
      setUsers(prev => prev.map(u => u.id === data.id ? data : u))
      toast.success('Yangilandi!')
      setEditUser(null)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xato')
    }
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
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="btn-secondary">
            <FileDown size={16} /> CSV eksport
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={16} /> Yangi foydalanuvchi
          </button>
        </div>
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

      {/* Klinika logotipi (PDF hisobotlar uchun) */}
      <div className="card border border-blue-100 dark:border-blue-900/30">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
              <ImageIcon size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white">Klinika logotipi</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                PDF tashxis hisobotlarining sarlavhasida ko'rsatiladi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasLogo && (
              <>
                <img key={logoVersion} src={`${API_BASE_URL}/admin/clinic-logo?v=${logoVersion}`}
                  alt="Logotip" className="h-12 w-12 object-contain bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600" />
                <button onClick={removeLogo}
                  className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 size={16} />
                </button>
              </>
            )}
            <label className="btn-secondary text-sm cursor-pointer">
              {logoUploading
                ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : <><Upload size={14} /> {hasLogo ? 'Almashtirish' : 'Yuklash'}</>}
              <input type="file" accept=".png,.jpg,.jpeg" className="hidden"
                disabled={logoUploading} onChange={uploadLogo} />
            </label>
          </div>
        </div>
      </div>

      {/* Yuklangan bemorlar rasmlarini tozalash */}
      <div className="card border border-orange-100 dark:border-orange-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/40 rounded-xl flex items-center justify-center">
              <ImageOff size={18} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white">Yuklangan bemorlar rasmlari</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                Hamshira yuklagan rasmlar (dataset rasmlari saqlanadi)
                {uploadStats !== null && (
                  <span className="ml-2 font-semibold text-orange-600 dark:text-orange-400">
                    — {uploadStats.uploaded_count} ta rasm
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={!uploadStats || uploadStats.uploaded_count === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                       bg-orange-500 hover:bg-orange-600 text-white transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed">
            <Trash2 size={15} /> Tozalash
          </button>
        </div>
      </div>

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
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg
                                   text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                        <Edit2 size={14} />
                      </button>
                      {u.id !== user.id && (
                        <button onClick={() => deleteUser(u.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg
                                     text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit-log */}
      <div className="card p-0 overflow-hidden">
        <button onClick={toggleLogs}
          className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <ScrollText size={16} className="text-gray-400" /> Audit-log (tizim harakatlari)
          </h3>
          {logsOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {logsOpen && (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/50 sticky top-0">
                <tr>
                  {['Vaqt', 'Foydalanuvchi', 'Harakat', 'Tafsilot'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {logsLoading ? (
                  <tr><td colSpan={4} className="text-center py-10 text-gray-400">Yuklanmoqda...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-gray-400">Yozuvlar yo'q</td></tr>
                ) : logs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-2.5 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('uz-UZ')}
                    </td>
                    <td className="px-6 py-2.5 text-gray-700 dark:text-slate-300">{l.user_name || '—'}</td>
                    <td className="px-6 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-medium">
                        {l.action}
                      </span>
                    </td>
                    <td className="px-6 py-2.5 text-xs text-gray-500 dark:text-slate-400 truncate max-w-xs">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clear confirm modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Rasmlarni o'chirish</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">Bu amalni qaytarib bo'lmaydi</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-slate-300 mb-6 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 border border-orange-200 dark:border-orange-800">
              <strong>{uploadStats?.uploaded_count} ta</strong> bemor rasmi va ularning
              diagnozlari bazadan o'chiriladi. MIAS dataset rasmlari saqlanib qoladi.
            </p>
            <div className="flex gap-3">
              <button
                onClick={clearUploads}
                disabled={clearing}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold
                           rounded-xl transition-all disabled:opacity-50 text-sm">
                {clearing ? 'O\'chirilmoqda...' : 'Ha, o\'chirish'}
              </button>
              <button onClick={() => setShowClearConfirm(false)} className="btn-secondary">
                Bekor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit2 size={16} /> {editUser.full_name} — tahrirlash
              </h3>
              <button onClick={() => setEditUser(null)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
                  <User size={12} className="inline mr-1" /> Ism familiya
                </label>
                <input className="input" value={editForm.full_name}
                  onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
                  <Mail size={12} className="inline mr-1" /> Email
                </label>
                <input type="email" className="input" value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
                  <Lock size={12} className="inline mr-1" /> Yangi parol
                  <span className="text-gray-400 font-normal ml-1">(ixtiyoriy)</span>
                </label>
                <input type="password" className="input" value={editForm.password}
                  placeholder="O'zgartirmasangiz bo'sh qoldiring"
                  onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="btn-primary flex-1">
                  <Save size={14} /> Saqlash
                </button>
                <button type="button" onClick={() => setEditUser(null)} className="btn-secondary">Bekor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
