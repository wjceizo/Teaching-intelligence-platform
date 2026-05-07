from __future__ import annotations

from fastapi import Header, HTTPException, status
from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import get_settings
from app.database import get_db


class CurrentUser(BaseModel):
    user_id: str
    role: str = "student"


settings = get_settings()


async def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if authorization is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization scheme",
        )

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user_id_value = payload.get("sub")
    if not isinstance(user_id_value, str) or not user_id_value.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    role_value = payload.get("role", "student")
    role = role_value if isinstance(role_value, str) and role_value else "student"

    return CurrentUser(user_id=user_id_value, role=role)
