"""
SGIMP - Módulo ML/IA
- Predicción de vencimientos en riesgo
- Recomendaciones de reabastecimiento
- Análisis de riesgo químico con score
"""

from typing import List, Optional, Dict
from datetime import date, timedelta
import numpy as np
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.models import Lot, LotStatus, RawMaterial, InventoryMovement, MovementType
from app.schemas.schemas import RestockRecommendation, RiskAnalysis


class MLService:

    # ─────────────────────────────────────────────
    # PREDICCIÓN DE VENCIMIENTOS
    # ─────────────────────────────────────────────

    @staticmethod
    async def predict_expiry_risk(db: AsyncSession) -> List[Dict]:
        """
        Calcula un score de riesgo de vencimiento para cada lote activo.
        Factores: días para vencer, cantidad disponible vs histórico de consumo,
        tasa de rotación del material.
        """
        result = await db.execute(
            select(Lot)
            .options(selectinload(Lot.raw_material), selectinload(Lot.movements))
            .where(Lot.status == LotStatus.APPROVED)
        )
        lots = result.scalars().all()

        predictions = []
        for lot in lots:
            today = date.today()
            days_to_expiry = (lot.expiry_date - today).days
            if days_to_expiry < 0:
                risk_score = 1.0
            else:
                # Factor 1: proximidad al vencimiento (0=verde, 1=vencido)
                max_days = 365
                time_factor = 1 - min(days_to_expiry / max_days, 1.0)

                # Factor 2: cantidad disponible relativa (mucho disponible + poco tiempo = riesgo)
                total_received = lot.quantity_received or 1
                pct_remaining = lot.quantity_available / total_received
                qty_factor = pct_remaining * time_factor

                # Factor 3: movimientos recientes (más movimientos = menos riesgo)
                exit_movements = [
                    m for m in lot.movements
                    if m.movement_type in (MovementType.EXIT, MovementType.REJECT)
                ]
                movement_factor = max(0, 1 - len(exit_movements) * 0.1)

                risk_score = round(
                    (time_factor * 0.5 + qty_factor * 0.3 + movement_factor * 0.2), 3
                )

            predictions.append({
                "lot_id": lot.id,
                "lot_number": lot.internal_lot,
                "raw_material_id": lot.raw_material_id,
                "raw_material_name": lot.raw_material.initial_name if lot.raw_material else "",
                "expiry_date": lot.expiry_date.isoformat(),
                "days_to_expiry": days_to_expiry,
                "quantity_available": lot.quantity_available,
                "unit_of_measure": lot.unit_of_measure,
                "risk_score": risk_score,
                "risk_level": (
                    "critical" if risk_score >= 0.75 else
                    "high" if risk_score >= 0.5 else
                    "medium" if risk_score >= 0.25 else
                    "low"
                ),
            })

        return sorted(predictions, key=lambda x: x["risk_score"], reverse=True)

    # ─────────────────────────────────────────────
    # RECOMENDACIONES DE REABASTECIMIENTO
    # ─────────────────────────────────────────────

    @staticmethod
    async def get_restock_recommendations(db: AsyncSession) -> List[RestockRecommendation]:
        """
        Analiza consumo histórico por materia prima y predice
        cuándo se agotará el stock actual.
        """
        result = await db.execute(
            select(RawMaterial)
            .options(selectinload(RawMaterial.lots))
            .where(RawMaterial.is_active == True)
        )
        materials = result.scalars().all()

        recommendations = []
        for mat in materials:
            # Obtener movimientos de salida de los últimos 6 meses
            movements_result = await db.execute(
                select(InventoryMovement)
                .join(Lot, InventoryMovement.lot_id == Lot.id)
                .where(
                    Lot.raw_material_id == mat.id,
                    InventoryMovement.movement_type.in_([MovementType.EXIT]),
                )
                .order_by(InventoryMovement.movement_date.desc())
                .limit(100)
            )
            movements = movements_result.scalars().all()

            if not movements:
                avg_monthly = 0
            else:
                # Calcular consumo promedio mensual
                total_consumed = sum(m.quantity for m in movements)
                if len(movements) >= 2:
                    oldest = movements[-1].movement_date
                    newest = movements[0].movement_date
                    months_span = max(
                        ((newest - oldest).days / 30), 0.1
                    )
                    avg_monthly = total_consumed / months_span
                else:
                    avg_monthly = total_consumed

            # Predicción de stockout
            if avg_monthly > 0:
                days_of_stock = (mat.current_stock / avg_monthly) * 30
                stockout_date = date.today() + timedelta(days=int(days_of_stock))
                recommended_qty = avg_monthly * 2  # 2 meses de stock
            else:
                stockout_date = None
                recommended_qty = mat.min_stock * 2 if mat.min_stock > 0 else 0

            # Urgencia
            if stockout_date and stockout_date <= date.today() + timedelta(days=15):
                urgency = "high"
            elif mat.current_stock <= mat.min_stock:
                urgency = "high"
            elif stockout_date and stockout_date <= date.today() + timedelta(days=45):
                urgency = "medium"
            else:
                urgency = "low"

            if urgency != "low" or mat.current_stock <= mat.min_stock:
                confidence = min(len(movements) / 10, 1.0)
                recommendations.append(
                    RestockRecommendation(
                        raw_material_id=mat.id,
                        raw_material_name=mat.initial_name,
                        current_stock=mat.current_stock,
                        min_stock=mat.min_stock,
                        avg_monthly_consumption=round(avg_monthly, 2),
                        predicted_stockout_date=stockout_date,
                        recommended_order_quantity=round(recommended_qty, 2),
                        urgency=urgency,
                        confidence=round(confidence, 2),
                    )
                )

        return sorted(
            recommendations,
            key=lambda x: (x.urgency == "high", x.urgency == "medium"),
            reverse=True,
        )

    # ─────────────────────────────────────────────
    # ANÁLISIS DE RIESGO QUÍMICO
    # ─────────────────────────────────────────────

    @staticmethod
    async def analyze_chemical_risk(db: AsyncSession, material_id: int) -> RiskAnalysis:
        """
        Analiza el riesgo químico de una materia prima basado en GHS
        y sus incompatibilidades registradas.
        """
        mat = await db.get(RawMaterial, material_id)
        if not mat:
            raise ValueError("Materia prima no encontrada")

        risk_factors = []
        recommendations = []

        hazard_classes = mat.ghs_hazard_classes or []

        # Evaluar clases de peligro GHS
        high_risk_classes = {
            "explosive": "Explosivo",
            "toxic": "Tóxico",
            "flammable": "Inflamable",
            "oxidizing": "Oxidante",
        }
        medium_risk_classes = {
            "corrosive": "Corrosivo",
            "compressed_gas": "Gas comprimido",
            "health_hazard": "Peligro para la salud",
        }
        low_risk_classes = {
            "irritant": "Irritante",
            "environmental": "Peligroso para el medio ambiente",
        }

        high_count = sum(1 for h in hazard_classes if h in high_risk_classes)
        medium_count = sum(1 for h in hazard_classes if h in medium_risk_classes)

        for h in hazard_classes:
            if h in high_risk_classes:
                risk_factors.append(f"Clasificado como {high_risk_classes[h]} (GHS)")
            elif h in medium_risk_classes:
                risk_factors.append(f"Clasificado como {medium_risk_classes[h]} (GHS)")
            elif h in low_risk_classes:
                risk_factors.append(f"Clasificado como {low_risk_classes[h]} (GHS)")

        # Verificar incompatibilidades
        from app.models.models import ChemicalCompatibility, CompatibilityStatus
        incompat_result = await db.execute(
            select(ChemicalCompatibility).where(
                (ChemicalCompatibility.material_a_id == material_id) |
                (ChemicalCompatibility.material_b_id == material_id),
                ChemicalCompatibility.status == CompatibilityStatus.INCOMPATIBLE,
            )
        )
        incompatibilities = incompat_result.scalars().all()

        if incompatibilities:
            risk_factors.append(
                f"Tiene {len(incompatibilities)} incompatibilidad(es) química(s) registrada(s)"
            )

        # Score general
        if high_count >= 2 or len(incompatibilities) > 3:
            overall_risk = "high"
        elif high_count == 1 or medium_count >= 2 or len(incompatibilities) > 0:
            overall_risk = "medium"
        else:
            overall_risk = "low"

        # Recomendaciones
        if mat.ghs_signal_word == "Danger":
            recommendations.append("Usar EPP completo: guantes, gafas y bata de laboratorio")
        if "flammable" in hazard_classes:
            recommendations.append("Almacenar alejado de fuentes de calor e ignición")
        if "corrosive" in hazard_classes:
            recommendations.append("Almacenar en recipientes resistentes a corrosión")
        if "toxic" in hazard_classes:
            recommendations.append("Almacenar en área ventilada con extracción de vapores")
        if incompatibilities:
            recommendations.append(
                "Verificar compatibilidad antes de asignar ubicación de bodega"
            )
        if not recommendations:
            recommendations.append("Seguir procedimientos estándar de manejo de reactivos")

        return RiskAnalysis(
            raw_material_id=material_id,
            raw_material_name=mat.initial_name,
            risk_factors=risk_factors,
            overall_risk=overall_risk,
            recommendations=recommendations,
        )

    # ─────────────────────────────────────────────
    # DASHBOARD DE ANÁLISIS
    # ─────────────────────────────────────────────

    @staticmethod
    async def get_consumption_trend(
        db: AsyncSession, raw_material_id: int, months: int = 6
    ) -> Dict:
        """Retorna tendencia de consumo mensual para gráficas."""
        result = await db.execute(
            select(InventoryMovement)
            .join(Lot, InventoryMovement.lot_id == Lot.id)
            .where(
                Lot.raw_material_id == raw_material_id,
                InventoryMovement.movement_type == MovementType.EXIT,
            )
            .order_by(InventoryMovement.movement_date)
        )
        movements = result.scalars().all()

        if not movements:
            return {"labels": [], "data": []}

        # Agrupar por mes
        df_data = [
            {
                "date": m.movement_date.strftime("%Y-%m"),
                "quantity": m.quantity,
            }
            for m in movements
        ]
        df = pd.DataFrame(df_data)
        grouped = df.groupby("date")["quantity"].sum().reset_index()

        return {
            "labels": grouped["date"].tolist(),
            "data": grouped["quantity"].tolist(),
        }
