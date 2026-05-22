import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Brain, CheckCircle, AlertTriangle, AlertCircle, XCircle, User, ImageOff } from 'lucide-react'
import api from '../api/axios'

const LABELS = ['Normal', 'Benign', 'Malignant', 'Very Malignant']

const LABEL_STYLE = {
  'Normal':        { color: 'text-green-600',  bg: 'bg-green-50 border-green-300',   icon: CheckCircle },
  'Benign':        { color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-300', icon: AlertTriangle },
  'Malignant':     { color: 'text-red-600',    bg: 'bg-red-50 border-red-300',       icon: AlertCircle },
  'Very Malignant':{ color: 'text-red-900',    bg: 'bg-red-100 border-red-500',      icon: XCircle },
}

function parseSimilarCases(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

export default function ReviewDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [image, setImage]       = useState(null)
  const [error, setError]       = useState(null)
  const [aiPred, setAiPred]     = useState(null)
  const [form, setForm]         = useState({ label: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading]   = useState(false)
  const [imgError, setImgError]     = useState(false)
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const canReview = ['radiolog', 'admin'].includes(user.role)

  useEffect(() => {
    api.get(`/images/${id}`)
      .then(r => {
        setImage(r.data)
        if (r.data.review) {
          setForm({
            label: r.data.review.label || '',
            description: r.data.review.description || '',
          })
        }
        if (r.data.ai_prediction) setAiPred(r.data.ai_prediction)
      })
      .catch(() => setError('Rasm ma\'lumotlari yuklanmadi'))
  }, [id])

  async function loadAiPrediction() {
    setAiLoading(true)
    try {
      const { data } = await api.get(`/ai-predict/${id}`)
      setAiPred(data)
      if (!form.label && data.label) setForm(f => ({ ...f, label: data.label }))
      toast.success('AI tahlil tayyor')
    } catch (err) {
      const msg = err.response?.data?.detail || 'AI tahlil xatosi'
      toast.error(msg, { duration: 5000 })
    } finally {
      setAiLoading(false)
    }
  }

  async function submitReview(e) {
    e.preventDefault()
    if (!form.label) return toast.error('Diagnoz tanlang')
    setSubmitting(true)
    try {
      await api.post(`/review/${id}`, {
        label: form.label,
        description: form.description || null,
      })
      toast.success('Diagnoz saqlandi! AI yangilandi.')
      navigate('/review')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Saqlash xatosi')
    } finally {
      setSubmitting(false)
    }
  }

  // Rasm URL ni to'g'ri hisoblash
  function getImageUrl(img) {
    if (!img) return null
    return `/api/image-file/${img.id}`
  }

  if (error) return (
    <div className="max-w-xl mx-auto mt-20 text-center">
      <p className="text-red-500 mb-4">{error}</p>
      <button onClick={() => navigate('/review')} className="btn-secondary">Orqaga</button>
    </div>
  )

  if (!image) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  const similarCases = parseSimilarCases(aiPred?.similar_cases)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate('/review')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Ko'rib chiqish navbati
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Rasm */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Mammografiya Rasmi</h3>
          {imgError ? (
            <div className="flex flex-col items-center justify-center h-48 bg-gray-50 rounded-lg text-gray-400">
              <ImageOff size={40} className="mb-2 opacity-40" />
              <p className="text-sm">Rasm ko'rsatilmadi</p>
            </div>
          ) : (
            <img
              src={getImageUrl(image)}
              alt="mammogram"
              className="w-full rounded-lg object-contain bg-black max-h-80"
              onError={() => setImgError(true)}
            />
          )}
          <div className="mt-3 text-xs text-gray-500 space-y-1">
            <p>Fayl: {image.filename}</p>
            <p>Yuklangan: {new Date(image.uploaded_at).toLocaleString('uz-UZ')}</p>
            <p>Status:
              <span className={`ml-1 font-medium ${image.status === 'pending' ? 'text-yellow-600' : 'text-green-600'}`}>
                {image.status === 'pending' ? 'Kutmoqda' : 'Tekshirilgan'}
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* AI tahlil */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Brain size={18} className="text-purple-500" /> AI Tahlil
              </h3>
              {!aiPred && (
                <button onClick={loadAiPrediction} disabled={aiLoading}
                  className="btn-secondary text-sm flex items-center gap-1.5">
                  {aiLoading
                    ? <><div className="animate-spin h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full" />Tahlil...</>
                    : 'AI dan so\'rang'}
                </button>
              )}
            </div>

            {aiPred ? (
              <div className="space-y-3">
                {(() => {
                  const s = LABEL_STYLE[aiPred.label] || LABEL_STYLE['Normal']
                  const Icon = s.icon
                  return (
                    <div className={`flex items-center gap-3 p-3 rounded-lg border ${s.bg}`}>
                      <Icon size={20} className={s.color} />
                      <div>
                        <p className={`font-bold ${s.color}`}>{aiPred.label}</p>
                        <p className="text-xs text-gray-500">
                          Ishonch: {Math.round((aiPred.confidence || 0) * 100)}%
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {similarCases.length > 0 ? (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">
                      Eng o'xshash {similarCases.length} ta holat:
                    </p>
                    <div className="space-y-1">
                      {similarCases.slice(0, 4).map((c, i) => (
                        <div key={i}
                          className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-2">
                          <span className="text-gray-600">Rasm #{c.image_id}</span>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${(LABEL_STYLE[c.label] || {}).color || 'text-gray-700'}`}>
                              {c.label}
                            </span>
                            <span className="text-gray-400">
                              {Math.round((c.similarity || 0) * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-orange-600 bg-orange-50 rounded p-2">
                    Labeled rasm topilmadi. Birinchi diagnoz qo'ying — AI o'rganib boradi.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                "AI dan so'rang" tugmasini bosing
              </p>
            )}
          </div>

          {/* Radiolog forma */}
          {canReview ? (
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <User size={18} /> Doktor Xulosasi
              </h3>
              <form onSubmit={submitReview} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Diagnoz *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {LABELS.map(lbl => {
                      const s = LABEL_STYLE[lbl]
                      const Icon = s.icon
                      const selected = form.label === lbl
                      return (
                        <button key={lbl} type="button"
                          onClick={() => setForm(f => ({ ...f, label: lbl }))}
                          className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            selected
                              ? `${s.bg} border-current ${s.color}`
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}>
                          <Icon size={16} className={selected ? s.color : 'text-gray-400'} />
                          {lbl}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Izoh / Tavsif
                  </label>
                  <textarea className="input resize-none" rows={3}
                    placeholder="Diagnoz haqida batafsil izoh..."
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <button type="submit" disabled={submitting || !form.label}
                  className="btn-primary w-full py-2.5">
                  {submitting ? 'Saqlanmoqda...' : image.review ? 'Yangilash' : 'Tasdiqlash'}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  Saqlash bilan AI bu rasmni trening ma'lumot sifatida oladi
                </p>
              </form>
            </div>
          ) : (
            image.review && (
              <div className="card">
                <h3 className="font-semibold text-gray-800 mb-3">Doktor Xulosasi</h3>
                {(() => {
                  const s = LABEL_STYLE[image.review.label] || LABEL_STYLE['Normal']
                  const Icon = s.icon
                  return (
                    <div className={`flex items-center gap-3 p-4 rounded-lg border ${s.bg} mb-3`}>
                      <Icon size={24} className={s.color} />
                      <div>
                        <p className={`text-lg font-bold ${s.color}`}>{image.review.label}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(image.review.reviewed_at).toLocaleString('uz-UZ')}
                        </p>
                      </div>
                    </div>
                  )
                })()}
                {image.review.description && (
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                    {image.review.description}
                  </p>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
