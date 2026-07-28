import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Brain, CheckCircle, AlertTriangle, AlertCircle, XCircle, User, ImageOff, Maximize2, FileDown } from 'lucide-react'
import api, { API_BASE_URL } from '../api/axios'
import ImageZoom from '../components/ImageZoom'
import LesionOverlay from '../components/LesionOverlay'

const LABELS = ['Normal', 'Benign', 'Malignant', 'Very Malignant']

const LABEL_STYLE = {
  'Normal':        { color: 'text-green-600',  bg: 'bg-green-50 border-green-300',   icon: CheckCircle,  hex: '#16a34a' },
  'Benign':        { color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-300', icon: AlertTriangle, hex: '#ca8a04' },
  'Malignant':     { color: 'text-red-600',    bg: 'bg-red-50 border-red-300',       icon: AlertCircle,  hex: '#dc2626' },
  'Very Malignant':{ color: 'text-red-900',    bg: 'bg-red-100 border-red-500',      icon: XCircle,      hex: '#7f1d1d' },
}

// DICOM ViewPosition (CC/MLO) tegi ko'pincha bo'sh yoki notekis keladi, shuning
// uchun buni faqat R/L ichida ikkinchi darajali tartiblash uchun ishlatamiz.
// Asosiy tartib — R va L rasmlarni har qatorda bittadan (yonma-yon, taqqoslash
// uchun) navbatma-navbat joylashtirish: R,L,R,L... (professional viewer kabi).
const VIEW_ORDER = { CC: 0, MLO: 1 }
function viewRank(img) {
  return VIEW_ORDER[String(img.view_position || '').toUpperCase()] ?? 9
}

function arrangeForComparison(images) {
  const rs     = images.filter(i => i.laterality === 'R').sort((a, b) => viewRank(a) - viewRank(b))
  const ls     = images.filter(i => i.laterality === 'L').sort((a, b) => viewRank(a) - viewRank(b))
  const others = images.filter(i => !['R', 'L'].includes(i.laterality))
  const out = []
  for (let k = 0; k < Math.max(rs.length, ls.length); k++) {
    if (rs[k]) out.push(rs[k])
    if (ls[k]) out.push(ls[k])
  }
  return [...out, ...others]
}

function panelLabel(img) {
  const parts = [img.laterality, img.view_position].filter(Boolean)
  return parts.length ? parts.join(' ') : `#${img.id}`
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
  const [siblings, setSiblings] = useState([])
  const [error, setError]       = useState(null)
  const [aiPred, setAiPred]     = useState(null)
  const [form, setForm]         = useState({ label: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading]   = useState(false)
  const [zoomImage, setZoomImage]   = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const imgRefs = useRef({})
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const canReview = ['radiolog', 'admin'].includes(user.role)

  useEffect(() => {
    api.get(`/images/${id}`)
      .then(async r => {
        setImage(r.data)
        if (r.data.review) {
          setForm({
            label: r.data.review.label || '',
            description: r.data.review.description || '',
          })
        }
        if (r.data.ai_prediction) setAiPred(r.data.ai_prediction)

        try {
          const sib = await api.get(`/patients/${r.data.patient_id}/images`)
          setSiblings(arrangeForComparison(sib.data))
        } catch {
          setSiblings([r.data])
        }
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
      const targetIds = siblings.length ? siblings.map(s => s.id) : [id]
      await Promise.all(targetIds.map(imgId => api.post(`/review/${imgId}`, {
        label: form.label,
        description: form.description || null,
      })))
      toast.success(
        targetIds.length > 1
          ? `Diagnoz ${targetIds.length} ta rasmga saqlandi! AI yangilandi.`
          : 'Diagnoz saqlandi! AI yangilandi.'
      )
      navigate('/review')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Saqlash xatosi')
    } finally {
      setSubmitting(false)
    }
  }

  function getImageUrl(img) {
    if (!img) return null
    return `${API_BASE_URL}/img/${img.id}`
  }

  function getImgRefObj(imgId) {
    if (!imgRefs.current[imgId]) imgRefs.current[imgId] = { current: null }
    return imgRefs.current[imgId]
  }
  const setImgRef = useCallback((imgId) => (el) => { getImgRefObj(imgId).current = el }, [])

  async function downloadPdf() {
    setPdfLoading(true)
    try {
      const res = await api.get(`/report/${id}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `tashxis_${id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error('PDF yuklab olishda xatolik')
    } finally {
      setPdfLoading(false)
    }
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
  const panels = siblings.length ? siblings : [image]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/review')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Ko'rib chiqish navbati
        </button>

        {image.review && (
          <button onClick={downloadPdf} disabled={pdfLoading}
            className="btn-secondary text-sm flex items-center gap-1.5">
            {pdfLoading
              ? <><div className="animate-spin h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full" />Tayyorlanmoqda...</>
              : <><FileDown size={14} /> Tashxis hisoboti (PDF)</>}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">

        {/* Rasmlar — bitta bemorning barcha ko'rinishlari (R/L, CC/MLO) bitta oynada */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 dark:text-white">
              Mammografiya Rasmlari {panels.length > 1 && <span className="text-gray-400 font-normal text-sm">({panels.length} ta ko'rinish)</span>}
            </h3>
          </div>

          <div className={`grid w-fit max-w-full bg-black rounded-lg overflow-hidden mx-auto ${panels.length > 1 ? 'grid-cols-[repeat(2,auto)] gap-px' : 'grid-cols-1'}`}>
            {panels.map(p => {
              const pLesion = (p.ai_prediction?.lesion_x != null && p.ai_prediction?.lesion_width)
                ? { x: p.ai_prediction.lesion_x, y: p.ai_prediction.lesion_y,
                    width: p.ai_prediction.lesion_width, height: p.ai_prediction.lesion_height }
                : null
              const pColor = (LABEL_STYLE[p.ai_prediction?.label] || LABEL_STYLE['Normal']).hex

              return (
                <div key={p.id} className="relative group cursor-zoom-in bg-black"
                  onClick={() => setZoomImage(p)}>
                  <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded">
                    {panelLabel(p)}
                  </span>
                  {p.status === 'reviewed' && (
                    <CheckCircle size={14} className="absolute top-1.5 right-1.5 z-10 text-green-400" />
                  )}
                  <img
                    ref={setImgRef(p.id)}
                    src={getImageUrl(p)}
                    alt={panelLabel(p)}
                    className="block object-contain bg-black max-h-[520px] hover:opacity-95 transition-opacity"
                    onError={e => { e.target.style.opacity = 0.15 }}
                  />
                  {pLesion && (
                    <LesionOverlay box={pLesion} color={pColor} label="Shubhali mintaqa" imgRef={getImgRefObj(p.id)} />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/60 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
                      <Maximize2 size={10} /> Kattalashtirish
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-3 text-xs text-gray-500 space-y-1">
            <p>Bemor: {image.patient_id ? `#${image.patient_id}` : '—'} • Fayllar: {panels.length}</p>
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
                <span className="text-xs text-gray-400 italic">AI tahlil hozircha o'chirilgan</span>
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
              {panels.length > 1 && (
                <p className="text-xs text-blue-600 bg-blue-50 rounded p-2 mb-3">
                  Diagnoz shu bemorning barcha {panels.length} ta ko'rinishiga birgalikda saqlanadi.
                </p>
              )}
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
                  Saqlash bilan AI bu rasm(lar)ni trening ma'lumot sifatida oladi
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

      {zoomImage && (
        <ImageZoom
          src={getImageUrl(zoomImage)}
          alt={panelLabel(zoomImage)}
          onClose={() => setZoomImage(null)}
        />
      )}
    </div>
  )
}
