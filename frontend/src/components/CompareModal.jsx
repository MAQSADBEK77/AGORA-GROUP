import { useState, useRef, useCallback, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw, Columns2, Repeat, Play, Pause } from 'lucide-react'

const FLICKER_INTERVAL_MS = 650

export default function CompareModal({ images, labels, onClose }) {
  const [scale, setScale]     = useState(1)
  const [pos, setPos]         = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [mode, setMode]       = useState('side') // 'side' | 'flicker'
  const [flickerIndex, setFlickerIndex] = useState(0)
  const [flickerPlaying, setFlickerPlaying] = useState(true)
  const dragStart = useRef(null)
  const wrapRef   = useRef(null)

  const zoom  = delta => setScale(s => Math.min(Math.max(s + delta, 0.5), 8))
  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }) }

  const onWheel = useCallback(e => {
    e.preventDefault()
    zoom(e.deltaY < 0 ? 0.2 : -0.2)
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (el) el.addEventListener('wheel', onWheel, { passive: false })
    return () => { if (el) el.removeEventListener('wheel', onWheel) }
  }, [onWheel])

  useEffect(() => {
    if (mode !== 'flicker' || !flickerPlaying) return
    const id = setInterval(() => setFlickerIndex(i => (i === 0 ? 1 : 0)), FLICKER_INTERVAL_MS)
    return () => clearInterval(id)
  }, [mode, flickerPlaying])

  const onMouseDown = e => {
    setDragging(true)
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }
  const onMouseMove = e => {
    if (!dragging) return
    setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }
  const onMouseUp = () => setDragging(false)

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') zoom(0.3)
      if (e.key === '-') zoom(-0.3)
      if (e.key === '0') reset()
      if (e.key === ' ') { e.preventDefault(); if (mode === 'flicker') setFlickerIndex(i => (i === 0 ? 1 : 0)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, mode])

  const imgStyle = {
    transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
    transformOrigin: 'center',
    transition: dragging ? 'none' : 'transform 0.15s ease',
    maxWidth: '100%',
    maxHeight: '100%',
    userSelect: 'none',
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/80 border-b border-white/10 flex-shrink-0">
        <p className="text-sm text-gray-400 font-medium">
          Taqqoslash: {labels?.[0]} ↔ {labels?.[1]}
        </p>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/10 rounded-lg overflow-hidden mr-2">
            <button onClick={() => setMode('side')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'side' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}>
              <Columns2 size={14} /> Yonma-yon
            </button>
            <button onClick={() => setMode('flicker')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'flicker' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}>
              <Repeat size={14} /> Flicker
            </button>
          </div>

          {mode === 'flicker' && (
            <button onClick={() => setFlickerPlaying(p => !p)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white" title="Avtomatik almashtirish">
              {flickerPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
          )}

          <span className="text-xs text-gray-500 bg-white/10 px-2 py-1 rounded">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => zoom(0.3)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ZoomIn size={18} />
          </button>
          <button onClick={() => zoom(-0.3)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ZoomOut size={18} />
          </button>
          <button onClick={reset} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <RotateCcw size={16} />
          </button>
          <div className="w-px h-5 bg-white/20 mx-1" />
          <button onClick={onClose} className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-white">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Viewer */}
      <div ref={wrapRef}
        className="flex-1 overflow-hidden flex items-stretch"
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        style={{ cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}>

        {mode === 'side' ? (
          <>
            <div className="flex-1 flex items-center justify-center border-r border-white/10 overflow-hidden relative">
              <span className="absolute top-2 left-2 z-10 text-[11px] font-bold bg-black/70 text-white px-2 py-0.5 rounded">
                {labels?.[0]}
              </span>
              <img src={images[0]} alt={labels?.[0]} draggable={false} style={imgStyle} className="rounded" />
            </div>
            <div className="flex-1 flex items-center justify-center overflow-hidden relative">
              <span className="absolute top-2 left-2 z-10 text-[11px] font-bold bg-black/70 text-white px-2 py-0.5 rounded">
                {labels?.[1]}
              </span>
              <img src={images[1]} alt={labels?.[1]} draggable={false} style={imgStyle} className="rounded" />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center relative">
            <span className="absolute top-2 left-2 z-10 text-[11px] font-bold bg-black/70 text-white px-2 py-0.5 rounded">
              {labels?.[flickerIndex]}
            </span>
            <img src={images[0]} alt={labels?.[0]} draggable={false}
              style={{ ...imgStyle, position: 'absolute', opacity: flickerIndex === 0 ? 1 : 0, transition: dragging ? 'none' : 'opacity 0.05s linear, transform 0.15s ease' }} />
            <img src={images[1]} alt={labels?.[1]} draggable={false}
              style={{ ...imgStyle, position: 'absolute', opacity: flickerIndex === 1 ? 1 : 0, transition: dragging ? 'none' : 'opacity 0.05s linear, transform 0.15s ease' }} />
          </div>
        )}
      </div>

      {/* Hints */}
      <div className="text-center py-2 text-xs text-gray-600 flex-shrink-0">
        Scroll — zoom (ikkalasiga birga) • Drag — siljitish (sinxron) •
        {mode === 'flicker' ? ' Bo\'shliq (Space) — qo\'lda almashtirish • ' : ' '}
        0 — reset • Esc — yopish
      </div>
    </div>
  )
}
