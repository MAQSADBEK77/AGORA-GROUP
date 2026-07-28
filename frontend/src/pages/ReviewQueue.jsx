import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, CheckCircle, ImageIcon, Brain, ChevronRight, Search, Users } from 'lucide-react'
import api, { API_BASE_URL } from '../api/axios'

const LABEL_BADGE = {
  Normal:          'badge-normal',
  Benign:          'badge-benign',
  Malignant:       'badge-malignant',
  'Very Malignant':'badge-very-malignant',
}
const LABEL_SEVERITY = { Normal: 0, Benign: 1, Malignant: 2, 'Very Malignant': 3 }

function isToday(dateStr) {
  const d = new Date(dateStr), now = new Date()
  return d.toDateString() === now.toDateString()
}
function isThisWeek(dateStr) {
  const d = new Date(dateStr), now = new Date()
  const diffDays = (now - d) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= 7
}

// Bitta bemorning barcha rasmlarini bitta kartaga birlashtiradi
function groupByPatient(images) {
  const map = new Map()
  for (const img of images) {
    const key = img.patient_id
    if (!map.has(key)) {
      map.set(key, {
        patientId: key,
        patientName: img.patient_name || `Bemor #${key}`,
        images: [],
        latestUploadedAt: img.uploaded_at,
      })
    }
    const group = map.get(key)
    group.images.push(img)
    if (new Date(img.uploaded_at) > new Date(group.latestUploadedAt)) {
      group.latestUploadedAt = img.uploaded_at
    }
  }
  return [...map.values()].sort((a, b) => new Date(b.latestUploadedAt) - new Date(a.latestUploadedAt))
}

function groupWorstLabel(group) {
  let worst = null
  for (const img of group.images) {
    if (!img.review) continue
    if (!worst || LABEL_SEVERITY[img.review.label] > LABEL_SEVERITY[worst]) worst = img.review.label
  }
  return worst
}

export default function ReviewQueue() {
  const navigate = useNavigate()
  const [tab, setTab]         = useState('pending')
  const [dateFilter, setDateFilter] = useState('all')
  const [search, setSearch]   = useState('')
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(tab === 'pending' ? '/pending' : '/reviewed')
      .then(r => setItems(r.data))
      .finally(() => setLoading(false))
  }, [tab])

  const groups = useMemo(() => {
    let filtered = items
    if (dateFilter === 'today') filtered = filtered.filter(i => isToday(i.uploaded_at))
    else if (dateFilter === 'week') filtered = filtered.filter(i => isThisWeek(i.uploaded_at))

    let g = groupByPatient(filtered)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      g = g.filter(grp => grp.patientName.toLowerCase().includes(q))
    }
    return g
  }, [items, dateFilter, search])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Ko'rib Chiqish Navbati</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Radiolog tomonidan tahlil qilinadigan bemorlar
          </p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl">
          <Brain size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">AI tayyor</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Asosiy tablar */}
        <div className="flex gap-2 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
          {[
            { id: 'pending',  icon: Clock,        label: 'Kutmoqda' },
            { id: 'reviewed', icon: CheckCircle,  label: 'Tekshirilgan' },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Tezkor sana filtri */}
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
          {[
            { id: 'all',   label: 'Hammasi' },
            { id: 'today', label: 'Bugungi' },
            { id: 'week',  label: 'Shu hafta' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setDateFilter(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                dateFilter === id
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Qidiruv */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Bemor ismi bo'yicha qidirish..."
            className="input pl-8 py-2 text-sm" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : groups.length === 0 ? (
        <div className="card text-center py-16">
          {tab === 'pending'
            ? <><CheckCircle size={48} className="mx-auto mb-3 text-emerald-400" />
                <p className="font-medium text-gray-600 dark:text-slate-300">Barcha rasmlar tekshirilgan</p>
                <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Yangi yuklashlar kutilmoqda</p></>
            : <><ImageIcon size={48} className="mx-auto mb-3 text-gray-300 dark:text-slate-600" />
                <p className="font-medium text-gray-600 dark:text-slate-300">Hech narsa topilmadi</p></>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map(group => {
            const cover = group.images[0]
            const worstLabel = groupWorstLabel(group)
            return (
              <button key={group.patientId} onClick={() => navigate(`/review/${cover.id}`)}
                className="card-hover text-left group">
                <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800
                                rounded-xl mb-4 flex items-center justify-center overflow-hidden relative">
                  <img src={`${API_BASE_URL}/img/${cover.id}`} alt={cover.filename}
                    className="w-full h-full object-cover rounded-xl"
                    onError={e => { e.target.style.display='none' }} />
                  <ImageIcon size={32} className="text-slate-300 dark:text-slate-600" />
                  {group.images.length > 1 && (
                    <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-semibold
                                     px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <ImageIcon size={10} /> {group.images.length}
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-slate-200 text-sm truncate flex items-center gap-1.5">
                      <Users size={13} className="text-gray-400 flex-shrink-0" /> {group.patientName}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {new Date(group.latestUploadedAt).toLocaleString('uz-UZ')}
                    </p>
                  </div>
                  {worstLabel
                    ? <span className={`${LABEL_BADGE[worstLabel] || 'badge-normal'} flex-shrink-0`}>{worstLabel}</span>
                    : <span className="badge-pending flex-shrink-0">Kutmoqda</span>}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                  <span className="text-xs text-gray-400 dark:text-slate-500">
                    {group.images.length} ta rasm • Bemor #{group.patientId}
                  </span>
                  <ChevronRight size={14} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
