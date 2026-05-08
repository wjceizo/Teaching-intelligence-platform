from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User
from app.schemas.user import UserRegister

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()


class AuthService:
    @staticmethod
    def _hash_password(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def _verify_password(plain_password: str, password_hash: str) -> bool:
        return pwd_context.verify(plain_password, password_hash)

    @staticmethod
    def create_access_token(user_id: str, role: str) -> str:
        expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
        payload = {
            "sub": user_id,
            "role": role,
            "type": "access",
            "exp": expire,
            "iat": datetime.now(UTC),
        }
        return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    @staticmethod
    def create_refresh_token(user_id: str, role: str) -> str:
        expire = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
        payload = {
            "sub": user_id,
            "role": role,
            "type": "refresh",
            "exp": expire,
            "iat": datetime.now(UTC),
        }
        return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    @classmethod
    async def register(cls, db: AsyncSession, data: UserRegister) -> User:
        existing = await db.execute(
            select(User).where(or_(User.email == data.email, User.username == data.username))
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email or username already exists")

        user = User(
            username=data.username.strip(),
            email=data.email,
            password_hash=cls._hash_password(data.password),
            role="student",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @classmethod
    async def login(cls, db: AsyncSession, email: str, password: str) -> tuple[User, str, str]:
        query = await db.execute(select(User).where(User.email == email.strip().lower()))
        user = query.scalar_one_or_none()
        if user is None or not cls._verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

        access_token = cls.create_access_token(user.id, user.role)
        refresh_token = cls.create_refresh_token(user.id, user.role)
        return user, access_token, refresh_token

    @classmethod
    async def refresh_access_token(cls, db: AsyncSession, refresh_token: str) -> str:
        try:
            payload = jwt.decode(refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        except JWTError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

        token_type = payload.get("type")
        user_id = payload.get("sub")

        if token_type != "refresh" or not isinstance(user_id, str) or not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        query = await db.execute(select(User).where(User.id == user_id))
        user = query.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        return cls.create_access_token(user_id=user_id, role=user.role)

    @classmethod
    async def change_password(
        cls,
        db: AsyncSession,
        user: User,
        old_password: str,
        new_password: str,
    ) -> None:
        if not cls._verify_password(old_password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Old password is incorrect")

        user.password_hash = cls._hash_password(new_password)
        await db.commit()
