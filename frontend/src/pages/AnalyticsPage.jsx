import { useQuery } from '@tanstack/react-query'
import { analyticsAPI } from '../services/api'
import { PageHeader, PageLoader, Badge } from '../components/ui'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, AlertTriangle, ShoppingCart, FlaskConical } from 'lucide-react'
import { formatDate } from '../utils/helpers'

function RiskBadge({ level }) {
  const styles = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }
  const labels = { critical: '🔴 Crítico', high: '🟠 Alto', medium: '🟡 Medio', low: '🟢 Bajo' }
  return <Badge className={styles[level] || 'bg-gray-100'}>{labels[level] || level}</Badge>
}

export default function AnalyticsPage() {
  const { data: expiryRisk, isLoading: loadingRisk } = useQuery({
    queryKey: ['expiry-risk'],
    queryFn: () => analyticsAPI.expiryRisk().then(r => r.data),
  })
  const { data: restock, isLoading: loadingRestock } = useQuery({
    queryKey: ['restock'],
    queryFn: () => analyticsAPI.restock().then(r => r.data),
  })

  if (loadingRisk || loadingRestock) return <PageLoader />

  const topRisk = (expiryRisk || []).slice(0, 10)
  const chartData = topRisk.map(p => ({
    name: p.raw_material_name.substring(0, 15) + (p.raw_material_name.length > 15 ? '…' : ''),
    riesgo: Math.round(p.risk_score * 100),
    dias: p.days_to_expiry,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics & Machine Learning"
        subtitle="Predicciones automáticas de vencimientos, reabastecimiento y riesgos"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500" size={22} />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {(expiryRisk || []).filter(r => r.risk_level === 'critical').length}
              </div>
              <div className="text-sm text-gray-500">Lotes riesgo crítico</div>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-orange-500">
          <div className="flex items-center gap-3">
            <ShoppingCart className="text-orange-500" size={22} />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {(restock || []).filter(r => r.urgency === 'high').length}
              </div>
              <div className="text-sm text-gray-500">Reabastecimiento urgente</div>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-blue-500" size={22} />
            <div>
              <div className="text-2xl font-bold text-gray-900">{(expiryRisk || []).length}</div>
              <div className="text-sm text-gray-500">Lotes analizados</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiry Risk Chart */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FlaskConical size={18} className="text-orange-500" />
            Top 10 Lotes por Riesgo de Vencimiento
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="riesgo" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No hay lotes activos</div>
          )}
        </div>

        {/* Restock Recommendations */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ShoppingCart size={18} className="text-blue-500" />
            Recomendaciones de Reabastecimiento
          </h3>
          {restock?.length > 0 ? (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {restock.map((rec, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm text-gray-800">{rec.raw_material_name}</div>
                    <RiskBadge level={rec.urgency} />
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <span>Stock: <strong className="text-gray-700">{rec.current_stock} / mín {rec.min_stock}</strong></span>
                    <span>Consumo/mes: <strong className="text-gray-700">{rec.avg_monthly_consumption}</strong></span>
                    <span>Agotamiento: <strong className="text-red-600">{rec.predicted_stockout_date ? formatDate(rec.predicted_stockout_date) : 'N/A'}</strong></span>
                    <span>Pedir: <strong className="text-blue-700">{rec.recommended_order_quantity}</strong></span>
                  </div>
                  <div className="mt-1.5">
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          rec.urgency === 'high' ? 'bg-red-500' :
                          rec.urgency === 'medium' ? 'bg-orange-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min((rec.current_stock / (rec.min_stock || 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              ✅ Todo el inventario está en niveles adecuados
            </div>
          )}
        </div>
      </div>

      {/* Full risk table */}
      {expiryRisk?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Análisis Detallado de Riesgo de Vencimiento</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Materia Prima', 'Lote', 'Vencimiento', 'Días', 'Cantidad', 'Score', 'Nivel'].map(h => (
                    <th key={h} className="table-header text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expiryRisk.map((pred, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="table-cell font-medium text-sm">{pred.raw_material_name}</td>
                    <td className="table-cell font-mono text-xs text-blue-600">{pred.lot_number}</td>
                    <td className="table-cell text-sm">{formatDate(pred.expiry_date)}</td>
                    <td className={`table-cell text-sm font-semibold ${pred.days_to_expiry < 30 ? 'text-red-600' : pred.days_to_expiry < 90 ? 'text-orange-600' : 'text-green-600'}`}>
                      {pred.days_to_expiry < 0 ? 'Vencido' : `${pred.days_to_expiry} días`}
                    </td>
                    <td className="table-cell text-sm">{pred.quantity_available} {pred.unit_of_measure}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pred.risk_score * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">{Math.round(pred.risk_score * 100)}%</span>
                      </div>
                    </td>
                    <td className="table-cell"><RiskBadge level={pred.risk_level} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
