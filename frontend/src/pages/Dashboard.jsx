import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, ImageIcon, Activity, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../api/axios'

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="card flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={22} className="text-white" />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  </div>
)

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444']

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/predictions?limit=5'),
    ]).then(([s, p]) => {
      setStats(s.data)
      setPredictions(p.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
    </div>
  )

  const pieData = [
    { name: 'Normal', value: stats?.normal_count || 0 },
    { name: 'Benign', value: stats?.benign_count || 0 },
    { name: 'Malignant', value: stats?.malignant_count || 0 },
  ]

  const labelBadge = (label) => {
    if (label === 'Normal')    return <span className="badge-normal">Normal</span>
    if (label === 'Benign')    return <span className="badge-benign">Benign</span>
    if (label === 'Malignant') return <span className="badge-malignant">Malignant</span>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Bemorlar" value={stats?.total_patients} icon={Users} color="bg-blue-500" />
        <StatCard label="Rasmlar" value={stats?.total_images} icon={ImageIcon} color="bg-indigo-500" />
        <StatCard label="Analizlar" value={stats?.total_predictions} icon={Activity} color="bg-purple-500" />
        <StatCard label="Normal" value={stats?.normal_count} icon={CheckCircle} color="bg-green-500" />
        <StatCard label="Xavfli" value={stats?.malignant_count} icon={AlertTriangle} color="bg-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Natijalar taqsimoti</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">So'nggi analizlar</h3>
          <div className="space-y-3">
            {predictions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">Hali analiz yo'q</p>
            )}
            {predictions.map(p => (
              <div key={p.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                onClick={() => navigate(`/predictions/${p.id}`)}>
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700">Analiz #{p.id}</span>
                </div>
                <div className="flex items-center gap-3">
                  {labelBadge(p.label)}
                  <span className="text-xs text-gray-400">
                    {Math.round(p.confidence * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
