import { useEffect, useState } from 'react'

/**
 * `points` — DICOM piksel koordinatalari ([x, y] juftliklari), rasmning
 * asl (natural) o'lchamiga nisbatan. `imgRef` orqali object-contain
 * letterboxing hisobga olinadi.
 */
export default function CadMarkers({ points, color = '#f97316', title, imgRef }) {
  const [markers, setMarkers] = useState([])

  useEffect(() => {
    const el = imgRef?.current
    if (!points?.length || !el) { setMarkers([]); return }

    function compute() {
      if (!el.naturalWidth || !el.naturalHeight || !el.clientWidth || !el.clientHeight) return
      const scale     = Math.min(el.clientWidth / el.naturalWidth, el.clientHeight / el.naturalHeight)
      const renderedW = el.naturalWidth * scale
      const renderedH = el.naturalHeight * scale
      const offsetX   = (el.clientWidth - renderedW) / 2
      const offsetY   = (el.clientHeight - renderedH) / 2
      setMarkers(points.map(([x, y]) => ({
        left: offsetX + (x / el.naturalWidth) * renderedW,
        top:  offsetY + (y / el.naturalHeight) * renderedH,
      })))
    }

    compute()
    if (!el.complete) el.addEventListener('load', compute)
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => {
      el.removeEventListener('load', compute)
      ro.disconnect()
    }
  }, [points, imgRef])

  return (
    <>
      {markers.map((m, i) => (
        <div key={i} title={title}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 animate-pulse"
          style={{ left: m.left, top: m.top, width: 18, height: 18, borderColor: color, boxShadow: `0 0 0 2px rgba(0,0,0,0.4)` }}
        />
      ))}
    </>
  )
}
