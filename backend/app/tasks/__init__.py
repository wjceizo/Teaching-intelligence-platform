"""Celery tasks package."""
from app.tasks.notes import index_note

__all__ = ["index_note"]
