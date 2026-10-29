import { format, differenceInDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export const formatDate = (d) => d ? format(typeof d === 'string' ? parseISO(d) : d, 'dd/MM/yyyy', { locale: es }) : '—'
export const formatDateTime = (d) => d ? format(typeof d === 'string' ? parseISO(d) : d, 'dd/MM/yyyy HH:mm', { locale: es }) : '—'

export function getExpiryInfo(expiryDate) {
  const today = new Date()
  const expiry = typeof expiryDate === 'string' ? parseISO(expiryDate) : expiryDate
  const days = differenceInDays(expiry, today)

  if (days < 0)  return { days, label: '⚫ Vencido',    color: 'expiry-expired', badge: 'bg-gray-200 text-gray-700' }
  if (days <= 30) return { days, label: '🔴 Crítico',   color: 'expiry-red',    badge: 'bg-red-100 text-red-800' }
  if (days <= 90) return { days, label: '🟠 Atención',  color: 'expiry-orange', badge: 'bg-orange-100 text-orange-800' }
  if (days <= 180) return { days, label: '🟡 Advertencia', color: 'expiry-yellow', badge: 'bg-yellow-100 text-yellow-800' }
  return { days, label: '🟢 OK',         color: 'expiry-green',  badge: 'bg-green-100 text-green-800' }
}

export const LOT_STATUS_LABELS = {
  pending: { label: 'Pendiente', badge: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Aprobado', badge: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rechazado', badge: 'bg-red-100 text-red-800' },
  expired: { label: 'Vencido', badge: 'bg-gray-200 text-gray-700' },
  consumed: { label: 'Consumido', badge: 'bg-blue-100 text-blue-800' },
  quarantine: { label: 'Cuarentena', badge: 'bg-purple-100 text-purple-800' },
}

export const DOC_TYPE_LABELS = {
  technical_sheet: 'Ficha Técnica',
  safety_sheet: 'Ficha de Seguridad (SDS)',
  coa: 'Certificado de Análisis',
  allergen_cert: 'Decl. Alérgenos',
  cruelty_free: 'No Testeado Animales',
  quotation: 'Cotización',
  ghs_sheet: 'Hoja GHS',
  other: 'Otro',
}

export const GHS_ICONS = {
  explosive: '💥',
  flammable: '🔥',
  oxidizing: '🔵',
  compressed_gas: '🫧',
  corrosive: '⚗️',
  toxic: '☠️',
  irritant: '❗',
  health_hazard: '⚕️',
  environmental: '🌿',
}

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}
