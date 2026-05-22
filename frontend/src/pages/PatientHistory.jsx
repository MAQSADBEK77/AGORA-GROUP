import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search, ChevronRight, User, ImageIcon, Calendar, Phone,
  Filter, X, CheckCircle, AlertTriangle, AlertCircle, XCircle,
  Clock, Activity
} from 'lucide-react'
import api from '../api/axios'

const LABELS = [
  { key: '',              label: 'Barchasi',      icon: Activity,       color: 'text-gray-500',    active: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-white' },
  { key: 'Normal',        label: 'Normal',        icon: CheckCircle,    color: 'text-emerald-600', active: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' },
  { key: 'Benign',        label: 'Benign',        icon: AlertTriangle,  color: 'text-amber-600',   active: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700' },
  { key: 'Malignant',     label: 'Malignant',     icon: AlertCircle,    color: 'text-red-600',     active: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700' },
  { key: 'Very Malignant',label: 'Very Malignant',icon: XCircle,        color: 'text-red-900',     active: 'bg-red-100 dark:bg-red-950/50 text-red-900 dark:text-red-200 border-red-500 dark:border-red-800' },
]

const LABEL_STYLE = {
  'Normal':        { badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', icon: CheckCircle },
  'Benign':        { badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',         icon: AlertTriangle },
  'Malignant':     { badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',                 icon: AlertCircle },
  'Very Malignant':{ badge: 'bg-red-200 dark:bg-red-950/60 text-red-900 dark:text-red-200',                 icon: XCircle },
  'Kutmoqda':      { badge: 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400',              icon: Clock },
}

export default function PatientHistory() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch]       = useState('')
  const [activeLabel, setActiveLabel] = useState(searchParams.get('label') || '')
  const [patients, setPatients]   = useState([])
  const [expanded, setExpanded]   = useState(null)
  const [images, setImages]       = useState({})
  const [loading, setLoading]     = useState(false)
  const debounceRef = useRef(null)

  async function loadPatients(q = search, lbl = activeLabel) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q)   params.set('search', q)
      if (lbl) params.set('label', lbl)
      const { data } = await api.get(`/patients?${params}`)
      setPatients(data)
    } catch {
      setPatients([])
    } finally {
      setLoading(false)
    }
  }

  // URL param o'zgarganda
  useEffect(() => {
    const lbl = searchParams.get('label') || ''
    setActiveLabel(lbl)
    loadPatients(search, lbl)
  }, [searchParams])

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadPatients(search, activeLabel), 350)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  function selectLabel(key) {
    setActiveLabel(key)
    setExpanded(null)
    if (key) setSearchParams({ label: key })
    else setSearchParams({})
    loadPatients(search, key)
  }

  async function togglePatient(id) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!images[id]) {
      const { data } = await api.get(`/patients/${id}/images`)
      setImages(prev => ({ ...prev, [id]: data }))
    }
  }

  const activeLabelInfo = LABELS.find(l => l.key === activeLabel)

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <User className="text-blue-600" size={26} /> Bemor Tarixi
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Yuklangan bemorlar va ularning mammografiya tarixi
          </p>
        </div>
        {activeLabel && (
          <button onClick={() => selectLabel('')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-slate-700">
            <X size={14} /> Filterni olib tashlash
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10 pr-10 w-full"
            placeholder="Ism familiya yoki telefon raqam bilan qidiring..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={15} />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 flex items-center gap-1">
          <Phone size={11} /> Telefon raqam yoki ism bilan qidiring
        </p>
      </div>

      {/* Label filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {LABELS.map(({ key, label, icon: Icon, color, active }) => (
          <button key={key} onClick={() => selectLabel(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
              activeLabel === key
                ? `${active} border-current shadow-sm`
                : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50'
            }`}>
            <Icon size={14} className={activeLabel === key ? '' : color} />
            {label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="animate-spin h-9 w-9 border-4 border-blue-600 border-t-transparent rounded-full" />
          <p className="text-sm text-gray-400">Qidirilmoqda...</p>
        </div>
      ) : patients.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User size={28} className="text-gray-400 dark:text-slate-500" />
          </div>
          <p className="font-semibold text-gray-700 dark:text-slate-300 mb-1">
            {search || activeLabel ? 'Bemor topilmadi' : 'Hali bemor yo\'q'}
          </p>
          <p className="text-sm text-gray-400 dark:text-slate-500">
            {search
              ? `"${search}" bo'yicha natija topilmadi`
              : activeLabel
              ? `${activeLabel} diagnozli bemor mavjud emas`
              : 'Hamshira rasm yuklagandan so\'ng bemorlar bu yerda ko\'rinadi'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 dark:text-slate-500 px-1">
            {patients.length} ta bemor topildi
            {activeLabel && ` — ${activeLabel} filtri`}
          </p>

          {patients.map(p => (
            <div key={p.id}
              className="card p-0 overflow-hidden hover:shadow-md dark:hover:shadow-slate-900/50 transition-all duration-200">

              {/* Patient row */}
              <button onClick={() => togglePatient(p.id)}
                className="w-full flex items-center justify-between px-5 py-4
                           hover:bg-gray-50 dark:hover:bg-slate-700/40 text-left transition-colors">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl
                                  flex items-center justify-center flex-shrink-0 shadow-sm">
                    <User size={19} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{p.full_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {p.birth_year && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
                          <Calendar size={11} /> {p.birth_year}
                        </span>
                      )}
                      {p.phone && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
                          <Phone size={11} /> {p.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight size={18}
                  className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${expanded === p.id ? 'rotate-90' : ''}`} />
              </button>

              {/* Expanded images */}
              {expanded === p.id && (
                <div className="border-t border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/40 px-5 py-4">
                  {!images[p.id] ? (
                    <div className="flex justify-center py-6">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                    </div>
                  ) : images[p.id].length === 0 ? (
                    <div className="text-center py-6">
                      <ImageIcon size={22} className="mx-auto text-gray-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-gray-400 dark:text-slate-500">Rasmlar mavjud emas</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                        {images[p.id].length} ta mammografiya
                      </p>
                      {images[p.id].map(img => {
                        const lbl   = img.review?.label || 'Kutmoqda'
                        const style = LABEL_STYLE[lbl] || LABEL_STYLE['Kutmoqda']
                        const Icon  = style.icon
                        return (
                          <button key={img.id}
                            className="w-full flex items-center justify-between bg-white dark:bg-slate-800
                                       rounded-xl px-4 py-3 border border-gray-100 dark:border-slate-700
                                       hover:border-blue-300 dark:hover:border-blue-500/50
                                       hover:shadow-sm transition-all text-left group"
                            onClick={() => navigate(`/review/${img.id}`)}>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-gradient-to-br from-slate-100 to-slate-200
                                              dark:from-slate-700 dark:to-slate-600 rounded-lg
                                              flex items-center justify-center flex-shrink-0">
                                <ImageIcon size={15} className="text-slate-500 dark:text-slate-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate max-w-[180px]">
                                  {img.filename}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-slate-500">
                                  {new Date(img.uploaded_at).toLocaleDateString('uz-UZ')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${style.badge}`}>
                                <Icon size={11} /> {lbl}
                              </span>
                              <ChevronRight size={14} className="text-gray-300 dark:text-slate-600 group-hover:text-blue-400 transition-colors" />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
