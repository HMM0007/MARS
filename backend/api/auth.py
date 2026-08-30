"""Authentication endpoints for the MARS frontend prototype.

Provides authenticated user categories:
- Engineering (ENG001)
- S&T (SNT001)
- Traction (TRD001)
- Divisional Planner (PLAN001)
"""

from hashlib import pbkdf2_hmac
import hmac
import os

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    employee_id: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)
    department: str = Field(min_length=1, max_length=64)


class UserInfo(BaseModel):
    employee_id: str
    name: str
    department: str
    role: str


class LoginResponse(BaseModel):
    authenticated: bool
    user: UserInfo
    access_token: str
    token_type: str = "bearer"


_DEMO_USERS = {
    "ENG001": {"password": "mars123", "name": "Engineering Officer", "department": "Engineering", "role": "Department User"},
    "SNT001": {"password": "mars123", "name": "S&T Officer", "department": "S&T", "role": "Department User"},
    "TRD001": {"password": "mars123", "name": "Traction Officer", "department": "Traction", "role": "Department User"},
    "PLAN001": {"password": "mars123", "name": "Divisional Planner", "department": "Divisional Planner", "role": "Divisional Planner"},
}


def _hash_password(password: str, salt: bytes) -> bytes:
    return pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)


def _password_matches(password: str, expected: str) -> bool:
    salt = b"MARS-DEMO-SALT"
    actual = _hash_password(password, salt)
    target = _hash_password(expected, salt)
    return hmac.compare_digest(actual, target)


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    """Authenticate a MARS development user and return department & role info."""
    employee_id = payload.employee_id.strip().upper()
    user = _DEMO_USERS.get(employee_id)

    if not user or user["department"] != payload.department or not _password_matches(payload.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Employee ID, password, or department.",
        )

    token = f"mars-dev-{employee_id}-{os.urandom(8).hex()}"

    return LoginResponse(
        authenticated=True,
        user=UserInfo(
            employee_id=employee_id,
            name=user["name"],
            department=user["department"],
            role=user["role"],
        ),
        access_token=token,
    )


@router.post("/logout")
def logout():
    return {"authenticated": False, "message": "MARS session ended."}
