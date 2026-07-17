"""
Scheduler - wires all background workers to APScheduler.
Started when the FastAPI app starts up.
"""
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from app.core.config import settings
from app.workers.nws_worker import run_nws_worker
from app.workers.rss_worker import run_rss_worker

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def run_expiry_worker():
    """Mark Monitor events as expired after 48 hours if not reviewed."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import Event, AlertTier
    from sqlalchemy import select, update

    cutoff = datetime.utcnow() - timedelta(hours=settings.MONITOR_EXPIRY_HOURS)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Event).where(
                Event.tier == AlertTier.MONITOR,
                Event.reviewed == False,
                Event.created_at < cutoff
            )
        )
        expired = result.scalars().all()
        for event in expired:
            event.tier = AlertTier.DIGEST  # demote to digest on expiry
        await db.commit()
        if expired:
            logger.info(f"Expiry worker: demoted {len(expired)} stale Monitor events to Digest")


async def run_archive_worker():
    """Move events older than 30 days out of the live events table."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import Event
    from sqlalchemy import select, delete, insert
    from sqlalchemy import text

    cutoff = datetime.utcnow() - timedelta(days=settings.ARCHIVE_AFTER_DAYS)

    async with AsyncSessionLocal() as db:
        # Copy to archive table then delete from live table
        await db.execute(text("""
            INSERT INTO event_archive
            SELECT *, NOW() as archived_at
            FROM events
            WHERE created_at < :cutoff
            ON CONFLICT (id) DO NOTHING
        """), {"cutoff": cutoff})

        result = await db.execute(text("""
            DELETE FROM events WHERE created_at < :cutoff
        """), {"cutoff": cutoff})

        # Retention purge: hard-delete old archive rows so event_archive does not
        # grow unbounded. This is what keeps total DB size under the free-tier cap.
        purged = 0
        if settings.ARCHIVE_RETENTION_DAYS > 0:
            purge_cutoff = datetime.utcnow() - timedelta(days=settings.ARCHIVE_RETENTION_DAYS)
            purge_result = await db.execute(text("""
                DELETE FROM event_archive WHERE archived_at < :cutoff
            """), {"cutoff": purge_cutoff})
            purged = purge_result.rowcount or 0

        await db.commit()
        logger.info(
            f"Archive worker: archived events older than {settings.ARCHIVE_AFTER_DAYS} days; "
            f"purged {purged} archive rows older than {settings.ARCHIVE_RETENTION_DAYS} days"
        )


def start_scheduler():
    """Register all jobs and start the scheduler."""
    scheduler.add_job(
        run_nws_worker,
        trigger=IntervalTrigger(seconds=settings.NWS_POLL_INTERVAL),
        id="nws_worker",
        name="NWS Alert Poller",
        replace_existing=True,
        misfire_grace_time=60,
    )

    scheduler.add_job(
        run_rss_worker,
        trigger=IntervalTrigger(seconds=settings.RSS_POLL_INTERVAL),
        id="rss_worker",
        name="RSS Feed Poller",
        replace_existing=True,
        misfire_grace_time=60,
    )

    scheduler.add_job(
        run_expiry_worker,
        trigger=IntervalTrigger(seconds=settings.EXPIRY_CHECK_INTERVAL),
        id="expiry_worker",
        name="Monitor Event Expiry",
        replace_existing=True,
    )

    scheduler.add_job(
        run_archive_worker,
        trigger=CronTrigger(hour=2, minute=0),  # 2 AM UTC daily
        id="archive_worker",
        name="Event Archiver",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started with all workers registered")


def stop_scheduler():
    scheduler.shutdown()
