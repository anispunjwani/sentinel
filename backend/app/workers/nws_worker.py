"""
NWS Worker - polls api.weather.gov for active alerts.
Runs every 5 minutes via APScheduler.
No API key required.
"""
import httpx
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Event, Team, TeamCounty, AlertTier
from app.workers.classifier import classify_nws_event
from app.core.config import settings
from app.core.database import AsyncSessionLocal


def _truncate_summary(text: str | None) -> str | None:
    """Bound summary size on insert to keep per-row storage small."""
    if not text or settings.MAX_SUMMARY_LENGTH <= 0:
        return text
    if len(text) <= settings.MAX_SUMMARY_LENGTH:
        return text
    return text[: settings.MAX_SUMMARY_LENGTH].rstrip() + "…"

logger = logging.getLogger(__name__)

NWS_ALERTS_URL = "https://api.weather.gov/alerts/active"


async def fetch_nws_alerts(zone_codes: list[str]) -> list[dict]:
    """
    Fetch active NWS alerts for a list of county UGC zone codes.
    api.weather.gov has no 'county' parameter; county-level filtering uses the
    'zone' parameter with UGC codes (e.g. 'MAC025' for Suffolk County, MA).
    Max ~50 per request; we chunk if needed.
    """
    alerts = []
    chunk_size = 50
    chunks = [zone_codes[i:i+chunk_size] for i in range(0, len(zone_codes), chunk_size)]

    async with httpx.AsyncClient(timeout=30) as client:
        for chunk in chunks:
            params = {"zone": ",".join(chunk)}
            try:
                resp = await client.get(NWS_ALERTS_URL, params=params, headers={
                    "User-Agent": "Sentinel Disaster Management Dashboard (contact@sentinel.app)",
                    "Accept": "application/geo+json"
                })
                resp.raise_for_status()
                data = resp.json()
                alerts.extend(data.get("features", []))
            except Exception as e:
                logger.error(f"NWS fetch error for chunk {chunk}: {e}")

    return alerts


def _parse_nws_time(value: str | None) -> datetime | None:
    """Parse an NWS ISO timestamp into a naive UTC datetime (matches our columns)."""
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def parse_nws_alert(feature: dict, team_id: str) -> dict | None:
    """Parse a GeoJSON feature from NWS into our Event schema."""
    props = feature.get("properties", {})
    if not props:
        return None

    event_type = props.get("event", "Unknown")
    headline = props.get("headline") or props.get("event", "NWS Alert")
    summary = props.get("description", "")
    source_url = props.get("@id", "")
    external_id = props.get("id", source_url)

    # Parse affected zones/counties
    # NWS returns geocode with FIPS list
    geocode = props.get("geocode", {})
    fips_list = geocode.get("SAME", [])  # SAME codes are 6-digit, first digit is country, next 5 are county FIPS
    county_fips = fips_list[0][1:] if fips_list else None  # strip leading 0

    # Parse times. NWS returns tz-aware ISO strings; our columns are naive UTC.
    issued_at = _parse_nws_time(props.get("sent"))
    expires_at = _parse_nws_time(props.get("expires"))

    tier = classify_nws_event(event_type)

    return {
        "team_id": team_id,
        "source": "nws",
        "event_type": event_type,
        "tier": tier,
        "county_fips": county_fips,
        "headline": headline[:512],
        "summary": _truncate_summary(summary),
        "source_url": source_url,
        "external_id": external_id,
        "issued_at": issued_at,
        "expires_at": expires_at,
    }


async def run_nws_worker():
    """Main worker entry point. Called by APScheduler."""
    logger.info("NWS worker: starting poll")

    async with AsyncSessionLocal() as db:
        # Get all teams and their county FIPS codes
        teams_result = await db.execute(select(Team))
        teams = teams_result.scalars().all()

        for team in teams:
            counties_result = await db.execute(
                select(TeamCounty).where(TeamCounty.team_id == team.id)
            )
            counties = counties_result.scalars().all()
            # NWS zone filtering uses UGC county codes: <state><C><last 3 FIPS digits>
            # e.g. Suffolk County MA (state MA, FIPS 25025) -> "MAC025"
            zone_codes = [f"{c.state_code}C{c.fips_code[-3:]}" for c in counties]

            if not zone_codes:
                continue

            alerts = await fetch_nws_alerts(zone_codes)
            new_count = 0

            for feature in alerts:
                parsed = parse_nws_alert(feature, str(team.id))
                if not parsed:
                    continue

                # Deduplication: skip if external_id already exists for this team
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
            logger.info(f"NWS worker: {new_count} new events for team {team.name}")
