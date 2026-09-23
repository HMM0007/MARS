from pydantic import BaseModel, Field
import os


def _get_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "")
    if raw.strip() == "*":
        return ["*"]
    defaults = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    if not raw.strip():
        return defaults
    configured = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return list(dict.fromkeys(configured + defaults))


class Settings(BaseModel):
    app_name: str = "MARS"
    env: str = os.getenv("ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/mars.db")
    cors_origins: list[str] = Field(default_factory=_get_cors_origins)
    default_division: str = "Pune Division (CR)"


settings = Settings()

