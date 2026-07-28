import { useState, useEffect } from 'react'
import { Activity, Users, TrendingUp, Percent } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import api from '../api/axios'

function StatCard({ label, value, icon: Icon, gradient, subtitle }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${gradient}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value ?? 0}</p>
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">{label}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

const SimpleTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 shadow-xl text-sm">
      <p className="font-semibold text-gray-800 dark:text-white">{label}</p>
      <p className="text-blue-600 dark:text-blue-400">{payload[0].value}{unit || ''}</p>
    </div>
  )
}

export default function QADashboard() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/stats/qa?months=6').then(r => setStats(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <Activity size={32} className="text-blue-500 animate-pulse-slow" />
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    </div>
  )

  const doctorData = (stats?.per_doctor || []).map(d => ({
    name: d.doctor_name.split(' ')[0],
    ta: d.total_reviewed,
  }))

  const trendData = (stats?.monthly_trend || []).map(m => ({
    name: m.month,
    ta: m.count,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">QA / Statistik dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Barcha radiologlar bo'yicha sifat nazorati va ish yuki ko'rsatkichlari
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Jami yakunlangan" value={stats?.total_reviewed} icon={Activity}
          gradient="bg-gradient-to-br from-blue-500 to-blue-700" subtitle="Barcha radiologlar" />
        <StatCard label="Recall rate" value={`${stats?.overall_recall_rate ?? 0}%`} icon={Percent}
          gradient="bg-gradient-to-br from-amber-400 to-amber-600" subtitle="Normal bo'lmagan tashxislar" />
        <StatCard label="Faol radiologlar" value={stats?.per_doctor?.length} icon={Users}
          gradient="bg-gradient-to-br from-indigo-500 to-indigo-700" subtitle="Kamida 1 ta tashxis yozgan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">Radiologlar bo'yicha ish yuki</h3>
          {doctorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={doctorData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<SimpleTooltip unit=" ta" />} />
                <Bar dataKey="ta" radius={[6, 6, 0, 0]} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-16">Hali ma'lumot yo'q</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">Oylik trend (so'nggi 6 oy)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<SimpleTooltip unit=" ta" />} />
              <Line type="monotone" dataKey="ta" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h3 className="font-bold text-gray-800 dark:text-white">Radiolog bo'yicha batafsil</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-900/50">
              <tr>
                {['Radiolog', 'Jami tashxis', 'Recall rate', "O'rtacha/kun"].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {(stats?.per_doctor || []).length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400">Hali ma'lumot yo'q</td></tr>
              ) : stats.per_doctor.map(d => (
                <tr key={d.doctor_id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-3 font-semibold text-gray-800 dark:text-white">{d.doctor_name}</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-slate-300">{d.total_reviewed} ta</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-slate-300">{d.recall_rate}%</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-slate-300">{d.avg_per_day}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
