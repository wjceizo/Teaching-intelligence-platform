from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    cover_image: str | None = None


class CourseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    cover_image: str | None = None
    status: str | None = Field(default=None, pattern="^(draft|published)$")


class ChapterCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    order_index: int = Field(ge=0)


class ChapterUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    order_index: int | None = Field(default=None, ge=0)


class ChapterOrderItem(BaseModel):
    id: str
    order_index: int = Field(ge=0)


class ChapterReorder(BaseModel):
    chapters: list[ChapterOrderItem] = Field(default_factory=list)


class TeacherSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    avatar_url: str | None


class ChapterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    title: str
    order_index: int
    created_at: datetime
    updated_at: datetime


class ChapterDetailResponse(ChapterResponse):
    content: str


class CourseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str | None
    teacher_id: str
    cover_image: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    teacher: TeacherSummary
    chapters_count: int
    chapters: list[ChapterResponse] = Field(default_factory=list)
    is_enrolled: bool = False
    progress_percent: float = 0.0
    completed_chapter_ids: list[str] = Field(default_factory=list)


class ProgressUpdate(BaseModel):
    completed: bool


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int


class PaginatedCourseResponse(BaseModel):
    data: list[CourseResponse]
    meta: PaginationMeta
