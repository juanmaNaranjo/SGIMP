"""
Endpoints de Gestión Documental - Upload, descarga y validación de documentos.
"""

import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.db.database import get_db
from app.schemas.schemas import DocumentOut
from app.models.models import Document, DocumentType, Lot
from app.core.security import get_current_active_user
from app.core.config import settings

router = APIRouter(prefix="/documents", tags=["Documentos"])

ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/tiff"}


def _update_lot_doc_flags(lot: Lot, doc_type: DocumentType):
    """Actualiza los flags de documentos en el lote."""
    mapping = {
        DocumentType.COA: "has_coa",
        DocumentType.TECHNICAL_SHEET: "has_technical_sheet",
        DocumentType.SAFETY_SHEET: "has_safety_sheet",
        DocumentType.ALLERGEN_CERT: "has_allergen_cert",
        DocumentType.CRUELTY_FREE: "has_cruelty_free",
        DocumentType.QUOTATION: "has_quotation",
    }
    if doc_type in mapping:
        setattr(lot, mapping[doc_type], True)


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    lot_id: int = Form(...),
    doc_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    issue_date: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido: {file.content_type}. Permitidos: PDF, JPEG, PNG, TIFF",
        )

    # Validate file size
    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Archivo demasiado grande. Máximo: {settings.MAX_FILE_SIZE_MB}MB",
        )

    # Check lot exists
    lot = await db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    # Save file
    ext = os.path.splitext(file.filename)[1].lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    save_dir = os.path.join(settings.UPLOAD_DIR, "documents", str(lot_id))
    os.makedirs(save_dir, exist_ok=True)
    file_path = os.path.join(save_dir, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    # Parse dates
    from datetime import date
    parsed_issue = date.fromisoformat(issue_date) if issue_date else None
    parsed_expiry = date.fromisoformat(expiry_date) if expiry_date else None

    # Create document record
    doc = Document(
        lot_id=lot_id,
        doc_type=doc_type,
        filename=unique_name,
        original_filename=file.filename,
        file_path=file_path,
        file_size=len(content),
        mime_type=file.content_type,
        issue_date=parsed_issue,
        expiry_date=parsed_expiry,
        notes=notes,
        uploaded_by=current_user.id,
    )
    db.add(doc)

    # Update lot document flags
    _update_lot_doc_flags(lot, doc_type)

    await db.flush()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


@router.get("/lot/{lot_id}", response_model=list[DocumentOut])
async def get_lot_documents(
    lot_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Document).where(Document.lot_id == lot_id).order_by(Document.uploaded_at.desc())
    )
    return [DocumentOut.model_validate(d) for d in result.scalars().all()]


@router.get("/{doc_id}/download")
async def download_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado en el servidor")
    return FileResponse(
        doc.file_path,
        filename=doc.original_filename,
        media_type=doc.mime_type,
    )


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    # Remove file from disk
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    await db.delete(doc)
    await db.flush()


@router.get("/missing/report")
async def get_missing_documents_report(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Reporte de lotes con documentos faltantes."""
    from app.models.models import LotStatus
    result = await db.execute(
        select(Lot).where(Lot.status == LotStatus.PENDING)
    )
    lots = result.scalars().all()

    report = []
    for lot in lots:
        missing = []
        if not lot.has_coa:
            missing.append("Certificado de Análisis (COA)")
        if not lot.has_technical_sheet:
            missing.append("Ficha Técnica")
        if not lot.has_safety_sheet:
            missing.append("Ficha de Seguridad (SDS)")
        if missing:
            report.append({
                "lot_id": lot.id,
                "internal_lot": lot.internal_lot,
                "lot_number": lot.lot_number,
                "raw_material_id": lot.raw_material_id,
                "missing_documents": missing,
                "entry_date": lot.entry_date.isoformat(),
            })
    return report
