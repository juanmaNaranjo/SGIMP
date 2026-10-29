"""
Endpoints de Alertas, Dashboard, Analytics e IA.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.db.database import get_db
from app.schemas.schemas import (
    AlertOut, DashboardStats, ChatRequest, ChatResponse,
    RestockRecommendation, RiskAnalysis
)
from app.services.alert_service import AlertService
from app.ml.ml_service import MLService
from app.ml.ai_service import AIService
from app.core.security import get_current_active_user
from app.models.models import (
    Alert, RawMaterial, Lot, LotStatus,
    InventoryMovement, WarehouseLocation, Warehouse
)

# ─────────────────────────────────────────────
# ALERTS
# ─────────────────────────────────────────────

alerts_router = APIRouter(prefix="/alerts", tags=["Alertas"])


@alerts_router.get("", response_model=list[AlertOut])
async def get_alerts(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    return [AlertOut.model_validate(a) for a in await AlertService.get_unread(db, limit)]


@alerts_router.post("/generate")
async def trigger_alert_generation(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Dispara generación manual de alertas (útil para testing)."""
    expiry = await AlertService.generate_expiry_alerts(db)
    stock = await AlertService.generate_low_stock_alerts(db)
    docs = await AlertService.generate_missing_document_alerts(db)
    return {
        "message": "Alertas generadas",
        "expiry_alerts": len(expiry),
        "stock_alerts": len(stock),
        "document_alerts": len(docs),
    }


@alerts_router.patch("/{alert_id}/read")
async def mark_alert_read(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    ok = await AlertService.mark_read(db, alert_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    return {"message": "Marcada como leída"}


@alerts_router.patch("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    ok = await AlertService.resolve(db, alert_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    return {"message": "Alerta resuelta"}


# ─────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────

dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@dashboard_router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    from datetime import date, timedelta

    total_rm = await db.scalar(select(func.count(RawMaterial.id)).where(RawMaterial.is_active == True))
    active_lots = await db.scalar(select(func.count(Lot.id)).where(Lot.status == LotStatus.APPROVED))
    expired_lots = await db.scalar(select(func.count(Lot.id)).where(Lot.status == LotStatus.EXPIRED))

    cutoff_30 = date.today() + timedelta(days=30)
    cutoff_90 = date.today() + timedelta(days=90)

    expiring_30 = await db.scalar(
        select(func.count(Lot.id)).where(
            Lot.expiry_date <= cutoff_30,
            Lot.expiry_date >= date.today(),
            Lot.status == LotStatus.APPROVED,
        )
    )
    expiring_90 = await db.scalar(
        select(func.count(Lot.id)).where(
            Lot.expiry_date <= cutoff_90,
            Lot.expiry_date >= date.today(),
            Lot.status == LotStatus.APPROVED,
        )
    )
    low_stock = await db.scalar(
        select(func.count(RawMaterial.id)).where(
            RawMaterial.current_stock <= RawMaterial.min_stock,
            RawMaterial.is_active == True,
            RawMaterial.min_stock > 0,
        )
    )

    # Pending docs (lots without all required docs)
    pending_docs_result = await db.execute(
        select(func.count(Lot.id)).where(
            Lot.status == LotStatus.PENDING,
            (Lot.has_coa == False) | (Lot.has_technical_sheet == False) | (Lot.has_safety_sheet == False),
        )
    )
    pending_docs = pending_docs_result.scalar()

    unread_alerts = await db.scalar(
        select(func.count(Alert.id)).where(Alert.is_read == False, Alert.is_resolved == False)
    )

    # Expiry distribution
    expiry_dist = {
        "expired": expired_lots or 0,
        "red": expiring_30 or 0,
        "orange": (expiring_90 or 0) - (expiring_30 or 0),
        "green": (active_lots or 0) - (expiring_90 or 0),
    }

    return DashboardStats(
        total_raw_materials=total_rm or 0,
        active_lots=active_lots or 0,
        expired_lots=expired_lots or 0,
        lots_expiring_30_days=expiring_30 or 0,
        lots_expiring_90_days=expiring_90 or 0,
        low_stock_materials=low_stock or 0,
        pending_documents=pending_docs or 0,
        total_alerts_unread=unread_alerts or 0,
        expiry_distribution=expiry_dist,
    )


@dashboard_router.get("/consumption-trend/{raw_material_id}")
async def get_consumption_trend(
    raw_material_id: int,
    months: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    return await MLService.get_consumption_trend(db, raw_material_id, months)


# ─────────────────────────────────────────────
# ML / ANALYTICS
# ─────────────────────────────────────────────

analytics_router = APIRouter(prefix="/analytics", tags=["Analytics & ML"])


@analytics_router.get("/expiry-risk")
async def get_expiry_risk_predictions(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Predicciones ML de riesgo de vencimiento para todos los lotes activos."""
    return await MLService.predict_expiry_risk(db)


@analytics_router.get("/restock-recommendations", response_model=list[RestockRecommendation])
async def get_restock_recommendations(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Recomendaciones de reabastecimiento basadas en consumo histórico."""
    return await MLService.get_restock_recommendations(db)


@analytics_router.get("/chemical-risk/{material_id}", response_model=RiskAnalysis)
async def get_chemical_risk_analysis(
    material_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Análisis de riesgo químico GHS para una materia prima."""
    try:
        return await MLService.analyze_chemical_risk(db, material_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─────────────────────────────────────────────
# AI CHATBOT
# ─────────────────────────────────────────────

ai_router = APIRouter(prefix="/ai", tags=["IA Asistente"])


@ai_router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Chat con el asistente IA especializado en materias primas."""
    return await AIService.chat(db, request.message, request.conversation_history)


@ai_router.post("/check-compatibility")
async def ai_check_compatibility(
    material_a: str,
    material_b: str,
    _=Depends(get_current_active_user),
):
    """Consulta a la IA sobre compatibilidad entre dos materiales."""
    return await AIService.analyze_incompatibility(material_a, material_b)


# ─── NEW: Supplier search via AI ──────────────────────────────────────────────

@ai_router.get("/search-supplier")
async def search_supplier_online(
    name: str,
    _=Depends(get_current_active_user),
):
    """Busca información de un proveedor en internet usando IA."""
    from app.ml.ai_service import AIService
    return await AIService.search_supplier_info(name)
