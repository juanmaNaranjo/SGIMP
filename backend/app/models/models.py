"""
SGIMP - Modelos de Base de Datos
Todos los modelos SQLAlchemy del sistema.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date,
    Text, ForeignKey, Enum, JSON, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
import enum

from app.db.database import Base


# ─────────────────────────────────────────────
# ENUMS
# ─────────────────────────────────────────────

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    QUALITY_ANALYST = "quality_analyst"
    WAREHOUSE = "warehouse"
    PURCHASING = "purchasing"
    PRODUCTION = "production"
    AUDITOR = "auditor"


class LotStatus(str, enum.Enum):
    PENDING = "pending"           # Pendiente de aprobación
    APPROVED = "approved"         # Aprobado
    REJECTED = "rejected"         # Rechazado
    EXPIRED = "expired"           # Vencido
    CONSUMED = "consumed"         # Consumido
    QUARANTINE = "quarantine"     # En cuarentena


class MovementType(str, enum.Enum):
    ENTRY = "entry"               # Ingreso
    EXIT = "exit"                 # Salida
    TRANSFER = "transfer"         # Transferencia entre bodegas
    ADJUSTMENT = "adjustment"     # Ajuste
    REJECT = "reject"             # Rechazo/Baja


class DocumentType(str, enum.Enum):
    TECHNICAL_SHEET = "technical_sheet"       # Ficha técnica
    SAFETY_SHEET = "safety_sheet"             # Ficha de seguridad (SDS)
    COA = "coa"                               # Certificado de análisis
    ALLERGEN_CERT = "allergen_cert"           # Declaración de alérgenos
    CRUELTY_FREE = "cruelty_free"             # No testeado en animales
    QUOTATION = "quotation"                   # Cotización
    GHS_SHEET = "ghs_sheet"                   # Hoja GHS
    OTHER = "other"


class CompatibilityStatus(str, enum.Enum):
    COMPATIBLE = "compatible"
    INCOMPATIBLE = "incompatible"
    RESTRICTED = "restricted"     # Requiere condiciones especiales


class AlertType(str, enum.Enum):
    EXPIRY_WARNING = "expiry_warning"
    EXPIRY_CRITICAL = "expiry_critical"
    EXPIRED = "expired"
    LOW_STOCK = "low_stock"
    MISSING_DOCUMENT = "missing_document"
    INCOMPATIBILITY = "incompatibility"


class GHSHazardClass(str, enum.Enum):
    EXPLOSIVE = "explosive"
    FLAMMABLE = "flammable"
    OXIDIZING = "oxidizing"
    COMPRESSED_GAS = "compressed_gas"
    CORROSIVE = "corrosive"
    TOXIC = "toxic"
    IRRITANT = "irritant"
    HEALTH_HAZARD = "health_hazard"
    ENVIRONMENTAL = "environmental"


# ─────────────────────────────────────────────
# USUARIO
# ─────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(200), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.WAREHOUSE, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    movements = relationship("InventoryMovement", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")


# ─────────────────────────────────────────────
# CATÁLOGO: FABRICANTE Y PROVEEDOR
# ─────────────────────────────────────────────

class Manufacturer(Base):
    __tablename__ = "manufacturers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    country = Column(String(100))
    contact_email = Column(String(255))
    contact_phone = Column(String(50))
    website = Column(String(300))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    raw_materials = relationship("RawMaterial", back_populates="manufacturer")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    nit = Column(String(50))
    contact_name = Column(String(200))
    contact_email = Column(String(255))
    contact_phone = Column(String(50))
    address = Column(Text)
    city = Column(String(100))
    country = Column(String(100), default="Colombia")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lots = relationship("Lot", back_populates="supplier")
    documents = relationship("Document", back_populates="supplier")


# ─────────────────────────────────────────────
# BODEGA Y UBICACIONES
# ─────────────────────────────────────────────

class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    temperature_min = Column(Float)
    temperature_max = Column(Float)
    humidity_max = Column(Float)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    locations = relationship("WarehouseLocation", back_populates="warehouse")


class WarehouseLocation(Base):
    __tablename__ = "warehouse_locations"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    code = Column(String(20), nullable=False)
    name = Column(String(100))
    capacity = Column(Float)
    is_occupied = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    warehouse = relationship("Warehouse", back_populates="locations")
    lots = relationship("Lot", back_populates="location")

    __table_args__ = (
        UniqueConstraint("warehouse_id", "code", name="uq_warehouse_location"),
    )


# ─────────────────────────────────────────────
# MATERIA PRIMA
# ─────────────────────────────────────────────

class RawMaterialCategory(Base):
    __tablename__ = "raw_material_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    requires_allergen_cert = Column(Boolean, default=False)
    requires_cruelty_free = Column(Boolean, default=False)

    raw_materials = relationship("RawMaterial", back_populates="category")


class RawMaterial(Base):
    __tablename__ = "raw_materials"

    id = Column(Integer, primary_key=True, index=True)
    internal_code = Column(String(50), unique=True, nullable=False)
    initial_name = Column(String(300), nullable=False)    # Nombre INCI / científico
    commercial_name = Column(String(300))                  # Nombre comercial
    cas_number = Column(String(50))                        # Número CAS
    category_id = Column(Integer, ForeignKey("raw_material_categories.id"))
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"))
    description = Column(Text)

    # Stock control
    min_stock = Column(Float, default=0)
    unit_of_measure = Column(String(20), default="kg")
    current_stock = Column(Float, default=0)

    # GHS Risk
    ghs_hazard_classes = Column(JSON, default=list)         # Lista de GHSHazardClass
    ghs_signal_word = Column(String(50))                    # Danger / Warning
    ghs_hazard_statements = Column(JSON, default=list)      # H-statements
    ghs_precautionary_statements = Column(JSON, default=list)  # P-statements

    # Status
    is_active = Column(Boolean, default=True)
    is_fragrance = Column(Boolean, default=False)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ML prediction fields
    avg_consumption_per_month = Column(Float, default=0)
    predicted_restock_date = Column(Date)
    expiry_risk_score = Column(Float, default=0)            # 0-1 risk score

    # Relationships
    category = relationship("RawMaterialCategory", back_populates="raw_materials")
    manufacturer = relationship("Manufacturer", back_populates="raw_materials")
    lots = relationship("Lot", back_populates="raw_material", cascade="all, delete-orphan")
    compatibility_a = relationship(
        "ChemicalCompatibility",
        foreign_keys="ChemicalCompatibility.material_a_id",
        back_populates="material_a"
    )
    compatibility_b = relationship(
        "ChemicalCompatibility",
        foreign_keys="ChemicalCompatibility.material_b_id",
        back_populates="material_b"
    )

    __table_args__ = (
        Index("ix_rm_initial_name", "initial_name"),
        Index("ix_rm_commercial_name", "commercial_name"),
    )


# ─────────────────────────────────────────────
# COMPATIBILIDAD QUÍMICA
# ─────────────────────────────────────────────

class ChemicalCompatibility(Base):
    __tablename__ = "chemical_compatibilities"

    id = Column(Integer, primary_key=True, index=True)
    material_a_id = Column(Integer, ForeignKey("raw_materials.id"), nullable=False)
    material_b_id = Column(Integer, ForeignKey("raw_materials.id"), nullable=False)
    status = Column(Enum(CompatibilityStatus), nullable=False)
    reason = Column(Text)
    recommendation = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    material_a = relationship("RawMaterial", foreign_keys=[material_a_id], back_populates="compatibility_a")
    material_b = relationship("RawMaterial", foreign_keys=[material_b_id], back_populates="compatibility_b")

    __table_args__ = (
        UniqueConstraint("material_a_id", "material_b_id", name="uq_compatibility_pair"),
    )


# ─────────────────────────────────────────────
# LOTES
# ─────────────────────────────────────────────

class Lot(Base):
    __tablename__ = "lots"

    id = Column(Integer, primary_key=True, index=True)
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    location_id = Column(Integer, ForeignKey("warehouse_locations.id"))

    lot_number = Column(String(100), nullable=False)         # Lote del fabricante
    internal_lot = Column(String(50), unique=True)           # Lote interno SGIMP

    quantity_received = Column(Float, nullable=False)
    quantity_available = Column(Float, nullable=False)
    unit_of_measure = Column(String(20), default="kg")

    entry_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False)
    manufacture_date = Column(Date)

    status = Column(Enum(LotStatus), default=LotStatus.PENDING)
    rejection_reason = Column(Text)

    # Document validation flags
    has_coa = Column(Boolean, default=False)
    has_technical_sheet = Column(Boolean, default=False)
    has_safety_sheet = Column(Boolean, default=False)
    has_allergen_cert = Column(Boolean, default=False)
    has_cruelty_free = Column(Boolean, default=False)
    has_quotation = Column(Boolean, default=False)

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ML
    days_to_expiry_at_entry = Column(Integer)
    expiry_prediction_flag = Column(Boolean, default=False)

    # Relationships
    raw_material = relationship("RawMaterial", back_populates="lots")
    supplier = relationship("Supplier", back_populates="lots")
    location = relationship("WarehouseLocation", back_populates="lots")
    documents = relationship("Document", back_populates="lot", cascade="all, delete-orphan")
    movements = relationship("InventoryMovement", back_populates="lot")

    __table_args__ = (
        Index("ix_lot_expiry_date", "expiry_date"),
        Index("ix_lot_status", "status"),
    )


# ─────────────────────────────────────────────
# DOCUMENTOS
# ─────────────────────────────────────────────

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))

    doc_type = Column(Enum(DocumentType), nullable=False)
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer)
    mime_type = Column(String(100))

    issue_date = Column(Date)
    expiry_date = Column(Date)
    is_valid = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    notes = Column(Text)

    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    lot = relationship("Lot", back_populates="documents")
    supplier = relationship("Supplier", back_populates="documents")

    __table_args__ = (
        Index("ix_doc_lot_type", "lot_id", "doc_type"),
    )


# ─────────────────────────────────────────────
# MOVIMIENTOS DE INVENTARIO (KARDEX)
# ─────────────────────────────────────────────

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    movement_type = Column(Enum(MovementType), nullable=False)
    quantity = Column(Float, nullable=False)
    quantity_before = Column(Float, nullable=False)
    quantity_after = Column(Float, nullable=False)

    origin_location_id = Column(Integer, ForeignKey("warehouse_locations.id"))
    destination_location_id = Column(Integer, ForeignKey("warehouse_locations.id"))

    reference_number = Column(String(100))     # Número de orden/referencia
    reason = Column(Text)
    notes = Column(Text)
    movement_date = Column(DateTime, default=datetime.utcnow)

    # Relationships
    lot = relationship("Lot", back_populates="movements")
    user = relationship("User", back_populates="movements")

    __table_args__ = (
        Index("ix_movement_lot_date", "lot_id", "movement_date"),
        Index("ix_movement_date", "movement_date"),
    )


# ─────────────────────────────────────────────
# ALERTAS
# ─────────────────────────────────────────────

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(Enum(AlertType), nullable=False)
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=False)

    raw_material_id = Column(Integer, ForeignKey("raw_materials.id"))
    lot_id = Column(Integer, ForeignKey("lots.id"))

    is_read = Column(Boolean, default=False)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"))
    resolved_at = Column(DateTime)

    days_to_expiry = Column(Integer)   # Para alertas de vencimiento
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_alert_unread", "is_read", "is_resolved"),
    )


# ─────────────────────────────────────────────
# AUDITORÍA
# ─────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    entity = Column(String(100), nullable=False)
    entity_id = Column(Integer)
    old_values = Column(JSON)
    new_values = Column(JSON)
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")


# ─────────────────────────────────────────────
# ML PREDICTIONS HISTORY
# ─────────────────────────────────────────────

class MLPrediction(Base):
    __tablename__ = "ml_predictions"

    id = Column(Integer, primary_key=True, index=True)
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id"), nullable=False)
    prediction_type = Column(String(50), nullable=False)   # restock, expiry_risk
    predicted_value = Column(Float)
    predicted_date = Column(Date)
    confidence_score = Column(Float)
    model_version = Column(String(50))
    features_used = Column(JSON)
    actual_value = Column(Float)    # Para evaluar accuracy posterior
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_ml_rm_type", "raw_material_id", "prediction_type"),
    )
