import { useState, useEffect } from 'react'
import { BarChart2, CalendarDays, TrendingUp, Award, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import api from '../api/axios'

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#7f1d1d']
const LABEL_ORDER = ['Normal', 'Benign', 'Malignant', 'Very Malignant']

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

const DailyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 shadow-xl text-sm">
      <p className="font-semibold text-gray-800 dark:text-white">{label}</p>
      <p className="text-blue-600 dark:text-blue-400">{payload[0].value} ta tashxis</p>
    </div>
  )
}

export default function PersonalStats() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    api.get('/stats/personal').then(r => setStats(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <Activity size={32} className="text-blue-500 animate-pulse-slow" />
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    </div>
  )

  const dailyData = (stats?.daily_counts || []).map(d => ({
    name: d.date.slice(5), // MM-DD
    ta: d.count,
  }))

  const pieData = LABEL_ORDER
    .map(l => ({ name: l, value: stats?.label_counts?.[l] || 0 }))
    .filter(d => d.value > 0)

  const biradsEntries = Object.entries(stats?.birads_counts || {}).sort((a, b) => Number(a[0]) - Number(b[0]))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Shaxsiy statistika</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {user.full_name} — bajarilgan tashxislar bo'yicha shaxsiy hisobot
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Jami tashxis" value={stats?.total_reviewed} icon={Award}
          gradient="bg-gradient-to-br from-blue-500 to-blue-700" subtitle="Yakunlangan (qoralamalarsiz)" />
        <StatCard label="Bugun" value={stats?.today_count} icon={CalendarDays}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" subtitle="Bugungi natijalar" />
        <StatCard label="Shu hafta" value={stats?.week_count} icon={BarChart2}
          gradient="bg-gradient-to-br from-indigo-500 to-indigo-700" subtitle="Dushanbadan buyon" />
        <StatCard label="O'rtacha/kun" value={stats?.avg_per_day} icon={TrendingUp}
          gradient="bg-gradient-to-br from-amber-400 to-amber-600" subtitle={`Shu oy: ${stats?.month_count ?? 0} ta`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">So'nggi 14 kun faolligi</h3>
          {dailyData.some(d => d.ta > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<DailyTooltip />} />
                <Bar dataKey="ta" radius={[6, 6, 0, 0]} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-16">
              Hali tashxis yozilmagan
            </p>
          )}
        </div>

        {pieData.length > 0 && (
          <div className="card">
            <h3 className="font-bold text-gray-800 dark:text-white mb-4">Diagnozlar taqsimoti</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[LABEL_ORDER.indexOf(pieData[i].name)]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={8}
                  formatter={v => <span className="text-xs text-gray-600 dark:text-slate-400">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {biradsEntries.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">BI-RADS taqsimoti</h3>
          <div className="flex flex-wrap gap-3">
            {biradsEntries.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">BI-RADS {k}</span>
                <span className="text-lg font-bold text-gray-800 dark:text-white">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
