from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import secrets

import structlog
from fastapi import HTTPException, status
from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Chapter, Course
from app.models.note import Note, NoteShare
from app.models.user import User
from app.schemas.note import NoteCreate, NoteFilter, NoteShareResponse, NoteUpdate
from app.tasks.notes import index_note

logger = structlog.get_logger(__name__)


@dataclass
class NoteListResult:
    items: list[Note]
    total: int


class NoteService:
    @staticmethod
    def _normalize_tags(tags: list[str] | None) -> list[str]:
        if not tags:
            return []
        normalized: list[str] = []
        seen: set[str] = set()
        for tag in tags:
            value = tag.strip()
            if value and value.lower() not in seen:
                normalized.append(value[:64])
                seen.add(value.lower())
        return normalized

    @staticmethod
    async def _validate_course_and_chapter(
        db: AsyncSession,
        course_id: str | None,
        chapter_id: str | None,
    ) -> None:
        if course_id is not None:
            course = await db.get(Course, course_id)
            if course is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        if chapter_id is None:
            return

        chapter = await db.get(Chapter, chapter_id)
        if chapter is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
        if course_id is not None and chapter.course_id != course_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chapter does not belong to course")

    @staticmethod
    def _visibility_condition(user_id: str, filters: NoteFilter):
        own_private = and_(Note.user_id == user_id, Note.is_public.is_(False))
        public_notes = Note.is_public.is_(True)
        own_public = and_(Note.user_id == user_id, Note.is_public.is_(True))

        if filters.is_public is True:
            return public_notes
        if filters.is_public is False:
            return own_private
        return or_(own_private, own_public, public_notes)

    @classmethod
    def _apply_filters(cls, query: Select[tuple[Note]], user_id: str, filters: NoteFilter) -> Select[tuple[Note]]:
        conditions = [cls._visibility_condition(user_id, filters)]
        if filters.course_id:
            conditions.append(Note.course_id == filters.course_id)
        if filters.chapter_id:
            conditions.append(Note.chapter_id == filters.chapter_id)
        if filters.tags:
            conditions.append(Note.tags.overlap(filters.tags))
        if filters.q and filters.q.strip():
            searchable = func.to_tsvector(
                "english",
                func.concat(func.coalesce(Note.title, ""), " ", Note.content),
            )
            conditions.append(searchable.op("@@")(func.plainto_tsquery("english", filters.q.strip())))
        return query.where(*conditions)

    @classmethod
    async def _get_note_for_response(cls, db: AsyncSession, note_id: str) -> Note:
        result = await db.execute(
            select(Note)
            .where(Note.id == note_id)
            .options(selectinload(Note.user), selectinload(Note.course), selectinload(Note.chapter))
        )
        note = result.scalar_one_or_none()
        if note is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        return note

    @classmethod
    async def list_notes(
        cls,
        db: AsyncSession,
        user_id: str,
        filters: NoteFilter,
        page: int,
        page_size: int,
    ) -> NoteListResult:
        total_query = cls._apply_filters(select(func.count()).select_from(Note), user_id, filters)
        total = int(await db.scalar(total_query) or 0)

        query: Select[tuple[Note]] = (
            select(Note)
            .options(selectinload(Note.user), selectinload(Note.course), selectinload(Note.chapter))
            .order_by(Note.updated_at.desc(), Note.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        query = cls._apply_filters(query, user_id, filters)
        result = await db.execute(query)
        return NoteListResult(items=list(result.scalars().all()), total=total)

    @classmethod
    async def get_note(cls, db: AsyncSession, note_id: str, user_id: str) -> Note:
        note = await cls._get_note_for_response(db, note_id)
        if not note.is_public and note.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        return note

    @classmethod
    async def create_note(cls, db: AsyncSession, user_id: str, data: NoteCreate) -> Note:
        await cls._validate_course_and_chapter(db, data.course_id, data.chapter_id)
        note = Note(
            user_id=user_id,
            course_id=data.course_id,
            chapter_id=data.chapter_id,
            title=data.title.strip() if data.title else None,
            content=data.content,
            tags=cls._normalize_tags(data.tags),
            is_public=data.is_public,
            source_paragraph_ref=data.source_paragraph_ref,
        )
        db.add(note)
        await db.commit()

        if note.is_public:
            try:
                index_note.delay(note.id)
            except Exception as exc:
                logger.warning("note_index_enqueue_failed", note_id=note.id, error=str(exc))

        return await cls._get_note_for_response(db, note.id)

    @classmethod
    async def update_note(cls, db: AsyncSession, note_id: str, user_id: str, data: NoteUpdate) -> Note:
        note = await db.get(Note, note_id)
        if note is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        if note.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        payload = data.model_dump(exclude_unset=True)
        next_course_id = payload.get("course_id", note.course_id)
        next_chapter_id = payload.get("chapter_id", note.chapter_id)
        if "course_id" in payload or "chapter_id" in payload:
            await cls._validate_course_and_chapter(db, next_course_id, next_chapter_id)

        for key, value in payload.items():
            if key == "title" and value is not None:
                setattr(note, key, value.strip() or None)
            elif key == "tags":
                setattr(note, key, cls._normalize_tags(value))
            else:
                setattr(note, key, value)

        await db.commit()
        if note.is_public:
            try:
                index_note.delay(note.id)
            except Exception as exc:
                logger.warning("note_index_enqueue_failed", note_id=note.id, error=str(exc))
        return await cls._get_note_for_response(db, note.id)

    @staticmethod
    async def delete_note(db: AsyncSession, note_id: str, user_id: str) -> None:
        note = await db.get(Note, note_id)
        if note is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        if note.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        await db.delete(note)
        await db.commit()

    @classmethod
    async def create_share(
        cls,
        db: AsyncSession,
        note_id: str,
        user_id: str,
        expires_in_hours: int | None,
    ) -> NoteShareResponse:
        note = await cls._get_note_for_response(db, note_id)
        if not note.is_public and note.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        if note.is_public:
            token = f"public-{note.id}"
            return NoteShareResponse(token=token, share_url=f"/notes/shared/{token}", expires_at=None)

        expires_at = datetime.now(UTC) + timedelta(hours=expires_in_hours or 24)
        for _ in range(3):
            token = secrets.token_urlsafe(32)
            share = NoteShare(note_id=note.id, created_by_id=user_id, token=token, expires_at=expires_at)
            db.add(share)
            try:
                await db.commit()
                return NoteShareResponse(token=token, share_url=f"/notes/shared/{token}", expires_at=expires_at)
            except IntegrityError:
                await db.rollback()

        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create share link")

    @classmethod
    async def get_shared_note(cls, db: AsyncSession, token: str) -> Note:
        if token.startswith("public-"):
            note_id = token.removeprefix("public-")
            note = await cls._get_note_for_response(db, note_id)
            if not note.is_public:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")
            return note

        result = await db.execute(select(NoteShare).where(NoteShare.token == token).options(selectinload(NoteShare.note)))
        share = result.scalar_one_or_none()
        if share is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")

        expires_at = share.expires_at
        if expires_at is not None:
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=UTC)
            if expires_at <= datetime.now(UTC):
                await db.delete(share)
                await db.commit()
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link expired")

        return await cls._get_note_for_response(db, share.note_id)

    @classmethod
    async def get_public_notes_for_chapter(
        cls,
        db: AsyncSession,
        chapter_id: str,
        user_id: str,
    ) -> list[Note]:
        if await db.get(Chapter, chapter_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

        query: Select[tuple[Note]] = (
            select(Note)
            .where(Note.chapter_id == chapter_id, Note.is_public.is_(True))
            .options(selectinload(Note.user), selectinload(Note.course), selectinload(Note.chapter))
            .order_by(Note.updated_at.desc())
            .limit(20)
        )
        result = await db.execute(query)
        return [note for note in result.scalars().all() if note.user_id != user_id or note.is_public]
