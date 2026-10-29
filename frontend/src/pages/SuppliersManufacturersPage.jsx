import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { suppliersAPI, manufacturersAPI } from '../services/api'
import { extendedAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Plus, Truck, Factory, Edit2, Search, Globe } from 'lucide-react'
import { PageHeader, Modal, EmptyState, Field, PageLoader } from '../components/ui'
import DeleteButton from '../components/DeleteButton'

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
function SupplierForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    name: '', nit: '', contact_name: '', contact_email: '',
    contact_phone: '', address: '', city: '', country: 'Colombia',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre" required><input className="input" value={form.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="NIT"><input className="input" value={form.nit || ''} onChange={e => set('nit', e.target.value)} placeholder="900.123.456-7" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Contacto"><input className="input" value={form.contact_name || ''} onChange={e => set('contact_name', e.target.value)} /></Field>
        <Field label="Email"><input type="email" className="input" value={form.contact_email || ''} onChange={e => set('contact_email', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Teléfono"><input className="input" value={form.contact_phone || ''} onChange={e => set('contact_phone', e.target.value)} /></Field>
        <Field label="Ciudad"><input className="input" value={form.city || ''} onChange={e => set('city', e.target.value)} /></Field>
      </div>
      <Field label="Dirección"><input className="input" value={form.address || ''} onChange={e => set('address', e.target.value)} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={() => onSave(form)}>{initial ? 'Guardar cambios' : 'Crear proveedor'}</button>
      </div>
    </div>
  )
}

export function SuppliersPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [searchName, setSearchName] = useState('')
  const [onlineInfo, setOnlineInfo] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersAPI.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: suppliersAPI.create,
    onSuccess: () => { qc.invalidateQueries(['suppliers']); setModal(null); toast.success('Proveedor creado') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => extendedAPI.updateManufacturer ? suppliersAPI.update(id, data) : suppliersAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['suppliers']); setModal(null); toast.success('Actualizado') },
  })
  const deleteMut = useMutation({
    mutationFn: extendedAPI.deleteSupplier,
    onSuccess: () => { qc.invalidateQueries(['suppliers']); toast.success('Proveedor desactivado') },
    onError: (e) => toast.error(e.response?.data?.detail || 'No se puede eliminar'),
  })

  const handleSearchOnline = async (name) => {
    setSearchLoading(true)
    setOnlineInfo(null)
    try {
      const res = await extendedAPI.searchSupplierOnline(name)
      setOnlineInfo(res.data)
    } catch {
      toast.error('No se pudo buscar en línea. Verifica tu ANTHROPIC_API_KEY.')
    } finally {
      setSearchLoading(false)
    }
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proveedores"
        subtitle={`${suppliers?.length ?? 0} proveedores activos`}
        actions={<button className="btn-primary" onClick={() => setModal({ mode: 'create' })}><Plus size={15} />Nuevo Proveedor</button>}
      />

      {/* AI Online Search */}
      <div className="card border-l-4 border-l-purple-400 bg-purple-50">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={18} className="text-purple-600" />
          <h3 className="font-semibold text-purple-900 text-sm">Buscar proveedor en internet (IA)</h3>
        </div>
        <div className="flex gap-3">
          <input
            className="input flex-1 max-w-sm bg-white"
            placeholder="Nombre del proveedor a buscar..."
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchName && handleSearchOnline(searchName)}
          />
          <button
            className="btn-primary bg-purple-600 hover:bg-purple-700"
            onClick={() => handleSearchOnline(searchName)}
            disabled={!searchName || searchLoading}
          >
            <Search size={15} />
            {searchLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {onlineInfo && (
          <div className="mt-3 p-3 bg-white rounded-xl border border-purple-100 text-sm text-gray-700 whitespace-pre-wrap">
            <strong className="text-purple-700">Resultados para "{onlineInfo.supplier}":</strong>
            <div className="mt-1">{onlineInfo.info}</div>
          </div>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {suppliers?.length === 0 ? (
          <EmptyState icon={Truck} title="Sin proveedores" subtitle="Registra el primero" />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {['Nombre', 'NIT', 'Contacto', 'Email', 'Ciudad', 'Acciones'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{s.name}</td>
                  <td className="table-cell text-sm font-mono">{s.nit || '—'}</td>
                  <td className="table-cell text-sm">{s.contact_name || '—'}</td>
                  <td className="table-cell text-sm text-blue-600">{s.contact_email || '—'}</td>
                  <td className="table-cell text-sm">{s.city || '—'}</td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <button className="p-1.5 hover:bg-gray-100 rounded" onClick={() => setModal({ mode: 'edit', data: s })}>
                        <Edit2 size={14} className="text-gray-500" />
                      </button>
                      <button className="p-1.5 hover:bg-purple-50 rounded" title="Buscar online" onClick={() => handleSearchOnline(s.name)}>
                        <Globe size={14} className="text-purple-500" />
                      </button>
                      <DeleteButton
                        size="icon"
                        label={s.name}
                        warningText="El proveedor quedará inactivo. Los lotes históricos se conservan."
                        onConfirm={() => deleteMut.mutateAsync(s.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Editar Proveedor' : 'Nuevo Proveedor'} size="lg">
        <SupplierForm
          initial={modal?.data}
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

// ─── MANUFACTURERS ────────────────────────────────────────────────────────────
function ManufacturerForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    name: '', country: '', contact_email: '', contact_phone: '', website: '', notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre" required><input className="input" value={form.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="País"><input className="input" value={form.country || ''} onChange={e => set('country', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Email"><input type="email" className="input" value={form.contact_email || ''} onChange={e => set('contact_email', e.target.value)} /></Field>
        <Field label="Teléfono"><input className="input" value={form.contact_phone || ''} onChange={e => set('contact_phone', e.target.value)} /></Field>
      </div>
      <Field label="Sitio Web"><input className="input" value={form.website || ''} onChange={e => set('website', e.target.value)} placeholder="https://..." /></Field>
      <Field label="Notas"><textarea className="input" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={() => onSave(form)}>{initial ? 'Guardar cambios' : 'Crear fabricante'}</button>
      </div>
    </div>
  )
}

export function ManufacturersPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)

  const { data: manufacturers, isLoading } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: () => manufacturersAPI.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: manufacturersAPI.create,
    onSuccess: () => { qc.invalidateQueries(['manufacturers']); setModal(null); toast.success('Fabricante creado') },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => extendedAPI.updateManufacturer(id, data),
    onSuccess: () => { qc.invalidateQueries(['manufacturers']); setModal(null); toast.success('Actualizado') },
  })
  const deleteMut = useMutation({
    mutationFn: extendedAPI.deleteManufacturer,
    onSuccess: () => { qc.invalidateQueries(['manufacturers']); toast.success('Fabricante desactivado') },
    onError: (e) => toast.error(e.response?.data?.detail || 'No se puede eliminar'),
  })

  if (isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Fabricantes"
        subtitle={`${manufacturers?.length ?? 0} fabricantes activos`}
        actions={<button className="btn-primary" onClick={() => setModal({ mode: 'create' })}><Plus size={15} />Nuevo Fabricante</button>}
      />
      <div className="card p-0 overflow-hidden">
        {manufacturers?.length === 0 ? (
          <EmptyState icon={Factory} title="Sin fabricantes" subtitle="Registra el primero" />
        ) : (
          <table className="w-full">
            <thead>
              <tr>{['Nombre', 'País', 'Email', 'Teléfono', 'Web', 'Acciones'].map(h => <th key={h} className="table-header text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {manufacturers.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{m.name}</td>
                  <td className="table-cell text-sm">{m.country || '—'}</td>
                  <td className="table-cell text-sm text-blue-600">{m.contact_email || '—'}</td>
                  <td className="table-cell text-sm">{m.contact_phone || '—'}</td>
                  <td className="table-cell text-sm">
                    {m.website ? <a href={m.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Ver sitio</a> : '—'}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <button className="p-1.5 hover:bg-gray-100 rounded" onClick={() => setModal({ mode: 'edit', data: m })}>
                        <Edit2 size={14} className="text-gray-500" />
                      </button>
                      <DeleteButton
                        size="icon"
                        label={m.name}
                        warningText="Solo se puede desactivar si ninguna materia prima activa lo referencia."
                        onConfirm={() => deleteMut.mutateAsync(m.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Editar Fabricante' : 'Nuevo Fabricante'} size="md">
        <ManufacturerForm
          initial={modal?.data}
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
