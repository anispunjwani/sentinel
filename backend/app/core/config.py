from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours

    # Web Push (VAPID)
    VAPID_PRIVATE_KEY: str
    VAPID_PUBLIC_KEY: str
    VAPID_EMAIL: str

    # App
    ENVIRONMENT: str = "development"
    APP_NAME: str = "Sentinel"

    # CORS — comma-separated list of allowed frontend origins, used in production.
    # e.g. "https://sentinel.up.railway.app,https://sentinel.replit.app"
    # In development the middleware allows all origins regardless of this value.
    CORS_ORIGINS: str = ""

    # Alert defaults
    MONITOR_EXPIRY_HOURS: int = 48
    ARCHIVE_AFTER_DAYS: int = 30
    DIGEST_DEFAULT_TIME: str = "09:00"

    # ── Database-size controls (Railway free tier is < 1 GB) ─────────────────
    # Hard-delete archived rows older than this. Without it, event_archive grows
    # forever and is the single biggest long-term free-tier risk. 0 disables.
    ARCHIVE_RETENTION_DAYS: int = 180
    # Cap stored summary length. NWS/full-content RSS summaries can be several KB
    # each; this bounds per-row size. 0 disables truncation.
    MAX_SUMMARY_LENGTH: int = 2000
    # Persist keyword-unmatched RSS articles (which classify as Digest). Most are
    # irrelevant general news and are the dominant row-count driver, so default
    # off. Set true to keep a full news firehose in the digest.
    STORE_UNMATCHED_RSS: bool = False

    # Polling intervals (seconds)
    NWS_POLL_INTERVAL: int = 300       # 5 minutes
    FEMA_POLL_INTERVAL: int = 300      # 5 minutes
    RSS_POLL_INTERVAL: int = 900       # 15 minutes
    EXPIRY_CHECK_INTERVAL: int = 3600  # 1 hour

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
