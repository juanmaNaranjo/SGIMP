import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { compatibilityAPI, rmAPI, aiAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Plus, Zap, AlertTriangle, CheckCircle, Bot } from 'lucide-react'
import DeleteButton from '../components/DeleteButton'
import { extendedAPI } from '../services/api'
import { PageHeader, Modal, EmptyState, Field, PageLoader, Badge } from '../components/ui'
import { GHS_ICONS } from '../utils/helpers'

const STATUS_CONFIG = {
  compatible:   { label: '✅ Compatible',   badge: 'bg-green-100 text-green-800',  border: 'border-l-green-500' },
  incompatible: { label: '❌ Incompatible', badge: 'bg-red-100 text-red-800',     border: 'border-l-red-500' },
  restricted:   { label: '⚠️ Restringido',  badge: 'bg-yellow-100 text-yellow-800', border: 'border-l-yellow-500' },
}

function AICompatibilityChecker({ materials }) {
  const [matA, setMatA] = useState('')
  const [matB, setMatB] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const check = async () => {
    const a = materials.find(m => String(m.id) === matA)
    const b = materials.find(m => String(m.id) === matB)
    if (!a || !b) return
    setLoading(true)
    setResult(null)
    try {
      const res = await aiAPI.checkCompatibility(a.initial_name, b.initial_name)
      setResult(res.data)
    } catch {
      toast.error('Error al consultar IA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card border-2 border-purple-200 bg-purple-50">
      <div className="flex items-center gap-2 mb-4">
        <Bot size={20} className="text-purple-600" />
        <h3 className="font-semibold text-purple-900">Consultar compatibilidad con IA</h3>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Field label="Materia Prima A">
          <select className="input" value={matA} onChange={e => setMatA(e.target.value)}>
            <option value="">Selecciona...</option>
            {materials?.map(m => <option key={m.id} value={m.id}>{m.initial_name}</option>)}
          </select>
        </Field>
        <Field label="Materia Prima B">
          <select className="input" value={matB} onChange={e => setMatB(e.target.value)}>
            <option value="">Selecciona...</option>
            {materials?.map(m => <option key={m.id} value={m.id}>{m.initial_name}</option>)}
          </select>
        </Field>
      </div>
      <button
        className="btn-primary bg-purple-600 hover:bg-purple-700"
        onClick={check}
        disabled={!matA || !matB || loading || matA === matB}
      >
        <Zap size={15} />
        {loading ? 'Consultando IA...' : 'Analizar compatibilidad'}
      </button>

      {result && (
        <div className={`mt-4 p-4 rounded-xl border ${
          result.compatible === true ? 'bg-green-50 border-green-200' :
          result.compatible === false ? 'bg-red-50 border-red-200' :
          'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="font-semibold text-sm mb-1">
            {result.compatible === true ? '✅ Compatible' :
             result.compatible === false ? '❌ Incompatible' : '⚠️ Incierto'}
          </div>
          <p className="text-sm text-gray-700">{result.reason}</p>
          {result.recommendation && (
            <p className="text-xs text-gray-500 mt-2 italic">💡 {result.recommendation}</p>
          )}
          <p className="text-xs text-purple-500 mt-2">Análisis generado por IA — verificar con SDS oficial</p>
        </div>
      )}
    </div>
  )
}

export default function CompatibilityPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ material_a_id: '', material_b_id: '', status: 'incompatible', reason: '', recommendation: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: compatibilities, isLoading } = useQuery({
    queryKey: ['compatibility'],
    queryFn: () => compatibilityAPI.list().then(r => r.data),
  })
  const { data: rmData } = useQuery({
    queryKey: ['rm-summary'],
    queryFn: () => rmAPI.list({ size: 200 }).then(r => r.data.items),
  })
  const materials = rmData || []

  const createMut = useMutation({
    mutationFn: compatibilityAPI.create,
    onSuccess: () => {
      qc.invalidateQueries(['compatibility'])
      setModal(false)
      toast.success('Regla de compatibilidad registrada')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al crear'),
  })

  const deleteMut = useMutation({
    mutationFn: extendedAPI.deleteCompatibility,
    onSuccess: () => { qc.invalidateQueries(['compatibility']); toast.success('Regla eliminada') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  if (isLoading) return <PageLoader />

  const incompatibles = compatibilities?.filter(c => c.status === 'incompatible') || []
  const compatibles = compatibilities?.filter(c => c.status === 'compatible') || []
  const restricted = compatibilities?.filter(c => c.status === 'restricted') || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compatibilidad Química"
        subtitle={`${incompatibles.length} incompatibilidades · ${restricted.length} restricciones registradas`}
        actions={
          <button className="btn-primary" onClick={() => setModal(true)}>
            <Plus size={15} /> Nueva Regla
          </button>
        }
      />

      {/* AI Checker */}
      <AICompatibilityChecker materials={materials} />

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card border-l-4 border-l-red-500 bg-red-50">
          <div className="text-2xl font-bold text-red-700">{incompatibles.length}</div>
          <div className="text-sm text-red-600">Incompatibilidades</div>
        </div>
        <div className="card border-l-4 border-l-yellow-500 bg-yellow-50">
          <div className="text-2xl font-bold text-yellow-700">{restricted.length}</div>
          <div className="text-sm text-yellow-600">Restricciones especiales</div>
        </div>
        <div className="card border-l-4 border-l-green-500 bg-green-50">
          <div className="text-2xl font-bold text-green-700">{compatibles.length}</div>
          <div className="text-sm text-green-600">Compatibilidades confirmadas</div>
        </div>
      </div>

      {/* Compatibility list */}
      {compatibilities?.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={AlertTriangle}
            title="Sin reglas de compatibilidad"
            subtitle="Registra las incompatibilidades conocidas para proteger el almacenamiento"
            action={<button className="btn-primary" onClick={() => setModal(true)}><Plus size={15} />Nueva Regla</button>}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Incompatible first */}
          {[...incompatibles, ...restricted, ...compatibles].map(c => {
            const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.compatible
            return (
              <div key={c.id} className={`card border-l-4 ${cfg.border} py-4`}>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">
                        {c.material_a?.initial_name || `MP #${c.material_a_id}`}
                      </span>
                      <span className="text-gray-400 text-sm">⟷</span>
                      <span className="font-semibold text-gray-900 text-sm">
                        {c.material_b?.initial_name || `MP #${c.material_b_id}`}
                      </span>
                      <Badge className={cfg.badge}>{cfg.label}</Badge>
                    </div>
                  <div className="ml-auto">
                    <DeleteButton size="icon" label="esta regla" warningText="Se eliminará permanentemente." onConfirm={() => deleteMut.mutateAsync(c.id)} />
                  </div>
                    {c.reason && (
                      <p className="text-sm text-gray-600 mt-1.5">📋 {c.reason}</p>
                    )}
                    {c.recommendation && (
                      <p className="text-xs text-gray-500 mt-1 italic">💡 {c.recommendation}</p>
                    )}
                    {/* GHS icons */}
                    <div className="flex gap-3 mt-2">
                      {c.material_a?.ghs_hazard_classes?.length > 0 && (
                        <div className="flex gap-1 text-sm">
                          {c.material_a.ghs_hazard_classes.map(g => <span key={g} title={g}>{GHS_ICONS[g]}</span>)}
                        </div>
                  <div className="ml-auto">
                    <DeleteButton size="icon" label="esta regla" warningText="Se eliminará permanentemente." onConfirm={() => deleteMut.mutateAsync(c.id)} />
                  </div>
                      )}
                      {c.material_b?.ghs_hazard_classes?.length > 0 && (
                        <div className="flex gap-1 text-sm">
                          {c.material_b.ghs_hazard_classes.map(g => <span key={g} title={g}>{GHS_ICONS[g]}</span>)}
                        </div>
                  <div className="ml-auto">
                    <DeleteButton size="icon" label="esta regla" warningText="Se eliminará permanentemente." onConfirm={() => deleteMut.mutateAsync(c.id)} />
                  </div>
                      )}
                    </div>
                  <div className="ml-auto">
                    <DeleteButton size="icon" label="esta regla" warningText="Se eliminará permanentemente." onConfirm={() => deleteMut.mutateAsync(c.id)} />
                  </div>
                  </div>
                  <div className="ml-auto">
                    <DeleteButton size="icon" label="esta regla" warningText="Se eliminará permanentemente." onConfirm={() => deleteMut.mutateAsync(c.id)} />
                  </div>
                </div>
                  <div className="ml-auto">
                    <DeleteButton size="icon" label="esta regla" warningText="Se eliminará permanentemente." onConfirm={() => deleteMut.mutateAsync(c.id)} />
                  </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva Regla de Compatibilidad" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Materia Prima A" required>
              <select className="input" value={form.material_a_id} onChange={e => set('material_a_id', e.target.value)}>
                <option value="">Selecciona...</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.initial_name}</option>)}
              </select>
            </Field>
            <Field label="Materia Prima B" required>
              <select className="input" value={form.material_b_id} onChange={e => set('material_b_id', e.target.value)}>
                <option value="">Selecciona...</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.initial_name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Estado" required>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="incompatible">❌ Incompatible — No almacenar juntos</option>
              <option value="restricted">⚠️ Restringido — Condiciones especiales</option>
              <option value="compatible">✅ Compatible — Almacenamiento seguro</option>
            </select>
          </Field>
          <Field label="Razón / Explicación">
            <textarea className="input" rows={2} value={form.reason} onChange={e => set('reason', e.target.value)}
              placeholder="Ej: Hipoclorito + ácidos genera Cl2 (gas tóxico)" />
          </Field>
          <Field label="Recomendación">
            <textarea className="input" rows={2} value={form.recommendation} onChange={e => set('recommendation', e.target.value)}
              placeholder="Ej: Almacenar en bodegas separadas con ventilación independiente" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button
              className="btn-primary"
              onClick={() => createMut.mutate({
                material_a_id: parseInt(form.material_a_id),
                material_b_id: parseInt(form.material_b_id),
                status: form.status,
                reason: form.reason,
                recommendation: form.recommendation,
              })}
              disabled={!form.material_a_id || !form.material_b_id || form.material_a_id === form.material_b_id}
            >
              Guardar Regla
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
