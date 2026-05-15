from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.course import PaginationMeta

QuestionType = Literal["single", "multi", "fill", "short", "proof"]
ExamStatus = Literal["draft", "published", "closed"]
AttemptStatus = Literal["in_progress", "submitted", "pending_review", "graded", "expired"]
ResultPolicy = Literal["after_submit", "after_end", "manual"]
AnswerValue = str | list[str] | dict[str, object] | None


class QuestionOption(BaseModel):
    id: str = Field(min_length=1, max_length=12)
    label: str = Field(min_length=1, max_length=20)
    content: str = Field(min_length=1)


class ExamQuestionCreate(BaseModel):
    course_id: str
    chapter_id: str | None = None
    type: QuestionType
    content: str = Field(min_length=1)
    options: list[QuestionOption] | None = None
    answer: AnswerValue
    explanation: str | None = None
    difficulty: int = Field(default=1, ge=1, le=5)
    tags: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_question_shape(self) -> "ExamQuestionCreate":
        if self.type in {"single", "multi"}:
            if not self.options or len(self.options) < 2:
                raise ValueError("Choice questions require at least two options")
            option_ids = {option.id for option in self.options}
            answers = [self.answer] if isinstance(self.answer, str) else self.answer
            if self.type == "single" and not isinstance(self.answer, str):
                raise ValueError("Single choice answer must be one option id")
            if self.type == "multi" and not isinstance(self.answer, list):
                raise ValueError("Multiple choice answer must be a list")
            if not isinstance(answers, list) or not answers or any(item not in option_ids for item in answers):
                raise ValueError("Choice answers must match option ids")
        elif self.type == "fill":
            if not isinstance(self.answer, (str, list)) or (isinstance(self.answer, list) and not self.answer):
                raise ValueError("Fill question answer must be a string or non-empty string list")
        elif not isinstance(self.answer, str):
            raise ValueError("Subjective question answer must be reference text")
        return self


class ExamQuestionUpdate(BaseModel):
    course_id: str | None = None
    chapter_id: str | None = None
    type: QuestionType | None = None
    content: str | None = Field(default=None, min_length=1)
    options: list[QuestionOption] | None = None
    answer: AnswerValue = None
    explanation: str | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = None
    is_active: bool | None = None


class ExamQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    chapter_id: str | None
    teacher_id: str | None
    type: QuestionType
    content: str
    options: list[QuestionOption] | None
    answer: AnswerValue = None
    explanation: str | None = None
    difficulty: int
    tags: list[str] = Field(default_factory=list)
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ExamQuestionInPaperCreate(BaseModel):
    question_id: str
    points: int = Field(gt=0)
    order_index: int = Field(default=0, ge=0)


class ExamQuestionInPaperResponse(BaseModel):
    id: str
    question_id: str
    points: int
    order_index: int
    question: ExamQuestionResponse


class ExamCreate(BaseModel):
    course_id: str
    chapter_id: str | None = None
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    total_score: int = Field(default=100, gt=0)
    pass_score: int | None = Field(default=None, ge=0)
    time_limit_minutes: int = Field(gt=0, le=600)
    start_time: datetime | None = None
    end_time: datetime | None = None
    max_attempts: int = Field(default=1, gt=0, le=20)
    is_shuffled: bool = False
    show_result_policy: ResultPolicy = "after_submit"
    questions: list[ExamQuestionInPaperCreate] = Field(default_factory=list)
    status: ExamStatus = "draft"

    @model_validator(mode="after")
    def validate_exam(self) -> "ExamCreate":
        if self.pass_score is None:
            self.pass_score = round(self.total_score * 0.6)
        if self.pass_score > self.total_score:
            raise ValueError("Pass score cannot exceed total score")
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValueError("End time must be after start time")
        return self


class ExamUpdate(BaseModel):
    course_id: str | None = None
    chapter_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    total_score: int | None = Field(default=None, gt=0)
    pass_score: int | None = Field(default=None, ge=0)
    time_limit_minutes: int | None = Field(default=None, gt=0, le=600)
    start_time: datetime | None = None
    end_time: datetime | None = None
    max_attempts: int | None = Field(default=None, gt=0, le=20)
    is_shuffled: bool | None = None
    show_result_policy: ResultPolicy | None = None
    questions: list[ExamQuestionInPaperCreate] | None = None
    status: ExamStatus | None = None


class PublishExamRequest(BaseModel):
    status: Literal["published", "closed"] | None = None


class ExamAttemptSummary(BaseModel):
    id: str
    status: AttemptStatus
    score: int | None
    total_score: int
    submitted_at: datetime | None
    graded_at: datetime | None


class ExamListItem(BaseModel):
    id: str
    title: str
    course_id: str
    course_title: str | None
    chapter_id: str | None
    chapter_title: str | None
    status: ExamStatus
    total_score: int
    pass_score: int
    time_limit_minutes: int
    start_time: datetime | None
    end_time: datetime | None
    question_count: int
    attempt_status: AttemptStatus | None = None
    best_score: int | None = None
    latest_attempt_id: str | None = None
    created_at: datetime
    updated_at: datetime


class ExamResponse(BaseModel):
    id: str
    title: str
    description: str | None
    course_id: str
    course_title: str | None
    chapter_id: str | None
    chapter_title: str | None
    teacher_id: str | None
    status: ExamStatus
    total_score: int
    pass_score: int
    time_limit_minutes: int
    start_time: datetime | None
    end_time: datetime | None
    max_attempts: int
    is_shuffled: bool
    show_result_policy: ResultPolicy
    questions: list[ExamQuestionInPaperResponse]
    latest_attempt: ExamAttemptSummary | None = None
    created_at: datetime
    updated_at: datetime


class AttemptStartResponse(BaseModel):
    attempt_id: str
    exam_id: str
    status: AttemptStatus
    questions: list[ExamQuestionInPaperResponse]
    time_limit_minutes: int
    started_at: datetime
    deadline_at: datetime | None
    saved_answers: dict[str, AnswerValue]


class AttemptSaveRequest(BaseModel):
    answers: dict[str, AnswerValue] = Field(default_factory=dict)


class AttemptSubmitRequest(BaseModel):
    answers: dict[str, AnswerValue] = Field(default_factory=dict)


class AttemptAnswerResult(BaseModel):
    question_id: str
    user_answer: AnswerValue = None
    is_correct: bool | None = None
    score: int | None = None
    max_score: int
    standard_answer: AnswerValue = None
    explanation: str | None = None
    teacher_comment: str | None = None
    pending_review: bool = False


class AttemptResultResponse(BaseModel):
    attempt_id: str
    exam_id: str
    status: AttemptStatus
    score: int | None
    auto_score: int
    manual_score: int
    total_score: int
    pass_score: int
    submitted_at: datetime | None
    graded_at: datetime | None
    can_view_detail: bool
    answers: list[AttemptAnswerResult]


class GradeAnswerRequest(BaseModel):
    question_id: str
    score: int = Field(ge=0)
    teacher_comment: str | None = None


class GradeAttemptRequest(BaseModel):
    answers: list[GradeAnswerRequest] = Field(min_length=1)


class ViolationReportRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=255)


class ExamAttemptListItem(BaseModel):
    id: str
    exam_id: str
    user_id: str
    student_name: str | None
    status: AttemptStatus
    score: int | None
    auto_score: int
    manual_score: int
    total_score: int
    violation_count: int
    started_at: datetime
    submitted_at: datetime | None
    graded_at: datetime | None


class QuestionStats(BaseModel):
    question_id: str
    content: str
    type: QuestionType
    max_score: int
    answered_count: int
    correct_rate: float | None
    avg_score: float | None
    pending_review_count: int


class ExamStatsResponse(BaseModel):
    participants_count: int
    submitted_count: int
    pending_review_count: int
    avg_score: float | None
    pass_rate: float | None
    max_score: int | None
    min_score: int | None
    score_distribution: list[dict[str, int]]
    question_stats: list[QuestionStats]


class PaginatedQuestionResponse(BaseModel):
    data: list[ExamQuestionResponse]
    meta: PaginationMeta


class PaginatedExamResponse(BaseModel):
    data: list[ExamListItem]
    meta: PaginationMeta


class PaginatedAttemptResponse(BaseModel):
    data: list[ExamAttemptListItem]
    meta: PaginationMeta
