"""
SGIMP - Schemas Pydantic
Validación de entrada/salida para todos los endpoints.
"""

from datetime import datetime, date
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from app.models.models import (
    UserRole, LotStatus, MovementType, DocumentType,
    CompatibilityStatus, AlertType, GHSHazardClass
)


# ─────────────────────────────────────────────
# BASE
# ─────────────────────────────────────────────

class TimestampMixin(BaseModel):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ─────────────────────────────────────────────
# USUARIO
# ─────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    password: str
    role: UserRole = UserRole.WAREHOUSE

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v):
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─────────────────────────────────────────────
# FABRICANTE
# ─────────────────────────────────────────────

class ManufacturerCreate(BaseModel):
    name: str
    country: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None


class ManufacturerOut(ManufacturerCreate, TimestampMixin):
    id: int
    is_active: bool
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# PROVEEDOR
# ─────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name: str
    nit: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "Colombia"


class SupplierOut(SupplierCreate):
    id: int
    is_active: bool
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# BODEGA Y UBICACIONES
# ─────────────────────────────────────────────

class WarehouseCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None
    humidity_max: Optional[float] = None


class WarehouseOut(WarehouseCreate):
    id: int
    is_active: bool
    model_config = {"from_attributes": True}


class WarehouseLocationCreate(BaseModel):
    warehouse_id: int
    code: str
    name: Optional[str] = None
    capacity: Optional[float] = None


class WarehouseLocationOut(WarehouseLocationCreate):
    id: int
    is_occupied: bool
    is_active: bool
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# CATEGORÍA MATERIA PRIMA
# ─────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    requires_allergen_cert: bool = False
    requires_cruelty_free: bool = False


class CategoryOut(CategoryCreate):
    id: int
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# MATERIA PRIMA
# ─────────────────────────────────────────────

class RawMaterialCreate(BaseModel):
    initial_name: str
    commercial_name: Optional[str] = None
    cas_number: Optional[str] = None
    category_id: Optional[int] = None
    manufacturer_id: Optional[int] = None
    description: Optional[str] = None
    min_stock: float = 0
    unit_of_measure: str = "kg"
    ghs_hazard_classes: List[str] = []
    ghs_signal_word: Optional[str] = None
    ghs_hazard_statements: List[str] = []
    ghs_precautionary_statements: List[str] = []
    is_fragrance: bool = False
    notes: Optional[str] = None


class RawMaterialUpdate(BaseModel):
    initial_name: Optional[str] = None
    commercial_name: Optional[str] = None
    cas_number: Optional[str] = None
    category_id: Optional[int] = None
    manufacturer_id: Optional[int] = None
    description: Optional[str] = None
    min_stock: Optional[float] = None
    unit_of_measure: Optional[str] = None
    ghs_hazard_classes: Optional[List[str]] = None
    ghs_signal_word: Optional[str] = None
    ghs_hazard_statements: Optional[List[str]] = None
    ghs_precautionary_statements: Optional[List[str]] = None
    is_fragrance: Optional[bool] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class RawMaterialOut(BaseModel):
    id: int
    internal_code: str
    initial_name: str
    commercial_name: Optional[str] = None
    cas_number: Optional[str] = None
    category_id: Optional[int] = None
    category: Optional[CategoryOut] = None
    manufacturer_id: Optional[int] = None
    manufacturer: Optional[ManufacturerOut] = None
    description: Optional[str] = None
    min_stock: float
    unit_of_measure: str
    current_stock: float
    ghs_hazard_classes: List[str] = []
    ghs_signal_word: Optional[str] = None
    is_fragrance: bool
    is_active: bool
    predicted_restock_date: Optional[date] = None
    expiry_risk_score: float = 0
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RawMaterialSummary(BaseModel):
    """Versión compacta para listas/selects."""
    id: int
    internal_code: str
    initial_name: str
    commercial_name: Optional[str] = None
    current_stock: float
    unit_of_measure: str
    is_active: bool
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# COMPATIBILIDAD QUÍMICA
# ─────────────────────────────────────────────

class CompatibilityCreate(BaseModel):
    material_a_id: int
    material_b_id: int
    status: CompatibilityStatus
    reason: Optional[str] = None
    recommendation: Optional[str] = None


class CompatibilityOut(CompatibilityCreate):
    id: int
    material_a: Optional[RawMaterialSummary] = None
    material_b: Optional[RawMaterialSummary] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class CompatibilityCheckRequest(BaseModel):
    material_id: int
    warehouse_location_id: int


class CompatibilityCheckResult(BaseModel):
    is_allowed: bool
    conflicts: List[CompatibilityOut] = []
    message: str


# ─────────────────────────────────────────────
# LOTES
# ─────────────────────────────────────────────

class LotCreate(BaseModel):
    raw_material_id: int
    supplier_id: Optional[int] = None
    location_id: Optional[int] = None
    lot_number: str
    quantity_received: float
    unit_of_measure: str = "kg"
    entry_date: date
    expiry_date: date
    manufacture_date: Optional[date] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.expiry_date <= self.entry_date:
            raise ValueError("La fecha de vencimiento debe ser posterior a la fecha de ingreso")
        return self


class LotUpdate(BaseModel):
    location_id: Optional[int] = None
    status: Optional[LotStatus] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


class LotApprove(BaseModel):
    location_id: int
    notes: Optional[str] = None


class LotOut(BaseModel):
    id: int
    raw_material_id: int
    raw_material: Optional[RawMaterialSummary] = None
    supplier_id: Optional[int] = None
    supplier: Optional[SupplierOut] = None
    location_id: Optional[int] = None
    location: Optional[WarehouseLocationOut] = None
    lot_number: str
    internal_lot: Optional[str] = None
    quantity_received: float
    quantity_available: float
    unit_of_measure: str
    entry_date: date
    expiry_date: date
    manufacture_date: Optional[date] = None
    status: LotStatus
    rejection_reason: Optional[str] = None
    has_coa: bool
    has_technical_sheet: bool
    has_safety_sheet: bool
    has_allergen_cert: bool
    has_cruelty_free: bool
    has_quotation: bool
    notes: Optional[str] = None
    days_to_expiry: Optional[int] = None
    expiry_status: Optional[str] = None    # green/yellow/orange/red/expired
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# DOCUMENTOS
# ─────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: int
    lot_id: int
    doc_type: DocumentType
    filename: str
    original_filename: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    is_valid: bool
    version: int
    notes: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# MOVIMIENTOS
# ─────────────────────────────────────────────

class MovementCreate(BaseModel):
    lot_id: int
    movement_type: MovementType
    quantity: float
    origin_location_id: Optional[int] = None
    destination_location_id: Optional[int] = None
    reference_number: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v):
        if v <= 0:
            raise ValueError("La cantidad debe ser positiva")
        return v


class MovementOut(BaseModel):
    id: int
    lot_id: int
    user_id: int
    movement_type: MovementType
    quantity: float
    quantity_before: float
    quantity_after: float
    reference_number: Optional[str] = None
    reason: Optional[str] = None
    movement_date: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# ALERTAS
# ─────────────────────────────────────────────

class AlertOut(BaseModel):
    id: int
    alert_type: AlertType
    title: str
    message: str
    raw_material_id: Optional[int] = None
    lot_id: Optional[int] = None
    is_read: bool
    is_resolved: bool
    days_to_expiry: Optional[int] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# DASHBOARD / ANALYTICS
# ─────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_raw_materials: int
    active_lots: int
    expired_lots: int
    lots_expiring_30_days: int
    lots_expiring_90_days: int
    low_stock_materials: int
    pending_documents: int
    total_alerts_unread: int
    warehouses_usage: List[Dict[str, Any]] = []
    top_materials_by_movement: List[Dict[str, Any]] = []
    expiry_distribution: Dict[str, int] = {}


class ExpiryForecast(BaseModel):
    raw_material_id: int
    raw_material_name: str
    lot_id: int
    lot_number: str
    expiry_date: date
    days_to_expiry: int
    quantity_available: float
    unit_of_measure: str
    expiry_status: str
    risk_score: float


# ─────────────────────────────────────────────
# AI CHAT
# ─────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    response: str
    suggested_actions: List[str] = []


# ─────────────────────────────────────────────
# ML PREDICTIONS
# ─────────────────────────────────────────────

class RestockRecommendation(BaseModel):
    raw_material_id: int
    raw_material_name: str
    current_stock: float
    min_stock: float
    avg_monthly_consumption: float
    predicted_stockout_date: Optional[date] = None
    recommended_order_quantity: float
    urgency: str  # high / medium / low
    confidence: float


class RiskAnalysis(BaseModel):
    raw_material_id: int
    raw_material_name: str
    risk_factors: List[str]
    overall_risk: str  # high / medium / low
    recommendations: List[str]


# ─────────────────────────────────────────────
# PAGINATION
# ─────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int
