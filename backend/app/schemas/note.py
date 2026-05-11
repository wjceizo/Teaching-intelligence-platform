from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class NoteCreate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    content: str = Field(min_length=1)
    course_id: str | None = None
    chapter_id: str | None = None
    tags: list[str] = Field(default_factory=list)
    is_public: bool = False
    source_paragraph_ref: str | None = Field(default=None, max_length=128)


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    content: str | None = Field(default=None, min_length=1)
    course_id: str | None = None
    chapter_id: str | None = None
    tags: list[str] | None = None
    is_public: bool | None = None
    source_paragraph_ref: str | None = Field(default=None, max_length=128)


class NoteFilter(BaseModel):
    course_id: str | None = None
    chapter_id: str | None = None
    is_public: bool | None = None
    tags: list[str] = Field(default_factory=list)
    q: str | None = None


class NoteUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    avatar_url: str | None


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    course_id: str | None
    chapter_id: str | None
    title: str | None
    content: str
    tags: list[str]
    is_public: bool
    source_paragraph_ref: str | None
    created_at: datetime
    updated_at: datetime
    user: NoteUserSummary
    course_title: str | None = None
    chapter_title: str | None = None


class NoteShareCreate(BaseModel):
    expires_in_hours: Literal[1, 24, 168] | None = None


class NoteShareResponse(BaseModel):
    token: str
    share_url: str
    expires_at: datetime | None = None


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int


class PaginatedNoteResponse(BaseModel):
    data: list[NoteResponse]
    meta: PaginationMeta
