"""
SGIMP - Sistema de Gestión Integral de Materias Primas
FastAPI Backend - Punto de entrada principal
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.db.database import create_tables
from app.core.scheduler import setup_scheduler

# Endpoints
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.raw_materials import router as rm_router
from app.api.v1.endpoints.lots import router as lots_router
from app.api.v1.endpoints.documents import router as docs_router
from app.api.v1.endpoints.reports import router as reports_router
from app.api.v1.endpoints.analytics import (
    alerts_router, dashboard_router, analytics_router, ai_router
)
from app.api.v1.endpoints.catalog import (
    suppliers_router, manufacturers_router,
    warehouses_router, compatibility_router,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / Shutdown lifecycle."""
    logger.info("🚀 Iniciando SGIMP...")
    await create_tables()
    logger.info("✅ Tablas creadas/verificadas")
    setup_scheduler()
    yield
    logger.info("🛑 Deteniendo SGIMP...")


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Sistema de Gestión Integral de Materias Primas "
        "para Industria Cosmética/Farmacéutica. "
        "Incluye inventario, trazabilidad, gestión documental, "
        "riesgo químico GHS, alertas automáticas y análisis IA."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ─── MIDDLEWARE ───────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── ROUTERS ──────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(rm_router, prefix=API_PREFIX)
app.include_router(lots_router, prefix=API_PREFIX)
app.include_router(docs_router, prefix=API_PREFIX)
app.include_router(reports_router, prefix=API_PREFIX)
app.include_router(alerts_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(analytics_router, prefix=API_PREFIX)
app.include_router(ai_router, prefix=API_PREFIX)
app.include_router(suppliers_router, prefix=API_PREFIX)
app.include_router(manufacturers_router, prefix=API_PREFIX)
app.include_router(warehouses_router, prefix=API_PREFIX)
app.include_router(compatibility_router, prefix=API_PREFIX)


@app.get("/", tags=["Health"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/api/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}
