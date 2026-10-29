import { useState } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { Modal } from './ui'

/**
 * Botón de eliminar con modal de confirmación.
 * Props:
 *   onConfirm: async fn — se llama al confirmar
 *   label: string — nombre del elemento a eliminar
 *   warningText: string — texto opcional de advertencia
 *   disabled: bool
 */
export default function DeleteButton({ onConfirm, label, warningText, disabled, size = 'sm' }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  const btnClass = size === 'icon'
    ? 'p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors'
    : 'btn-danger text-xs py-1.5'

  return (
    <>
      <button className={btnClass} onClick={() => setOpen(true)} disabled={disabled} title="Eliminar">
        <Trash2 size={14} />
        {size !== 'icon' && 'Eliminar'}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Confirmar eliminación" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">
                ¿Eliminar <strong>{label}</strong>?
              </p>
              {warningText && (
                <p className="text-xs text-red-600 mt-1">{warningText}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-danger" onClick={handleConfirm} disabled={loading}>
              <Trash2 size={14} />
              {loading ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
