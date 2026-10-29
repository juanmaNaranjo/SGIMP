import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { docsAPI, lotsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Upload, Download, Trash2, FileText, Search } from 'lucide-react'
import { PageHeader, PageLoader, Modal, EmptyState, Badge, Field } from '../components/ui'
import { formatDate, DOC_TYPE_LABELS, downloadBlob } from '../utils/helpers'

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS)

function UploadForm({ lots, onClose, onSave }) {
  const [form, setForm] = useState({
    lot_id: '', doc_type: 'coa', issue_date: '', expiry_date: '', notes: '',
  })
  const [file, setFile] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!file || !form.lot_id || !form.doc_type) {
      toast.error('Completa los campos requeridos y selecciona un archivo')
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('lot_id', form.lot_id)
    fd.append('doc_type', form.doc_type)
    if (form.issue_date) fd.append('issue_date', form.issue_date)
    if (form.expiry_date) fd.append('expiry_date', form.expiry_date)
    if (form.notes) fd.append('notes', form.notes)
    onSave(fd)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Lote" required>
          <select className="input" value={form.lot_id} onChange={e => set('lot_id', e.target.value)}>
            <option value="">Selecciona lote...</option>
            {lots?.map(lot => (
              <option key={lot.id} value={lot.id}>
                {lot.internal_lot} — {lot.raw_material?.initial_name || 'N/A'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo de Documento" required>
          <select className="input" value={form.doc_type} onChange={e => set('doc_type', e.target.value)}>
            {DOC_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Fecha de Emisión">
          <input type="date" className="input" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} />
        </Field>
        <Field label="Fecha de Vencimiento Doc.">
          <input type="date" className="input" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
        </Field>
      </div>

      {/* File drop zone */}
      <Field label="Archivo (PDF, JPEG, PNG)" required>
        <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
        }`}>
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" onChange={e => setFile(e.target.files[0])} />
          {file ? (
            <div className="text-center">
              <div className="text-2xl mb-1">📄</div>
              <div className="text-sm font-medium text-green-700">{file.name}</div>
              <div className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          ) : (
            <div className="text-center">
              <Upload size={24} className="text-gray-400 mx-auto mb-2" />
              <div className="text-sm text-gray-500">Arrastra o haz clic para subir</div>
              <div className="text-xs text-gray-400 mt-1">PDF, JPEG, PNG · Máx 50MB</div>
            </div>
          )}
        </label>
      </Field>

      <Field label="Notas">
        <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Observaciones opcionales..." />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={handleSubmit}>
          <Upload size={15} /> Cargar Documento
        </button>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [selectedLot, setSelectedLot] = useState(null)

  const { data: lotsData } = useQuery({
    queryKey: ['lots-for-docs'],
    queryFn: () => lotsAPI.list({ size: 200 }).then(r => r.data),
  })
  const lots = lotsData?.items || []

  const { data: lotDocs, isLoading } = useQuery({
    queryKey: ['docs', selectedLot],
    queryFn: () => docsAPI.byLot(selectedLot).then(r => r.data),
    enabled: !!selectedLot,
  })

  const { data: missingReport } = useQuery({
    queryKey: ['missing-docs'],
    queryFn: () => docsAPI.missing().then(r => r.data),
  })

  const uploadMut = useMutation({
    mutationFn: docsAPI.upload,
    onSuccess: () => {
      qc.invalidateQueries(['docs'])
      qc.invalidateQueries(['lots'])
      qc.invalidateQueries(['missing-docs'])
      setModal(false)
      toast.success('Documento cargado exitosamente')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al subir documento'),
  })

  const deleteMut = useMutation({
    mutationFn: docsAPI.delete,
    onSuccess: () => { qc.invalidateQueries(['docs']); toast.success('Documento eliminado') },
  })

  const handleDownload = async (docId, filename) => {
    try {
      const res = await docsAPI.download(docId)
      downloadBlob(res.data, filename)
    } catch {
      toast.error('Error al descargar el archivo')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión Documental"
        subtitle="Repositorio centralizado de documentos por lote"
        actions={
          <button className="btn-primary" onClick={() => setModal(true)}>
            <Upload size={15} /> Cargar Documento
          </button>
        }
      />

      {/* Missing Documents Alert */}
      {missingReport?.length > 0 && (
        <div className="card border-l-4 border-l-orange-500 bg-orange-50">
          <h3 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
            ⚠️ Lotes con documentación incompleta ({missingReport.length})
          </h3>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {missingReport.map((item, i) => (
              <div key={i} className="text-sm text-orange-700 flex items-center gap-2">
                <span className="font-mono text-xs bg-orange-100 px-1.5 py-0.5 rounded">{item.internal_lot}</span>
                <span>Faltan: {item.missing_documents.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lot selector + docs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lot list */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">Selecciona un Lote</h3>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {lots.map(lot => (
              <button
                key={lot.id}
                className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${selectedLot === lot.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
                onClick={() => setSelectedLot(lot.id)}
              >
                <div className="font-mono text-xs text-blue-600">{lot.internal_lot}</div>
                <div className="text-sm text-gray-700 truncate">{lot.raw_material?.initial_name}</div>
                <div className="flex gap-1.5 mt-1">
                  {[
                    { key: 'has_coa', label: 'COA' },
                    { key: 'has_technical_sheet', label: 'FT' },
                    { key: 'has_safety_sheet', label: 'SDS' },
                  ].map(({ key, label }) => (
                    <span key={key} className={`text-xs px-1.5 py-0.5 rounded ${lot[key] ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {lot[key] ? '✓' : '✗'} {label}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Documents for selected lot */}
        <div className="lg:col-span-2 card">
          {!selectedLot ? (
            <EmptyState icon={FileText} title="Selecciona un lote" subtitle="Para ver sus documentos asociados" />
          ) : isLoading ? (
            <PageLoader />
          ) : lotDocs?.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Sin documentos"
              subtitle="Este lote no tiene documentos cargados aún"
              action={<button className="btn-primary" onClick={() => setModal(true)}><Upload size={15} />Cargar primero</button>}
            />
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800 mb-4">Documentos del lote ({lotDocs.length})</h3>
              {lotDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-2xl">📄</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</div>
                    <div className="text-xs text-gray-500 truncate">{doc.original_filename}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {doc.issue_date ? `Emisión: ${formatDate(doc.issue_date)}` : ''}
                      {doc.expiry_date ? ` · Vence: ${formatDate(doc.expiry_date)}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                      onClick={() => handleDownload(doc.id, doc.original_filename)}
                    >
                      <Download size={15} />
                    </button>
                    <button
                      className="p-2 hover:bg-red-50 rounded-lg text-red-500"
                      onClick={() => { if (confirm('¿Eliminar este documento?')) deleteMut.mutate(doc.id) }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Cargar Documento" size="lg">
        <UploadForm lots={lots} onClose={() => setModal(false)} onSave={(fd) => uploadMut.mutate(fd)} />
      </Modal>
    </div>
  )
}
