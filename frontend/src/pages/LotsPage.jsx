import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { lotsAPI, rmAPI, suppliersAPI, warehousesAPI } from '../services/api'
import { extendedAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Plus, CheckCircle, XCircle, FlaskConical, SlidersHorizontal } from 'lucide-react'
import {
  PageHeader, PageLoader, Modal, EmptyState,
  Pagination, Badge, Field
} from '../components/ui'
import { formatDate, getExpiryInfo, LOT_STATUS_LABELS } from '../utils/helpers'
import MovementPanel from '../components/MovementPanel'
import DeleteButton from '../components/DeleteButton'

function CreateLotForm({ onSave, onClose, rawMaterials, suppliers }) {
  const [form, setForm] = useState({
    raw_material_id: '', supplier_id: '', lot_number: '',
    quantity_received: '', unit_of_measure: 'kg',
    entry_date: new Date().toISOString().split('T')[0],
    expiry_date: '', notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Materia Prima" required>
          <select className="input" value={form.raw_material_id} onChange={e => set('raw_material_id', e.target.value)}>
            <option value="">Selecciona...</option>
            {rawMaterials?.map(rm => (
              <option key={rm.id} value={rm.id}>{rm.initial_name} ({rm.internal_code})</option>
            ))}
          </select>
        </Field>
        <Field label="Proveedor">
          <select className="input" value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}>
            <option value="">Sin proveedor</option>
            {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Número de Lote (Fabricante)" required>
          <input className="input" value={form.lot_number} onChange={e => set('lot_number', e.target.value)} placeholder="Ej: LOT-2024-001" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Cantidad">
            <input type="number" step="0.01" className="input" value={form.quantity_received} onChange={e => set('quantity_received', e.target.value)} />
          </Field>
          <Field label="UOM">
            <select className="input" value={form.unit_of_measure} onChange={e => set('unit_of_measure', e.target.value)}>
              {['kg','g','L','mL','unidad','ton'].map(u => <option key={u}>{u}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Fecha de Ingreso" required>
          <input type="date" className="input" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} />
        </Field>
        <Field label="Fecha de Vencimiento" required>
          <input type="date" className="input" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
        </Field>
      </div>
      <Field label="Notas">
        <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={() => onSave(form)}>Registrar Lote</button>
      </div>
    </div>
  )
}

function ApproveLotModal({ lot, onApprove, onClose, warehouses }) {
  const [locationId, setLocationId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [notes, setNotes] = useState('')
  const { data: locations } = useQuery({
    queryKey: ['locations', warehouseId],
    queryFn: () => warehousesAPI.locations(warehouseId).then(r => r.data),
    enabled: !!warehouseId,
  })

  const missing = []
  if (!lot.has_coa) missing.push('COA')
  if (!lot.has_technical_sheet) missing.push('Ficha Técnica')
  if (!lot.has_safety_sheet) missing.push('SDS')

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800">⚠️ Documentos faltantes:</p>
          <p className="text-sm text-yellow-700">{missing.join(', ')}</p>
          <p className="text-xs text-yellow-600 mt-1">No podrá aprobar hasta cargar los documentos requeridos.</p>
        </div>
      )}
      <Field label="Bodega">
        <select className="input" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
          <option value="">Selecciona bodega...</option>
          {warehouses?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </Field>
      <Field label="Ubicación" required>
        <select className="input" value={locationId} onChange={e => setLocationId(e.target.value)} disabled={!warehouseId}>
          <option value="">Selecciona ubicación...</option>
          {locations?.map(l => (
            <option key={l.id} value={l.id} disabled={l.is_occupied}>
              {l.code} {l.name ? `(${l.name})` : ''} {l.is_occupied ? '— Ocupado' : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notas de aprobación">
        <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button
          className="btn-primary bg-green-600 hover:bg-green-700"
          onClick={() => onApprove({ location_id: parseInt(locationId), notes })}
          disabled={!locationId || missing.length > 0}
        >
          <CheckCircle size={16} /> Aprobar Lote
        </button>
      </div>
    </div>
  )
}

export default function LotsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [movLot, setMovLot] = useState(null) // lot for movement panel

  const { data, isLoading } = useQuery({
    queryKey: ['lots', page, statusFilter],
    queryFn: () => lotsAPI.list({ page, size: 20, status: statusFilter || undefined }).then(r => r.data),
  })
  const { data: rawMaterials } = useQuery({ queryKey: ['rm-summary'], queryFn: () => rmAPI.list({ size: 200 }).then(r => r.data.items) })
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => suppliersAPI.list().then(r => r.data) })
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: () => warehousesAPI.list().then(r => r.data) })

  const createMut = useMutation({
    mutationFn: lotsAPI.create,
    onSuccess: () => { qc.invalidateQueries(['lots']); setModal(null); toast.success('Lote registrado') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al crear lote'),
  })
  const approveMut = useMutation({
    mutationFn: ({ id, data }) => lotsAPI.approve(id, data),
    onSuccess: () => { qc.invalidateQueries(['lots']); setModal(null); toast.success('✅ Lote aprobado') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al aprobar'),
  })
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => lotsAPI.reject(id, reason),
    onSuccess: () => { qc.invalidateQueries(['lots']); toast.success('Lote rechazado') },
  })
  const deleteMut = useMutation({
    mutationFn: extendedAPI.deleteLot,
    onSuccess: () => { qc.invalidateQueries(['lots']); toast.success('Lote eliminado') },
    onError: (e) => toast.error(e.response?.data?.detail || 'No se puede eliminar este lote'),
  })

  if (isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Gestión de Lotes"
        subtitle={`${data?.total ?? 0} lotes registrados`}
        actions={
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <Plus size={16} /> Nuevo Lote
          </button>
        }
      />

      <div className="card mb-4">
        <select className="input max-w-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="approved">Aprobado</option>
          <option value="rejected">Rechazado</option>
          <option value="expired">Vencido</option>
          <option value="consumed">Consumido</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        {data?.items?.length === 0 ? (
          <EmptyState icon={FlaskConical} title="Sin lotes" subtitle="Registra el primero" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Lote Interno','Materia Prima','Proveedor','Vencimiento','Disponible','Estado','Docs','Acciones'].map(h => (
                    <th key={h} className="table-header text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map(lot => {
                  const exp = getExpiryInfo(lot.expiry_date)
                  const statusInfo = LOT_STATUS_LABELS[lot.status] || {}
                  const docCount = [lot.has_coa, lot.has_technical_sheet, lot.has_safety_sheet, lot.has_quotation].filter(Boolean).length
                  return (
                    <tr key={lot.id} className="hover:bg-gray-50">
                      <td className="table-cell font-mono text-xs text-blue-600">{lot.internal_lot}</td>
                      <td className="table-cell font-medium text-sm">{lot.raw_material?.initial_name || '—'}</td>
                      <td className="table-cell text-sm text-gray-500">{lot.supplier?.name || '—'}</td>
                      <td className="table-cell">
                        <span className={`badge text-xs ${exp.badge}`}>{exp.label}</span>
                        <div className="text-xs text-gray-400 mt-0.5">{formatDate(lot.expiry_date)}</div>
                      </td>
                      <td className="table-cell">
                        <span className="font-semibold text-gray-800">{lot.quantity_available}</span>
                        <span className="text-xs text-gray-400 ml-1">{lot.unit_of_measure}</span>
                      </td>
                      <td className="table-cell">
                        <Badge className={statusInfo.badge}>{statusInfo.label}</Badge>
                      </td>
                      <td className="table-cell">
                        <span className={`text-xs font-medium ${docCount >= 3 ? 'text-green-600' : 'text-orange-600'}`}>
                          {docCount}/4
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          {/* Movement button — only approved lots */}
                          <button
                            className="p-1.5 hover:bg-blue-50 rounded text-blue-600"
                            title="Registrar movimiento (consumo)"
                            onClick={() => setMovLot(lot)}
                          >
                            <SlidersHorizontal size={14} />
                          </button>
                          {lot.status === 'pending' && (
                            <>
                              <button className="p-1.5 hover:bg-green-50 rounded" onClick={() => setModal({ mode: 'approve', data: lot })}>
                                <CheckCircle size={14} className="text-green-600" />
                              </button>
                              <button className="p-1.5 hover:bg-red-50 rounded" onClick={() => {
                                const reason = prompt('Motivo del rechazo:')
                                if (reason) rejectMut.mutate({ id: lot.id, reason })
                              }}>
                                <XCircle size={14} className="text-red-500" />
                              </button>
                            </>
                          )}
                          <DeleteButton
                            size="icon"
                            label={lot.internal_lot}
                            warningText="Solo se puede eliminar si no tiene movimientos registrados. Si tiene movimientos, usa Rechazar."
                            onConfirm={() => deleteMut.mutateAsync(lot.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination page={page} pages={data?.pages ?? 1} onPage={setPage} />

      {/* Create lot */}
      <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="Registrar Nuevo Lote" size="lg">
        <CreateLotForm
          rawMaterials={rawMaterials}
          suppliers={suppliers}
          onClose={() => setModal(null)}
          onSave={(form) => createMut.mutate({
            ...form,
            raw_material_id: parseInt(form.raw_material_id),
            supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
            quantity_received: parseFloat(form.quantity_received),
          })}
        />
      </Modal>

      {/* Approve lot */}
      <Modal open={modal?.mode === 'approve'} onClose={() => setModal(null)} title={`Aprobar: ${modal?.data?.internal_lot}`} size="md">
        {modal?.data && (
          <ApproveLotModal
            lot={modal.data}
            warehouses={warehouses}
            onClose={() => setModal(null)}
            onApprove={(data) => approveMut.mutate({ id: modal.data.id, data })}
          />
        )}
      </Modal>

      {/* Movement panel */}
      <Modal open={!!movLot} onClose={() => setMovLot(null)} title={`Movimientos — ${movLot?.internal_lot}`} size="lg">
        {movLot && <MovementPanel lot={movLot} onClose={() => setMovLot(null)} />}
      </Modal>
    </div>
  )
}
