from pydantic import BaseModel
import os

class Settings(BaseModel):
    app_name: str = "MARS 2.0"
    env: str = os.getenv("ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/mars.db")
    cors_origins: list[str] = ["http://localhost:5173"]
    default_division: str = "Pune Division (CR)"

settings = Settings()