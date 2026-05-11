from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.note import Note
from app.models.user import User
from app.schemas.note import (
    NoteCreate,
    NoteFilter,
    NoteResponse,
    NoteShareCreate,
    NoteShareResponse,
    NoteUpdate,
    NoteUserSummary,
    PaginatedNoteResponse,
    PaginationMeta,
)
from app.services.note_service import NoteService

router = APIRouter(prefix="/api/v1/notes", tags=["notes"])


def _parse_tags(tags: str | None) -> list[str]:
    if not tags:
        return []
    return [tag.strip() for tag in tags.split(",") if tag.strip()]


def _build_note_response(note: Note) -> NoteResponse:
    return NoteResponse(
        id=note.id,
        user_id=note.user_id,
        course_id=note.course_id,
        chapter_id=note.chapter_id,
        title=note.title,
        content=note.content,
        tags=note.tags,
        is_public=note.is_public,
        source_paragraph_ref=note.source_paragraph_ref,
        created_at=note.created_at,
        updated_at=note.updated_at,
        user=NoteUserSummary.model_validate(note.user),
        course_title=note.course.title if note.course is not None else None,
        chapter_title=note.chapter.title if note.chapter is not None else None,
    )


@router.get("", response_model=PaginatedNoteResponse)
async def list_notes(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    course_id: str | None = Query(default=None),
    chapter_id: str | None = Query(default=None),
    is_public: bool | None = Query(default=None),
    tags: str | None = Query(default=None),
    q: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedNoteResponse:
    filters = NoteFilter(
        course_id=course_id,
        chapter_id=chapter_id,
        is_public=is_public,
        tags=_parse_tags(tags),
        q=q,
    )
    result = await NoteService.list_notes(
        db=db,
        user_id=current_user.id,
        filters=filters,
        page=page,
        page_size=page_size,
    )
    return PaginatedNoteResponse(
        data=[_build_note_response(note) for note in result.items],
        meta=PaginationMeta(page=page, page_size=page_size, total=result.total),
    )


@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    note = await NoteService.create_note(db=db, user_id=current_user.id, data=data)
    return _build_note_response(note)


@router.get("/chapter/{chapter_id}/public", response_model=list[NoteResponse])
async def get_chapter_public_notes(
    chapter_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NoteResponse]:
    notes = await NoteService.get_public_notes_for_chapter(db=db, chapter_id=chapter_id, user_id=current_user.id)
    return [_build_note_response(note) for note in notes]


@router.get("/shared/{token}", response_model=NoteResponse)
async def get_shared_note(
    token: str,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    note = await NoteService.get_shared_note(db=db, token=token)
    return _build_note_response(note)


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    note = await NoteService.get_note(db=db, note_id=note_id, user_id=current_user.id)
    return _build_note_response(note)


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: str,
    data: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    note = await NoteService.update_note(db=db, note_id=note_id, user_id=current_user.id, data=data)
    return _build_note_response(note)


@router.post("/{note_id}/share", response_model=NoteShareResponse)
async def create_share_link(
    note_id: str,
    data: NoteShareCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteShareResponse:
    return await NoteService.create_share(
        db=db,
        note_id=note_id,
        user_id=current_user.id,
        expires_in_hours=data.expires_in_hours,
    )


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await NoteService.delete_note(db=db, note_id=note_id, user_id=current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
