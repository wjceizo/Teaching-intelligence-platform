from app.routers.auth import router as auth_router
from app.routers.courses import router as courses_router
from app.routers.notes import router as notes_router
from app.routers.questions import router as questions_router

__all__ = ["auth_router", "courses_router", "notes_router", "questions_router"]
