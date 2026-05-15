from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.exam import Exam, ExamAttempt, ExamQuestion, ExamQuestionInPaper
from app.models.user import User
from app.schemas.course import PaginationMeta
from app.schemas.exam import (
    AttemptAnswerResult,
    AttemptResultResponse,
    AttemptSaveRequest,
    AttemptStartResponse,
    AttemptSubmitRequest,
    ExamAttemptListItem,
    ExamCreate,
    ExamListItem,
    ExamQuestionCreate,
    ExamQuestionInPaperResponse,
    ExamQuestionResponse,
    ExamResponse,
    ExamStatsResponse,
    ExamUpdate,
    GradeAttemptRequest,
    PaginatedAttemptResponse,
    PaginatedExamResponse,
    PaginatedQuestionResponse,
    ViolationReportRequest,
    ExamQuestionUpdate,
)
from app.services.exam_service import ExamService

router = APIRouter(prefix="/api/v1/exams", tags=["exams"])


def _question_response(question: ExamQuestion, can_view_answer: bool) -> ExamQuestionResponse:
    return ExamQuestionResponse(
        id=question.id,
        course_id=question.course_id,
        chapter_id=question.chapter_id,
        teacher_id=question.teacher_id,
        type=question.type,
        content=question.content,
        options=question.options,
        answer=question.answer if can_view_answer else None,
        explanation=question.explanation if can_view_answer else None,
        difficulty=question.difficulty,
        tags=question.tags or [],
        is_active=question.is_active,
        created_at=question.created_at,
        updated_at=question.updated_at,
    )


def _paper_response(paper: ExamQuestionInPaper, can_view_answer: bool) -> ExamQuestionInPaperResponse:
    return ExamQuestionInPaperResponse(
        id=paper.id,
        question_id=paper.question_id,
        points=paper.points,
        order_index=paper.order_index,
        question=_question_response(paper.question, can_view_answer),
    )


def _attempt_summary(attempt: ExamAttempt | None):
    if attempt is None:
        return None
    return {
        "id": attempt.id,
        "status": attempt.status,
        "score": attempt.score,
        "total_score": attempt.total_score,
        "submitted_at": attempt.submitted_at,
        "graded_at": attempt.graded_at,
    }


async def _exam_list_item(db: AsyncSession, exam: Exam, user: User) -> ExamListItem:
    latest = await ExamService.latest_attempt(db, exam.id, user.id) if user.role == "student" else None
    return ExamListItem(
        id=exam.id,
        title=exam.title,
        course_id=exam.course_id,
        course_title=exam.course.title if exam.course else None,
        chapter_id=exam.chapter_id,
        chapter_title=exam.chapter.title if exam.chapter else None,
        status=exam.status,
        total_score=exam.total_score,
        pass_score=exam.pass_score,
        time_limit_minutes=exam.time_limit_minutes,
        start_time=exam.start_time,
        end_time=exam.end_time,
        question_count=len(exam.paper_questions),
        attempt_status=latest.status if latest else None,
        best_score=await ExamService.best_score(db, exam.id, user.id) if user.role == "student" else None,
        latest_attempt_id=latest.id if latest else None,
        created_at=exam.created_at,
        updated_at=exam.updated_at,
    )


async def _exam_response(db: AsyncSession, exam: Exam, user: User) -> ExamResponse:
    can_view_answer = user.role in {"teacher", "admin"}
    latest = await ExamService.latest_attempt(db, exam.id, user.id) if user.role == "student" else None
    return ExamResponse(
        id=exam.id,
        title=exam.title,
        description=exam.description,
        course_id=exam.course_id,
        course_title=exam.course.title if exam.course else None,
        chapter_id=exam.chapter_id,
        chapter_title=exam.chapter.title if exam.chapter else None,
        teacher_id=exam.teacher_id,
        status=exam.status,
        total_score=exam.total_score,
        pass_score=exam.pass_score,
        time_limit_minutes=exam.time_limit_minutes,
        start_time=exam.start_time,
        end_time=exam.end_time,
        max_attempts=exam.max_attempts,
        is_shuffled=exam.is_shuffled,
        show_result_policy=exam.show_result_policy,
        questions=[_paper_response(item, can_view_answer) for item in exam.paper_questions],
        latest_attempt=_attempt_summary(latest),
        created_at=exam.created_at,
        updated_at=exam.updated_at,
    )


def _ordered_paper_questions(attempt: ExamAttempt) -> list[ExamQuestionInPaper]:
    papers = {item.question_id: item for item in attempt.exam.paper_questions}
    if attempt.question_order:
        ordered = [papers[question_id] for question_id in attempt.question_order if question_id in papers]
        if ordered:
            return ordered
    return list(attempt.exam.paper_questions)


def _attempt_start_response(attempt: ExamAttempt) -> AttemptStartResponse:
    return AttemptStartResponse(
        attempt_id=attempt.id,
        exam_id=attempt.exam_id,
        status=attempt.status,
        questions=[_paper_response(item, False) for item in _ordered_paper_questions(attempt)],
        time_limit_minutes=attempt.exam.time_limit_minutes,
        started_at=attempt.started_at,
        deadline_at=attempt.deadline_at,
        saved_answers=attempt.answers or {},
    )


def _attempt_result_response(attempt: ExamAttempt, user: User) -> AttemptResultResponse:
    can_view_detail = ExamService.can_view_result_detail(attempt, user)
    answers = []
    answer_by_question = {item.question_id: item for item in attempt.answer_items}
    for paper in _ordered_paper_questions(attempt):
        answer = answer_by_question.get(paper.question_id)
        pending = paper.question.type in {"short", "proof"} and (answer is None or answer.manual_score is None)
        answers.append(
            AttemptAnswerResult(
                question_id=paper.question_id,
                user_answer=answer.answer if answer else None,
                is_correct=answer.is_correct if answer and can_view_detail else None,
                score=answer.final_score if answer and (can_view_detail or user.role in {"teacher", "admin"}) else None,
                max_score=paper.points,
                standard_answer=paper.question.answer if can_view_detail else None,
                explanation=paper.question.explanation if can_view_detail else None,
                teacher_comment=answer.teacher_comment if answer and can_view_detail else None,
                pending_review=pending,
            )
        )
    return AttemptResultResponse(
        attempt_id=attempt.id,
        exam_id=attempt.exam_id,
        status=attempt.status,
        score=attempt.score,
        auto_score=attempt.auto_score,
        manual_score=attempt.manual_score,
        total_score=attempt.total_score,
        pass_score=attempt.exam.pass_score,
        submitted_at=attempt.submitted_at,
        graded_at=attempt.graded_at,
        can_view_detail=can_view_detail,
        answers=answers,
    )


def _attempt_list_item(attempt: ExamAttempt) -> ExamAttemptListItem:
    return ExamAttemptListItem(
        id=attempt.id,
        exam_id=attempt.exam_id,
        user_id=attempt.user_id,
        student_name=attempt.user.username if attempt.user else None,
        status=attempt.status,
        score=attempt.score,
        auto_score=attempt.auto_score,
        manual_score=attempt.manual_score,
        total_score=attempt.total_score,
        violation_count=attempt.violation_count,
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        graded_at=attempt.graded_at,
    )


@router.get("/questions", response_model=PaginatedQuestionResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def list_questions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    course_id: str | None = Query(default=None),
    chapter_id: str | None = Query(default=None),
    type: str | None = Query(default=None, pattern="^(single|multi|fill|short|proof)$"),
    difficulty: int | None = Query(default=None, ge=1, le=5),
    q: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedQuestionResponse:
    questions, total = await ExamService.list_questions(db, current_user, page, page_size, course_id, chapter_id, type, difficulty, q)
    return PaginatedQuestionResponse(
        data=[_question_response(item, True) for item in questions],
        meta=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.post("/questions", response_model=ExamQuestionResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role("teacher", "admin"))])
async def create_question(
    data: ExamQuestionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExamQuestionResponse:
    question = await ExamService.create_question(db, data, current_user)
    return _question_response(question, True)


@router.get("/questions/{question_id}", response_model=ExamQuestionResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def get_question(
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExamQuestionResponse:
    question = await ExamService.get_question(db, question_id, current_user)
    return _question_response(question, True)


@router.put("/questions/{question_id}", response_model=ExamQuestionResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def update_question(
    question_id: str,
    data: ExamQuestionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExamQuestionResponse:
    question = await ExamService.update_question(db, question_id, data, current_user)
    return _question_response(question, True)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role("teacher", "admin"))])
async def delete_question(
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await ExamService.delete_question(db, question_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=PaginatedExamResponse)
async def list_exams(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    course_id: str | None = Query(default=None),
    chapter_id: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedExamResponse:
    exams, total = await ExamService.list_exams(db, current_user, page, page_size, course_id, chapter_id, status_value, q)
    return PaginatedExamResponse(
        data=[await _exam_list_item(db, item, current_user) for item in exams],
        meta=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.post("", response_model=ExamResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role("teacher", "admin"))])
async def create_exam(
    data: ExamCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExamResponse:
    exam = await ExamService.create_exam(db, data, current_user)
    return await _exam_response(db, exam, current_user)


@router.get("/attempts/{attempt_id}", response_model=AttemptStartResponse)
async def get_attempt_session(
    attempt_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptStartResponse:
    attempt = await ExamService.get_result(db, attempt_id, current_user)
    return _attempt_start_response(attempt)


@router.get("/attempts/{attempt_id}/result", response_model=AttemptResultResponse)
async def get_attempt_result(
    attempt_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptResultResponse:
    attempt = await ExamService.get_result(db, attempt_id, current_user)
    return _attempt_result_response(attempt, current_user)


@router.put("/attempts/{attempt_id}", response_model=AttemptStartResponse)
async def save_attempt(
    attempt_id: str,
    data: AttemptSaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptStartResponse:
    attempt = await ExamService.save_draft(db, attempt_id, current_user, data.answers)
    return _attempt_start_response(attempt)


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptResultResponse)
async def submit_attempt(
    attempt_id: str,
    data: AttemptSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptResultResponse:
    attempt = await ExamService.submit_attempt(db, attempt_id, current_user, data.answers)
    return _attempt_result_response(attempt, current_user)


@router.post("/attempts/{attempt_id}/violations", response_model=AttemptStartResponse)
async def report_violation(
    attempt_id: str,
    data: ViolationReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptStartResponse:
    attempt = await ExamService.report_violation(db, attempt_id, current_user, data.reason)
    return _attempt_start_response(attempt)


@router.post("/attempts/{attempt_id}/grade", response_model=AttemptResultResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def grade_attempt(
    attempt_id: str,
    data: GradeAttemptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptResultResponse:
    attempt = await ExamService.grade_attempt(db, attempt_id, data, current_user)
    return _attempt_result_response(attempt, current_user)


@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExamResponse:
    exam = await ExamService.get_exam(db, exam_id, current_user)
    return await _exam_response(db, exam, current_user)


@router.put("/{exam_id}", response_model=ExamResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def update_exam(
    exam_id: str,
    data: ExamUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExamResponse:
    exam = await ExamService.update_exam(db, exam_id, data, current_user)
    return await _exam_response(db, exam, current_user)


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role("teacher", "admin"))])
async def delete_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await ExamService.delete_exam(db, exam_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{exam_id}/publish", response_model=ExamResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def publish_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExamResponse:
    exam = await ExamService.publish_exam(db, exam_id, current_user)
    return await _exam_response(db, exam, current_user)


@router.patch("/{exam_id}/close", response_model=ExamResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def close_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExamResponse:
    exam = await ExamService.close_exam(db, exam_id, current_user)
    return await _exam_response(db, exam, current_user)


@router.post("/{exam_id}/attempts", response_model=AttemptStartResponse)
async def start_attempt(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptStartResponse:
    attempt = await ExamService.start_attempt(db, exam_id, current_user)
    return _attempt_start_response(attempt)


@router.get("/{exam_id}/attempts", response_model=PaginatedAttemptResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def list_attempts(
    exam_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAttemptResponse:
    attempts, total = await ExamService.list_attempts(db, exam_id, current_user, page, page_size)
    return PaginatedAttemptResponse(
        data=[_attempt_list_item(item) for item in attempts],
        meta=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get("/{exam_id}/reviews", response_model=PaginatedAttemptResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def list_pending_reviews(
    exam_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAttemptResponse:
    attempts, total = await ExamService.list_attempts(db, exam_id, current_user, page, page_size, pending_only=True)
    return PaginatedAttemptResponse(
        data=[_attempt_list_item(item) for item in attempts],
        meta=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get("/{exam_id}/stats", response_model=ExamStatsResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def get_exam_stats(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExamStatsResponse:
    stats = await ExamService.get_exam_stats(db, exam_id, current_user)
    return ExamStatsResponse.model_validate(stats)
