import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, ImageIcon, Clock, CheckCircle, AlertTriangle, AlertCircle, XCircle } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../api/axios'

const StatCard = ({ label, value, icon: Icon, color, onClick }) => (
  <div onClick={onClick}
    className={`card flex items-center gap-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={22} className="text-white" />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value ?? 0}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  </div>
)

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#991b1b']

const LABEL_BADGE = {
  Normal:        'badge-normal',
  Benign:        'badge-benign',
  Malignant:     'badge-malignant',
  'Very Malignant': 'bg-red-900 text-white text-xs font-medium px-2 py-1 rounded-full',
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [pending, setPending] = useState([])
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => {})
    if (['radiolog','admin'].includes(user.role)) {
      api.get('/pending').then(r => setPending(r.data)).catch(() => {})
    }
  }, [])

  const pieData = [
    { name: 'Normal',        value: stats?.normal_count        || 0 },
    { name: 'Benign',        value: stats?.benign_count        || 0 },
    { name: 'Malignant',     value: stats?.malignant_count     || 0 },
    { name: 'Very Malignant',value: stats?.very_malignant_count|| 0 },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Bemorlar"    value={stats?.total_patients}  icon={Users}        color="bg-blue-500" />
        <StatCard label="Jami rasmlar" value={stats?.total_images}    icon={ImageIcon}    color="bg-indigo-500" />
        <StatCard label="Kutmoqda"    value={stats?.pending_count}   icon={Clock}        color="bg-yellow-500"
          onClick={['radiolog','admin'].includes(user.role) ? () => navigate('/review') : null} />
        <StatCard label="Tekshirilgan" value={stats?.reviewed_count}  icon={CheckCircle}  color="bg-green-500" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Normal"        value={stats?.normal_count}        icon={CheckCircle}  color="bg-green-400" />
        <StatCard label="Benign"        value={stats?.benign_count}        icon={AlertTriangle} color="bg-yellow-400" />
        <StatCard label="Malignant"     value={stats?.malignant_count}     icon={AlertCircle}  color="bg-red-500" />
        <StatCard label="Very Malignant" value={stats?.very_malignant_count} icon={XCircle}     color="bg-red-900" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pieData.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Diagnozlar taqsimoti</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {['radiolog','admin'].includes(user.role) && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Kutayotgan rasmlar</h3>
              {pending.length > 0 && (
                <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full font-medium">
                  {pending.length} ta
                </span>
              )}
            </div>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Barcha rasmlar tekshirilgan</p>
            ) : (
              <div className="space-y-2">
                {pending.slice(0, 5).map(img => (
                  <div key={img.id}
                    className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100"
                    onClick={() => navigate(`/review/${img.id}`)}>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{img.filename}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(img.uploaded_at).toLocaleDateString('uz-UZ')}
                      </p>
                    </div>
                    <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                      Kutmoqda
                    </span>
                  </div>
                ))}
                {pending.length > 5 && (
                  <button onClick={() => navigate('/review')}
                    className="w-full text-sm text-blue-600 hover:underline text-center py-2">
                    Yana {pending.length - 5} ta ko'rish →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
