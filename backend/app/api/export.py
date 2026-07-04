"""Incident log export (CSV) for after-action reporting."""
import csv
import io

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import AlertTier, Event, User

router = APIRouter(prefix="/export", tags=["export"])

_COLUMNS = [
    "created_at", "issued_at", "expires_at", "tier", "source", "event_type",
    "county_fips", "county_name", "state_code", "headline", "summary",
    "source_url", "reviewed", "reviewed_by", "reviewed_at",
]


@router.get("/incidents.csv")
async def export_incidents_csv(
    tier: AlertTier | None = None,
    source: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export the team's incident log as CSV, newest first."""
    stmt = select(Event).where(Event.team_id == user.team_id)
    if tier is not None:
        stmt = stmt.where(Event.tier == tier)
    if source is not None:
        stmt = stmt.where(Event.source == source)
    stmt = stmt.order_by(Event.created_at.desc())
    events = (await db.execute(stmt)).scalars().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(_COLUMNS)
    for e in events:
        writer.writerow([
            e.created_at, e.issued_at, e.expires_at,
            e.tier.value if e.tier else "", e.source, e.event_type,
            e.county_fips, e.county_name, e.state_code, e.headline, e.summary,
            e.source_url, e.reviewed, e.reviewed_by, e.reviewed_at,
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=incidents.csv"},
    )
