import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { warehousesAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Plus, Warehouse, MapPin } from 'lucide-react'
import DeleteButton from '../components/DeleteButton'
import { extendedAPI } from '../services/api'
import { PageHeader, Modal, EmptyState, Field, PageLoader } from '../components/ui'

function WarehouseCard({ warehouse, onAddLocation }) {
  const { data: locations, isLoading } = useQuery({
    queryKey: ['locations', warehouse.id],
    queryFn: () => warehousesAPI.locations(warehouse.id).then(r => r.data),
  })

  const occupied = locations?.filter(l => l.is_occupied).length || 0
  const total = locations?.length || 0

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 rounded-xl">
            <Warehouse size={20} className="text-blue-700" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{warehouse.name}</h3>
            <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{warehouse.code}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-700">{occupied}/{total}</div>
          <div className="text-xs text-gray-400">posiciones ocupadas</div>
        </div>
      </div>

      {/* Capacity bar */}
      {total > 0 && (
        <div className="mb-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                occupied / total > 0.8 ? 'bg-red-500' :
                occupied / total > 0.5 ? 'bg-orange-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.round((occupied / total) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{Math.round((occupied / total) * 100)}% ocupado</span>
            <span>{total - occupied} disponibles</span>
          </div>
        </div>
      )}

      {/* Conditions */}
      {(warehouse.temperature_min || warehouse.temperature_max || warehouse.humidity_max) && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {warehouse.temperature_min !== null && warehouse.temperature_max !== null && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
              🌡️ {warehouse.temperature_min}–{warehouse.temperature_max}°C
            </span>
          )}
          {warehouse.humidity_max && (
            <span className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-lg">
              💧 HR ≤{warehouse.humidity_max}%
            </span>
          )}
        </div>
      )}

      {/* Location grid */}
      {isLoading ? (
        <div className="text-xs text-gray-400 text-center py-3">Cargando ubicaciones...</div>
      ) : (
        <div className="grid grid-cols-6 gap-1.5 mb-4">
          {locations?.map(loc => (
            <div
              key={loc.id}
              title={`${loc.code}${loc.is_occupied ? ' — Ocupado' : ' — Libre'}`}
              className={`h-8 rounded-lg flex items-center justify-center text-xs font-medium border transition-colors ${
                loc.is_occupied
                  ? 'bg-red-100 border-red-300 text-red-700'
                  : 'bg-green-100 border-green-300 text-green-700'
              }`}
            >
              {loc.code}
            </div>
          ))}
          {locations?.length === 0 && (
            <div className="col-span-6 text-center text-xs text-gray-400 py-2 italic">
              Sin ubicaciones configuradas
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-200 border border-green-300 rounded"></span>Libre</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-200 border border-red-300 rounded"></span>Ocupado</span>
        </div>
        <button className="btn-secondary py-1.5 text-xs" onClick={() => onAddLocation(warehouse.id)}>
          <Plus size={13} /> Agregar ubicación
        </button>
      </div>
    </div>
  )
}

export default function WarehousesPage() {
  const qc = useQueryClient()
  const [warehouseModal, setWarehouseModal] = useState(false)
  const [locationModal, setLocationModal] = useState(null) // warehouse_id
  const [wForm, setWForm] = useState({ code: '', name: '', description: '', temperature_min: '', temperature_max: '', humidity_max: '' })
  const [lForm, setLForm] = useState({ code: '', name: '', capacity: '' })

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesAPI.list().then(r => r.data),
  })

  const deleteWMut = useMutation({
    mutationFn: extendedAPI.deleteWarehouse,
    onSuccess: () => { qc.invalidateQueries(['warehouses']); toast.success('Bodega desactivada') },
    onError: (e) => toast.error(e.response?.data?.detail || 'No se puede eliminar'),
  })
  const deleteLMut = useMutation({
    mutationFn: extendedAPI.deleteLocation,
    onSuccess: () => { qc.invalidateQueries(['locations']); toast.success('Ubicación eliminada') },
    onError: (e) => toast.error(e.response?.data?.detail || 'No se puede eliminar'),
  })

  const createWMut = useMutation({
    mutationFn: warehousesAPI.create,
    onSuccess: () => {
      qc.invalidateQueries(['warehouses'])
      setWarehouseModal(false)
      setWForm({ code: '', name: '', description: '', temperature_min: '', temperature_max: '', humidity_max: '' })
      toast.success('Bodega creada')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al crear'),
  })

  const createLMut = useMutation({
    mutationFn: warehousesAPI.createLocation,
    onSuccess: () => {
      qc.invalidateQueries(['locations'])
      setLocationModal(null)
      setLForm({ code: '', name: '', capacity: '' })
      toast.success('Ubicación creada')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al crear'),
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mapa de Bodegas"
        subtitle="Visualización y gestión de ubicaciones de almacenamiento"
        actions={
          <button className="btn-primary" onClick={() => setWarehouseModal(true)}>
            <Plus size={15} /> Nueva Bodega
          </button>
        }
      />

      {warehouses?.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Warehouse}
            title="Sin bodegas configuradas"
            subtitle="Crea la primera bodega para empezar a gestionar ubicaciones"
            action={<button className="btn-primary" onClick={() => setWarehouseModal(true)}><Plus size={15} />Nueva Bodega</button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {warehouses.map(w => (
            <WarehouseCard key={w.id} warehouse={w} onAddLocation={setLocationModal} />
          ))}
        </div>
      )}

      {/* New Warehouse Modal */}
      <Modal open={warehouseModal} onClose={() => setWarehouseModal(false)} title="Nueva Bodega">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Código" required>
              <input className="input" value={wForm.code} onChange={e => setWForm(f => ({ ...f, code: e.target.value }))} placeholder="Ej: BOD-A" />
            </Field>
            <Field label="Nombre" required>
              <input className="input" value={wForm.name} onChange={e => setWForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Bodega Principal" />
            </Field>
          </div>
          <Field label="Descripción">
            <input className="input" value={wForm.description} onChange={e => setWForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Temp. Mín (°C)">
              <input type="number" className="input" value={wForm.temperature_min} onChange={e => setWForm(f => ({ ...f, temperature_min: e.target.value }))} />
            </Field>
            <Field label="Temp. Máx (°C)">
              <input type="number" className="input" value={wForm.temperature_max} onChange={e => setWForm(f => ({ ...f, temperature_max: e.target.value }))} />
            </Field>
            <Field label="HR Máx (%)">
              <input type="number" className="input" value={wForm.humidity_max} onChange={e => setWForm(f => ({ ...f, humidity_max: e.target.value }))} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setWarehouseModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={() => createWMut.mutate({
              ...wForm,
              temperature_min: wForm.temperature_min ? parseFloat(wForm.temperature_min) : null,
              temperature_max: wForm.temperature_max ? parseFloat(wForm.temperature_max) : null,
              humidity_max: wForm.humidity_max ? parseFloat(wForm.humidity_max) : null,
            })}>
              Crear Bodega
            </button>
          </div>
        </div>
      </Modal>

      {/* New Location Modal */}
      <Modal open={!!locationModal} onClose={() => setLocationModal(null)} title="Agregar Ubicación" size="sm">
        <div className="space-y-4">
          <Field label="Código de Ubicación" required>
            <input className="input" value={lForm.code} onChange={e => setLForm(f => ({ ...f, code: e.target.value }))} placeholder="Ej: A1, B3" />
          </Field>
          <Field label="Nombre">
            <input className="input" value={lForm.name} onChange={e => setLForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Estante 1 Nivel 2" />
          </Field>
          <Field label="Capacidad (kg)">
            <input type="number" className="input" value={lForm.capacity} onChange={e => setLForm(f => ({ ...f, capacity: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setLocationModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={() => createLMut.mutate({
              warehouse_id: locationModal,
              code: lForm.code,
              name: lForm.name || null,
              capacity: lForm.capacity ? parseFloat(lForm.capacity) : null,
            })}>
              Crear Ubicación
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
