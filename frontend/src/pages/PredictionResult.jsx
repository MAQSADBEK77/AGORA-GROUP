import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, AlertTriangle, AlertCircle, ArrowLeft, Thermometer } from 'lucide-react'
import api from '../api/axios'

const LABEL_INFO = {
  Normal: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'Mammografiya tasviri normal ko\'rinishda. Saraton belgilari aniqlanmadi.',
    recommendation: 'Yillik profilaktik tekshiruvni davom ettiring.',
  },
  Cancer: {
    icon: AlertCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'Saraton belgilari ehtimoli aniqlandi. Darhol mutaxassis ko\'rigidan o\'tish zarur.',
    recommendation: 'Onkolog va radiolog bilan zudlik bilan maslahatlashing.',
  },
}

function ProbBar({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

export default function PredictionResult() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pred, setPred] = useState(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/predictions/${id}`).then(r => setPred(r.data)).finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
    </div>
  )
  if (!pred) return <p className="text-center text-gray-500 mt-20">Natija topilmadi</p>

  const info = LABEL_INFO[pred.label] || LABEL_INFO.Normal
  const Icon = info.icon

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Orqaga
      </button>

      <div className={`card border ${info.border} ${info.bg}`}>
        <div className="flex items-start gap-4">
          <Icon size={36} className={info.color} />
          <div className="flex-1">
            <h2 className={`text-2xl font-bold ${info.color}`}>{pred.label}</h2>
            <p className="text-sm text-gray-600 mt-1">{info.text}</p>
            <div className="mt-3 p-3 bg-white bg-opacity-70 rounded-lg text-sm text-gray-700">
              <span className="font-medium">Tavsiya:</span> {info.recommendation}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Ehtimollik (Confidence)</h3>
        <div className="space-y-4">
          <ProbBar label="Normal"  value={pred.normal_prob || 0} color="bg-green-500" />
          <ProbBar label="Cancer"  value={pred.cancer_prob || 0} color="bg-red-500" />
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Umumiy ishonch darajasi: <span className="font-bold text-gray-800">{Math.round(pred.confidence * 100)}%</span>
        </p>
      </div>

      {pred.heatmap_path && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Thermometer size={18} className="text-red-500" />
              Grad-CAM Heatmap
            </h3>
            <button onClick={() => setShowHeatmap(!showHeatmap)} className="btn-secondary text-sm">
              {showHeatmap ? 'Yashirish' : 'Ko\'rish'}
            </button>
          </div>
          {showHeatmap && (
            <div className="rounded-lg overflow-hidden">
              <img src={`/api/heatmap/${pred.id}`} alt="Heatmap" className="w-full" />
              <p className="text-xs text-gray-400 text-center mt-2">
                Qizil hududlar — AI diqqatini jalb qilgan shubhali joylar
              </p>
            </div>
          )}
        </div>
      )}

      <div className="card bg-yellow-50 border border-yellow-200 space-y-2">
        <p className="text-xs text-yellow-800 text-center">
          ⚠️ Bu AI yordamchi tizimi hisoblanadi. Yakuniy diagnoz faqat malakali shifokor tomonidan qo'yiladi.
        </p>
        {pred.analysis_mode === 'heuristic' ? (
          <p className="text-xs text-orange-700 text-center bg-orange-50 rounded p-2 border border-orange-200">
            🔬 <b>Heuristic rejim</b> — trenirovka qilingan model yuklanmagan.
            Natijalar to'qima zichligiga asoslanadi.
          </p>
        ) : (
          <p className="text-xs text-green-700 text-center bg-green-50 rounded p-2 border border-green-200">
            🤖 <b>AI Model rejim</b> — trenirovka qilingan EfficientNet-B4 ishlamoqda.
          </p>
        )}
      </div>
    </div>
  )
}
