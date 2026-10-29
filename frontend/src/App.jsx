import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RawMaterialsPage from './pages/RawMaterialsPage'
import LotsPage from './pages/LotsPage'
import DocumentsPage from './pages/DocumentsPage'
import AlertsPage from './pages/AlertsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AIAssistantPage from './pages/AIAssistantPage'
import WarehousesPage from './pages/WarehousesPage'
import CompatibilityPage from './pages/CompatibilityPage'
import ReportsPage from './pages/ReportsPage'
import { SuppliersPage, ManufacturersPage } from './pages/SuppliersManufacturersPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="materias-primas" element={<RawMaterialsPage />} />
        <Route path="lotes" element={<LotsPage />} />
        <Route path="documentos" element={<DocumentsPage />} />
        <Route path="bodegas" element={<WarehousesPage />} />
        <Route path="compatibilidad" element={<CompatibilityPage />} />
        <Route path="alertas" element={<AlertsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="asistente" element={<AIAssistantPage />} />
        <Route path="proveedores" element={<SuppliersPage />} />
        <Route path="fabricantes" element={<ManufacturersPage />} />
        <Route path="reportes" element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: { fontSize: '13px', maxWidth: '380px' },
              success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
