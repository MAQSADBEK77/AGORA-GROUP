import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, User, ImageIcon } from 'lucide-react'
import api from '../api/axios'

const labelBadge = (label) => {
  if (!label) return null
  const cls = { Normal: 'badge-normal', Cancer: 'badge-malignant' }
  return <span className={cls[label] || 'badge-normal'}>{label}</span>
}

export default function PatientHistory() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [images, setImages] = useState({})
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
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Bemor Tarixi</h2>

      <div className="flex gap-2">
        <input
          className="input max-w-sm"
          placeholder="Bemor qidirish..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadPatients(search)}
        />
        <button onClick={() => loadPatients(search)} className="btn-primary flex items-center gap-1.5">
          <Search size={16} /> Qidir
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : patients.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <User size={40} className="mx-auto mb-3 opacity-50" />
          <p>Bemor topilmadi</p>
        </div>
      ) : (
        <div className="space-y-3">
          {patients.map(p => (
            <div key={p.id} className="card p-0 overflow-hidden">
              <button
                onClick={() => togglePatient(p.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                    <User size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{p.full_name}</p>
                    <p className="text-xs text-gray-400">
                      {p.birth_year && `${p.birth_year} yil`}{p.phone && ` • ${p.phone}`}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} className={`text-gray-400 transition-transform ${expanded === p.id ? 'rotate-90' : ''}`} />
              </button>

              {expanded === p.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-2">
                  {!images[p.id] ? (
                    <p className="text-sm text-gray-400 text-center py-4">Yuklanmoqda...</p>
                  ) : images[p.id].length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Rasmlar mavjud emas</p>
                  ) : (
                    images[p.id].map(img => (
                      <div key={img.id}
                        className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-gray-100 cursor-pointer hover:border-blue-300"
                        onClick={() => img.prediction && navigate(`/predictions/${img.prediction.id}`)}>
                        <div className="flex items-center gap-3">
                          <ImageIcon size={16} className="text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">{img.filename}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(img.uploaded_at).toLocaleDateString('uz-UZ')} • {img.file_format}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {img.prediction ? labelBadge(img.prediction.label) : (
                            <span className="text-xs text-gray-400">Analiz yo'q</span>
                          )}
                        </div>
                      </div>
                    ))
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
