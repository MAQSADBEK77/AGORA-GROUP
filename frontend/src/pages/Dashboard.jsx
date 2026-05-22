import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, ImageIcon, Clock, CheckCircle, AlertTriangle,
  AlertCircle, XCircle, TrendingUp, Activity, Upload, Search, X
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import toast from 'react-hot-toast'
import api from '../api/axios'

const PIE_COLORS  = ['#10b981', '#f59e0b', '#ef4444', '#7f1d1d']
const LABEL_INFO  = {
  Normal:         { cls: 'badge-normal' },
  Benign:         { cls: 'badge-benign' },
  Malignant:      { cls: 'badge-malignant' },
  'Very Malignant':{ cls: 'badge-very-malignant' },
}

function StatCard({ label, value, icon: Icon, gradient, onClick, subtitle }) {
  return (
    <div onClick={onClick}
      className={`stat-card ${onClick ? 'cursor-pointer group' : ''}`}>
      <div className={`stat-icon ${gradient}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value ?? 0}</p>
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">{label}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {onClick && (
        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
            <TrendingUp size={12} className="text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 shadow-xl text-sm">
      <p className="font-semibold text-gray-800 dark:text-white">{payload[0].name}</p>
      <p className="text-blue-600 dark:text-blue-400">{payload[0].value} ta</p>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats]       = useState(null)
  const [pending, setPending]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [uploadState, setUploadState] = useState({ step: 1, search: '', patients: [], selected: null, file: null, preview: null, uploading: false })
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isDoctor  = ['radiolog', 'admin'].includes(user.role)
  const isNurse   = ['hamshira', 'admin'].includes(user.role)

  const refreshStats = async () => {
    const [s, p] = await Promise.all([
      api.get('/dashboard/stats'),
      isDoctor ? api.get('/pending') : Promise.resolve({ data: [] }),
    ])
    setStats(s.data)
    setPending(p.data)
  }

  useEffect(() => {
    refreshStats().finally(() => setLoading(false))
  }, [])

  // Upload helpers
  const searchPatients = async () => {
    if (!uploadState.search.trim()) return
    const { data } = await api.get(`/patients?search=${uploadState.search}`)
    setUploadState(u => ({ ...u, patients: data }))
  }
  const onFileChange = e => {
    const f = e.target.files[0]
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['jpg','jpeg','png','dcm'].includes(ext)) { toast.error('Faqat JPG, PNG, DICOM'); return }
    const preview = ext !== 'dcm' ? URL.createObjectURL(f) : null
    setUploadState(u => ({ ...u, file: f, preview }))
  }
  const handleUpload = async () => {
    if (!uploadState.file || !uploadState.selected) return
    setUploadState(u => ({ ...u, uploading: true }))
    try {
      const fd = new FormData()
      fd.append('patient_id', uploadState.selected.id)
      fd.append('file', uploadState.file)
      await api.post('/upload', fd)
      toast.success('Rasm yuklandi! Radiolog ko\'rib chiqadi.')
      setUploadState({ step: 1, search: '', patients: [], selected: null, file: null, preview: null, uploading: false })
      refreshStats()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Yuklash xatosi', { duration: 6000 })
    } finally {
      setUploadState(u => ({ ...u, uploading: false }))
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <Activity size={32} className="text-blue-500 animate-pulse-slow" />
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    </div>
  )

  const pieData = [
    { name: 'Normal',         value: stats?.normal_count         || 0 },
    { name: 'Benign',         value: stats?.benign_count         || 0 },
    { name: 'Malignant',      value: stats?.malignant_count      || 0 },
    { name: 'Very Malignant', value: stats?.very_malignant_count || 0 },
  ].filter(d => d.value > 0)

  const barData = [
    { name: 'Normal',   ta: stats?.normal_count         || 0, fill: '#10b981' },
    { name: 'Benign',   ta: stats?.benign_count         || 0, fill: '#f59e0b' },
    { name: 'Malig.',   ta: stats?.malignant_count      || 0, fill: '#ef4444' },
    { name: 'V.Malig.', ta: stats?.very_malignant_count || 0, fill: '#7f1d1d' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            MammoAI — Mammografiya tahlil tizimi
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-xl">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-green-700 dark:text-green-400">Tizim faol</span>
        </div>
      </div>

      {/* Row 1: Main stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Jami bemorlar"  value={stats?.total_patients}  icon={Users}
          gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          subtitle="Ro'yxatdagi barcha" />
        <StatCard label="Jami rasmlar"   value={stats?.total_images}    icon={ImageIcon}
          gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
          subtitle="Yuklangan rasmlar" />
        <StatCard label="Kutmoqda"       value={stats?.pending_count}   icon={Clock}
          gradient="bg-gradient-to-br from-amber-400 to-amber-600"
          subtitle="Radiolog kutayapti"
          onClick={isDoctor ? () => navigate('/review') : null} />
        <StatCard label="Tekshirilgan"   value={stats?.reviewed_count}  icon={CheckCircle}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          subtitle="Bajarilgan analizlar" />
      </div>

      {/* Row 2: Diagnosis stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Normal"         value={stats?.normal_count}         icon={CheckCircle}
          gradient="bg-gradient-to-br from-emerald-400 to-emerald-600" />
        <StatCard label="Benign"         value={stats?.benign_count}         icon={AlertTriangle}
          gradient="bg-gradient-to-br from-amber-400 to-amber-600" />
        <StatCard label="Malignant"      value={stats?.malignant_count}      icon={AlertCircle}
          gradient="bg-gradient-to-br from-red-500 to-red-700" />
        <StatCard label="Very Malignant" value={stats?.very_malignant_count} icon={XCircle}
          gradient="bg-gradient-to-br from-red-800 to-red-950" />
      </div>

      {/* Row 3: Charts + Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pie chart */}
        {pieData.length > 0 && (
          <div className="card">
            <h3 className="font-bold text-gray-800 dark:text-white mb-4">Diagnozlar taqsimoti</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8}
                  formatter={v => <span className="text-xs text-gray-600 dark:text-slate-400">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bar chart */}
        {stats?.reviewed_count > 0 && (
          <div className="card">
            <h3 className="font-bold text-gray-800 dark:text-white mb-4">Diagnoz statistikasi</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="ta" radius={[6,6,0,0]}>
                  {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pending queue (radiolog) */}
        {isDoctor && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 dark:text-white">Kutayotgan rasmlar</h3>
              {pending.length > 0 && <span className="badge-pending">{pending.length} ta</span>}
            </div>
            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle size={32} className="text-emerald-400 mb-2" />
                <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Hammasi tekshirilgan</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pending.slice(0, 4).map(img => (
                  <button key={img.id} onClick={() => navigate(`/review/${img.id}`)}
                    className="w-full flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20
                               hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-xl transition-colors text-left">
                    <Clock size={14} className="text-amber-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{img.filename}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{new Date(img.uploaded_at).toLocaleString('uz-UZ')}</p>
                    </div>
                  </button>
                ))}
                {pending.length > 4 && (
                  <button onClick={() => navigate('/review')}
                    className="w-full text-center text-sm text-blue-600 dark:text-blue-400 py-2 hover:underline font-medium">
                    Yana {pending.length - 4} ta →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Upload mini-form (hamshira) */}
        {isNurse && (
          <div className="card">
            <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Upload size={16} className="text-blue-500" /> Tez yuklash
            </h3>

            {uploadState.step === 1 ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-slate-400">Bemorni tanlang</p>
                <div className="flex gap-2">
                  <input className="input text-sm" placeholder="Ism qidirish..."
                    value={uploadState.search}
                    onChange={e => setUploadState(u => ({ ...u, search: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && searchPatients()} />
                  <button onClick={searchPatients} className="btn-secondary px-3">
                    <Search size={14} />
                  </button>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {uploadState.patients.map(p => (
                    <button key={p.id}
                      onClick={() => setUploadState(u => ({ ...u, selected: p, step: 2 }))}
                      className="w-full text-left px-3 py-2 text-sm rounded-lg border border-gray-100 dark:border-slate-700
                                 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 transition-colors">
                      <span className="font-medium text-gray-800 dark:text-slate-200">{p.full_name}</span>
                      {p.birth_year && <span className="text-gray-400 ml-2 text-xs">{p.birth_year}</span>}
                    </button>
                  ))}
                </div>
                <button onClick={() => navigate('/upload')}
                  className="w-full text-center text-xs text-blue-600 dark:text-blue-400 hover:underline py-1">
                  To'liq yuklash sahifasi →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-lg">
                    {uploadState.selected?.full_name}
                  </span>
                  <button onClick={() => setUploadState(u => ({ ...u, step: 1, selected: null, file: null, preview: null }))}
                    className="text-gray-400 hover:text-gray-600 p-1">
                    <X size={14} />
                  </button>
                </div>

                {uploadState.preview ? (
                  <div className="relative">
                    <img src={uploadState.preview} className="w-full h-28 object-cover rounded-lg bg-black" />
                    <button onClick={() => setUploadState(u => ({ ...u, file: null, preview: null }))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="block border-2 border-dashed border-gray-200 dark:border-slate-600
                                    rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 transition-colors">
                    <Upload size={24} className="mx-auto text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500 dark:text-slate-400">JPG, PNG, DICOM yuklang</p>
                    <input type="file" accept=".jpg,.jpeg,.png,.dcm" className="hidden" onChange={onFileChange} />
                  </label>
                )}

                <button onClick={handleUpload} disabled={!uploadState.file || uploadState.uploading}
                  className="btn-primary w-full text-sm py-2">
                  {uploadState.uploading
                    ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Yuklanmoqda...</>
                    : <><Upload size={14} /> Yuborish</>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
