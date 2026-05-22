import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Activity, Lock, Mail, Sun, Moon } from 'lucide-react'
import api from '../api/axios'
import { useTheme } from '../context/ThemeContext'

export default function Login() {
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      toast.success(`Xush kelibsiz, ${data.user.full_name}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login xatosi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      {/* Dark mode toggle */}
      <button onClick={toggle}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-xl
                   bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all">
        {dark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-blue-200" />}
      </button>

      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16
                          bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl shadow-2xl mb-4">
            <Activity size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">MammoAI</h1>
          <p className="text-blue-300 text-sm">Ko'krak saratonini erta aniqlash tizimi</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">Tizimga kirish</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-300" />
                <input type="email" required
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pl-10
                             text-white placeholder-blue-300/60 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  placeholder="email@shifoxona.uz"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">Parol</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-300" />
                <input type="password" required
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pl-10
                             text-white placeholder-blue-300/60 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800
                         text-white font-bold py-3 rounded-xl transition-all duration-300 mt-2
                         shadow-lg hover:shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Kirish...</>
                : 'Tizimga kirish'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-center text-xs text-blue-300/70">
              Faqat tibbiy xodimlar uchun • Ruxsatsiz kirish taqiqlangan
            </p>
          </div>
        </div>

        {/* Tech badges */}
        <div className="flex justify-center gap-3 mt-6">
          {['FastAPI', 'React', 'AI Model'].map(t => (
            <span key={t} className="text-xs text-blue-400/60 bg-white/5 border border-white/10
                                     px-3 py-1 rounded-full backdrop-blur-sm">{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
