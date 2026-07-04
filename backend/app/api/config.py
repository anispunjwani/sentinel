"""Team configuration endpoints: counties, keywords, RSS sources.

Reads are available to any team member; mutations are admin-only.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_admin, get_current_user
from app.models.models import TeamCounty, TeamKeyword, TeamRSSSource, User
from app.schemas import (
    CountyCreate,
    CountyOut,
    KeywordCreate,
    KeywordOut,
    RSSSourceCreate,
    RSSSourceOut,
    RSSSourceUpdate,
)

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/counties", response_model=list[CountyOut])
async def list_counties(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TeamCounty).where(TeamCounty.team_id == user.team_id).order_by(
            TeamCounty.state_code, TeamCounty.county_name
        )
    )
    return result.scalars().all()


@router.get("/keywords", response_model=list[KeywordOut])
async def list_keywords(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TeamKeyword).where(TeamKeyword.team_id == user.team_id)
    )
    return result.scalars().all()


@router.get("/rss-sources", response_model=list[RSSSourceOut])
async def list_rss_sources(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TeamRSSSource).where(TeamRSSSource.team_id == user.team_id).order_by(
            TeamRSSSource.label
        )
    )
    return result.scalars().all()


# ── Mutations (admin-only) ──────────────────────────────────────────────────
async def _get_owned(model, obj_id: uuid.UUID, db: AsyncSession, admin: User):
    result = await db.execute(
        select(model).where(model.id == obj_id, model.team_id == admin.team_id)
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return obj


@router.post("/counties", response_model=CountyOut, status_code=status.HTTP_201_CREATED)
async def add_county(
    payload: CountyCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    county = TeamCounty(
        team_id=admin.team_id,
        fips_code=payload.fips_code,
        county_name=payload.county_name,
        state_code=payload.state_code,
    )
    db.add(county)
    await db.commit()
    await db.refresh(county)
    return county


@router.delete("/counties/{county_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_county(
    county_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    obj = await _get_owned(TeamCounty, county_id, db, admin)
    await db.delete(obj)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/keywords", response_model=KeywordOut, status_code=status.HTTP_201_CREATED)
async def add_keyword(
    payload: KeywordCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    keyword = TeamKeyword(team_id=admin.team_id, keyword=payload.keyword)
    db.add(keyword)
    await db.commit()
    await db.refresh(keyword)
    return keyword


@router.delete("/keywords/{keyword_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_keyword(
    keyword_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    obj = await _get_owned(TeamKeyword, keyword_id, db, admin)
    await db.delete(obj)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/rss-sources", response_model=RSSSourceOut, status_code=status.HTTP_201_CREATED)
async def add_rss_source(
    payload: RSSSourceCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    source = TeamRSSSource(
        team_id=admin.team_id,
        url=payload.url,
        label=payload.label,
        state_code=payload.state_code,
        active=payload.active,
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return source


@router.patch("/rss-sources/{source_id}", response_model=RSSSourceOut)
async def update_rss_source(
    source_id: uuid.UUID,
    payload: RSSSourceUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Partial update — commonly used to toggle `active` on/off."""
    obj = await _get_owned(TeamRSSSource, source_id, db, admin)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/rss-sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rss_source(
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    obj = await _get_owned(TeamRSSSource, source_id, db, admin)
    await db.delete(obj)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
