"""
Pydantic request/response schemas for the REST API.
Pydantic v2; ORM objects are serialized via from_attributes.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.models import AlertTier, UserRole


# ── Auth ────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    team_id: uuid.UUID
    team_name: str | None = None  # populated from the user's Team in /auth/me
    email: str
    name: str
    role: UserRole
    digest_time: str
    timezone: str
    is_active: bool


# ── Events ──────────────────────────────────────────────────────────────────
class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source: str
    event_type: str
    tier: AlertTier
    county_fips: str | None
    county_name: str | None
    state_code: str | None
    headline: str
    summary: str | None
    source_url: str | None
    issued_at: datetime | None
    expires_at: datetime | None
    reviewed: bool
    reviewed_by: str | None
    reviewed_at: datetime | None
    created_at: datetime


class EscalateRequest(BaseModel):
    tier: AlertTier


class EventCreate(BaseModel):
    """Manual event entry. `source` is forced to 'manual' server-side."""
    event_type: str
    tier: AlertTier
    headline: str
    summary: str | None = None
    county_fips: str | None = None
    county_name: str | None = None
    state_code: str | None = None
    source_url: str | None = None
    issued_at: datetime | None = None


# ── Digest ──────────────────────────────────────────────────────────────────
class DigestGroup(BaseModel):
    county_name: str | None
    state_code: str | None
    count: int
    events: list["EventOut"]


class DigestResponse(BaseModel):
    since: datetime
    total: int
    groups: list[DigestGroup]


# ── Templates ───────────────────────────────────────────────────────────────
class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    body: str
    created_at: datetime


class TemplateCreate(BaseModel):
    name: str
    body: str


class TemplateUpdate(BaseModel):
    name: str | None = None
    body: str | None = None


class RenderRequest(BaseModel):
    event_id: uuid.UUID


class RenderResponse(BaseModel):
    event_id: uuid.UUID
    template_id: uuid.UUID
    rendered: str


# ── Config (read) ───────────────────────────────────────────────────────────
class CountyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fips_code: str
    county_name: str
    state_code: str


class KeywordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    keyword: str
    created_at: datetime


class RSSSourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    label: str
    state_code: str | None
    active: bool


# ── Config (mutations, admin-only) ──────────────────────────────────────────
class CountyCreate(BaseModel):
    fips_code: str
    county_name: str
    state_code: str


class KeywordCreate(BaseModel):
    keyword: str


class RSSSourceCreate(BaseModel):
    url: str
    label: str
    state_code: str | None = None
    active: bool = True


class RSSSourceUpdate(BaseModel):
    label: str | None = None
    url: str | None = None
    active: bool | None = None
