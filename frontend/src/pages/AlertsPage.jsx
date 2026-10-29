import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Bell, CheckCircle, RefreshCw, Eye } from 'lucide-react'
import { PageHeader, PageLoader, EmptyState, Badge } from '../components/ui'
import { formatDateTime } from '../utils/helpers'

const ALERT_ICONS = {
  expired: '⚫', expiry_critical: '🔴', expiry_warning: '🟡',
  low_stock: '📦', missing_document: '📄', incompatibility: '⚗️',
}
const ALERT_COLORS = {
  expired: 'border-l-gray-400 bg-gray-50',
  expiry_critical: 'border-l-red-500 bg-red-50',
  expiry_warning: 'border-l-yellow-400 bg-yellow-50',
  low_stock: 'border-l-orange-500 bg-orange-50',
  missing_document: 'border-l-blue-500 bg-blue-50',
  incompatibility: 'border-l-purple-500 bg-purple-50',
}

export default function AlertsPage() {
  const qc = useQueryClient()
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts-full'],
    queryFn: () => alertsAPI.list(200).then(r => r.data),
    refetchInterval: 30_000,
  })

  const markReadMut = useMutation({
    mutationFn: alertsAPI.markRead,
    onSuccess: () => qc.invalidateQueries(['alerts-full']),
  })
  const resolveMut = useMutation({
    mutationFn: alertsAPI.resolve,
    onSuccess: () => { qc.invalidateQueries(['alerts-full']); toast.success('Alerta resuelta') },
  })
  const generateMut = useMutation({
    mutationFn: alertsAPI.generate,
    onSuccess: (res) => {
      qc.invalidateQueries(['alerts-full'])
      toast.success(`Generadas: ${res.data.expiry_alerts + res.data.stock_alerts + res.data.document_alerts} alertas nuevas`)
    },
  })

  if (isLoading) return <PageLoader />

  const unread = alerts?.filter(a => !a.is_read) || []
  const resolved = alerts?.filter(a => a.is_resolved) || []
  const active = alerts?.filter(a => !a.is_resolved) || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centro de Alertas"
        subtitle={`${unread.length} sin leer · ${active.length} activas`}
        actions={
          <button className="btn-secondary" onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
            <RefreshCw size={15} className={generateMut.isPending ? 'animate-spin' : ''} />
            Generar alertas
          </button>
        }
      />

      {active.length === 0 ? (
        <div className="card">
          <EmptyState icon={CheckCircle} title="Sin alertas activas" subtitle="El sistema está en orden ✅" />
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(alert => (
            <div
              key={alert.id}
              className={`card border-l-4 py-4 ${ALERT_COLORS[alert.alert_type] || 'border-l-gray-300 bg-white'} ${!alert.is_read ? 'shadow-md' : 'opacity-80'}`}
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl leading-none">{ALERT_ICONS[alert.alert_type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 text-sm">{alert.title}</h4>
                    {!alert.is_read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(alert.created_at)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {!alert.is_read && (
                    <button
                      className="p-1.5 hover:bg-white rounded-lg text-gray-500 transition-colors"
                      title="Marcar leída"
                      onClick={() => markReadMut.mutate(alert.id)}
                    >
                      <Eye size={15} />
                    </button>
                  )}
                  <button
                    className="p-1.5 hover:bg-white rounded-lg text-green-600 transition-colors"
                    title="Resolver"
                    onClick={() => resolveMut.mutate(alert.id)}
                  >
                    <CheckCircle size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Alertas Resueltas ({resolved.length})</h3>
          <div className="space-y-2">
            {resolved.slice(0, 5).map(alert => (
              <div key={alert.id} className="card py-3 opacity-60 border-l-4 border-l-green-400">
                <div className="flex items-center gap-3">
                  <CheckCircle size={15} className="text-green-500 shrink-0" />
                  <span className="text-sm text-gray-600">{alert.title}</span>
                  <span className="text-xs text-gray-400 ml-auto">{formatDateTime(alert.resolved_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
