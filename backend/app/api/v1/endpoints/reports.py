"""
Endpoints de Reportes - Exportación a Excel y PDF.
"""

import io
from datetime import date
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.models import Lot, LotStatus, RawMaterial, InventoryMovement
from app.core.security import get_current_active_user
from app.services.lot_service import get_expiry_status

router = APIRouter(prefix="/reports", tags=["Reportes"])


@router.get("/inventory-excel")
async def export_inventory_excel(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Exporta el inventario completo a Excel (Kardex)."""
    import openpyxl
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    result = await db.execute(
        select(Lot)
        .options(
            selectinload(Lot.raw_material),
            selectinload(Lot.supplier),
            selectinload(Lot.location),
        )
        .where(Lot.status.in_([LotStatus.APPROVED, LotStatus.PENDING]))
        .order_by(Lot.expiry_date)
    )
    lots = result.scalars().all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Inventario SGIMP"

    # Styles
    header_fill = PatternFill(start_color="1B4F72", end_color="1B4F72", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=11)
    red_fill = PatternFill(start_color="FADBD8", end_color="FADBD8", fill_type="solid")
    orange_fill = PatternFill(start_color="FDEBD0", end_color="FDEBD0", fill_type="solid")
    yellow_fill = PatternFill(start_color="FDFBEA", end_color="FDFBEA", fill_type="solid")
    green_fill = PatternFill(start_color="D5F5E3", end_color="D5F5E3", fill_type="solid")

    headers = [
        "Lote Interno", "# Lote Fabricante", "Código MP", "Nombre Inicial",
        "Nombre Comercial", "Proveedor", "Ubicación", "Fecha Ingreso",
        "Fecha Vencimiento", "Días para Vencer", "Estado Semáforo",
        "Cant. Recibida", "Cant. Disponible", "UOM", "Estado Lote",
        "COA", "Ficha Técnica", "SDS", "Cotización",
    ]

    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.column_dimensions[get_column_letter(col)].width = 18

    ws.row_dimensions[1].height = 25

    for row, lot in enumerate(lots, 2):
        expiry_status, days = get_expiry_status(lot.expiry_date)
        fill = {
            "expired": red_fill,
            "red": red_fill,
            "orange": orange_fill,
            "yellow": yellow_fill,
            "green": green_fill,
        }.get(expiry_status, green_fill)

        status_label = {
            "expired": "⚫ VENCIDO",
            "red": "🔴 CRÍTICO",
            "orange": "🟠 ATENCIÓN",
            "yellow": "🟡 ADVERTENCIA",
            "green": "🟢 OK",
        }.get(expiry_status, "🟢 OK")

        values = [
            lot.internal_lot,
            lot.lot_number,
            lot.raw_material.internal_code if lot.raw_material else "",
            lot.raw_material.initial_name if lot.raw_material else "",
            lot.raw_material.commercial_name if lot.raw_material else "",
            lot.supplier.name if lot.supplier else "",
            lot.location.code if lot.location else "Sin ubicación",
            lot.entry_date.strftime("%Y-%m-%d"),
            lot.expiry_date.strftime("%Y-%m-%d"),
            days,
            status_label,
            lot.quantity_received,
            lot.quantity_available,
            lot.unit_of_measure,
            lot.status.value,
            "✓" if lot.has_coa else "✗",
            "✓" if lot.has_technical_sheet else "✗",
            "✓" if lot.has_safety_sheet else "✗",
            "✓" if lot.has_quotation else "✗",
        ]

        for col, value in enumerate(values, 1):
            cell = ws.cell(row=row, column=col, value=value)
            if col in (9, 10, 11):  # Expiry columns
                cell.fill = fill
            cell.alignment = Alignment(horizontal="center")

    # Freeze header
    ws.freeze_panes = "A2"

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"inventario_sgimp_{date.today().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/traceability/{lot_id}")
async def get_lot_traceability(
    lot_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Reporte completo de trazabilidad de un lote."""
    lot = await db.get(Lot, lot_id)
    if not lot:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    movements_result = await db.execute(
        select(InventoryMovement)
        .where(InventoryMovement.lot_id == lot_id)
        .order_by(InventoryMovement.movement_date)
    )
    movements = movements_result.scalars().all()

    expiry_status, days = get_expiry_status(lot.expiry_date)

    return {
        "lot": {
            "id": lot.id,
            "internal_lot": lot.internal_lot,
            "lot_number": lot.lot_number,
            "raw_material_id": lot.raw_material_id,
            "entry_date": lot.entry_date.isoformat(),
            "expiry_date": lot.expiry_date.isoformat(),
            "days_to_expiry": days,
            "expiry_status": expiry_status,
            "quantity_received": lot.quantity_received,
            "quantity_available": lot.quantity_available,
            "status": lot.status.value,
        },
        "movements": [
            {
                "id": m.id,
                "type": m.movement_type.value,
                "quantity": m.quantity,
                "quantity_before": m.quantity_before,
                "quantity_after": m.quantity_after,
                "date": m.movement_date.isoformat(),
                "reason": m.reason,
                "reference": m.reference_number,
            }
            for m in movements
        ],
        "documents": {
            "coa": lot.has_coa,
            "technical_sheet": lot.has_technical_sheet,
            "safety_sheet": lot.has_safety_sheet,
            "allergen_cert": lot.has_allergen_cert,
            "cruelty_free": lot.has_cruelty_free,
            "quotation": lot.has_quotation,
        },
    }


@router.get("/expiry-forecast")
async def get_expiry_forecast(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Pronóstico de vencimientos para los próximos 180 días."""
    from datetime import timedelta
    cutoff = date.today() + timedelta(days=180)

    result = await db.execute(
        select(Lot)
        .options(selectinload(Lot.raw_material))
        .where(
            Lot.expiry_date <= cutoff,
            Lot.status == LotStatus.APPROVED,
        )
        .order_by(Lot.expiry_date)
    )
    lots = result.scalars().all()

    return [
        {
            "lot_id": lot.id,
            "internal_lot": lot.internal_lot,
            "raw_material_name": lot.raw_material.initial_name if lot.raw_material else "",
            "expiry_date": lot.expiry_date.isoformat(),
            "days_to_expiry": (lot.expiry_date - date.today()).days,
            "quantity_available": lot.quantity_available,
            "unit_of_measure": lot.unit_of_measure,
            "expiry_status": get_expiry_status(lot.expiry_date)[0],
        }
        for lot in lots
    ]
