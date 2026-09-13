from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.adapters.router import router as adapters_router
from app.core.emergency_router import router as emergency_router
from app.core.router import router as core_router
from app.api.dataset import router as dataset_router
from app.api.what_if import router as what_if_router

app = FastAPI(
    title=settings.app_name,
    description="AI-Powered Automatic Block Planning System for Indian Railways",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers. The hardened emergency router is registered before the
# legacy core emergency route so emergency submissions use the durable,
# explicit repair-outcome contract. What-If is isolated and read-only with
# respect to the approved plan state.
app.include_router(adapters_router)
app.include_router(emergency_router)
app.include_router(core_router)
app.include_router(dataset_router)
app.include_router(what_if_router)


@app.get("/")
def root():
    return {
        "system": "MARS 2.0",
        "status": "online",
        "division": settings.default_division,
        "message": "Automatic Block Planning Decision-Support Layer",
    }


@app.get("/health")
def health():
    """Application health only; use /api/v1/dataset/status for data health."""
    return {"status": "ok"}
