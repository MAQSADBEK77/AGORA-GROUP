import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, CheckCircle, ImageIcon, Brain, ChevronRight } from 'lucide-react'
import api, { API_BASE_URL } from '../api/axios'

const LABEL_BADGE = {
  Normal:          'badge-normal',
  Benign:          'badge-benign',
  Malignant:       'badge-malignant',
  'Very Malignant':'badge-very-malignant',
}

export default function ReviewQueue() {
  const navigate = useNavigate()
  const [tab, setTab]     = useState('pending')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(tab === 'pending' ? '/pending' : '/reviewed')
      .then(r => setItems(r.data))
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Ko'rib Chiqish Navbati</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Radiolog tomonidan tahlil qilinadigan rasmlar
          </p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl">
          <Brain size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">AI tayyor</span>
        </div>
      </div>

      {/* Tabs */}
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

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-16">
          {tab === 'pending'
            ? <><CheckCircle size={48} className="mx-auto mb-3 text-emerald-400" />
                <p className="font-medium text-gray-600 dark:text-slate-300">Barcha rasmlar tekshirilgan</p>
                <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Yangi yuklashlar kutilmoqda</p></>
            : <><ImageIcon size={48} className="mx-auto mb-3 text-gray-300 dark:text-slate-600" />
                <p className="font-medium text-gray-600 dark:text-slate-300">Tekshirilgan rasm yo'q</p></>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(img => (
            <button key={img.id} onClick={() => navigate(`/review/${img.id}`)}
              className="card-hover text-left group">
              {/* Preview placeholder */}
              <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800
                              rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                <img src={`${API_BASE_URL}/img/${img.id}`} alt={img.filename}
                  className="w-full h-full object-cover rounded-xl"
                  onError={e => { e.target.style.display='none' }} />
                <ImageIcon size={32} className="text-slate-300 dark:text-slate-600" />
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 dark:text-slate-200 text-sm truncate">{img.filename}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    {new Date(img.uploaded_at).toLocaleString('uz-UZ')}
                  </p>
                </div>
                {img.review
                  ? <span className={`${LABEL_BADGE[img.review.label] || 'badge-normal'} flex-shrink-0`}>{img.review.label}</span>
                  : <span className="badge-pending flex-shrink-0">Kutmoqda</span>}
              </div>

              {img.review?.description && (
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-3 bg-gray-50 dark:bg-slate-700/50
                               rounded-lg p-2 line-clamp-2 italic">
                  "{img.review.description}"
                </p>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                <span className="text-xs text-gray-400 dark:text-slate-500">Rasm #{img.id}</span>
                <ChevronRight size={14} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
