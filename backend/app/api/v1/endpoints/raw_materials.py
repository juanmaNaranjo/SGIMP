from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.schemas.schemas import (
    RawMaterialCreate, RawMaterialUpdate, RawMaterialOut,
    RawMaterialSummary, PaginatedResponse, CategoryCreate, CategoryOut
)
from app.services.raw_material_service import RawMaterialService
from app.core.security import get_current_active_user
from app.models.models import RawMaterialCategory
from datetime import datetime

router = APIRouter(prefix="/raw-materials", tags=["Materias Primas"])


@router.get("", response_model=PaginatedResponse)
async def list_raw_materials(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    is_active: Optional[bool] = True,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    skip = (page - 1) * size
    items, total = await RawMaterialService.get_all(
        db, skip=skip, limit=size, search=search,
        category_id=category_id, is_active=is_active
    )
    pages = (total + size - 1) // size
    return PaginatedResponse(
        items=[RawMaterialOut.model_validate(i) for i in items],
        total=total, page=page, size=size, pages=pages
    )


@router.post("", response_model=RawMaterialOut, status_code=201)
async def create_raw_material(
    data: RawMaterialCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    rm = await RawMaterialService.create(db, data)
    return RawMaterialOut.model_validate(rm)


@router.get("/low-stock/list", response_model=list[RawMaterialSummary])
async def get_low_stock(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    items = await RawMaterialService.get_low_stock(db)
    return [RawMaterialSummary.model_validate(i) for i in items]


@router.get("/categories/list", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    result = await db.execute(select(RawMaterialCategory))
    return [CategoryOut.model_validate(c) for c in result.scalars().all()]


@router.post("/categories", response_model=CategoryOut, status_code=201)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    cat = RawMaterialCategory(**data.model_dump())
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return CategoryOut.model_validate(cat)


@router.delete("/categories/{cat_id}", status_code=204)
async def delete_category(
    cat_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    cat = await db.get(RawMaterialCategory, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    await db.delete(cat)
    await db.flush()


@router.get("/{rm_id}", response_model=RawMaterialOut)
async def get_raw_material(
    rm_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    rm = await RawMaterialService.get_by_id(db, rm_id)
    if not rm:
        raise HTTPException(status_code=404, detail="Materia prima no encontrada")
    return RawMaterialOut.model_validate(rm)


@router.put("/{rm_id}", response_model=RawMaterialOut)
async def update_raw_material(
    rm_id: int,
    data: RawMaterialUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    rm = await RawMaterialService.update(db, rm_id, data)
    if not rm:
        raise HTTPException(status_code=404, detail="Materia prima no encontrada")
    return RawMaterialOut.model_validate(rm)


@router.delete("/{rm_id}", status_code=204)
async def delete_raw_material(
    rm_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """
    Soft delete: marca como inactiva.
    No se elimina físicamente porque los lotes históricos la referencian.
    """
    rm = await RawMaterialService.get_by_id(db, rm_id)
    if not rm:
        raise HTTPException(status_code=404, detail="Materia prima no encontrada")
    rm.is_active = False
    rm.updated_at = datetime.utcnow()
    await db.flush()
