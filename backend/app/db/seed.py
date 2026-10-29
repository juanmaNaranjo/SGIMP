"""
SGIMP - Script de datos iniciales
Crea usuario admin, categorías, bodegas y materias primas de ejemplo.
Ejecutar con: python -m app.db.seed
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.db.database import AsyncSessionLocal, create_tables
from app.models.models import (
    User, UserRole, RawMaterialCategory, Manufacturer, Supplier,
    Warehouse, WarehouseLocation, RawMaterial
)
from app.core.security import get_password_hash


async def seed():
    await create_tables()
    async with AsyncSessionLocal() as db:
        # ── Admin user ──────────────────────────────────
        existing = await db.get(User, 1)
        if not existing:
            admin = User(
                email="admin@sgimp.com",
                username="admin",
                full_name="Administrador SGIMP",
                hashed_password=get_password_hash("Admin1234"),
                role=UserRole.ADMIN,
            )
            quality = User(
                email="calidad@sgimp.com",
                username="calidad",
                full_name="Analista de Calidad",
                hashed_password=get_password_hash("Calidad1234"),
                role=UserRole.QUALITY_ANALYST,
            )
            warehouse_user = User(
                email="almacen@sgimp.com",
                username="almacen",
                full_name="Almacenista",
                hashed_password=get_password_hash("Almacen1234"),
                role=UserRole.WAREHOUSE,
            )
            db.add_all([admin, quality, warehouse_user])
            print("✅ Usuarios creados")

        # ── Categories ──────────────────────────────────
        cats = [
            RawMaterialCategory(name="Conservantes", description="Agentes conservantes y antimicrobianos"),
            RawMaterialCategory(name="Emolientes", description="Aceites, mantecas y ésteres"),
            RawMaterialCategory(name="Surfactantes", description="Detergentes y espumantes"),
            RawMaterialCategory(name="Fragancias", description="Aceites esenciales y fragancias sintéticas",
                                requires_allergen_cert=True, requires_cruelty_free=True),
            RawMaterialCategory(name="Activos cosméticos", description="Vitaminas, péptidos y extractos"),
            RawMaterialCategory(name="Reguladores de pH", description="Ácidos y bases para ajuste de pH"),
            RawMaterialCategory(name="Pigmentos y colorantes", description="Colorantes aprobados para cosméticos"),
            RawMaterialCategory(name="Espesantes", description="Polímeros y agentes viscosantes"),
            RawMaterialCategory(name="Solventes", description="Alcoholes, glicoles y solventes"),
            RawMaterialCategory(name="Desinfectantes", description="Agentes biocidas para limpieza"),
        ]
        db.add_all(cats)
        print("✅ Categorías creadas")

        # ── Manufacturers ────────────────────────────────
        manufacturers = [
            Manufacturer(name="BASF SE", country="Alemania", contact_email="info@basf.com", website="https://www.basf.com"),
            Manufacturer(name="Dow Chemical", country="Estados Unidos", contact_email="info@dow.com"),
            Manufacturer(name="Evonik Industries", country="Alemania"),
            Manufacturer(name="Croda International", country="Reino Unido"),
            Manufacturer(name="IFF", country="Estados Unidos"),
            Manufacturer(name="Givaudan", country="Suiza"),
            Manufacturer(name="Brenntag Colombia", country="Colombia"),
        ]
        db.add_all(manufacturers)
        print("✅ Fabricantes creados")

        # ── Suppliers ────────────────────────────────────
        suppliers = [
            Supplier(name="QuimiCorp SAS", nit="900.111.222-3", contact_email="ventas@quimicorp.com",
                     city="Medellín", country="Colombia"),
            Supplier(name="Distribuidora Química Andina", nit="830.444.555-6",
                     contact_email="pedidos@dqa.com.co", city="Bogotá"),
            Supplier(name="Insumos Cosméticos del Pacífico", nit="900.777.888-9",
                     city="Cali", country="Colombia"),
        ]
        db.add_all(suppliers)
        print("✅ Proveedores creados")

        # ── Warehouses ───────────────────────────────────
        bod_a = Warehouse(code="BOD-A", name="Bodega Principal",
                          description="Almacenamiento general materias primas",
                          temperature_min=15.0, temperature_max=25.0, humidity_max=65.0)
        bod_b = Warehouse(code="BOD-B", name="Cuarto Frío",
                          description="Materias primas que requieren refrigeración",
                          temperature_min=2.0, temperature_max=8.0, humidity_max=50.0)
        bod_c = Warehouse(code="BOD-C", name="Bodega Fragancias",
                          description="Almacenamiento de fragancias y aceites esenciales")
        db.add_all([bod_a, bod_b, bod_c])
        await db.flush()

        # Locations for Bodega A
        for row in ['A', 'B', 'C']:
            for num in range(1, 7):
                db.add(WarehouseLocation(
                    warehouse_id=bod_a.id,
                    code=f"{row}{num}",
                    name=f"Estante {row} posición {num}",
                    capacity=50.0,
                ))
        # Locations for Bodega B
        for num in range(1, 5):
            db.add(WarehouseLocation(
                warehouse_id=bod_b.id,
                code=f"F{num}",
                name=f"Posición fría {num}",
                capacity=20.0,
            ))
        print("✅ Bodegas y ubicaciones creadas")

        # ── Raw Materials (sample) ───────────────────────
        await db.flush()

        sample_materials = [
            RawMaterial(
                internal_code="MP-SAMPLE-0001",
                initial_name="Sodium Hypochlorite",
                commercial_name="Hipoclorito de Sodio",
                cas_number="7681-52-9",
                min_stock=5.0, unit_of_measure="kg",
                ghs_hazard_classes=["corrosive", "oxidizing", "environmental"],
                ghs_signal_word="Danger",
                ghs_hazard_statements=["H290", "H314", "H400"],
                ghs_precautionary_statements=["P260", "P273", "P280", "P301+P330+P331"],
                notes="Incompatible con ácidos. Almacenar en bodega separada de ácidos.",
            ),
            RawMaterial(
                internal_code="MP-SAMPLE-0002",
                initial_name="Ascorbic Acid",
                commercial_name="Vitamina C",
                cas_number="50-81-7",
                min_stock=2.0, unit_of_measure="kg",
                ghs_hazard_classes=["irritant"],
                ghs_signal_word="Warning",
            ),
            RawMaterial(
                internal_code="MP-SAMPLE-0003",
                initial_name="Tocopherol",
                commercial_name="Vitamina E",
                cas_number="59-02-9",
                min_stock=1.0, unit_of_measure="kg",
                ghs_hazard_classes=[],
            ),
            RawMaterial(
                internal_code="MP-SAMPLE-0004",
                initial_name="Citric Acid",
                commercial_name="Ácido Cítrico",
                cas_number="77-92-9",
                min_stock=3.0, unit_of_measure="kg",
                ghs_hazard_classes=["irritant"],
                ghs_signal_word="Warning",
                notes="Incompatible con hipoclorito de sodio y otros oxidantes.",
            ),
            RawMaterial(
                internal_code="MP-SAMPLE-0005",
                initial_name="Glycerin",
                commercial_name="Glicerina USP",
                cas_number="56-81-5",
                min_stock=10.0, unit_of_measure="kg",
                ghs_hazard_classes=[],
            ),
            RawMaterial(
                internal_code="MP-SAMPLE-0006",
                initial_name="Phenoxyethanol",
                commercial_name="Fenoxietanol",
                cas_number="122-99-6",
                min_stock=2.0, unit_of_measure="kg",
                ghs_hazard_classes=["irritant", "health_hazard"],
                ghs_signal_word="Warning",
            ),
        ]
        db.add_all(sample_materials)

        await db.commit()
        print("\n🎉 Base de datos inicializada correctamente!")
        print("\n📋 Credenciales de acceso:")
        print("   Admin:    admin / Admin1234")
        print("   Calidad:  calidad / Calidad1234")
        print("   Almacén:  almacen / Almacen1234")
        print("\n🚀 Accede a: http://localhost:3000")
        print("📚 API Docs: http://localhost:8000/api/docs")


if __name__ == "__main__":
    asyncio.run(seed())
