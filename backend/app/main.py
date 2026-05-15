from __future__ import annotations

import logging

import structlog
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.user import User
from app.routers import auth_router, codelabs_router, courses_router, exams_router, notes_router, questions_router
from app.services.auth_service import AuthService

settings = get_settings()


def configure_logging() -> None:
    processors: list[structlog.types.Processor] = [
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.DEBUG if settings.debug else logging.INFO
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


configure_logging()
logger = structlog.get_logger(__name__)

app = FastAPI(title="Math Education Platform API", version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(courses_router)
app.include_router(notes_router)
app.include_router(questions_router)
app.include_router(codelabs_router)
app.include_router(exams_router)


class HealthData(BaseModel):
    status: str
    version: str


class HealthResponse(BaseModel):
    data: HealthData


@app.on_event("startup")
async def seed_default_user() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "student@example.com"))
        existing_user = result.scalar_one_or_none()
        if existing_user is None:
            user = User(
                username="student",
                email="student@example.com",
                password_hash=AuthService._hash_password("Password123"),
                role="student",
            )
            db.add(user)

        teacher_result = await db.execute(select(User).where(User.email == "teacher@example.com"))
        existing_teacher = teacher_result.scalar_one_or_none()
        if existing_teacher is None:
            teacher = User(
                username="teacher",
                email="teacher@example.com",
                password_hash=AuthService._hash_password("Password123"),
                role="teacher",
            )
            db.add(teacher)

        await db.commit()


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "unhandled_exception",
        path=str(request.url.path),
        method=request.method,
        error=str(exc),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/health", response_model=HealthResponse)
async def health_check() -> dict[str, dict[str, str]]:
    return {
        "data": {
            "status": "ok",
            "version": settings.app_version,
        }
    }


@app.get("/api/health", response_model=HealthResponse)
async def health_check_api() -> dict[str, dict[str, str]]:
    return await health_check()
