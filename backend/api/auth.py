"""Authentication endpoints for the MARS frontend prototype.

This module provides the first backend authentication boundary. It deliberately
uses an in-memory demo user store until persistent identity management is
introduced. Passwords are hashed rather than stored as plaintext.
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


# Demo identities for the development phase. Replace with the railway identity
# store/SSO in the production authentication implementation.
_DEMO_USERS = {
    "ENG001": {"password": "mars123", "name": "Engineering Planner", "department": "Engineering", "role": "Department Planner"},
    "SNT001": {"password": "mars123", "name": "S&T Planner", "department": "S&T", "role": "Department Planner"},
    "TRD001": {"password": "mars123", "name": "Traction Planner", "department": "Traction", "role": "Department Planner"},
    "PLAN001": {"password": "mars123", "name": "Divisional Planner", "department": "Divisional Planner", "role": "Divisional Planner"},
}


def _hash_password(password: str, salt: bytes) -> bytes:
    return pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)


def _password_matches(password: str, expected: str) -> bool:
    # Development-only verification helper. The production version should use
    # a dedicated identity provider/password hashing service.
    salt = b"MARS-DEMO-SALT"
    actual = _hash_password(password, salt)
    target = _hash_password(expected, salt)
    return hmac.compare_digest(actual, target)


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    """Authenticate a MARS development user and return role information."""
    employee_id = payload.employee_id.strip().upper()
    user = _DEMO_USERS.get(employee_id)

    if not user or user["department"] != payload.department or not _password_matches(payload.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Employee ID, password, or department.",
        )

    # Placeholder development token. JWT/SSO token issuance belongs in the
    # production authentication phase.
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
    """Development logout endpoint; production token revocation comes later."""
    return {"authenticated": False, "message": "MARS session ended."}
