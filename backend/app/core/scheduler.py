"""
SGIMP - Scheduler de tareas automáticas
Ejecuta alertas y actualizaciones periódicas.
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import AsyncSessionLocal
from app.core.config import settings

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="America/Bogota")


async def run_daily_alerts():
    """Tarea diaria: genera alertas de vencimiento, stock bajo y documentos."""
    logger.info("⏰ Ejecutando alertas automáticas diarias...")
    async with AsyncSessionLocal() as db:
        try:
            from app.services.alert_service import AlertService
            expiry = await AlertService.generate_expiry_alerts(db)
            stock = await AlertService.generate_low_stock_alerts(db)
            docs = await AlertService.generate_missing_document_alerts(db)
            await db.commit()
            logger.info(
                f"✅ Alertas generadas — Vencimientos: {len(expiry)}, "
                f"Stock: {len(stock)}, Documentos: {len(docs)}"
            )
        except Exception as e:
            logger.error(f"❌ Error en alertas automáticas: {e}")
            await db.rollback()


async def run_ml_predictions():
    """Tarea semanal: actualiza predicciones ML de stock y riesgo."""
    logger.info("🤖 Actualizando predicciones ML...")
    async with AsyncSessionLocal() as db:
        try:
            from app.ml.ml_service import MLService
            from sqlalchemy import select, update
            from app.models.models import RawMaterial

            recommendations = await MLService.get_restock_recommendations(db)
            for rec in recommendations:
                await db.execute(
                    update(RawMaterial)
                    .where(RawMaterial.id == rec.raw_material_id)
                    .values(
                        predicted_restock_date=rec.predicted_stockout_date,
                        avg_consumption_per_month=rec.avg_monthly_consumption,
                    )
                )

            predictions = await MLService.predict_expiry_risk(db)
            for pred in predictions:
                await db.execute(
                    update(RawMaterial)
                    .where(RawMaterial.id == pred["raw_material_id"])
                    .values(expiry_risk_score=pred["risk_score"])
                )

            await db.commit()
            logger.info("✅ Predicciones ML actualizadas")
        except Exception as e:
            logger.error(f"❌ Error en predicciones ML: {e}")
            await db.rollback()


async def mark_expired_lots():
    """Tarea diaria: marca lotes vencidos automáticamente."""
    from datetime import date
    async with AsyncSessionLocal() as db:
        try:
            from sqlalchemy import update
            from app.models.models import Lot, LotStatus
            await db.execute(
                update(Lot)
                .where(
                    Lot.expiry_date < date.today(),
                    Lot.status == LotStatus.APPROVED,
                )
                .values(status=LotStatus.EXPIRED)
            )
            await db.commit()
            logger.info("✅ Lotes vencidos marcados correctamente")
        except Exception as e:
            logger.error(f"❌ Error marcando lotes vencidos: {e}")
            await db.rollback()


def setup_scheduler():
    """Configura y arranca el scheduler."""
    # Alertas diarias a las 8:00 AM Colombia
    scheduler.add_job(
        run_daily_alerts,
        CronTrigger(
            hour=settings.SCHEDULER_ALERT_HOUR,
            minute=settings.SCHEDULER_ALERT_MINUTE,
        ),
        id="daily_alerts",
        replace_existing=True,
    )

    # Marcar lotes vencidos diariamente a las 00:05
    scheduler.add_job(
        mark_expired_lots,
        CronTrigger(hour=0, minute=5),
        id="mark_expired",
        replace_existing=True,
    )

    # Predicciones ML semanales - lunes 6 AM
    scheduler.add_job(
        run_ml_predictions,
        CronTrigger(day_of_week="mon", hour=6, minute=0),
        id="ml_predictions",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("✅ Scheduler iniciado")
    return scheduler
