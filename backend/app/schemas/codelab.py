from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.course import PaginationMeta, TeacherSummary

CodeLanguage = Literal["python", "javascript", "cpp"]
SubmissionMode = Literal["run", "submit"]
SubmissionStatus = Literal["pending", "running", "success", "failed", "error", "timeout"]


class TestCaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    input_data: str = ""
    expected_output: str = ""
    is_hidden: bool = False
    points: int = Field(default=10, gt=0)
    order_index: int = Field(default=0, ge=0)


class TestCaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    input_data: str | None = None
    expected_output: str | None = None
    is_hidden: bool | None = None
    points: int | None = Field(default=None, gt=0)
    order_index: int | None = Field(default=None, ge=0)


class TestCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    input_data: str | None
    expected_output: str | None
    is_hidden: bool
    points: int
    order_index: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CodeLabCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    course_id: str
    chapter_id: str | None = None
    language: CodeLanguage
    starter_code: str = Field(min_length=1)
    solution_code: str | None = None
    difficulty: int = Field(ge=1, le=5)
    max_score: int = Field(default=100, ge=1, le=10000)
    time_limit_ms: int = Field(default=30000, ge=1000, le=120000)
    memory_limit_mb: int = Field(default=256, ge=64, le=1024)
    is_published: bool = False
    test_cases: list[TestCaseCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_publishable(self) -> "CodeLabCreate":
        if self.is_published and not self.test_cases:
            raise ValueError("Published codelabs require at least one test case")
        return self


class CodeLabUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    course_id: str | None = None
    chapter_id: str | None = None
    language: CodeLanguage | None = None
    starter_code: str | None = Field(default=None, min_length=1)
    solution_code: str | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    max_score: int | None = Field(default=None, ge=1, le=10000)
    time_limit_ms: int | None = Field(default=None, ge=1000, le=120000)
    memory_limit_mb: int | None = Field(default=None, ge=64, le=1024)
    is_published: bool | None = None
    test_cases: list[TestCaseCreate] | None = None


class PublishCodeLabRequest(BaseModel):
    is_published: bool


class SubmissionSummary(BaseModel):
    id: str
    mode: SubmissionMode
    status: SubmissionStatus
    score: int
    max_score: int
    tests_passed: int
    tests_total: int
    execution_time_ms: int | None
    submitted_at: datetime


class CodeLabListItem(BaseModel):
    id: str
    title: str
    course_id: str
    course_title: str | None
    chapter_id: str | None
    chapter_title: str | None
    language: CodeLanguage
    difficulty: int
    is_published: bool
    max_score: int
    latest_submission: SubmissionSummary | None
    best_score: int | None
    submissions_count: int
    created_at: datetime
    updated_at: datetime


class CodeLabResponse(BaseModel):
    id: str
    title: str
    description: str
    course_id: str
    course_title: str | None
    chapter_id: str | None
    chapter_title: str | None
    teacher_id: str
    teacher: TeacherSummary | None
    language: CodeLanguage
    starter_code: str
    solution_code: str | None = None
    difficulty: int
    time_limit_ms: int
    memory_limit_mb: int
    is_published: bool
    max_score: int
    test_cases: list[TestCaseResponse]
    latest_submission: SubmissionSummary | None
    best_score: int | None
    submissions_count: int
    created_at: datetime
    updated_at: datetime


class RunCodeRequest(BaseModel):
    code: str = Field(min_length=1)


class SubmitCodeRequest(BaseModel):
    code: str = Field(min_length=1)


class GenerateExpectedOutputsRequest(BaseModel):
    language: CodeLanguage
    solution_code: str = Field(min_length=1)
    test_cases: list[TestCaseCreate] = Field(min_length=1)
    time_limit_ms: int = Field(default=30000, ge=1000, le=120000)
    memory_limit_mb: int = Field(default=256, ge=64, le=1024)


class GeneratedExpectedOutput(BaseModel):
    name: str
    input_data: str
    expected_output: str
    is_hidden: bool
    points: int
    order_index: int
    status: SubmissionStatus
    error: str | None = None


class GenerateExpectedOutputsResponse(BaseModel):
    test_cases: list[GeneratedExpectedOutput]
    logs: str | None = None


class TestCaseRunResult(BaseModel):
    test_case_id: str
    name: str
    is_hidden: bool
    passed: bool
    points: int
    actual_output: str | None = None
    expected_output: str | None = None
    input_data: str | None = None
    error: str | None = None
    execution_time_ms: int | None = None


class SubmissionResponse(SubmissionSummary):
    codelab_id: str
    user_id: str
    code: str
    results: list[TestCaseRunResult]
    logs: str | None


class PaginatedCodeLabResponse(BaseModel):
    data: list[CodeLabListItem]
    meta: PaginationMeta


class PaginatedSubmissionResponse(BaseModel):
    data: list[SubmissionResponse]
    meta: PaginationMeta
