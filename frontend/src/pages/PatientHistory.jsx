import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, User, ImageIcon, Calendar, Phone } from 'lucide-react'
import api from '../api/axios'

const LABEL_BADGE = {
  Normal:          'badge-normal',
  Benign:          'badge-benign',
  Malignant:       'badge-malignant',
  'Very Malignant':'badge-very-malignant',
}

export default function PatientHistory() {
  const navigate = useNavigate()
  const [search, setSearch]   = useState('')
  const [patients, setPatients] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [images, setImages]   = useState({})
  const [loading, setLoading] = useState(false)

  async function loadPatients(q = '') {
    setLoading(true)
    const { data } = await api.get(`/patients?search=${q}`)
    setPatients(data)
    setLoading(false)
  }

  useEffect(() => { loadPatients() }, [])

  async function togglePatient(id) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!images[id]) {
      const { data } = await api.get(`/patients/${id}/images`)
      setImages(prev => ({ ...prev, [id]: data }))
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Bemor Tarixi</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Barcha bemorlar va ularning mammografiya tarixi</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder="Bemor ismini qidiring..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadPatients(search)} />
        </div>
        <button onClick={() => loadPatients(search)} className="btn-primary px-5">
          Qidir
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : patients.length === 0 ? (
        <div className="card text-center py-16">
          <User size={48} className="mx-auto mb-3 text-gray-300 dark:text-slate-600" />
          <p className="text-gray-500 dark:text-slate-400 font-medium">Bemor topilmadi</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Qidiruv so'rovini o'zgartiring</p>
        </div>
      ) : (
        <div className="space-y-3">
          {patients.map(p => (
            <div key={p.id} className="card p-0 overflow-hidden hover:shadow-md transition-all">
              <button onClick={() => togglePatient(p.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 text-left transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl
                                  flex items-center justify-center flex-shrink-0 shadow-sm">
                    <User size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{p.full_name}</p>
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
                <ChevronRight size={18} className={`text-gray-400 transition-transform duration-200 ${expanded === p.id ? 'rotate-90' : ''}`} />
              </button>

              {expanded === p.id && (
                <div className="border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 p-4">
                  {!images[p.id] ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                    </div>
                  ) : images[p.id].length === 0 ? (
                    <div className="text-center py-6">
                      <ImageIcon size={24} className="mx-auto text-gray-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-gray-400 dark:text-slate-500">Rasmlar mavjud emas</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {images[p.id].map(img => (
                        <button key={img.id}
                          className="w-full flex items-center justify-between bg-white dark:bg-slate-800
                                     rounded-xl px-4 py-3 border border-gray-100 dark:border-slate-700
                                     hover:border-blue-300 dark:hover:border-blue-500/50 transition-all text-left"
                          onClick={() => img.review && navigate(`/review/${img.id}`)}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                              <ImageIcon size={14} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{img.filename}</p>
                              <p className="text-xs text-gray-400 dark:text-slate-500">
                                {new Date(img.uploaded_at).toLocaleDateString('uz-UZ')} • {img.file_format || 'JPG'}
                              </p>
                            </div>
                          </div>
                          <div>
                            {img.review
                              ? <span className={LABEL_BADGE[img.review.label] || 'badge-normal'}>{img.review.label}</span>
                              : <span className="badge-pending">Kutmoqda</span>}
                          </div>
                        </button>
                      ))}
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
