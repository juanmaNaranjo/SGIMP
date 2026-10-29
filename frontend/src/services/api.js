import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sgimp_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sgimp_token')
      localStorage.removeItem('sgimp_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ─── AUTH ─────────────────────────────────────
export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', new URLSearchParams({ username, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  me: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
}

// ─── RAW MATERIALS ────────────────────────────
export const rmAPI = {
  list: (params) => api.get('/raw-materials', { params }),
  get: (id) => api.get(`/raw-materials/${id}`),
  create: (data) => api.post('/raw-materials', data),
  update: (id, data) => api.put(`/raw-materials/${id}`, data),
  lowStock: () => api.get('/raw-materials/low-stock/list'),
  categories: () => api.get('/raw-materials/categories/list'),
  createCategory: (data) => api.post('/raw-materials/categories', data),
}

// ─── LOTS ─────────────────────────────────────
export const lotsAPI = {
  list: (params) => api.get('/lots', { params }),
  get: (id) => api.get(`/lots/${id}`),
  create: (data) => api.post('/lots', data),
  approve: (id, data) => api.post(`/lots/${id}/approve`, data),
  reject: (id, reason) => api.post(`/lots/${id}/reject`, null, { params: { reason } }),
  movement: (data) => api.post('/lots/movements', data),
  expiring: (days) => api.get('/lots/expiring/report', { params: { days } }),
}

// ─── DOCUMENTS ────────────────────────────────
export const docsAPI = {
  upload: (formData) =>
    api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  byLot: (lotId) => api.get(`/documents/lot/${lotId}`),
  download: (docId) =>
    api.get(`/documents/${docId}/download`, { responseType: 'blob' }),
  delete: (docId) => api.delete(`/documents/${docId}`),
  missing: () => api.get('/documents/missing/report'),
}

// ─── ALERTS ───────────────────────────────────
export const alertsAPI = {
  list: (limit = 50) => api.get('/alerts', { params: { limit } }),
  generate: () => api.post('/alerts/generate'),
  markRead: (id) => api.patch(`/alerts/${id}/read`),
  resolve: (id) => api.patch(`/alerts/${id}/resolve`),
}

// ─── DASHBOARD ────────────────────────────────
export const dashboardAPI = {
  stats: () => api.get('/dashboard/stats'),
  trend: (rmId, months = 6) =>
    api.get(`/dashboard/consumption-trend/${rmId}`, { params: { months } }),
}

// ─── ANALYTICS / ML ───────────────────────────
export const analyticsAPI = {
  expiryRisk: () => api.get('/analytics/expiry-risk'),
  restock: () => api.get('/analytics/restock-recommendations'),
  chemicalRisk: (materialId) => api.get(`/analytics/chemical-risk/${materialId}`),
}

// ─── AI ───────────────────────────────────────
export const aiAPI = {
  chat: (data) => api.post('/ai/chat', data),
  checkCompatibility: (a, b) =>
    api.post('/ai/check-compatibility', null, { params: { material_a: a, material_b: b } }),
}

// ─── CATALOG ──────────────────────────────────
export const suppliersAPI = {
  list: () => api.get('/suppliers'),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
}

export const manufacturersAPI = {
  list: () => api.get('/manufacturers'),
  create: (data) => api.post('/manufacturers', data),
}

export const warehousesAPI = {
  list: () => api.get('/warehouses'),
  create: (data) => api.post('/warehouses', data),
  locations: (id) => api.get(`/warehouses/${id}/locations`),
  createLocation: (data) => api.post('/warehouses/locations', data),
}

export const compatibilityAPI = {
  list: () => api.get('/compatibility'),
  create: (data) => api.post('/compatibility', data),
  checkLocation: (materialId, locationId) =>
    api.post('/compatibility/check-location', null, {
      params: { material_id: materialId, warehouse_location_id: locationId },
    }),
}

// ─── REPORTS ──────────────────────────────────
export const reportsAPI = {
  inventoryExcel: () =>
    api.get('/reports/inventory-excel', { responseType: 'blob' }),
  traceability: (lotId) => api.get(`/reports/traceability/${lotId}`),
  expiryForecast: () => api.get('/reports/expiry-forecast'),
}

// ─── EXTENDED CATALOG DELETES ─────────────────
export const extendedAPI = {
  deleteSupplier: (id) => api.delete(`/suppliers/${id}`),
  deleteManufacturer: (id) => api.delete(`/manufacturers/${id}`),
  updateManufacturer: (id, data) => api.put(`/manufacturers/${id}`, data),
  deleteWarehouse: (id) => api.delete(`/warehouses/${id}`),
  updateWarehouse: (id, data) => api.put(`/warehouses/${id}`, data),
  deleteLocation: (id) => api.delete(`/warehouses/locations/${id}`),
  deleteCompatibility: (id) => api.delete(`/compatibility/${id}`),
  deleteRawMaterial: (id) => api.delete(`/raw-materials/${id}`),
  deleteLot: (id) => api.delete(`/lots/${id}`),
  getLotMovements: (id) => api.get(`/lots/${id}/movements`),
  searchSupplierOnline: (name) => api.get('/ai/search-supplier', { params: { name } }),
}
