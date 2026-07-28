import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Brain, CheckCircle, AlertTriangle, AlertCircle, XCircle, User, ImageOff, Maximize2, FileDown, GripHorizontal } from 'lucide-react'
import api, { API_BASE_URL } from '../api/axios'
import ImageZoom from '../components/ImageZoom'
import LesionOverlay from '../components/LesionOverlay'
import CadMarkers from '../components/CadMarkers'

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

const SIDE_LABEL = { L: 'Chap ko\'krak', R: 'O\'ng ko\'krak' }

function findCadSummary(panels) {
  for (const p of panels) {
    if (p.cad_summary) {
      try { return JSON.parse(p.cad_summary) } catch { /* noqit */ }
    }
  }
  return null
}

// Har bir alohida kaltsifikatsiyaning aniq konturi (bo'lsa) yoki markazi — rasm ustida chizish uchun
function cadShapesForSide(cadSummary, side) {
  const clusters = cadSummary?.by_side?.[side]?.clusters || []
  const shapes = []
  for (const cluster of clusters) {
    for (const calc of cluster.calcifications || []) {
      if (calc.outline?.length >= 3) shapes.push({ type: 'polygon', points: calc.outline })
      else if (calc.center) shapes.push({ type: 'point', point: calc.center })
    }
  }
  return shapes
}

function cadCounts(cadSummary, side) {
  const clusters = cadSummary?.by_side?.[side]?.clusters || []
  const calcifications = clusters.reduce((sum, c) => sum + (c.calcifications?.length || c.count || 0), 0)
  return { clusters: clusters.length, calcifications }
}

const FOOTER_MIN_H = 110
const FOOTER_MAX_RATIO = 0.85
const FOOTER_H_KEY = 'reviewFooterHeight'

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
  const [footerHeight, setFooterHeight] = useState(() => {
    const saved = Number(localStorage.getItem(FOOTER_H_KEY))
    return saved > 0 ? saved : 320
  })
  const imgRefs = useRef({})
  const dragRef = useRef(null)
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const canReview = ['radiolog', 'admin'].includes(user.role)

  useEffect(() => {
    localStorage.setItem(FOOTER_H_KEY, String(footerHeight))
  }, [footerHeight])

  useEffect(() => {
    function clampHeight(h) {
      const maxH = window.innerHeight * FOOTER_MAX_RATIO
      return Math.min(maxH, Math.max(FOOTER_MIN_H, h))
    }
    function onMove(e) {
      if (!dragRef.current) return
      e.preventDefault()
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      const { startY, startHeight } = dragRef.current
      setFooterHeight(clampHeight(startHeight + (startY - clientY)))
    }
    function onUp() {
      if (!dragRef.current) return
      dragRef.current = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  function startFooterDrag(clientY) {
    dragRef.current = { startY: clientY, startHeight: footerHeight }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'
  }

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
  const cadSummary = findCadSummary(panels)

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
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

      {/* -mx-6 asosiy <main>ning p-6 to'ldirishini bekor qiladi, px-[10px] esa ekran/navbar
          chetidan atigi 10px oraliq qoldiradi — rasmlar iloji boricha keng joyni egallashi uchun */}
      <div className="-mx-6 px-[10px]" style={{ paddingBottom: footerHeight + 24 }}>

        {/* Rasmlar — bitta bemorning barcha ko'rinishlari (R/L, CC/MLO) bitta oynada, to'liq kenglikda */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-3 animate-fade-in">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-semibold text-gray-800 dark:text-white">
              Mammografiya Rasmlari {panels.length > 1 && <span className="text-gray-400 font-normal text-sm">({panels.length} ta ko'rinish)</span>}
            </h3>
          </div>

          <div className={`grid w-full bg-black rounded-lg overflow-hidden ${panels.length > 1 ? 'grid-cols-1 sm:grid-cols-2 gap-px' : 'grid-cols-1'}`}>
            {panels.map(p => {
              const pLesion = (p.ai_prediction?.lesion_x != null && p.ai_prediction?.lesion_width)
                ? { x: p.ai_prediction.lesion_x, y: p.ai_prediction.lesion_y,
                    width: p.ai_prediction.lesion_width, height: p.ai_prediction.lesion_height }
                : null
              const pColor = (LABEL_STYLE[p.ai_prediction?.label] || LABEL_STYLE['Normal']).hex
              const cadShapes = cadShapesForSide(cadSummary, p.laterality)

              return (
                <div key={p.id} className="relative group cursor-zoom-in bg-black flex items-center justify-center"
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
                    className="block w-full h-auto object-contain bg-black hover:opacity-95 transition-opacity"
                    onError={e => { e.target.style.opacity = 0.15 }}
                  />
                  {pLesion && (
                    <LesionOverlay box={pLesion} color={pColor} label="Shubhali mintaqa" imgRef={getImgRefObj(p.id)} />
                  )}
                  {cadShapes.length > 0 && (
                    <CadMarkers shapes={cadShapes} imgRef={getImgRefObj(p.id)} />
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

          <div className="mt-3 text-xs text-gray-500 space-y-1 px-1">
            <p>Bemor: {image.patient_id ? `#${image.patient_id}` : '—'} • Fayllar: {panels.length}</p>
            <p>Yuklangan: {new Date(image.uploaded_at).toLocaleString('uz-UZ')}</p>
            <p>Status:
              <span className={`ml-1 font-medium ${image.status === 'pending' ? 'text-yellow-600' : 'text-green-600'}`}>
                {image.status === 'pending' ? 'Kutmoqda' : 'Tekshirilgan'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* AI Tahlil + Doktor Xulosasi — pastda doim ko'rinib turadigan (sticky footer) panel */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-16 z-30 bg-white dark:bg-slate-800
                      border-t border-gray-200 dark:border-slate-700 shadow-[0_-8px_30px_rgba(0,0,0,0.15)]">
        {/* Sudrab kattalashtirish/kichraytirish tutqichi */}
        <div
          onMouseDown={e => { e.preventDefault(); startFooterDrag(e.clientY) }}
          onTouchStart={e => startFooterDrag(e.touches[0].clientY)}
          title="Sudrab kattalashtirish/kichraytirish"
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-4 rounded-t-md bg-gray-200 dark:bg-slate-700
                    flex items-center justify-center cursor-row-resize touch-none group/handle
                    hover:bg-blue-100 dark:hover:bg-slate-600 transition-colors"
        >
          <GripHorizontal size={14} className="text-gray-500 group-hover/handle:text-blue-600" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 overflow-y-auto" style={{ height: footerHeight }}>

          {/* AI tahlil */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 text-sm">
                <Brain size={16} className="text-purple-500" /> AI Tahlil
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

          {/* Apparatning o'z ichki CAD hisoboti (masalan FUJIFILM M-CAD) — DICOM
              papkadagi SR faylidan o'qilgan, bizning AI'dan mustaqil natija */}
          {cadSummary && (
            <div className="mb-3 border-t border-gray-100 dark:border-slate-700 pt-3">
              <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 text-sm mb-2">
                <AlertTriangle size={16} className="text-orange-500" /> Apparat CAD hisoboti
                <span className="text-[11px] font-normal text-gray-400">
                  ({cadSummary.algorithm}{cadSummary.algorithm_version ? ` v${cadSummary.algorithm_version}` : ''})
                </span>
              </h3>

              {cadSummary.detections_performed?.length > 0 && (
                <p className="text-[11px] text-gray-500 mb-2">
                  O'tkazilgan tekshiruvlar: {cadSummary.detections_performed.join(', ')}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {['L', 'R'].map(side => {
                  const { clusters, calcifications } = cadCounts(cadSummary, side)
                  const hasFindings = clusters > 0
                  return (
                    <div key={side}
                      className={`text-xs px-3 py-2 rounded-lg border ${
                        hasFindings ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                      <span className="font-semibold">{SIDE_LABEL[side]}:</span>{' '}
                      {hasFindings
                        ? `${clusters} ta kaltsifikatsiya to'plami (${calcifications} ta alohida)`
                        : 'topilma yo\'q'}
                    </div>
                  )
                })}
              </div>

              {cadSummary.analyses_attempted === false && (
                <p className="text-[11px] text-red-500 bg-red-50 rounded p-2 mt-2">
                  ⚠ Apparat faqat joylarni <b>aniqladi</b> (detection) — xavflilik darajasini baholovchi
                  tahlil (malignancy/BI-RADS scoring) <b>o'tkazilmagan</b>. Yakuniy baho butunlay radiologga bog'liq.
                </p>
              )}

              <p className="text-[11px] text-gray-400 mt-2">
                Topilgan har bir kaltsifikatsiyaning aniq konturi rasmda <span className="text-orange-500 font-medium">to'q sariq chiziq</span> bilan
                belgilangan (tegishli tomon ko'rinishlarida — aniq CC/MLO farqi DICOM'da yo'q bo'lgani uchun ikkalasida ham).
                Bu — mammografiya apparatining o'z tahlili, bizning AI natijasidan mustaqil. Yakuniy tashxis radiolog tomonidan tasdiqlanadi.
              </p>
            </div>
          )}

          {/* Radiolog forma */}
          {canReview ? (
            <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 text-sm">
                  <User size={16} /> Doktor Xulosasi
                </h3>
                {panels.length > 1 && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400">
                    Diagnoz barcha {panels.length} ta ko'rinishga birgalikda saqlanadi
                  </p>
                )}
              </div>
              <form onSubmit={submitReview} className="flex flex-col lg:flex-row lg:items-start gap-3">
                <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                  {LABELS.map(lbl => {
                    const s = LABEL_STYLE[lbl]
                    const Icon = s.icon
                    const selected = form.label === lbl
                    return (
                      <button key={lbl} type="button"
                        onClick={() => setForm(f => ({ ...f, label: lbl }))}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-medium whitespace-nowrap transition-all ${
                          selected
                            ? `${s.bg} border-current ${s.color}`
                            : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-gray-300'
                        }`}>
                        <Icon size={14} className={selected ? s.color : 'text-gray-400'} />
                        {lbl}
                      </button>
                    )
                  })}
                </div>

                <textarea className="input resize-y min-h-[2.5rem] flex-1 text-sm" rows={1}
                  placeholder="Izoh / Tavsif..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />

                <button type="submit" disabled={submitting || !form.label}
                  className="btn-primary px-6 py-2 flex-shrink-0 whitespace-nowrap">
                  {submitting ? 'Saqlanmoqda...' : image.review ? 'Yangilash' : 'Tasdiqlash'}
                </button>
              </form>
            </div>
          ) : (
            image.review && (
              <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                <h3 className="font-semibold text-gray-800 dark:text-white mb-2 text-sm">Doktor Xulosasi</h3>
                {(() => {
                  const s = LABEL_STYLE[image.review.label] || LABEL_STYLE['Normal']
                  const Icon = s.icon
                  return (
                    <div className={`flex items-center gap-3 p-3 rounded-lg border ${s.bg} mb-2`}>
                      <Icon size={20} className={s.color} />
                      <div>
                        <p className={`font-bold ${s.color}`}>{image.review.label}</p>
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
