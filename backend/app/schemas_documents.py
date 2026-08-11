from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models import BuildingType
from app.models_documents import DocumentFamily, GeneratedDocumentStatus, TigDocumentSubtype


class DocumentTemplateResponse(BaseModel):
    id: int
    family: DocumentFamily
    doc_subtype: TigDocumentSubtype
    building_type: Optional[BuildingType] = None
    currency: Optional[str] = None
    is_electronic: bool
    is_delay_variant: bool
    name: str
    input_schema: Optional[str] = None
    version: int
    is_active: bool
    uploaded_by_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentTemplateUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    input_schema: Optional[str] = None


class GeneratedDocumentCreate(BaseModel):
    family: DocumentFamily
    source_id: int
    # Only meaningful for family=TIG — ignored otherwise.
    doc_subtype: TigDocumentSubtype = TigDocumentSubtype.NORMAL
    delay_reason: Optional[str] = None
    # Only meaningful for SUBCONTRACTOR_CONTRACT/TIG — not derived from any
    # stored data, the caller explicitly picks paper vs. e-signature wording.
    is_electronic: bool = False
    # Explicit template override — when set, generation uses this exact
    # template instead of services.document_templates.select_template's
    # automatic building_type/currency/delay-risk matching.
    template_id: Optional[int] = None


class GeneratedDocumentResponse(BaseModel):
    id: int
    family: DocumentFamily
    source_id: int
    project_id: Optional[int] = None
    template_id: int
    doc_subtype: TigDocumentSubtype
    delay_reason: Optional[str] = None
    status: GeneratedDocumentStatus
    has_pdf: bool = False
    version: int
    generated_by_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
