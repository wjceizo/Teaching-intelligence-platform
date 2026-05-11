from __future__ import annotations

import structlog

from app.tasks.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(name="notes.index_note")
def index_note(note_id: str) -> dict[str, str]:
    logger.info("note_index_requested", note_id=note_id)
    return {"note_id": note_id, "status": "queued"}
