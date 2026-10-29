# 🧪 SGIMP — Sistema de Gestión Integral de Materias Primas

Sistema completo para gestión de inventarios de materias primas en la industria cosmética y farmacéutica. Incluye trazabilidad, gestión documental, análisis de riesgo químico GHS, alertas automáticas e inteligencia artificial.

---

## 🏗️ Arquitectura

```
sgimp/
├── backend/           # FastAPI + PostgreSQL + ML
│   ├── app/
│   │   ├── api/v1/    # Endpoints REST
│   │   ├── core/      # Config, seguridad, scheduler
│   │   ├── db/        # SQLAlchemy, seed
│   │   ├── models/    # Modelos ORM
│   │   ├── schemas/   # Schemas Pydantic
│   │   ├── services/  # Lógica de negocio
│   │   └── ml/        # Predicciones ML + IA Anthropic
│   └── requirements.txt
│
├── frontend/          # React + Tailwind + Recharts
│   └── src/
│       ├── pages/     # Páginas principales
│       ├── components/# UI reutilizable
│       ├── services/  # API client (Axios)
│       ├── hooks/     # Auth hook
│       └── utils/     # Helpers
│
└── docker-compose.yml # Orquestación completa
```

---

## 🚀 Inicio Rápido (Docker — Recomendado)

### 1. Clonar y configurar

```bash
git clone <repo> sgimp
cd sgimp

# Crear el archivo de variables de entorno (no se sube a Git)
cp .env.example .env
```

### 2. Completar el `.env` de la raíz

```env
POSTGRES_PASSWORD=una_clave_solo_letras_y_numeros
SECRET_KEY=valor-aleatorio-de-32-caracteres-o-mas   # openssl rand -hex 32
ANTHROPIC_API_KEY=sk-ant-tu-clave-aqui              # opcional
```

> Guía completa para otra máquina (requisitos, sin Docker, problemas comunes): ver **GUIA_INSTALACION.md**.

### 3. Levantar con Docker

```bash
docker-compose up -d
```

### 4. Inicializar base de datos

```bash
docker-compose exec backend python -m app.db.seed
```

### 5. Acceder

| Servicio   | URL                             |
|------------|--------------------------------|
| Frontend   | http://localhost:3000           |
| API Docs   | http://localhost:8000/api/docs  |
| ReDoc      | http://localhost:8000/api/redoc |

### Usuarios por defecto

| Usuario   | Contraseña    | Rol              |
|-----------|---------------|------------------|
| `admin`   | `Admin1234`   | Administrador    |
| `calidad` | `Calidad1234` | Analista Calidad |
| `almacen` | `Almacen1234` | Almacenista      |

---

## 🛠️ Desarrollo Local (sin Docker)

### Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables
cp .env.example .env
# Editar .env con tu configuración

# Iniciar servidor
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Disponible en http://localhost:3000
```

---

## 📦 Módulos del Sistema

### 1. 📊 Dashboard
- KPIs en tiempo real: lotes activos, vencimientos, alertas
- Gráfica de distribución por estado de semáforo
- Alertas recientes y cumplimiento documental

### 2. 🧬 Catálogo de Materias Primas
- Registro con nombre INCI, nombre comercial, CAS
- Clasificación GHS completa (9 clases de peligro)
- Control de stock mínimo y unidades de medida
- Generación automática de códigos internos `MP-YYYYMMDD-NNNN`

### 3. 🧪 Gestión de Lotes
- Registro de lotes con datos de proveedor y fabricante
- Flujo de aprobación con validación documental obligatoria
- Semáforo de vencimiento: 🟢🟡🟠🔴⚫
- Lotes internos `LOTE-YYYY-NNNNNN`

### 4. 📄 Gestión Documental
- Upload de PDF, JPEG, PNG por tipo de documento
- Tipos: COA, Ficha Técnica, SDS, Alérgenos, No crueldad, Cotización
- Reporte de lotes con documentos faltantes
- Descarga directa de archivos

### 5. 🏭 Mapa de Bodegas
- Configuración visual de bodegas y posiciones
- Control de temperatura, humedad y capacidad
- Visualización de ocupación en tiempo real

### 6. ⚗️ Compatibilidad Química
- Registro de reglas: Compatible / Incompatible / Restringido
- Verificación automática al asignar ubicaciones
- Consulta de compatibilidad por IA (Anthropic Claude)

### 7. 🔔 Centro de Alertas
- Alertas automáticas diarias (8:00 AM COL)
- Tipos: vencimiento crítico, stock bajo, documentos faltantes
- Marcado de leídas y resolución con auditoría

### 8. 📈 Analytics & ML
- **Predicción de vencimientos**: score de riesgo 0-100% por lote
- **Recomendaciones de reabastecimiento**: basado en consumo histórico
- **Análisis de riesgo químico GHS**: score por material
- Gráficas interactivas con Recharts

### 9. 🤖 Asistente IA (Claude)
- Chatbot especializado en materias primas cosméticas
- Contexto del sistema en tiempo real
- Consultas sobre GHS, normativas INVIMA, BPM
- Sugerencias de acciones concretas

### 10. 📊 Reportes
- **Exportación Excel**: Kardex completo con semáforo de colores
- **Trazabilidad**: historial completo de movimientos por lote
- **Pronóstico de vencimientos**: próximos 180 días

---

## ⚙️ Automatizaciones

| Automatización | Frecuencia | Descripción |
|----------------|------------|-------------|
| Alertas vencimiento | Diario 8 AM | Genera alertas para lotes próximos a vencer |
| Marcar lotes vencidos | Diario 00:05 | Cambia estado automáticamente |
| Predicciones ML | Lunes 6 AM | Actualiza scores de riesgo y reabastecimiento |
| Validación documental | En registro | Bloquea aprobación si faltan documentos |
| Verificación compatibilidad | En asignación | Impide almacenar materiales incompatibles |

---

## 🔌 API Endpoints

Accede a la documentación interactiva en `/api/docs`

| Grupo | Prefijo |
|-------|---------|
| Autenticación | `/api/v1/auth` |
| Materias Primas | `/api/v1/raw-materials` |
| Lotes | `/api/v1/lots` |
| Documentos | `/api/v1/documents` |
| Proveedores | `/api/v1/suppliers` |
| Fabricantes | `/api/v1/manufacturers` |
| Bodegas | `/api/v1/warehouses` |
| Compatibilidad | `/api/v1/compatibility` |
| Alertas | `/api/v1/alerts` |
| Dashboard | `/api/v1/dashboard` |
| Analytics ML | `/api/v1/analytics` |
| Asistente IA | `/api/v1/ai` |
| Reportes | `/api/v1/reports` |

---

## 🛡️ Roles de Usuario

| Rol | Permisos |
|-----|----------|
| `admin` | Acceso completo, configuración |
| `quality_analyst` | Documentos, aprobaciones, compatibilidad |
| `warehouse` | Lotes, movimientos, ubicaciones |
| `purchasing` | Proveedores, solicitudes de compra |
| `production` | Solo consulta de disponibilidad |
| `auditor` | Solo lectura, trazabilidad |

---

## 🧠 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0 async |
| Base de Datos | PostgreSQL 16 |
| ML / Data | scikit-learn, pandas, numpy |
| IA | Anthropic Claude (claude-sonnet-4) |
| Scheduler | APScheduler |
| Frontend | React 18, Vite, Tailwind CSS |
| Gráficas | Recharts |
| HTTP Client | Axios + TanStack Query |
| Contenedores | Docker + Docker Compose |
| Web Server | Nginx (producción) |

---

## 📋 Cumplimiento Normativo

El sistema está diseñado para apoyar el cumplimiento de:
- **INVIMA** — Instituto Nacional de Vigilancia de Medicamentos y Alimentos (Colombia)
- **Resolución 3774 de 2004** — Régimen sanitario para cosméticos
- **ISO 22716** — Buenas Prácticas de Manufactura Cosméticos
- **GHS/SGA** — Sistema Globalmente Armonizado de clasificación de peligros
- **ICH Q7** — Buenas Prácticas de Fabricación para API

---

*Desarrollado para la industria cosmética y farmacéutica colombiana.*
# SGIMP
