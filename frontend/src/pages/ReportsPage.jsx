import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsAPI, lotsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Download, FileSpreadsheet, GitBranch, Calendar, Search } from 'lucide-react'
import { PageHeader, PageLoader, EmptyState } from '../components/ui'
import { formatDate, getExpiryInfo, downloadBlob } from '../utils/helpers'

export default function ReportsPage() {
  const [exporting, setExporting] = useState(false)
  const [selectedLot, setSelectedLot] = useState('')
  const [traceData, setTraceData] = useState(null)
  const [loadingTrace, setLoadingTrace] = useState(false)

  const { data: forecast, isLoading: loadingForecast } = useQuery({
    queryKey: ['expiry-forecast'],
    queryFn: () => reportsAPI.expiryForecast().then(r => r.data),
  })
  const { data: lotsData } = useQuery({
    queryKey: ['lots-for-reports'],
    queryFn: () => lotsAPI.list({ size: 200, status: 'approved' }).then(r => r.data),
  })

  const handleExcelExport = async () => {
    setExporting(true)
    try {
      const res = await reportsAPI.inventoryExcel()
      const today = new Date().toISOString().split('T')[0]
      downloadBlob(res.data, `inventario_sgimp_${today}.xlsx`)
      toast.success('Excel descargado correctamente')
    } catch {
      toast.error('Error al generar el reporte')
    } finally {
      setExporting(false)
    }
  }

  const handleTraceability = async () => {
    if (!selectedLot) return
    setLoadingTrace(true)
    try {
      const res = await reportsAPI.traceability(selectedLot)
      setTraceData(res.data)
    } catch {
      toast.error('Error al obtener trazabilidad')
    } finally {
      setLoadingTrace(false)
    }
  }

  const MOVEMENT_LABELS = {
    entry: { label: 'Ingreso', color: 'bg-green-100 text-green-800', icon: '📥' },
    exit: { label: 'Salida', color: 'bg-orange-100 text-orange-800', icon: '📤' },
    transfer: { label: 'Transferencia', color: 'bg-blue-100 text-blue-800', icon: '🔄' },
    adjustment: { label: 'Ajuste', color: 'bg-purple-100 text-purple-800', icon: '⚖️' },
    reject: { label: 'Rechazo', color: 'bg-red-100 text-red-800', icon: '❌' },
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        subtitle="Exportación de datos e informes de trazabilidad"
      />

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Excel Inventory */}
        <div className="card border-2 border-dashed border-green-300 hover:border-green-400 transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <FileSpreadsheet size={28} className="text-green-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800">Inventario Completo (Excel)</h3>
              <p className="text-sm text-gray-500 mt-1">
                Kardex completo con todos los lotes activos, fechas de vencimiento,
                semáforo de colores y estado documental.
              </p>
              <button
                className="btn-primary mt-4 bg-green-600 hover:bg-green-700"
                onClick={handleExcelExport}
                disabled={exporting}
              >
                <Download size={15} />
                {exporting ? 'Generando...' : 'Descargar Excel'}
              </button>
            </div>
          </div>
        </div>

        {/* Expiry Forecast Summary */}
        <div className="card border-2 border-dashed border-orange-300 hover:border-orange-400 transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <Calendar size={28} className="text-orange-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800">Pronóstico de Vencimientos</h3>
              <p className="text-sm text-gray-500 mt-1">
                Vista de todos los lotes que vencen en los próximos 180 días,
                ordenados por urgencia.
              </p>
              <div className="mt-3 flex gap-3 text-sm">
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded-lg text-xs font-medium">
                  🔴 {forecast?.filter(f => f.expiry_status === 'red').length ?? 0} críticos
                </span>
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-lg text-xs font-medium">
                  🟠 {forecast?.filter(f => f.expiry_status === 'orange').length ?? 0} atención
                </span>
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-lg text-xs font-medium">
                  🟡 {forecast?.filter(f => f.expiry_status === 'yellow').length ?? 0} advertencia
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expiry Forecast Table */}
      {!loadingForecast && forecast?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">
            Pronóstico de Vencimientos — Próximos 180 días ({forecast.length} lotes)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Lote Interno', 'Materia Prima', 'Fecha Vencimiento', 'Días', 'Cantidad', 'Estado'].map(h => (
                    <th key={h} className="table-header text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forecast.map((item, i) => {
                  const exp = getExpiryInfo(item.expiry_date)
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="table-cell font-mono text-xs text-blue-600">{item.internal_lot}</td>
                      <td className="table-cell font-medium text-sm">{item.raw_material_name}</td>
                      <td className="table-cell text-sm">{formatDate(item.expiry_date)}</td>
                      <td className={`table-cell text-sm font-semibold ${
                        item.days_to_expiry <= 30 ? 'text-red-600' :
                        item.days_to_expiry <= 90 ? 'text-orange-600' : 'text-yellow-600'
                      }`}>
                        {item.days_to_expiry} días
                      </td>
                      <td className="table-cell text-sm">{item.quantity_available} {item.unit_of_measure}</td>
                      <td className="table-cell">
                        <span className={`badge text-xs ${exp.badge}`}>{exp.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Traceability */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <GitBranch size={18} className="text-blue-600" />
          Trazabilidad de Lote
        </h3>
        <div className="flex gap-3 mb-6">
          <select
            className="input flex-1 max-w-sm"
            value={selectedLot}
            onChange={e => { setSelectedLot(e.target.value); setTraceData(null) }}
          >
            <option value="">Selecciona un lote...</option>
            {lotsData?.items?.map(lot => (
              <option key={lot.id} value={lot.id}>
                {lot.internal_lot} — {lot.raw_material?.initial_name || 'N/A'}
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            onClick={handleTraceability}
            disabled={!selectedLot || loadingTrace}
          >
            <Search size={15} />
            {loadingTrace ? 'Consultando...' : 'Ver trazabilidad'}
          </button>
        </div>

        {traceData && (
          <div className="space-y-6">
            {/* Lot Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div>
                <div className="text-xs text-blue-600 font-medium">Lote Interno</div>
                <div className="font-mono font-bold text-blue-800">{traceData.lot.internal_lot}</div>
              </div>
              <div>
                <div className="text-xs text-blue-600 font-medium">Lote Fabricante</div>
                <div className="font-medium text-gray-800">{traceData.lot.lot_number}</div>
              </div>
              <div>
                <div className="text-xs text-blue-600 font-medium">Fecha Ingreso</div>
                <div className="font-medium text-gray-800">{formatDate(traceData.lot.entry_date)}</div>
              </div>
              <div>
                <div className="text-xs text-blue-600 font-medium">Fecha Vencimiento</div>
                <div className={`font-medium ${traceData.lot.days_to_expiry < 30 ? 'text-red-600' : 'text-gray-800'}`}>
                  {formatDate(traceData.lot.expiry_date)}
                  <span className="text-xs text-gray-500 ml-1">({traceData.lot.days_to_expiry} días)</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-blue-600 font-medium">Cant. Recibida</div>
                <div className="font-medium text-gray-800">{traceData.lot.quantity_received}</div>
              </div>
              <div>
                <div className="text-xs text-blue-600 font-medium">Cant. Disponible</div>
                <div className="font-medium text-gray-800">{traceData.lot.quantity_available}</div>
              </div>
              <div>
                <div className="text-xs text-blue-600 font-medium">Estado</div>
                <div className="font-medium text-gray-800 capitalize">{traceData.lot.status}</div>
              </div>
              <div>
                <div className="text-xs text-blue-600 font-medium">Documentación</div>
                <div className="flex gap-1 flex-wrap">
                  {Object.entries(traceData.documents).map(([key, val]) => (
                    <span key={key} className={`text-xs px-1 rounded ${val ? 'text-green-700' : 'text-red-600'}`}>
                      {val ? '✓' : '✗'}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Movement Timeline */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 text-sm">
                Historial de Movimientos ({traceData.movements.length})
              </h4>
              {traceData.movements.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Sin movimientos registrados</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                  <div className="space-y-4">
                    {traceData.movements.map((mv, i) => {
                      const info = MOVEMENT_LABELS[mv.type] || { label: mv.type, color: 'bg-gray-100', icon: '•' }
                      return (
                        <div key={i} className="flex gap-4 relative">
                          <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-base shrink-0 z-10">
                            {info.icon}
                          </div>
                          <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <div className="flex items-center justify-between">
                              <span className={`badge text-xs ${info.color}`}>{info.label}</span>
                              <span className="text-xs text-gray-400">{formatDate(mv.date)}</span>
                            </div>
                            <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs text-gray-600">
                              <span>Cantidad: <strong>{mv.quantity}</strong></span>
                              <span>Antes: <strong>{mv.quantity_before}</strong></span>
                              <span>Después: <strong>{mv.quantity_after}</strong></span>
                            </div>
                            {mv.reason && (
                              <div className="text-xs text-gray-500 mt-1">📝 {mv.reason}</div>
                            )}
                            {mv.reference && (
                              <div className="text-xs text-blue-600 mt-0.5">Ref: {mv.reference}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!traceData && !loadingTrace && (
          <EmptyState
            icon={GitBranch}
            title="Selecciona un lote"
            subtitle="Para ver su ciclo de vida completo y todos sus movimientos"
          />
        )}
      </div>
    </div>
  )
}
