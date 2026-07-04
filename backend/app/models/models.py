import uuid
from datetime import datetime
from sqlalchemy import (
    String, Integer, Boolean, DateTime, Text, ForeignKey, Enum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
import enum


class AlertTier(str, enum.Enum):
    ACTIVE = "active"
    MONITOR = "monitor"
    DIGEST = "digest"


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MEMBER = "member"


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    counties: Mapped[list["TeamCounty"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    keywords: Mapped[list["TeamKeyword"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    rss_sources: Mapped[list["TeamRSSSource"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    users: Mapped[list["User"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    events: Mapped[list["Event"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    templates: Mapped[list["MessageTemplate"]] = relationship(back_populates="team", cascade="all, delete-orphan")


class TeamCounty(Base):
    __tablename__ = "team_counties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    fips_code: Mapped[str] = mapped_column(String(5), nullable=False)   # 5-digit FIPS
    county_name: Mapped[str] = mapped_column(String(255), nullable=False)
    state_code: Mapped[str] = mapped_column(String(2), nullable=False)  # 2-letter abbreviation

    team: Mapped["Team"] = relationship(back_populates="counties")


class TeamKeyword(Base):
    __tablename__ = "team_keywords"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    keyword: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    team: Mapped["Team"] = relationship(back_populates="keywords")


class TeamRSSSource(Base):
    __tablename__ = "team_rss_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    state_code: Mapped[str] = mapped_column(String(2), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    team: Mapped["Team"] = relationship(back_populates="rss_sources")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, values_callable=lambda obj: [e.value for e in obj]),
        default=UserRole.MEMBER,
    )
    digest_time: Mapped[str] = mapped_column(String(5), default="09:00")  # HH:MM
    timezone: Mapped[str] = mapped_column(String(50), default="America/New_York")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    team: Mapped["Team"] = relationship(back_populates="users")
    push_subscriptions: Mapped[list["PushSubscription"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh: Mapped[str] = mapped_column(Text, nullable=False)
    auth: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="push_subscriptions")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)       # nws, fema, rss, manual
    event_type: Mapped[str] = mapped_column(String(255), nullable=False)   # e.g. "Tornado Warning"
    tier: Mapped[AlertTier] = mapped_column(
        Enum(AlertTier, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    county_fips: Mapped[str] = mapped_column(String(5), nullable=True)
    county_name: Mapped[str] = mapped_column(String(255), nullable=True)
    state_code: Mapped[str] = mapped_column(String(2), nullable=True)
    headline: Mapped[str] = mapped_column(String(512), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=True)
    external_id: Mapped[str] = mapped_column(String(512), nullable=True)   # dedup key
    issued_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_by: Mapped[str] = mapped_column(String(255), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    team: Mapped["Team"] = relationship(back_populates="events")


class MessageTemplate(Base):
    __tablename__ = "message_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    team: Mapped["Team"] = relationship(back_populates="templates")
