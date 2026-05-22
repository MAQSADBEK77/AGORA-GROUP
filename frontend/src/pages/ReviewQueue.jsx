import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, CheckCircle, ImageIcon, User } from 'lucide-react'
import api from '../api/axios'

export default function ReviewQueue() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const url = tab === 'pending' ? '/pending' : '/reviewed'
    api.get(url).then(r => setItems(r.data)).finally(() => setLoading(false))
  }, [tab])

  const labelColor = {
    Normal:          'badge-normal',
    Benign:          'badge-benign',
    Malignant:       'badge-malignant',
    'Very Malignant':'bg-red-900 text-white text-xs font-medium px-2 py-1 rounded-full',
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Ko'rib Chiqish Navbati</h2>

      <div className="flex gap-2">
        <button onClick={() => setTab('pending')}
          className={tab === 'pending' ? 'btn-primary' : 'btn-secondary'}>
          <Clock size={16} className="inline mr-1" /> Kutmoqda
        </button>
        <button onClick={() => setTab('reviewed')}
          className={tab === 'reviewed' ? 'btn-primary' : 'btn-secondary'}>
          <CheckCircle size={16} className="inline mr-1" /> Tekshirilgan
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <ImageIcon size={40} className="mx-auto mb-3 opacity-40" />
          <p>{tab === 'pending' ? 'Barcha rasmlar tekshirilgan' : 'Hali tekshirilgan rasm yo\'q'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(img => (
            <div key={img.id}
              onClick={() => navigate(`/review/${img.id}`)}
              className="card cursor-pointer hover:shadow-md transition-shadow border border-transparent hover:border-blue-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-800 truncate max-w-[140px]">
                    {img.filename}
                  </span>
                </div>
                {img.review ? (
                  <span className={labelColor[img.review.label] || 'badge-normal'}>
                    {img.review.label}
                  </span>
                ) : (
                  <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full font-medium">
                    Kutmoqda
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500 mb-2">
                {new Date(img.uploaded_at).toLocaleString('uz-UZ')}
              </p>

              {img.review?.description && (
                <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 line-clamp-2">
                  {img.review.description}
                </p>
              )}

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 text-xs text-gray-400">
                <User size={12} />
                <span>Rasm #{img.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
