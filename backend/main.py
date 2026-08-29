"""MARS FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import (
    APP_DESCRIPTION,
    APP_NAME,
    APP_VERSION,
)

from backend.api.jobs import router as jobs_router
from backend.api.assets import router as assets_router
from backend.api.blocks import router as blocks_router
from backend.api.trains import router as trains_router
from backend.api.plans import router as plans_router
from backend.api.replanning import (
    router as replanning_router,
)


app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
)


# ------------------------------------------------------------
# CORS
# ------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------
# API ROUTERS
# ------------------------------------------------------------

app.include_router(jobs_router)
app.include_router(assets_router)
app.include_router(blocks_router)
app.include_router(trains_router)
app.include_router(plans_router)
app.include_router(replanning_router)


# ------------------------------------------------------------
# Health
# ------------------------------------------------------------

@app.get("/api/health")
def health_check():
    """Return basic MARS backend health information."""

    return {
        "status": "healthy",
        "application": APP_NAME,
        "version": APP_VERSION,
    }


# ------------------------------------------------------------
# Root
# ------------------------------------------------------------

@app.get("/")
def root():
    """Return basic API information."""

    return {
        "application": APP_NAME,
        "message": "MARS backend is running.",
        "docs": "/docs",
        "health": "/api/health",
    }