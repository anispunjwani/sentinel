"""Event feed endpoints: list, detail, review, and escalate. Scoped to the caller's team."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import AlertTier, Event, User
from app.notifications.push import notify_team_active_event
from app.schemas import EscalateRequest, EventCreate, EventOut

router = APIRouter(prefix="/events", tags=["events"])

# Severity ranking for escalation (higher = more urgent).
_TIER_RANK = {AlertTier.DIGEST: 1, AlertTier.MONITOR: 2, AlertTier.ACTIVE: 3}


async def _get_team_event(event_id: uuid.UUID, db: AsyncSession, user: User) -> Event:
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.team_id == user.team_id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.get("", response_model=list[EventOut])
async def list_events(
    tier: AlertTier | None = None,
    county_fips: str | None = None,
    source: str | None = None,
    reviewed: bool | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    List events for the caller's team, newest first within tier priority
    (Active → Monitor → Digest, which matches the enum's declared order).
    """
    stmt = select(Event).where(Event.team_id == user.team_id)
    if tier is not None:
        stmt = stmt.where(Event.tier == tier)
    if county_fips is not None:
        stmt = stmt.where(Event.county_fips == county_fips)
    if source is not None:
        stmt = stmt.where(Event.source == source)
    if reviewed is not None:
        stmt = stmt.where(Event.reviewed == reviewed)

    stmt = stmt.order_by(Event.tier.asc(), Event.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Log an event manually. Marked reviewed (a human entered it); an Active
    manual event fans out a push notification like any other Active event."""
    event = Event(
        team_id=user.team_id,
        source="manual",
        event_type=payload.event_type,
        tier=payload.tier,
        county_fips=payload.county_fips,
        county_name=payload.county_name,
        state_code=payload.state_code,
        headline=payload.headline[:512],
        summary=payload.summary,
        source_url=payload.source_url,
        external_id=f"manual:{uuid.uuid4()}",
        issued_at=payload.issued_at or datetime.utcnow(),
        reviewed=True,
        reviewed_by=user.name,
        reviewed_at=datetime.utcnow(),
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    if event.tier == AlertTier.ACTIVE:
        await notify_team_active_event(
            db,
            str(user.team_id),
            {
                "id": event.id,
                "tier": event.tier,
                "event_type": event.event_type,
                "county_name": event.county_name,
                "headline": event.headline,
            },
        )
    return event


@router.get("/{event_id}", response_model=EventOut)
async def get_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _get_team_event(event_id, db, user)


@router.patch("/{event_id}/review", response_model=EventOut)
async def review_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark an event as reviewed by the current user (human confirmation)."""
    event = await _get_team_event(event_id, db, user)
    event.reviewed = True
    event.reviewed_by = user.name
    event.reviewed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(event)
    return event


@router.post("/{event_id}/escalate", response_model=EventOut)
async def escalate_event(
    event_id: uuid.UUID,
    payload: EscalateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Escalate an event to a more severe tier (a human action, so it also marks the
    event reviewed). Escalating to Active fans out a push notification to the team.
    """
    event = await _get_team_event(event_id, db, user)
    if _TIER_RANK[payload.tier] <= _TIER_RANK[event.tier]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target tier must be more severe than the current tier",
        )

    event.tier = payload.tier
    event.reviewed = True
    event.reviewed_by = user.name
    event.reviewed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(event)

    if event.tier == AlertTier.ACTIVE:
        await notify_team_active_event(
            db,
            str(user.team_id),
            {
                "id": event.id,
                "tier": event.tier,
                "event_type": event.event_type,
                "county_name": event.county_name,
                "headline": event.headline,
            },
        )

    return event


@router.post("/{event_id}/deescalate", response_model=EventOut)
async def deescalate_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Dismiss an event by demoting it to the Digest tier (a human action, so it
    also marks the event reviewed). Does not delete or hide the event."""
    event = await _get_team_event(event_id, db, user)
    event.tier = AlertTier.DIGEST
    event.reviewed = True
    event.reviewed_by = user.name
    event.reviewed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(event)
    return event
