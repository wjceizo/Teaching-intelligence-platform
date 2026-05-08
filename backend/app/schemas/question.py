from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class QuestionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    course_id: str
    chapter_id: str | None = None
    type: Literal["ai", "teacher"] = "teacher"
    paragraph_ref: str | None = Field(default=None, max_length=128)


class AnswerCreate(BaseModel):
    content: str = Field(min_length=1)


class AnswerUpdate(BaseModel):
    content: str = Field(min_length=1)


class AnswerVoteRequest(BaseModel):
    vote: Literal[-1, 0, 1]


class QuestionFilter(BaseModel):
    course_id: str | None = None
    chapter_id: str | None = None
    type: Literal["ai", "teacher"] | None = None
    status: Literal["open", "resolved"] | None = None
    sort: Literal["latest", "hot", "unanswered"] = "latest"


class QuestionUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    avatar_url: str | None


class AnswerUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    avatar_url: str | None
    role: Literal["student", "teacher", "admin"]


class AnswerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    question_id: str
    content: str
    is_teacher: bool
    is_ai: bool
    upvotes: int
    downvotes: int
    created_at: datetime
    user: AnswerUserSummary | None = None
    user_vote: Literal[-1, 0, 1] = 0


class QuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    course_id: str
    chapter_id: str | None
    title: str
    content: str
    type: Literal["ai", "teacher"]
    status: Literal["open", "resolved"]
    is_pinned: bool
    view_count: int
    paragraph_ref: str | None
    created_at: datetime
    user: QuestionUserSummary
    answers_count: int = 0


class QuestionDetailResponse(QuestionResponse):
    answers: list[AnswerResponse] = Field(default_factory=list)
    paragraph_excerpt: str | None = None


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int


class PaginatedQuestionResponse(BaseModel):
    data: list[QuestionResponse]
    meta: PaginationMeta
