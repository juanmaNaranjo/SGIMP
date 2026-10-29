"""
Servicio de Lotes - Gestión de lotes y trazabilidad.
"""

from typing import List, Optional, Tuple
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload

from app.models.models import Lot, LotStatus, InventoryMovement, MovementType, WarehouseLocation
from app.schemas.schemas import LotCreate, LotUpdate, MovementCreate
from app.core.config import settings


def get_expiry_status(expiry_date: date) -> Tuple[str, int]:
    """Retorna (estado_semaforo, dias_para_vencer)."""
    today = date.today()
    days = (expiry_date - today).days

    if days < 0:
        status = "expired"
    elif days <= settings.EXPIRY_ALERT_RED:
        status = "red"
    elif days <= settings.EXPIRY_ALERT_ORANGE:
        status = "orange"
    elif days <= settings.EXPIRY_ALERT_YELLOW:
        status = "yellow"
    else:
        status = "green"

    return status, days


class LotService:

    @staticmethod
    async def generate_internal_lot(db: AsyncSession) -> str:
        """Genera número de lote interno: LOTE-YYYY-NNNNNN."""
        year = date.today().year
        result = await db.execute(
            select(func.count(Lot.id)).where(
                Lot.internal_lot.like(f"LOTE-{year}-%")
            )
        )
        count = result.scalar() + 1
        return f"LOTE-{year}-{count:06d}"

    @staticmethod
    async def create(db: AsyncSession, data: LotCreate, user_id: int) -> Lot:
        internal_lot = await LotService.generate_internal_lot(db)
        days_to_expiry = (data.expiry_date - data.entry_date).days

        lot = Lot(
            internal_lot=internal_lot,
            quantity_available=data.quantity_received,
            days_to_expiry_at_entry=days_to_expiry,
            **data.model_dump()
        )
        db.add(lot)
        await db.flush()

        # Registrar movimiento de entrada
        movement = InventoryMovement(
            lot_id=lot.id,
            user_id=user_id,
            movement_type=MovementType.ENTRY,
            quantity=data.quantity_received,
            quantity_before=0,
            quantity_after=data.quantity_received,
            destination_location_id=data.location_id,
            reason="Ingreso inicial de lote",
        )
        db.add(movement)

        await db.refresh(lot)
        return lot

    @staticmethod
    async def get_by_id(db: AsyncSession, lot_id: int) -> Optional[Lot]:
        result = await db.execute(
            select(Lot)
            .options(
                selectinload(Lot.raw_material),
                selectinload(Lot.supplier),
                selectinload(Lot.location).selectinload(WarehouseLocation.warehouse),
                selectinload(Lot.documents),
                selectinload(Lot.movements),
            )
            .where(Lot.id == lot_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
        raw_material_id: Optional[int] = None,
        status: Optional[LotStatus] = None,
        expiring_in_days: Optional[int] = None,
    ) -> Tuple[List[Lot], int]:
        q = select(Lot).options(
            selectinload(Lot.raw_material),
            selectinload(Lot.supplier),
            selectinload(Lot.location),
        )
        if raw_material_id:
            q = q.where(Lot.raw_material_id == raw_material_id)
        if status:
            q = q.where(Lot.status == status)
        if expiring_in_days is not None:
            cutoff = date.today() + timedelta(days=expiring_in_days)
            q = q.where(
                Lot.expiry_date <= cutoff,
                Lot.expiry_date >= date.today(),
                Lot.status == LotStatus.APPROVED
            )

        total_result = await db.execute(select(func.count()).select_from(q.subquery()))
        total = total_result.scalar()

        q = q.offset(skip).limit(limit).order_by(Lot.expiry_date)
        result = await db.execute(q)
        lots = result.scalars().all()

        # Enricher with computed fields
        for lot in lots:
            lot.expiry_status, lot.days_to_expiry = get_expiry_status(lot.expiry_date)

        return lots, total

    @staticmethod
    async def approve(db: AsyncSession, lot_id: int, location_id: int, user_id: int, notes: str = None) -> Optional[Lot]:
        lot = await LotService.get_by_id(db, lot_id)
        if not lot:
            return None

        # Check all required documents
        missing = []
        if not lot.has_coa:
            missing.append("Certificado de Análisis")
        if not lot.has_technical_sheet:
            missing.append("Ficha Técnica")
        if not lot.has_safety_sheet:
            missing.append("Ficha de Seguridad")
        if lot.raw_material.is_fragrance and not lot.has_allergen_cert:
            missing.append("Declaración de Alérgenos")

        if missing:
            raise ValueError(f"Documentos faltantes: {', '.join(missing)}")

        lot.status = LotStatus.APPROVED
        lot.location_id = location_id
        if notes:
            lot.notes = notes

        # Mark location as occupied
        await db.execute(
            update(WarehouseLocation)
            .where(WarehouseLocation.id == location_id)
            .values(is_occupied=True)
        )

        await db.flush()
        return lot

    @staticmethod
    async def reject(db: AsyncSession, lot_id: int, reason: str, user_id: int) -> Optional[Lot]:
        lot = await db.get(Lot, lot_id)
        if not lot:
            return None
        lot.status = LotStatus.REJECTED
        lot.rejection_reason = reason
        await db.flush()
        return lot

    @staticmethod
    async def register_movement(
        db: AsyncSession, data: MovementCreate, user_id: int
    ) -> InventoryMovement:
        lot = await db.get(Lot, data.lot_id)
        if not lot:
            raise ValueError("Lote no encontrado")

        if data.movement_type in (MovementType.EXIT, MovementType.REJECT):
            if lot.quantity_available < data.quantity:
                raise ValueError(
                    f"Cantidad insuficiente. Disponible: {lot.quantity_available}"
                )

        quantity_before = lot.quantity_available
        quantity_delta = data.quantity if data.movement_type == MovementType.ENTRY else -data.quantity
        lot.quantity_available += quantity_delta
        if lot.quantity_available <= 0:
            lot.quantity_available = 0
            lot.status = LotStatus.CONSUMED

        movement = InventoryMovement(
            lot_id=lot.id,
            user_id=user_id,
            movement_type=data.movement_type,
            quantity=data.quantity,
            quantity_before=quantity_before,
            quantity_after=lot.quantity_available,
            origin_location_id=data.origin_location_id,
            destination_location_id=data.destination_location_id,
            reference_number=data.reference_number,
            reason=data.reason,
            notes=data.notes,
        )
        db.add(movement)

        # Update location on transfer
        if data.movement_type == MovementType.TRANSFER and data.destination_location_id:
            lot.location_id = data.destination_location_id

        # Update raw material stock
        from app.services.raw_material_service import RawMaterialService
        await RawMaterialService.update_stock(db, lot.raw_material_id, quantity_delta)

        await db.flush()
        await db.refresh(movement)
        return movement

    @staticmethod
    async def get_expiring_lots(db: AsyncSession, days: int = 30) -> List[Lot]:
        cutoff = date.today() + timedelta(days=days)
        result = await db.execute(
            select(Lot)
            .options(selectinload(Lot.raw_material))
            .where(
                Lot.expiry_date <= cutoff,
                Lot.expiry_date >= date.today(),
                Lot.status == LotStatus.APPROVED,
            )
            .order_by(Lot.expiry_date)
        )
        return result.scalars().all()

    @staticmethod
    async def get_expired_lots(db: AsyncSession) -> List[Lot]:
        result = await db.execute(
            select(Lot)
            .options(selectinload(Lot.raw_material))
            .where(
                Lot.expiry_date < date.today(),
                Lot.status == LotStatus.APPROVED,
            )
        )
        return result.scalars().all()
