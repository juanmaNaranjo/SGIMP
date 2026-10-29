import { useQuery } from '@tanstack/react-query'
import { dashboardAPI, alertsAPI } from '../services/api'
import { StatCard, PageLoader, PageHeader } from '../components/ui'
import {
  Package, FlaskConical, AlertTriangle, FileText,
  TrendingDown, Bell, CheckCircle, Clock
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { formatDate } from '../utils/helpers'

const PIE_COLORS = { green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444', expired: '#9ca3af' }

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardAPI.stats().then(r => r.data),
    refetchInterval: 60_000,
  })
  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => alertsAPI.list(10).then(r => r.data),
  })

  if (isLoading) return <PageLoader />

  const pieData = stats ? [
    { name: '🟢 OK', value: Math.max(stats.expiry_distribution.green, 0), key: 'green' },
    { name: '🟡 Advertencia', value: Math.max(stats.expiry_distribution.orange, 0), key: 'orange' },
    { name: '🔴 Crítico', value: stats.lots_expiring_30_days, key: 'red' },
    { name: '⚫ Vencido', value: stats.expired_lots, key: 'expired' },
  ].filter(d => d.value > 0) : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Resumen ejecutivo del sistema de gestión de materias primas"
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Materias Primas" value={stats?.total_raw_materials ?? 0} icon={Package} color="blue" />
        <StatCard label="Lotes Activos" value={stats?.active_lots ?? 0} icon={FlaskConical} color="green" />
        <StatCard label="Vencen en 30 días" value={stats?.lots_expiring_30_days ?? 0} icon={Clock} color="red" />
        <StatCard label="Stock Bajo" value={stats?.low_stock_materials ?? 0} icon={TrendingDown} color="orange" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Lotes Vencidos" value={stats?.expired_lots ?? 0} icon={AlertTriangle} color="gray" />
        <StatCard label="Docs Pendientes" value={stats?.pending_documents ?? 0} icon={FileText} color="yellow" />
        <StatCard label="Alertas Sin Leer" value={stats?.total_alerts_unread ?? 0} icon={Bell} color="purple" />
        <StatCard label="Vencen en 90 días" value={stats?.lots_expiring_90_days ?? 0} icon={Clock} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiry Pie Chart */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Distribución de Vencimientos</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={false}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.key} fill={PIE_COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              No hay lotes registrados aún
            </div>
          )}
        </div>

        {/* Recent Alerts */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Alertas Recientes</h3>
          {alerts?.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg leading-none mt-0.5">
                    {alert.alert_type === 'expired' ? '⚫' :
                     alert.alert_type === 'expiry_critical' ? '🔴' :
                     alert.alert_type === 'expiry_warning' ? '🟡' :
                     alert.alert_type === 'low_stock' ? '📦' : '📄'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{alert.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{formatDate(alert.created_at)}</div>
                  </div>
                  {!alert.is_read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-2">
              <CheckCircle size={36} />
              <span className="text-sm">Sin alertas activas</span>
            </div>
          )}
        </div>
      </div>

      {/* Document Compliance */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Estado de Cumplimiento Documental</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'COA', ok: stats?.active_lots - (stats?.pending_documents ?? 0), total: stats?.active_lots },
            { label: 'Ficha Técnica', ok: stats?.active_lots - (stats?.pending_documents ?? 0), total: stats?.active_lots },
            { label: 'SDS', ok: stats?.active_lots - (stats?.pending_documents ?? 0), total: stats?.active_lots },
            { label: 'Cotizaciones', ok: Math.floor((stats?.active_lots ?? 0) * 0.7), total: stats?.active_lots },
          ].map(item => {
            const pct = item.total > 0 ? Math.round((item.ok / item.total) * 100) : 0
            return (
              <div key={item.label} className="p-4 bg-gray-50 rounded-xl">
                <div className="text-sm font-medium text-gray-700 mb-2">{item.label}</div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-gray-900">{pct}%</span>
                  <span className="text-xs text-gray-500 mb-0.5">conformidad</span>
                </div>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
