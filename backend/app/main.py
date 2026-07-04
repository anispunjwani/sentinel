from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.workers.scheduler import start_scheduler, stop_scheduler
from app.api import auth, events, config as config_router, templates, export, digest


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="Sentinel API",
    description="Disaster Management Intelligence Dashboard",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.ENVIRONMENT == "development" else ["https://your-railway-domain.up.railway.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}


# ── API routers (registered per phase) ───────────────────────────────────────
# Phase A: auth + events (read) + config (read)
app.include_router(auth.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(config_router.router, prefix="/api")

# Phase B: review + escalate (in events) + templates
app.include_router(templates.router, prefix="/api")

# Phase C: manual entry (in events), config mutations (in config), export, digest
app.include_router(export.router, prefix="/api")
app.include_router(digest.router, prefix="/api")

# Later phases:
# app.include_router(push.router, prefix="/api")
# app.include_router(export.router, prefix="/api")
