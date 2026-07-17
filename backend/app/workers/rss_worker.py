"""
RSS Worker - polls configured RSS/Atom feeds for each team.
Applies keyword matching and classifies into Monitor or Digest.
Runs every 15 minutes via APScheduler.
"""
import feedparser
import httpx
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Event, Team, TeamRSSSource, TeamKeyword, AlertTier
from app.workers.classifier import classify_rss_event
from app.core.config import settings
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


def _truncate_summary(text: str | None) -> str | None:
    """Bound summary size on insert to keep per-row storage small."""
    if not text or settings.MAX_SUMMARY_LENGTH <= 0:
        return text
    if len(text) <= settings.MAX_SUMMARY_LENGTH:
        return text
    return text[: settings.MAX_SUMMARY_LENGTH].rstrip() + "…"


async def fetch_feed(url: str) -> list[dict]:
    """Fetch and parse an RSS/Atom feed. Returns list of entry dicts."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Sentinel Disaster Management Dashboard"
            })
            resp.raise_for_status()
            feed = feedparser.parse(resp.text)
            return feed.entries
    except Exception as e:
        logger.error(f"RSS fetch error for {url}: {e}")
        return []


def parse_entry(entry, source_label: str, team_id: str, keywords: list[str], source_url: str) -> dict | None:
    """Parse an RSS entry into our Event schema."""
    title = getattr(entry, "title", "") or ""
    summary = getattr(entry, "summary", "") or ""
    link = getattr(entry, "link", "") or ""
    external_id = getattr(entry, "id", link) or link

    if not title and not summary:
        return None

    full_text = f"{title} {summary}"
    tier = classify_rss_event(full_text, keywords)

    published = getattr(entry, "published_parsed", None)
    issued_at = datetime(*published[:6]) if published else datetime.utcnow()

    return {
        "team_id": team_id,
        "source": "rss",
        "event_type": "News",
        "tier": tier,
        "county_fips": None,
        "headline": title[:512],
        "summary": _truncate_summary(summary),
        "source_url": link,
        "external_id": external_id,
        "issued_at": issued_at,
        "expires_at": None,
    }


async def run_rss_worker():
    """Main worker entry point. Called by APScheduler."""
    logger.info("RSS worker: starting poll")

    async with AsyncSessionLocal() as db:
        teams_result = await db.execute(select(Team))
        teams = teams_result.scalars().all()

        for team in teams:
            # Get keywords for this team
            kw_result = await db.execute(
                select(TeamKeyword).where(TeamKeyword.team_id == team.id)
            )
            keywords = [kw.keyword for kw in kw_result.scalars().all()]

            # Get active RSS sources for this team
            sources_result = await db.execute(
                select(TeamRSSSource).where(
                    TeamRSSSource.team_id == team.id,
                    TeamRSSSource.active == True
                )
            )
            sources = sources_result.scalars().all()

            new_count = 0
            for source in sources:
                entries = await fetch_feed(source.url)

                for entry in entries:
                    parsed = parse_entry(entry, source.label, str(team.id), keywords, source.url)
                    if not parsed:
                        continue

                    # Skip keyword-unmatched news (Digest tier) unless configured
                    # to keep it. This is the dominant DB-growth driver on the
                    # free tier — most RSS articles are irrelevant general news.
                    if parsed["tier"] == AlertTier.DIGEST and not settings.STORE_UNMATCHED_RSS:
                        continue

                    # Deduplication
                    existing = await db.execute(
                        select(Event).where(
                            Event.team_id == team.id,
                            Event.external_id == parsed["external_id"]
                        )
                    )
                    if existing.scalar_one_or_none():
                        continue

                    event = Event(**parsed)
                    db.add(event)
                    new_count += 1

            await db.commit()
            logger.info(f"RSS worker: {new_count} new events for team {team.name}")
