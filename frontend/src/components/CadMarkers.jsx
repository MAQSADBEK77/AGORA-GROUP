import { useEffect, useState } from 'react'

/**
 * `shapes` — [{ type: 'polygon', points: [[x,y],...] } | { type: 'point', point: [x,y] }]
 * DICOM piksel koordinatalarida (rasmning asl o'lchamiga nisbatan). SVG `viewBox`
 * rasmning natural o'lchamiga moslanadi, shu sababli koordinatalar to'g'ridan-to'g'ri
 * (hech qanday qo'shimcha hisob-kitobsiz) rasm ustiga to'g'ri tushadi.
 */
export default function CadMarkers({ shapes, color = '#f97316', imgRef }) {
  const [box, setBox] = useState(null)

  useEffect(() => {
    const el = imgRef?.current
    if (!shapes?.length || !el) { setBox(null); return }

    function compute() {
      if (!el.naturalWidth || !el.naturalHeight || !el.clientWidth || !el.clientHeight) return
      const scale     = Math.min(el.clientWidth / el.naturalWidth, el.clientHeight / el.naturalHeight)
      const renderedW = el.naturalWidth * scale
      const renderedH = el.naturalHeight * scale
      setBox({
        left: (el.clientWidth - renderedW) / 2,
        top: (el.clientHeight - renderedH) / 2,
        width: renderedW,
        height: renderedH,
        natW: el.naturalWidth,
        natH: el.naturalHeight,
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
  }, [shapes, imgRef])

  if (!box) return null

  const strokeW = Math.max(box.natW / 500, 2)

  return (
    <svg className="absolute pointer-events-none animate-pulse"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      viewBox={`0 0 ${box.natW} ${box.natH}`} preserveAspectRatio="none">
      {shapes.map((s, i) => (
        s.type === 'polygon' ? (
          <polygon key={i} points={s.points.map(p => p.join(',')).join(' ')}
            fill="none" stroke={color} strokeWidth={strokeW} strokeLinejoin="round" />
        ) : (
          <circle key={i} cx={s.point[0]} cy={s.point[1]} r={box.natW / 220}
            fill="none" stroke={color} strokeWidth={strokeW} />
        )
      ))}
    </svg>
  )
}
