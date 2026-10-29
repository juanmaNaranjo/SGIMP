import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rmAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, FlaskConical, Package } from 'lucide-react'
import DeleteButton from '../components/DeleteButton'
import { extendedAPI } from '../services/api'
import {
  PageHeader, PageLoader, Modal, EmptyState,
  Pagination, Badge, Field
} from '../components/ui'
import { GHS_ICONS } from '../utils/helpers'

const GHS_OPTIONS = [
  'explosive','flammable','oxidizing','compressed_gas',
  'corrosive','toxic','irritant','health_hazard','environmental'
]

function RawMaterialForm({ initial, onSave, onClose, categories, manufacturers }) {
  const [form, setForm] = useState(initial || {
    initial_name: '', commercial_name: '', cas_number: '',
    category_id: '', manufacturer_id: '', description: '',
    min_stock: 0, unit_of_measure: 'kg', ghs_hazard_classes: [],
    ghs_signal_word: '', is_fragrance: false, notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleGHS = (cls) => {
    const cur = form.ghs_hazard_classes || []
    set('ghs_hazard_classes', cur.includes(cls) ? cur.filter(c => c !== cls) : [...cur, cls])
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre Inicial (INCI)" required>
          <input className="input" value={form.initial_name} onChange={e => set('initial_name', e.target.value)} placeholder="Ej: Sodium Hypochlorite" />
        </Field>
        <Field label="Nombre Comercial">
          <input className="input" value={form.commercial_name || ''} onChange={e => set('commercial_name', e.target.value)} placeholder="Ej: Clorox" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Número CAS">
          <input className="input" value={form.cas_number || ''} onChange={e => set('cas_number', e.target.value)} placeholder="Ej: 7681-52-9" />
        </Field>
        <Field label="Categoría">
          <select className="input" value={form.category_id || ''} onChange={e => set('category_id', e.target.value || null)}>
            <option value="">Sin categoría</option>
            {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Fabricante">
          <select className="input" value={form.manufacturer_id || ''} onChange={e => set('manufacturer_id', e.target.value || null)}>
            <option value="">Sin fabricante</option>
            {manufacturers?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Unidad de Medida">
          <select className="input" value={form.unit_of_measure} onChange={e => set('unit_of_measure', e.target.value)}>
            {['kg','g','L','mL','unidad','ton'].map(u => <option key={u}>{u}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Stock Mínimo">
          <input type="number" className="input" value={form.min_stock} onChange={e => set('min_stock', parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label="Palabra de Señal GHS">
          <select className="input" value={form.ghs_signal_word || ''} onChange={e => set('ghs_signal_word', e.target.value)}>
            <option value="">Sin señal</option>
            <option value="Danger">⛔ Peligro (Danger)</option>
            <option value="Warning">⚠️ Advertencia (Warning)</option>
          </select>
        </Field>
      </div>

      {/* GHS Hazard Classes */}
      <Field label="Clases de Peligro GHS">
        <div className="flex flex-wrap gap-2 mt-1">
          {GHS_OPTIONS.map(cls => (
            <button
              key={cls}
              type="button"
              onClick={() => toggleGHS(cls)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                (form.ghs_hazard_classes || []).includes(cls)
                  ? 'bg-red-100 border-red-400 text-red-800'
                  : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {GHS_ICONS[cls]} {cls.replace('_', ' ')}
            </button>
          ))}
        </div>
      </Field>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="fragrance" checked={form.is_fragrance} onChange={e => set('is_fragrance', e.target.checked)} />
        <label htmlFor="fragrance" className="text-sm text-gray-700">Es fragancia (requiere declaración de alérgenos)</label>
      </div>

      <Field label="Descripción / Notas">
        <textarea className="input" rows={3} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={() => onSave(form)}>
          {initial ? 'Guardar cambios' : 'Crear materia prima'}
        </button>
      </div>
    </div>
  )
}

export default function RawMaterialsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | { mode: 'create'|'edit', data? }

  const { data, isLoading } = useQuery({
    queryKey: ['raw-materials', page, search],
    queryFn: () => rmAPI.list({ page, size: 20, search: search || undefined }).then(r => r.data),
  })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => rmAPI.categories().then(r => r.data) })
  const { data: manufacturers } = useQuery({ queryKey: ['manufacturers'], queryFn: () => import('../services/api').then(m => m.manufacturersAPI.list()).then(r => r.data) })

  const createMut = useMutation({
    mutationFn: rmAPI.create,
    onSuccess: () => { qc.invalidateQueries(['raw-materials']); setModal(null); toast.success('Materia prima creada') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al crear'),
  })
  const deleteMut = useMutation({
    mutationFn: extendedAPI.deleteRawMaterial,
    onSuccess: () => { qc.invalidateQueries(['raw-materials']); toast.success('Materia prima desactivada') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al eliminar'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => rmAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['raw-materials']); setModal(null); toast.success('Actualizada correctamente') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al actualizar'),
  })

  if (isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Catálogo de Materias Primas"
        subtitle={`${data?.total ?? 0} registros`}
        actions={
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <Plus size={16} /> Nueva Materia Prima
          </button>
        }
      />

      {/* Search */}
      <div className="card mb-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {data?.items?.length === 0 ? (
          <EmptyState icon={Package} title="Sin materias primas" subtitle="Crea la primera para comenzar"
            action={<button className="btn-primary" onClick={() => setModal({ mode: 'create' })}><Plus size={16} />Nueva</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Código', 'Nombre Inicial', 'Nombre Comercial', 'Categoría', 'Stock', 'GHS', 'Estado', ''].map(h => (
                    <th key={h} className="table-header text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map(rm => (
                  <tr key={rm.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-mono text-xs text-blue-600">{rm.internal_code}</td>
                    <td className="table-cell font-medium">{rm.initial_name}</td>
                    <td className="table-cell text-gray-500">{rm.commercial_name || '—'}</td>
                    <td className="table-cell">{rm.category?.name || '—'}</td>
                    <td className="table-cell">
                      <span className={rm.current_stock <= rm.min_stock && rm.min_stock > 0 ? 'text-red-600 font-semibold' : ''}>
                        {rm.current_stock} {rm.unit_of_measure}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {(rm.ghs_hazard_classes || []).map(cls => (
                          <span key={cls} title={cls} className="text-base">{GHS_ICONS[cls]}</span>
                        ))}
                        {rm.ghs_hazard_classes?.length === 0 && '—'}
                      </div>
                    </td>
                    <td className="table-cell">
                      <Badge className={rm.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                        {rm.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="table-cell">
                      <button
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                        onClick={() => setModal({ mode: 'edit', data: rm })}
                      >
                        <Edit2 size={15} />
                      </button>
                      <DeleteButton
                        size="icon"
                        label={rm.initial_name}
                        warningText="La materia prima quedará inactiva. Los lotes históricos se conservan."
                        onConfirm={() => deleteMut.mutateAsync(rm.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination page={page} pages={data?.pages ?? 1} onPage={setPage} />

      {/* Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Editar Materia Prima' : 'Nueva Materia Prima'}
        size="lg"
      >
        <RawMaterialForm
          initial={modal?.data}
          categories={categories}
          manufacturers={manufacturers}
          onClose={() => setModal(null)}
          onSave={(form) => {
            if (modal.mode === 'edit') updateMut.mutate({ id: modal.data.id, data: form })
            else createMut.mutate(form)
          }}
        />
      </Modal>
    </div>
  )
}
