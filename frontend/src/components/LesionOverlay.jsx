import { useEffect, useState } from 'react'

/**
 * `box` koordinatalari rasm o'lchamiga nisbatan normallashtirilgan (0..1).
 * `imgRef` — ustiga ramka chiziladigan <img> elementiga ref (object-contain bo'lishi mumkin,
 * shuning uchun letterboxing hisobga olinadi).
 */
export default function LesionOverlay({ box, color = '#dc2626', label, imgRef }) {
  const [rect, setRect] = useState(null)

  useEffect(() => {
    const el = imgRef?.current
    if (!box || !el) { setRect(null); return }

    function compute() {
      if (!el.naturalWidth || !el.naturalHeight || !el.clientWidth || !el.clientHeight) return
      const scale     = Math.min(el.clientWidth / el.naturalWidth, el.clientHeight / el.naturalHeight)
      const renderedW = el.naturalWidth * scale
      const renderedH = el.naturalHeight * scale
      const offsetX   = (el.clientWidth - renderedW) / 2
      const offsetY   = (el.clientHeight - renderedH) / 2
      setRect({
        left:   offsetX + box.x * renderedW,
        top:    offsetY + box.y * renderedH,
        width:  box.width  * renderedW,
        height: box.height * renderedH,
      })
    }

    compute()
    if (!el.complete) el.addEventListener('load', compute)
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => {
      el.removeEventListener('load', compute)
      ro.disconnect()
    }
  }, [box, imgRef])

  if (!rect) return null

  return (
    <div
      className="absolute pointer-events-none rounded-sm animate-pulse"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height,
               border: `2px solid ${color}` }}
    >
      {label && (
        <span
          className="absolute -top-5 left-0 text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
          style={{ background: color, color: '#fff' }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
