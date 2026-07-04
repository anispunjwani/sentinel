"""Daily digest view: Digest-tier events from a recent window, grouped by county."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import AlertTier, Event, User
from app.schemas import DigestGroup, DigestResponse

router = APIRouter(prefix="/digest", tags=["digest"])


@router.get("", response_model=DigestResponse)
async def get_digest(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Digest-tier events from the last `hours` (default 24), grouped by county."""
    since = datetime.utcnow() - timedelta(hours=hours)
    stmt = (
        select(Event)
        .where(
            Event.team_id == user.team_id,
            Event.tier == AlertTier.DIGEST,
            Event.created_at >= since,
        )
        .order_by(Event.county_name, Event.created_at.desc())
    )
    events = (await db.execute(stmt)).scalars().all()

    grouped: dict[tuple, list[Event]] = {}
    for e in events:
        grouped.setdefault((e.county_name, e.state_code), []).append(e)

    groups = [
        DigestGroup(county_name=key[0], state_code=key[1], count=len(items), events=items)
        for key, items in grouped.items()
    ]
    return DigestResponse(since=since, total=len(events), groups=groups)
