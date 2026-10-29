from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.schemas.schemas import (
    LotCreate, LotUpdate, LotApprove, LotOut,
    MovementCreate, MovementOut, PaginatedResponse
)
from app.services.lot_service import LotService
from app.core.security import get_current_active_user
from app.models.models import LotStatus, Lot, InventoryMovement

router = APIRouter(prefix="/lots", tags=["Lotes"])


@router.get("", response_model=PaginatedResponse)
async def list_lots(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    raw_material_id: Optional[int] = None,
    status: Optional[LotStatus] = None,
    expiring_in_days: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    skip = (page - 1) * size
    items, total = await LotService.get_all(
        db, skip=skip, limit=size,
        raw_material_id=raw_material_id,
        status=status,
        expiring_in_days=expiring_in_days,
    )
    pages = (total + size - 1) // size
    return PaginatedResponse(
        items=[LotOut.model_validate(i) for i in items],
        total=total, page=page, size=size, pages=pages
    )


@router.post("", response_model=LotOut, status_code=201)
async def create_lot(
    data: LotCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    lot = await LotService.create(db, data, current_user.id)
    return LotOut.model_validate(lot)


@router.get("/expiring/report")
async def get_expiring_lots(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    lots = await LotService.get_expiring_lots(db, days)
    result = []
    for lot in lots:
        from app.services.lot_service import get_expiry_status
        status, days_left = get_expiry_status(lot.expiry_date)
        result.append({
            "lot_id": lot.id,
            "internal_lot": lot.internal_lot,
            "raw_material": lot.raw_material.initial_name if lot.raw_material else "",
            "expiry_date": lot.expiry_date.isoformat(),
            "days_to_expiry": days_left,
            "expiry_status": status,
            "quantity_available": lot.quantity_available,
        })
    return result


@router.get("/{lot_id}", response_model=LotOut)
async def get_lot(
    lot_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    lot = await LotService.get_by_id(db, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    from app.services.lot_service import get_expiry_status
    lot.expiry_status, lot.days_to_expiry = get_expiry_status(lot.expiry_date)
    return LotOut.model_validate(lot)


@router.put("/{lot_id}", response_model=LotOut)
async def update_lot(
    lot_id: int,
    data: LotUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    lot = await db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(lot, k, v)
    await db.flush()
    return LotOut.model_validate(lot)


@router.delete("/{lot_id}", status_code=204)
async def delete_lot(
    lot_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """
    Elimina un lote solo si NO tiene movimientos registrados.
    Si tiene movimientos, solo puede rechazarse (soft delete vía status).
    """
    lot = await db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    # Verificar que no tenga movimientos distintos al ingreso inicial
    result = await db.execute(
        select(InventoryMovement).where(InventoryMovement.lot_id == lot_id)
    )
    movements = result.scalars().all()
    non_entry = [m for m in movements if m.movement_type.value != "entry"]

    if non_entry:
        raise HTTPException(
            status_code=409,
            detail=f"No se puede eliminar: el lote tiene {len(non_entry)} movimiento(s) registrado(s). Use 'Rechazar' en su lugar."
        )

    # Delete entry movements and the lot
    for m in movements:
        await db.delete(m)
    # Update raw material stock back
    from app.services.raw_material_service import RawMaterialService
    await RawMaterialService.update_stock(db, lot.raw_material_id, -lot.quantity_available)
    await db.delete(lot)
    await db.flush()


@router.post("/{lot_id}/approve", response_model=LotOut)
async def approve_lot(
    lot_id: int,
    data: LotApprove,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    try:
        lot = await LotService.approve(db, lot_id, data.location_id, current_user.id, data.notes)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if not lot:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    return LotOut.model_validate(lot)


@router.post("/{lot_id}/reject", response_model=LotOut)
async def reject_lot(
    lot_id: int,
    reason: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    lot = await LotService.reject(db, lot_id, reason, current_user.id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    return LotOut.model_validate(lot)


@router.post("/movements", response_model=MovementOut, status_code=201)
async def register_movement(
    data: MovementCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    try:
        movement = await LotService.register_movement(db, data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return MovementOut.model_validate(movement)


@router.get("/{lot_id}/movements", response_model=list[MovementOut])
async def get_lot_movements(
    lot_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Kardex completo de un lote."""
    result = await db.execute(
        select(InventoryMovement)
        .where(InventoryMovement.lot_id == lot_id)
        .order_by(InventoryMovement.movement_date.desc())
    )
    return [MovementOut.model_validate(m) for m in result.scalars().all()]
