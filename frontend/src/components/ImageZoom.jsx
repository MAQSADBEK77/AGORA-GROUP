import { useState, useRef, useCallback, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react'

export default function ImageZoom({ src, alt, onClose }) {
  const [scale, setScale]     = useState(1)
  const [pos, setPos]         = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef(null)
  const imgRef    = useRef(null)

  const zoom   = (delta) => setScale(s => Math.min(Math.max(s + delta, 0.5), 8))
  const reset  = () => { setScale(1); setPos({ x: 0, y: 0 }) }

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
          <button onClick={onClose}
            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-white">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Image */}
      <div ref={imgRef}
        className="flex-1 overflow-hidden flex items-center justify-center"
        style={{ cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}>
        <img src={src} alt={alt}
          onMouseDown={onMouseDown}
          draggable={false}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: 'center',
            transition: dragging ? 'none' : 'transform 0.15s ease',
            maxWidth: '90vw',
            maxHeight: '85vh',
            userSelect: 'none',
          }}
          className="rounded-lg shadow-2xl"
        />
      </div>

      {/* Hints */}
      <div className="text-center py-2 text-xs text-gray-600">
        Scroll — zoom • Drag — siljitish • +/- — klaviatura • 0 — reset • Esc — yopish
      </div>
    </div>
  )
}
