"""
Endpoints de Proveedores, Fabricantes, Bodegas y Compatibilidad Química.
Incluye eliminación (soft delete para fabricantes/proveedores, hard delete para bodegas vacías).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.database import get_db
from app.schemas.schemas import (
    SupplierCreate, SupplierOut,
    ManufacturerCreate, ManufacturerOut,
    WarehouseCreate, WarehouseOut,
    WarehouseLocationCreate, WarehouseLocationOut,
    CompatibilityCreate, CompatibilityOut, CompatibilityCheckResult,
)
from app.models.models import (
    Supplier, Manufacturer, Warehouse, WarehouseLocation,
    ChemicalCompatibility, CompatibilityStatus, Lot, LotStatus, RawMaterial
)
from app.core.security import get_current_active_user
from sqlalchemy.orm import selectinload
from datetime import datetime

# ─── SUPPLIERS ────────────────────────────────────────────────────────────────

suppliers_router = APIRouter(prefix="/suppliers", tags=["Proveedores"])


@suppliers_router.get("", response_model=list[SupplierOut])
async def list_suppliers(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Supplier).where(Supplier.is_active == True).order_by(Supplier.name)
    )
    return [SupplierOut.model_validate(s) for s in result.scalars().all()]


@suppliers_router.post("", response_model=SupplierOut, status_code=201)
async def create_supplier(
    data: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    s = Supplier(**data.model_dump())
    db.add(s)
    await db.flush()
    await db.refresh(s)
    return SupplierOut.model_validate(s)


@suppliers_router.put("/{supplier_id}", response_model=SupplierOut)
async def update_supplier(
    supplier_id: int,
    data: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    s = await db.get(Supplier, supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    for k, v in data.model_dump().items():
        setattr(s, k, v)
    s.updated_at = datetime.utcnow()
    await db.flush()
    return SupplierOut.model_validate(s)


@suppliers_router.delete("/{supplier_id}", status_code=204)
async def delete_supplier(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Soft delete: desactiva el proveedor. Los lotes históricos quedan intactos."""
    s = await db.get(Supplier, supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    s.is_active = False
    s.updated_at = datetime.utcnow()
    await db.flush()


# ─── MANUFACTURERS ────────────────────────────────────────────────────────────

manufacturers_router = APIRouter(prefix="/manufacturers", tags=["Fabricantes"])


@manufacturers_router.get("", response_model=list[ManufacturerOut])
async def list_manufacturers(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Manufacturer).where(Manufacturer.is_active == True)
    )
    return [ManufacturerOut.model_validate(m) for m in result.scalars().all()]


@manufacturers_router.post("", response_model=ManufacturerOut, status_code=201)
async def create_manufacturer(
    data: ManufacturerCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    m = Manufacturer(**data.model_dump())
    db.add(m)
    await db.flush()
    await db.refresh(m)
    return ManufacturerOut.model_validate(m)


@manufacturers_router.put("/{manufacturer_id}", response_model=ManufacturerOut)
async def update_manufacturer(
    manufacturer_id: int,
    data: ManufacturerCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    m = await db.get(Manufacturer, manufacturer_id)
    if not m:
        raise HTTPException(status_code=404, detail="Fabricante no encontrado")
    for k, v in data.model_dump().items():
        setattr(m, k, v)
    await db.flush()
    return ManufacturerOut.model_validate(m)


@manufacturers_router.delete("/{manufacturer_id}", status_code=204)
async def delete_manufacturer(
    manufacturer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Soft delete: desactiva el fabricante."""
    m = await db.get(Manufacturer, manufacturer_id)
    if not m:
        raise HTTPException(status_code=404, detail="Fabricante no encontrado")
    # Check if any active raw materials reference this manufacturer
    count = await db.scalar(
        select(func.count(RawMaterial.id)).where(
            RawMaterial.manufacturer_id == manufacturer_id,
            RawMaterial.is_active == True,
        )
    )
    if count and count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"No se puede eliminar: {count} materia(s) prima(s) activa(s) lo referencian. Desactívalas primero."
        )
    m.is_active = False
    await db.flush()


# ─── WAREHOUSES ───────────────────────────────────────────────────────────────

warehouses_router = APIRouter(prefix="/warehouses", tags=["Bodegas"])


@warehouses_router.get("", response_model=list[WarehouseOut])
async def list_warehouses(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    result = await db.execute(select(Warehouse).where(Warehouse.is_active == True))
    return [WarehouseOut.model_validate(w) for w in result.scalars().all()]


@warehouses_router.post("", response_model=WarehouseOut, status_code=201)
async def create_warehouse(
    data: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    w = Warehouse(**data.model_dump())
    db.add(w)
    await db.flush()
    await db.refresh(w)
    return WarehouseOut.model_validate(w)


@warehouses_router.put("/{warehouse_id}", response_model=WarehouseOut)
async def update_warehouse(
    warehouse_id: int,
    data: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    w = await db.get(Warehouse, warehouse_id)
    if not w:
        raise HTTPException(status_code=404, detail="Bodega no encontrada")
    for k, v in data.model_dump().items():
        setattr(w, k, v)
    await db.flush()
    return WarehouseOut.model_validate(w)


@warehouses_router.delete("/{warehouse_id}", status_code=204)
async def delete_warehouse(
    warehouse_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Soft delete: desactiva la bodega si no tiene lotes activos."""
    w = await db.get(Warehouse, warehouse_id)
    if not w:
        raise HTTPException(status_code=404, detail="Bodega no encontrada")
    # Check for active lots in any location of this warehouse
    count = await db.scalar(
        select(func.count(Lot.id))
        .join(WarehouseLocation, Lot.location_id == WarehouseLocation.id)
        .where(
            WarehouseLocation.warehouse_id == warehouse_id,
            Lot.status == LotStatus.APPROVED,
        )
    )
    if count and count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"No se puede eliminar: hay {count} lote(s) activo(s) almacenados en esta bodega."
        )
    w.is_active = False
    await db.flush()


@warehouses_router.get("/{warehouse_id}/locations", response_model=list[WarehouseLocationOut])
async def get_warehouse_locations(
    warehouse_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    result = await db.execute(
        select(WarehouseLocation)
        .where(
            WarehouseLocation.warehouse_id == warehouse_id,
            WarehouseLocation.is_active == True,
        )
        .order_by(WarehouseLocation.code)
    )
    return [WarehouseLocationOut.model_validate(l) for l in result.scalars().all()]


@warehouses_router.post("/locations", response_model=WarehouseLocationOut, status_code=201)
async def create_location(
    data: WarehouseLocationCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    loc = WarehouseLocation(**data.model_dump())
    db.add(loc)
    await db.flush()
    await db.refresh(loc)
    return WarehouseLocationOut.model_validate(loc)


@warehouses_router.delete("/locations/{location_id}", status_code=204)
async def delete_location(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Elimina una ubicación solo si está vacía."""
    loc = await db.get(WarehouseLocation, location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    if loc.is_occupied:
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar: la ubicación tiene un lote asignado."
        )
    loc.is_active = False
    await db.flush()


# ─── CHEMICAL COMPATIBILITY ───────────────────────────────────────────────────

compatibility_router = APIRouter(prefix="/compatibility", tags=["Compatibilidad Química"])


@compatibility_router.get("", response_model=list[CompatibilityOut])
async def list_compatibilities(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    result = await db.execute(
        select(ChemicalCompatibility)
        .options(
            selectinload(ChemicalCompatibility.material_a),
            selectinload(ChemicalCompatibility.material_b),
        )
    )
    return [CompatibilityOut.model_validate(c) for c in result.scalars().all()]


@compatibility_router.post("", response_model=CompatibilityOut, status_code=201)
async def create_compatibility(
    data: CompatibilityCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    a = min(data.material_a_id, data.material_b_id)
    b = max(data.material_a_id, data.material_b_id)
    existing = await db.execute(
        select(ChemicalCompatibility).where(
            ChemicalCompatibility.material_a_id == a,
            ChemicalCompatibility.material_b_id == b,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ya existe una regla para este par")

    compat = ChemicalCompatibility(
        material_a_id=a, material_b_id=b,
        status=data.status, reason=data.reason,
        recommendation=data.recommendation,
        created_by=current_user.id,
    )
    db.add(compat)
    await db.flush()
    await db.refresh(compat)
    return CompatibilityOut.model_validate(compat)


@compatibility_router.delete("/{compat_id}", status_code=204)
async def delete_compatibility(
    compat_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    c = await db.get(ChemicalCompatibility, compat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    await db.delete(c)
    await db.flush()


@compatibility_router.post("/check-location", response_model=CompatibilityCheckResult)
async def check_location_compatibility(
    material_id: int,
    warehouse_location_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    existing_lots_result = await db.execute(
        select(Lot).where(
            Lot.location_id == warehouse_location_id,
            Lot.status == LotStatus.APPROVED,
        )
    )
    existing_lots = existing_lots_result.scalars().all()
    existing_material_ids = list({lot.raw_material_id for lot in existing_lots})

    conflicts = []
    for existing_id in existing_material_ids:
        if existing_id == material_id:
            continue
        a, b = min(material_id, existing_id), max(material_id, existing_id)
        compat_result = await db.execute(
            select(ChemicalCompatibility)
            .options(
                selectinload(ChemicalCompatibility.material_a),
                selectinload(ChemicalCompatibility.material_b),
            )
            .where(
                ChemicalCompatibility.material_a_id == a,
                ChemicalCompatibility.material_b_id == b,
                ChemicalCompatibility.status == CompatibilityStatus.INCOMPATIBLE,
            )
        )
        conflict = compat_result.scalar_one_or_none()
        if conflict:
            conflicts.append(CompatibilityOut.model_validate(conflict))

    if conflicts:
        return CompatibilityCheckResult(
            is_allowed=False,
            conflicts=conflicts,
            message=f"⚠️ ALMACENAMIENTO NO PERMITIDO: {len(conflicts)} incompatibilidad(es) detectada(s)",
        )
    return CompatibilityCheckResult(
        is_allowed=True, conflicts=[],
        message="✅ Compatible. Se puede almacenar en esta ubicación.",
    )
