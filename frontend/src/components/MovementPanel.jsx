import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { lotsAPI, extendedAPI } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowDown, ArrowUp, ArrowLeftRight, SlidersHorizontal, History } from 'lucide-react'
import { Modal, Field, Badge } from './ui'
import { formatDateTime } from '../utils/helpers'

const MOVEMENT_TYPES = [
  { value: 'exit',       label: '📤 Salida (consumo)',       color: 'bg-orange-100 text-orange-800' },
  { value: 'transfer',   label: '🔄 Transferencia bodega',   color: 'bg-blue-100 text-blue-800' },
  { value: 'adjustment', label: '⚖️ Ajuste de inventario',  color: 'bg-purple-100 text-purple-800' },
  { value: 'reject',     label: '❌ Baja / Rechazo',         color: 'bg-red-100 text-red-800' },
]

const MT_COLORS = {
  entry:      'bg-green-100 text-green-800',
  exit:       'bg-orange-100 text-orange-800',
  transfer:   'bg-blue-100 text-blue-800',
  adjustment: 'bg-purple-100 text-purple-800',
  reject:     'bg-red-100 text-red-800',
}
const MT_ICONS = { entry: '📥', exit: '📤', transfer: '🔄', adjustment: '⚖️', reject: '❌' }
const MT_LABELS = { entry: 'Ingreso', exit: 'Salida', transfer: 'Transferencia', adjustment: 'Ajuste', reject: 'Baja' }

/**
 * Panel completo de movimientos para un lote.
 * Muestra historial + botón para registrar salida/ajuste/etc.
 */
export default function MovementPanel({ lot, onClose }) {
  const qc = useQueryClient()
  const [movModal, setMovModal] = useState(false)
  const [form, setForm] = useState({
    movement_type: 'exit',
    quantity: '',
    reason: '',
    reference_number: '',
    notes: '',
  })

  const { data: movements, isLoading } = useQuery({
    queryKey: ['lot-movements', lot.id],
    queryFn: () => extendedAPI.getLotMovements(lot.id).then(r => r.data),
  })

  const movMut = useMutation({
    mutationFn: (data) => lotsAPI.movement(data),
    onSuccess: () => {
      qc.invalidateQueries(['lot-movements', lot.id])
      qc.invalidateQueries(['lots'])
      qc.invalidateQueries(['dashboard-stats'])
      setMovModal(false)
      setForm({ movement_type: 'exit', quantity: '', reason: '', reference_number: '', notes: '' })
      toast.success('Movimiento registrado correctamente')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al registrar movimiento'),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.quantity || parseFloat(form.quantity) <= 0) {
      toast.error('Ingresa una cantidad válida mayor a 0')
      return
    }
    movMut.mutate({
      lot_id: lot.id,
      movement_type: form.movement_type,
      quantity: parseFloat(form.quantity),
      reason: form.reason || null,
      reference_number: form.reference_number || null,
      notes: form.notes || null,
    })
  }

  return (
    <div className="space-y-4">
      {/* Lot summary */}
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-blue-500 font-medium">Lote</div>
          <div className="font-mono font-bold text-blue-800">{lot.internal_lot}</div>
        </div>
        <div>
          <div className="text-xs text-blue-500 font-medium">Disponible</div>
          <div className="font-bold text-gray-800">{lot.quantity_available} {lot.unit_of_measure}</div>
        </div>
        <div>
          <div className="text-xs text-blue-500 font-medium">Materia Prima</div>
          <div className="text-gray-700 truncate">{lot.raw_material?.initial_name || '—'}</div>
        </div>
      </div>

      {/* New movement button */}
      <button
        className="btn-primary w-full justify-center"
        onClick={() => setMovModal(true)}
        disabled={lot.status !== 'approved'}
      >
        <SlidersHorizontal size={15} />
        Registrar Movimiento
      </button>
      {lot.status !== 'approved' && (
        <p className="text-xs text-gray-400 text-center -mt-2">
          Solo lotes aprobados pueden tener movimientos de salida
        </p>
      )}

      {/* Movement history */}
      <div>
        <h4 className="font-semibold text-gray-700 text-sm flex items-center gap-2 mb-3">
          <History size={15} /> Historial de movimientos ({movements?.length ?? 0})
        </h4>
        {isLoading ? (
          <div className="text-sm text-gray-400 text-center py-4">Cargando...</div>
        ) : movements?.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4 italic">Sin movimientos</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {movements.map((mv) => (
              <div key={mv.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-lg leading-none">{MT_ICONS[mv.movement_type] || '•'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={MT_COLORS[mv.movement_type] || 'bg-gray-100'}>
                      {MT_LABELS[mv.movement_type] || mv.movement_type}
                    </Badge>
                    <span className="text-sm font-bold text-gray-800">
                      {mv.movement_type === 'entry' ? '+' : mv.movement_type === 'adjustment' ? '±' : '-'}
                      {mv.quantity}
                    </span>
                    <span className="text-xs text-gray-400">
                      {mv.quantity_before} → {mv.quantity_after}
                    </span>
                  </div>
                  {mv.reason && <p className="text-xs text-gray-500 mt-1">📝 {mv.reason}</p>}
                  {mv.reference_number && <p className="text-xs text-blue-600 mt-0.5">Ref: {mv.reference_number}</p>}
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(mv.movement_date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Movement form modal */}
      <Modal open={movModal} onClose={() => setMovModal(false)} title="Registrar Movimiento" size="md">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            💡 <strong>Disponible:</strong> {lot.quantity_available} {lot.unit_of_measure}
          </div>

          <Field label="Tipo de Movimiento" required>
            <div className="grid grid-cols-2 gap-2">
              {MOVEMENT_TYPES.map(mt => (
                <button
                  key={mt.value}
                  type="button"
                  onClick={() => set('movement_type', mt.value)}
                  className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all ${
                    form.movement_type === mt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  {mt.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label={`Cantidad (${lot.unit_of_measure})`} required>
              <input
                type="number"
                step="0.001"
                min="0.001"
                max={form.movement_type !== 'entry' ? lot.quantity_available : undefined}
                className="input"
                value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
                placeholder={`Máx: ${lot.quantity_available}`}
              />
            </Field>
            <Field label="N° de Referencia / Orden">
              <input
                className="input"
                value={form.reference_number}
                onChange={e => set('reference_number', e.target.value)}
                placeholder="Ej: OP-2024-001"
              />
            </Field>
          </div>

          <Field label="Motivo" required>
            <input
              className="input"
              value={form.reason}
              onChange={e => set('reason', e.target.value)}
              placeholder={
                form.movement_type === 'exit' ? 'Ej: Producción lote PL-001' :
                form.movement_type === 'transfer' ? 'Ej: Reubicación a bodega B' :
                form.movement_type === 'adjustment' ? 'Ej: Corrección por conteo físico' :
                'Ej: Material fuera de especificaciones'
              }
            />
          </Field>

          <Field label="Notas adicionales">
            <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </Field>

          {/* Preview of result */}
          {form.quantity && parseFloat(form.quantity) > 0 && (
            <div className="p-3 bg-gray-50 rounded-xl border text-sm">
              <span className="text-gray-500">Stock resultante: </span>
              <strong className={
                (lot.quantity_available - parseFloat(form.quantity)) < 0 ? 'text-red-600' : 'text-green-700'
              }>
                {form.movement_type === 'entry'
                  ? lot.quantity_available + parseFloat(form.quantity)
                  : Math.max(0, lot.quantity_available - parseFloat(form.quantity))
                } {lot.unit_of_measure}
              </strong>
              {form.movement_type !== 'entry' && parseFloat(form.quantity) > lot.quantity_available && (
                <span className="text-red-600 ml-2 text-xs">⚠️ Supera el disponible</span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setMovModal(false)}>Cancelar</button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={movMut.isPending || !form.quantity || !form.reason}
            >
              {movMut.isPending ? 'Registrando...' : 'Registrar movimiento'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
