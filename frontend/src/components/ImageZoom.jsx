import { useState, useRef, useCallback, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw, Contrast, SunMedium, FlipHorizontal2, Ruler, Pencil, Eraser } from 'lucide-react'

const ANNOTATION_COLOR = '#ef4444'

export default function ImageZoom({ src, alt, onClose, pixelSpacing, imageId, initialAnnotations, onSaveAnnotations, canDraw = true }) {
  const [scale, setScale]     = useState(1)
  const [pos, setPos]         = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [contrast, setContrast]     = useState(100)
  const [brightness, setBrightness] = useState(100)
  const [inverted, setInverted]     = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [rulerMode, setRulerMode]   = useState(false)
  const [rulerPoints, setRulerPoints] = useState([])
  const [drawMode, setDrawMode]     = useState(false)
  const [annotations, setAnnotations] = useState(initialAnnotations || [])
  const [currentPath, setCurrentPath] = useState(null)
  const dragStart = useRef(null)
  const imgRef    = useRef(null)
  const pictureRef = useRef(null)

  const zoom   = (delta) => setScale(s => Math.min(Math.max(s + delta, 0.5), 8))
  const reset  = () => {
    setScale(1); setPos({ x: 0, y: 0 })
    setContrast(100); setBrightness(100); setInverted(false)
    setRulerPoints([])
  }

  function naturalPointFromEvent(e) {
    const img = pictureRef.current
    if (!img) return null
    const rect = img.getBoundingClientRect()
    return [
      (e.clientX - rect.left) / rect.width * img.naturalWidth,
      (e.clientY - rect.top) / rect.height * img.naturalHeight,
    ]
  }

  function saveAnnotations(next) {
    setAnnotations(next)
    if (imageId && onSaveAnnotations) onSaveAnnotations(imageId, next)
  }

  function clearAnnotations() {
    saveAnnotations([])
  }

  function naturalToScreen(pt) {
    const img = pictureRef.current
    if (!img) return null
    const rect = img.getBoundingClientRect()
    return {
      x: rect.left + (pt.x / img.naturalWidth) * rect.width,
      y: rect.top + (pt.y / img.naturalHeight) * rect.height,
    }
  }

  function onRulerClick(e) {
    const img = pictureRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width * img.naturalWidth
    const ny = (e.clientY - rect.top) / rect.height * img.naturalHeight
    setRulerPoints(prev => prev.length >= 2 ? [{ x: nx, y: ny }] : [...prev, { x: nx, y: ny }])
  }

  let rulerDistanceLabel = null
  let rulerScreenPoints  = null
  if (rulerPoints.length === 2) {
    const [a, b] = rulerPoints
    const pxDist = Math.hypot(b.x - a.x, b.y - a.y)
    rulerDistanceLabel = pixelSpacing ? `${(pxDist * pixelSpacing).toFixed(1)} mm` : `${Math.round(pxDist)} px`
    rulerScreenPoints = [naturalToScreen(a), naturalToScreen(b)]
  }

  const onWheel = useCallback(e => {
    e.preventDefault()
    zoom(e.deltaY < 0 ? 0.2 : -0.2)
  }, [])

  useEffect(() => {
    const el = imgRef.current
    if (el) el.addEventListener('wheel', onWheel, { passive: false })
    return () => { if (el) el.removeEventListener('wheel', onWheel) }
  }, [onWheel])

  const onMouseDown = e => {
    if (rulerMode) { onRulerClick(e); return }
    if (drawMode && canDraw) {
      const pt = naturalPointFromEvent(e)
      if (pt) setCurrentPath([pt])
      return
    }
    setDragging(true)
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }
  const onMouseMove = e => {
    if (drawMode && currentPath) {
      const pt = naturalPointFromEvent(e)
      if (pt) setCurrentPath(prev => [...prev, pt])
      return
    }
    if (!dragging) return
    setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }
  const onMouseUp = () => {
    setDragging(false)
    if (drawMode && currentPath) {
      if (currentPath.length >= 2) {
        saveAnnotations([...annotations, { points: currentPath, color: ANNOTATION_COLOR }])
      }
      setCurrentPath(null)
    }
  }

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') zoom(0.3)
      if (e.key === '-') zoom(-0.3)
      if (e.key === '0') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/80 border-b border-white/10">
        <p className="text-sm text-gray-400 font-medium">{alt}</p>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 bg-white/10 px-2 py-1 rounded">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => zoom(0.3)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ZoomIn size={18} />
          </button>
          <button onClick={() => zoom(-0.3)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ZoomOut size={18} />
          </button>
          <button onClick={reset}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <RotateCcw size={16} />
          </button>
          <div className="w-px h-5 bg-white/20 mx-1" />
          <button onClick={() => setAdjustOpen(o => !o)}
            title="Kontrast / yorqinlik"
            className={`p-2 rounded-lg transition-colors ${adjustOpen ? 'bg-blue-500/30 text-blue-300' : 'hover:bg-white/10 text-white'}`}>
            <Contrast size={18} />
          </button>
          <button onClick={() => setInverted(v => !v)}
            title="Ranglarni teskari qilish"
            className={`p-2 rounded-lg transition-colors ${inverted ? 'bg-blue-500/30 text-blue-300' : 'hover:bg-white/10 text-white'}`}>
            <FlipHorizontal2 size={18} />
          </button>
          <button onClick={() => { setRulerMode(v => !v); setRulerPoints([]) }}
            title="O'lchov asbobi (ruler)"
            className={`p-2 rounded-lg transition-colors ${rulerMode ? 'bg-blue-500/30 text-blue-300' : 'hover:bg-white/10 text-white'}`}>
            <Ruler size={18} />
          </button>
          {canDraw && (
            <button onClick={() => setDrawMode(v => !v)}
              title="Erkin chizish (annotatsiya)"
              className={`p-2 rounded-lg transition-colors ${drawMode ? 'bg-blue-500/30 text-blue-300' : 'hover:bg-white/10 text-white'}`}>
              <Pencil size={18} />
            </button>
          )}
          {canDraw && annotations.length > 0 && (
            <button onClick={clearAnnotations}
              title="Chizilganlarni tozalash"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
              <Eraser size={18} />
            </button>
          )}
          <div className="w-px h-5 bg-white/20 mx-1" />
          <button onClick={onClose}
            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-white">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Kontrast / yorqinlik paneli */}
      {adjustOpen && (
        <div className="flex items-center justify-center gap-8 px-6 py-3 bg-black/80 border-b border-white/10">
          <div className="flex items-center gap-3 w-64">
            <Contrast size={15} className="text-gray-400 flex-shrink-0" />
            <input type="range" min="50" max="300" value={contrast}
              onChange={e => setContrast(Number(e.target.value))}
              className="w-full accent-blue-500" />
            <span className="text-xs text-gray-400 w-10 text-right flex-shrink-0">{contrast}%</span>
          </div>
          <div className="flex items-center gap-3 w-64">
            <SunMedium size={15} className="text-gray-400 flex-shrink-0" />
            <input type="range" min="50" max="200" value={brightness}
              onChange={e => setBrightness(Number(e.target.value))}
              className="w-full accent-blue-500" />
            <span className="text-xs text-gray-400 w-10 text-right flex-shrink-0">{brightness}%</span>
          </div>
          <button onClick={() => { setContrast(100); setBrightness(100) }}
            className="text-xs text-gray-400 hover:text-white transition-colors">
            Standart
          </button>
        </div>
      )}

      {/* Image */}
      <div ref={imgRef}
        className="flex-1 overflow-hidden flex items-center justify-center"
        style={{ cursor: (rulerMode || drawMode) ? 'crosshair' : (scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default') }}>
        <img ref={pictureRef} src={src} alt={alt}
          onMouseDown={onMouseDown}
          draggable={false}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: 'center',
            transition: dragging ? 'none' : 'transform 0.15s ease',
            filter: `contrast(${contrast}%) brightness(${brightness}%)${inverted ? ' invert(1)' : ''}`,
            maxWidth: '90vw',
            maxHeight: '85vh',
            userSelect: 'none',
          }}
          className="rounded-lg shadow-2xl"
        />
      </div>

      {/* Ruler (o'lchov) chizig'i va masofa yorlig'i */}
      {rulerScreenPoints && rulerScreenPoints[0] && rulerScreenPoints[1] && (
        <svg className="fixed inset-0 pointer-events-none z-10" width="100%" height="100%">
          <line x1={rulerScreenPoints[0].x} y1={rulerScreenPoints[0].y}
            x2={rulerScreenPoints[1].x} y2={rulerScreenPoints[1].y}
            stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 4" />
          {rulerScreenPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={5} fill="#22d3ee" />
          ))}
          <text
            x={(rulerScreenPoints[0].x + rulerScreenPoints[1].x) / 2}
            y={(rulerScreenPoints[0].y + rulerScreenPoints[1].y) / 2 - 10}
            fill="#22d3ee" fontSize="14" fontWeight="600" textAnchor="middle">
            {rulerDistanceLabel}
          </text>
        </svg>
      )}
      {rulerMode && (
        <div className="text-center py-1 text-xs text-cyan-400 bg-black/60">
          O'lchov rejimi: rasmda ikkita nuqtani belgilang{!pixelSpacing && ' (piksel spacing noma\'lum — natija pikselda ko\'rsatiladi)'}
        </div>
      )}

      {/* Erkin chizilgan annotatsiyalar */}
      {(annotations.length > 0 || currentPath) && (
        <svg className="fixed inset-0 pointer-events-none z-10" width="100%" height="100%">
          {annotations.map((path, i) => {
            const screenPts = path.points.map(([x, y]) => naturalToScreen({ x, y }))
            if (screenPts.some(p => !p)) return null
            return (
              <polyline key={i} points={screenPts.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none" stroke={path.color || ANNOTATION_COLOR} strokeWidth={2.5}
                strokeLinecap="round" strokeLinejoin="round" />
            )
          })}
          {currentPath && (() => {
            const screenPts = currentPath.map(([x, y]) => naturalToScreen({ x, y }))
            if (screenPts.some(p => !p)) return null
            return (
              <polyline points={screenPts.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none" stroke={ANNOTATION_COLOR} strokeWidth={2.5}
                strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
            )
          })()}
        </svg>
      )}
      {drawMode && (
        <div className="text-center py-1 text-xs text-red-400 bg-black/60">
          Chizish rejimi: rasm ustida sichqonchani bosib torting — avtomatik saqlanadi
        </div>
      )}

      {/* Hints */}
      <div className="text-center py-2 text-xs text-gray-600">
        Scroll — zoom • Drag — siljitish • Kontrast — <Contrast size={11} className="inline -mt-0.5" /> • O'lchov — <Ruler size={11} className="inline -mt-0.5" /> • Chizish — <Pencil size={11} className="inline -mt-0.5" /> • 0 — reset • Esc — yopish
      </div>
    </div>
  )
}
