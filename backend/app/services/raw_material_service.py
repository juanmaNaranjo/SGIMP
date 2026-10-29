"""
Servicio de Materias Primas - Lógica de negocio principal.
"""

from typing import List, Optional, Tuple
from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload

from app.models.models import RawMaterial, RawMaterialCategory
from app.schemas.schemas import RawMaterialCreate, RawMaterialUpdate


class RawMaterialService:

    @staticmethod
    async def generate_internal_code(db: AsyncSession) -> str:
        """Genera código interno único MP-YYYYMMDD-NNNN."""
        today = date.today().strftime("%Y%m%d")
        result = await db.execute(
            select(func.count(RawMaterial.id)).where(
                RawMaterial.internal_code.like(f"MP-{today}-%")
            )
        )
        count = result.scalar() + 1
        return f"MP-{today}-{count:04d}"

    @staticmethod
    async def create(db: AsyncSession, data: RawMaterialCreate) -> RawMaterial:
        internal_code = await RawMaterialService.generate_internal_code(db)
        rm = RawMaterial(
            internal_code=internal_code,
            **data.model_dump()
        )
        db.add(rm)
        await db.flush()
        await db.refresh(rm)
        return rm

    @staticmethod
    async def get_by_id(db: AsyncSession, rm_id: int) -> Optional[RawMaterial]:
        result = await db.execute(
            select(RawMaterial)
            .options(
                selectinload(RawMaterial.category),
                selectinload(RawMaterial.manufacturer),
                selectinload(RawMaterial.lots),
            )
            .where(RawMaterial.id == rm_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        is_active: Optional[bool] = True,
    ) -> Tuple[List[RawMaterial], int]:
        q = select(RawMaterial).options(
            selectinload(RawMaterial.category),
            selectinload(RawMaterial.manufacturer),
        )
        if search:
            q = q.where(
                RawMaterial.initial_name.ilike(f"%{search}%") |
                RawMaterial.commercial_name.ilike(f"%{search}%") |
                RawMaterial.internal_code.ilike(f"%{search}%")
            )
        if category_id:
            q = q.where(RawMaterial.category_id == category_id)
        if is_active is not None:
            q = q.where(RawMaterial.is_active == is_active)

        total_result = await db.execute(select(func.count()).select_from(q.subquery()))
        total = total_result.scalar()

        q = q.offset(skip).limit(limit).order_by(RawMaterial.initial_name)
        result = await db.execute(q)
        return result.scalars().all(), total

    @staticmethod
    async def update(
        db: AsyncSession, rm_id: int, data: RawMaterialUpdate
    ) -> Optional[RawMaterial]:
        rm = await RawMaterialService.get_by_id(db, rm_id)
        if not rm:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(rm, field, value)
        rm.updated_at = datetime.utcnow()
        await db.flush()
        await db.refresh(rm)
        return rm

    @staticmethod
    async def update_stock(db: AsyncSession, rm_id: int, quantity_delta: float):
        """Actualiza el stock actual (puede ser positivo o negativo)."""
        await db.execute(
            update(RawMaterial)
            .where(RawMaterial.id == rm_id)
            .values(current_stock=RawMaterial.current_stock + quantity_delta)
        )

    @staticmethod
    async def get_low_stock(db: AsyncSession) -> List[RawMaterial]:
        """Retorna materias primas con stock por debajo del mínimo."""
        result = await db.execute(
            select(RawMaterial).where(
                RawMaterial.current_stock <= RawMaterial.min_stock,
                RawMaterial.is_active == True,
                RawMaterial.min_stock > 0,
            )
        )
        return result.scalars().all()
