import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, Package, FlaskConical, FileText,
  Bell, BarChart2, Bot, Warehouse, Settings, LogOut,
  ChevronRight, AlertTriangle, Truck, Factory
} from 'lucide-react'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/materias-primas', icon: Package, label: 'Materias Primas' },
  { to: '/lotes', icon: FlaskConical, label: 'Lotes' },
  { to: '/documentos', icon: FileText, label: 'Documentos' },
  { to: '/bodegas', icon: Warehouse, label: 'Bodegas' },
  { to: '/compatibilidad', icon: AlertTriangle, label: 'Compatibilidad' },
  { to: '/alertas', icon: Bell, label: 'Alertas' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics & ML' },
  { to: '/asistente', icon: Bot, label: 'Asistente IA' },
  { divider: true },
  { to: '/proveedores', icon: Truck, label: 'Proveedores' },
  { to: '/fabricantes', icon: Factory, label: 'Fabricantes' },
  { to: '/reportes', icon: FileText, label: 'Reportes' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex flex-col h-full bg-brand-dark text-white w-64 shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-blue-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-400 rounded-lg flex items-center justify-center font-bold text-blue-900 text-sm">
            SG
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">SGIMP</div>
            <div className="text-xs text-blue-300 leading-tight">Gestión de Mat. Primas</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {NAV.map((item, i) =>
          item.divider ? (
            <div key={i} className="border-t border-blue-800 my-3" />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 group ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-100 hover:bg-blue-800 hover:text-white'
                }`
              }
            >
              <item.icon size={17} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          )
        )}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-blue-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
            {user?.full_name?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.full_name}</div>
            <div className="text-xs text-blue-300 capitalize">{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-blue-300 hover:text-white transition-colors w-full">
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
