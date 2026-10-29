"""
SGIMP - Servicio de IA con Anthropic
Chatbot con búsqueda web activada para consultas de proveedores,
fichas de seguridad, precios y normativas en línea.
"""

from typing import List, Dict
import anthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.models.models import RawMaterial, Lot, LotStatus, Alert, Supplier, Manufacturer
from app.schemas.schemas import ChatMessage, ChatResponse


SYSTEM_PROMPT = """Eres SGIMP Assistant, un asistente especializado en gestión de
materias primas para la industria cosmética y farmacéutica colombiana.

Tu expertise incluye:
- Gestión de inventarios y control de lotes
- Normativas de calidad: GMP, ISO, BPM, INVIMA Colombia
- Sistema Globalmente Armonizado (GHS/SGA) de clasificación de peligros químicos
- Compatibilidad e incompatibilidad química
- Gestión documental: COA, SDS, fichas técnicas
- Control de vencimientos y alertas
- Trazabilidad de materias primas
- Nomenclatura INCI para ingredientes cosméticos
- Resolución 3774 de 2004 (cosméticos Colombia)

CAPACIDADES ESPECIALES:
- Puedes buscar en internet usando la herramienta web_search
- Úsala para: buscar proveedores, consultar precios actuales, encontrar fichas de
  seguridad (SDS) públicas, verificar normativas vigentes, buscar información de
  fabricantes o certificaciones
- Cuando el usuario pregunte por un proveedor específico, empresa, producto o
  normativa reciente, SIEMPRE busca en internet para dar información actualizada

CONTEXTO DEL SISTEMA EN ESTE MOMENTO:
{context}

REGLAS DE RESPUESTA:
- Responde siempre en español
- Sé conciso y práctico
- Si detectas riesgos de seguridad, señálalos claramente
- Para incompatibilidades químicas: sé conservador (seguridad primero)
- Cuando busques en internet, cita la fuente
- Al final incluye acciones sugeridas con formato:
  ACCIONES: acción1 | acción2 | acción3
"""


class AIService:

    @staticmethod
    async def get_system_context(db: AsyncSession) -> str:
        """Obtiene estadísticas y datos relevantes del sistema para el chatbot."""
        total_rm = await db.scalar(select(func.count(RawMaterial.id)).where(RawMaterial.is_active == True))
        active_lots = await db.scalar(
            select(func.count(Lot.id)).where(Lot.status == LotStatus.APPROVED)
        )
        unread_alerts = await db.scalar(
            select(func.count(Alert.id)).where(
                Alert.is_read == False, Alert.is_resolved == False
            )
        )
        # Active suppliers
        suppliers_result = await db.execute(
            select(Supplier).where(Supplier.is_active == True).limit(10)
        )
        suppliers = suppliers_result.scalars().all()
        supplier_names = ", ".join(s.name for s in suppliers) if suppliers else "ninguno registrado"

        # Low stock materials
        low_stock_result = await db.execute(
            select(RawMaterial).where(
                RawMaterial.current_stock <= RawMaterial.min_stock,
                RawMaterial.is_active == True,
                RawMaterial.min_stock > 0,
            ).limit(5)
        )
        low_stock = low_stock_result.scalars().all()
        low_stock_names = ", ".join(m.initial_name for m in low_stock) if low_stock else "ninguna"

        return (
            f"Materias primas activas: {total_rm}. "
            f"Lotes activos: {active_lots}. "
            f"Alertas sin leer: {unread_alerts}. "
            f"Proveedores registrados: {supplier_names}. "
            f"Materiales con stock bajo: {low_stock_names}."
        )

    @staticmethod
    async def chat(
        db: AsyncSession,
        message: str,
        conversation_history: List[ChatMessage],
    ) -> ChatResponse:
        if not settings.ANTHROPIC_API_KEY:
            return ChatResponse(
                response=(
                    "⚠️ La integración de IA no está configurada. "
                    "Por favor configura ANTHROPIC_API_KEY en el archivo .env"
                ),
                suggested_actions=["Configurar API key de Anthropic en backend/.env"],
            )

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        context = await AIService.get_system_context(db)

        # Build message history (last 10 for context window)
        messages = []
        for msg in conversation_history[-10:]:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": message})

        # Web search tool definition
        tools = [
            {
                "type": "web_search_20250305",
                "name": "web_search",
            }
        ]

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            system=SYSTEM_PROMPT.format(context=context),
            tools=tools,
            messages=messages,
        )

        # Collect all text blocks (including after tool use)
        raw_response = ""
        for block in response.content:
            if hasattr(block, "text"):
                raw_response += block.text

        # If the model used web_search, handle the agentic loop
        # (anthropic SDK handles tool_use automatically when using beta)
        if not raw_response:
            raw_response = "He buscado la información. " + " ".join(
                block.text for block in response.content if hasattr(block, "text")
            )

        # Parse suggested actions
        suggested_actions = []
        if "ACCIONES:" in raw_response:
            parts = raw_response.split("ACCIONES:")
            main_response = parts[0].strip()
            actions_text = parts[1].strip()
            suggested_actions = [a.strip() for a in actions_text.split("|") if a.strip()]
        else:
            main_response = raw_response

        return ChatResponse(
            response=main_response or "No se obtuvo respuesta del asistente.",
            suggested_actions=suggested_actions,
        )

    @staticmethod
    async def analyze_incompatibility(
        material_a_name: str,
        material_b_name: str,
    ) -> Dict:
        """Consulta a Claude con búsqueda web sobre compatibilidad entre dos materiales."""
        if not settings.ANTHROPIC_API_KEY:
            return {
                "compatible": None,
                "reason": "IA no configurada",
                "recommendation": "Consultar con experto químico",
            }

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        tools = [{"type": "web_search_20250305", "name": "web_search"}]

        prompt = (
            f"Analiza la compatibilidad química para almacenamiento conjunto de: "
            f"'{material_a_name}' y '{material_b_name}'. "
            f"Busca en internet si no estás seguro. "
            f"Responde SOLO en JSON válido con estos campos: "
            f"compatible (true/false/null), "
            f"reason (explicación en español, máx 100 caracteres), "
            f"recommendation (acción recomendada en español, máx 100 caracteres). "
            f"Solo el JSON, sin texto adicional ni backticks."
        )

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            tools=tools,
            messages=[{"role": "user", "content": prompt}],
        )

        import json
        raw = ""
        for block in response.content:
            if hasattr(block, "text"):
                raw += block.text

        # Clean JSON if wrapped in backticks
        raw = raw.strip().strip("```json").strip("```").strip()

        try:
            return json.loads(raw)
        except Exception:
            return {
                "compatible": None,
                "reason": "No se pudo determinar automáticamente",
                "recommendation": "Consultar ficha de seguridad (SDS) de ambos materiales",
            }

    @staticmethod
    async def search_supplier_info(supplier_name: str) -> Dict:
        """Busca información de un proveedor específico en internet."""
        if not settings.ANTHROPIC_API_KEY:
            return {"error": "IA no configurada"}

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        tools = [{"type": "web_search_20250305", "name": "web_search"}]

        prompt = (
            f"Busca información sobre el proveedor/empresa '{supplier_name}' "
            f"en el contexto de materias primas cosméticas o farmacéuticas en Colombia o Latinoamérica. "
            f"Incluye: sitio web, contacto, productos que distribuyen, certificaciones si las tienen. "
            f"Responde en español de forma concisa."
        )

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            tools=tools,
            messages=[{"role": "user", "content": prompt}],
        )

        text = " ".join(b.text for b in response.content if hasattr(b, "text"))
        return {"info": text, "supplier": supplier_name}
