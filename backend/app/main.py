from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(
    title=settings.app_name,
    description="AI-Powered Automatic Block Planning System for Indian Railways",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "system": "MARS 2.0",
        "status": "online",
        "division": settings.default_division,
        "message": "Automatic Block Planning Decision-Support Layer"
    }

@app.get("/health")
def health():
    return {"status": "ok"}