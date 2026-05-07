from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.split("@")[-1]:
            raise ValueError("Invalid email format")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        has_alpha = any(ch.isalpha() for ch in value)
        has_digit = any(ch.isdigit() for ch in value)
        if not (has_alpha and has_digit):
            raise ValueError("Password must contain letters and digits")
        return value


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str
    role: str
    avatar_url: str | None
    created_at: datetime


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=64)
    avatar_url: str | None = Field(default=None, max_length=512)


class PasswordChange(BaseModel):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, value: str) -> str:
        has_alpha = any(ch.isalpha() for ch in value)
        has_digit = any(ch.isdigit() for ch in value)
        if not (has_alpha and has_digit):
            raise ValueError("Password must contain letters and digits")
        return value


class RefreshTokenRequest(BaseModel):
    refresh_token: str
