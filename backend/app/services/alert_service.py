"""
Servicio de Alertas - Generación y gestión de alertas automáticas.
"""

from typing import List
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Alert, AlertType, Lot, LotStatus, RawMaterial
from app.services.lot_service import get_expiry_status
from app.core.config import settings


class AlertService:

    @staticmethod
    async def generate_expiry_alerts(db: AsyncSession) -> List[Alert]:
        """Genera alertas de vencimiento para todos los lotes activos."""
        new_alerts = []
        cutoff = date.today() + timedelta(days=settings.EXPIRY_ALERT_YELLOW)

        result = await db.execute(
            select(Lot).where(
                Lot.expiry_date <= cutoff,
                Lot.status == LotStatus.APPROVED,
            )
        )
        lots = result.scalars().all()

        for lot in lots:
            expiry_status, days = get_expiry_status(lot.expiry_date)

            if expiry_status == "expired":
                alert_type = AlertType.EXPIRED
                title = f"⚫ Lote VENCIDO: {lot.internal_lot}"
                msg = f"El lote {lot.internal_lot} venció hace {abs(days)} días."
            elif expiry_status == "red":
                alert_type = AlertType.EXPIRY_CRITICAL
                title = f"🔴 Vence en {days} días: {lot.internal_lot}"
                msg = f"El lote {lot.internal_lot} vence el {lot.expiry_date}. Quedan {days} días."
            elif expiry_status in ("orange", "yellow"):
                alert_type = AlertType.EXPIRY_WARNING
                title = f"🟡 Próximo a vencer: {lot.internal_lot}"
                msg = f"El lote {lot.internal_lot} vence el {lot.expiry_date} ({days} días)."
            else:
                continue

            # Avoid duplicate alerts for today
            existing = await db.execute(
                select(Alert).where(
                    Alert.lot_id == lot.id,
                    Alert.alert_type == alert_type,
                    Alert.is_resolved == False,
                )
            )
            if existing.scalar_one_or_none():
                continue

            alert = Alert(
                alert_type=alert_type,
                title=title,
                message=msg,
                raw_material_id=lot.raw_material_id,
                lot_id=lot.id,
                days_to_expiry=days,
            )
            db.add(alert)
            new_alerts.append(alert)

        await db.flush()
        return new_alerts

    @staticmethod
    async def generate_low_stock_alerts(db: AsyncSession) -> List[Alert]:
        """Genera alertas de stock mínimo."""
        new_alerts = []
        result = await db.execute(
            select(RawMaterial).where(
                RawMaterial.current_stock <= RawMaterial.min_stock,
                RawMaterial.is_active == True,
                RawMaterial.min_stock > 0,
            )
        )
        materials = result.scalars().all()

        for mat in materials:
            existing = await db.execute(
                select(Alert).where(
                    Alert.raw_material_id == mat.id,
                    Alert.alert_type == AlertType.LOW_STOCK,
                    Alert.is_resolved == False,
                )
            )
            if existing.scalar_one_or_none():
                continue

            alert = Alert(
                alert_type=AlertType.LOW_STOCK,
                title=f"📦 Stock bajo: {mat.initial_name}",
                message=(
                    f"Stock actual ({mat.current_stock} {mat.unit_of_measure}) "
                    f"está por debajo del mínimo ({mat.min_stock} {mat.unit_of_measure})."
                ),
                raw_material_id=mat.id,
            )
            db.add(alert)
            new_alerts.append(alert)

        await db.flush()
        return new_alerts

    @staticmethod
    async def generate_missing_document_alerts(db: AsyncSession) -> List[Alert]:
        """Genera alertas por documentos faltantes en lotes pendientes."""
        new_alerts = []
        result = await db.execute(
            select(Lot).where(Lot.status == LotStatus.PENDING)
        )
        lots = result.scalars().all()

        for lot in lots:
            missing = []
            if not lot.has_coa:
                missing.append("Certificado de Análisis")
            if not lot.has_technical_sheet:
                missing.append("Ficha Técnica")
            if not lot.has_safety_sheet:
                missing.append("Ficha de Seguridad")

            if not missing:
                continue

            existing = await db.execute(
                select(Alert).where(
                    Alert.lot_id == lot.id,
                    Alert.alert_type == AlertType.MISSING_DOCUMENT,
                    Alert.is_resolved == False,
                )
            )
            if existing.scalar_one_or_none():
                continue

            alert = Alert(
                alert_type=AlertType.MISSING_DOCUMENT,
                title=f"📄 Documentos faltantes: {lot.internal_lot}",
                message=f"Faltan documentos: {', '.join(missing)}",
                raw_material_id=lot.raw_material_id,
                lot_id=lot.id,
            )
            db.add(alert)
            new_alerts.append(alert)

        await db.flush()
        return new_alerts

    @staticmethod
    async def get_unread(db: AsyncSession, limit: int = 50) -> List[Alert]:
        result = await db.execute(
            select(Alert)
            .where(Alert.is_resolved == False)
            .order_by(Alert.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    @staticmethod
    async def mark_read(db: AsyncSession, alert_id: int) -> bool:
        alert = await db.get(Alert, alert_id)
        if not alert:
            return False
        alert.is_read = True
        await db.flush()
        return True

    @staticmethod
    async def resolve(db: AsyncSession, alert_id: int, user_id: int) -> bool:
        from datetime import datetime
        alert = await db.get(Alert, alert_id)
        if not alert:
            return False
        alert.is_resolved = True
        alert.resolved_by = user_id
        alert.resolved_at = datetime.utcnow()
        await db.flush()
        return True
