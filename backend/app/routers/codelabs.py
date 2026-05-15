from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.codelab import CodeLab, CodeSubmission
from app.models.user import User
from app.schemas.codelab import (
    CodeLabCreate,
    CodeLabListItem,
    CodeLabResponse,
    CodeLabUpdate,
    GenerateExpectedOutputsRequest,
    GenerateExpectedOutputsResponse,
    PaginatedCodeLabResponse,
    PaginatedSubmissionResponse,
    PublishCodeLabRequest,
    RunCodeRequest,
    SubmissionResponse,
    SubmissionSummary,
    SubmitCodeRequest,
    TestCaseResponse,
)
from app.schemas.course import PaginationMeta, TeacherSummary
from app.services.codelab_service import CodeLabService

router = APIRouter(prefix="/api/v1/codelabs", tags=["codelabs"])


def _can_view_hidden(codelab: CodeLab, user: User) -> bool:
    if user.role == "admin":
        return True
    return user.role == "teacher" and (codelab.teacher_id == user.id or codelab.course.teacher_id == user.id)


def _test_case_response(test_case, can_view_hidden: bool) -> TestCaseResponse:
    hidden = test_case.is_hidden and not can_view_hidden
    return TestCaseResponse(
        id=test_case.id,
        name=test_case.name,
        input_data=None if hidden else test_case.input_data,
        expected_output=None if hidden else test_case.expected_output,
        is_hidden=test_case.is_hidden,
        points=test_case.points,
        order_index=test_case.order_index,
        created_at=test_case.created_at,
        updated_at=test_case.updated_at,
    )


def _submission_summary(submission: CodeSubmission | None) -> SubmissionSummary | None:
    if submission is None:
        return None
    return SubmissionSummary(
        id=submission.id,
        mode=submission.mode,
        status=submission.status,
        score=submission.score,
        max_score=submission.max_score,
        tests_passed=submission.tests_passed,
        tests_total=submission.tests_total,
        execution_time_ms=submission.execution_time_ms,
        submitted_at=submission.submitted_at,
    )


def _submission_response(submission: CodeSubmission, can_view_hidden: bool) -> SubmissionResponse:
    results = []
    for item in submission.result_json or []:
        is_hidden = bool(item.get("is_hidden"))
        should_hide = is_hidden and not can_view_hidden
        results.append(
            {
                "test_case_id": str(item.get("test_case_id", "")),
                "name": str(item.get("name", "Hidden test" if should_hide else "Test case")),
                "is_hidden": is_hidden,
                "passed": bool(item.get("passed")),
                "points": int(item.get("points", 0)),
                "actual_output": None if should_hide else item.get("actual_output"),
                "expected_output": None if should_hide else item.get("expected_output"),
                "input_data": None if should_hide else item.get("input_data"),
                "error": item.get("error") if isinstance(item.get("error"), str) else None,
                "execution_time_ms": item.get("execution_time_ms") if isinstance(item.get("execution_time_ms"), int) else None,
            }
        )
    return SubmissionResponse(
        id=submission.id,
        codelab_id=submission.codelab_id,
        user_id=submission.user_id,
        code=submission.code,
        mode=submission.mode,
        status=submission.status,
        score=submission.score,
        max_score=submission.max_score,
        tests_passed=submission.tests_passed,
        tests_total=submission.tests_total,
        results=results,
        logs=submission.logs,
        execution_time_ms=submission.execution_time_ms,
        submitted_at=submission.submitted_at,
    )


async def _build_list_item(db: AsyncSession, codelab: CodeLab, user: User) -> CodeLabListItem:
    current_user_id = user.id if user.role == "student" else None
    latest = await CodeLabService.latest_submission(db, codelab.id, user.id)
    best_score = await CodeLabService.best_score(db, codelab.id, user.id)
    submissions_count = await CodeLabService.submissions_count(db, codelab.id, current_user_id)
    return CodeLabListItem(
        id=codelab.id,
        title=codelab.title,
        course_id=codelab.course_id,
        course_title=codelab.course.title if codelab.course else None,
        chapter_id=codelab.chapter_id,
        chapter_title=codelab.chapter.title if codelab.chapter else None,
        language=codelab.language,
        difficulty=codelab.difficulty,
        is_published=codelab.is_published,
        max_score=codelab.max_score,
        latest_submission=_submission_summary(latest),
        best_score=best_score,
        submissions_count=submissions_count,
        created_at=codelab.created_at,
        updated_at=codelab.updated_at,
    )


async def _build_codelab_response(db: AsyncSession, codelab: CodeLab, user: User) -> CodeLabResponse:
    can_view_hidden = _can_view_hidden(codelab, user)
    test_cases = [
        _test_case_response(test_case, can_view_hidden)
        for test_case in codelab.test_cases
        if can_view_hidden or not test_case.is_hidden
    ]
    latest = await CodeLabService.latest_submission(db, codelab.id, user.id)
    best_score = await CodeLabService.best_score(db, codelab.id, user.id)
    submissions_count = await CodeLabService.submissions_count(
        db,
        codelab.id,
        user.id if user.role == "student" else None,
    )
    return CodeLabResponse(
        id=codelab.id,
        title=codelab.title,
        description=codelab.description,
        course_id=codelab.course_id,
        course_title=codelab.course.title if codelab.course else None,
        chapter_id=codelab.chapter_id,
        chapter_title=codelab.chapter.title if codelab.chapter else None,
        teacher_id=codelab.teacher_id,
        teacher=TeacherSummary.model_validate(codelab.teacher) if codelab.teacher else None,
        language=codelab.language,
        starter_code=codelab.starter_code,
        solution_code=codelab.solution_code if can_view_hidden else None,
        difficulty=codelab.difficulty,
        time_limit_ms=codelab.time_limit_ms,
        memory_limit_mb=codelab.memory_limit_mb,
        is_published=codelab.is_published,
        max_score=codelab.max_score,
        test_cases=test_cases,
        latest_submission=_submission_summary(latest),
        best_score=best_score,
        submissions_count=submissions_count,
        created_at=codelab.created_at,
        updated_at=codelab.updated_at,
    )


@router.get("", response_model=PaginatedCodeLabResponse)
async def list_codelabs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    course_id: str | None = Query(default=None),
    chapter_id: str | None = Query(default=None),
    language: str | None = Query(default=None, pattern="^(python|javascript|cpp)$"),
    difficulty: int | None = Query(default=None, ge=1, le=5),
    is_published: bool | None = Query(default=None),
    q: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedCodeLabResponse:
    codelabs, total = await CodeLabService.list_codelabs(
        db=db,
        user=current_user,
        page=page,
        page_size=page_size,
        course_id=course_id,
        chapter_id=chapter_id,
        language=language,
        difficulty=difficulty,
        is_published=is_published,
        q=q,
    )
    data = [await _build_list_item(db, codelab, current_user) for codelab in codelabs]
    return PaginatedCodeLabResponse(data=data, meta=PaginationMeta(page=page, page_size=page_size, total=total))


@router.post(
    "",
    response_model=CodeLabResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("teacher", "admin"))],
)
async def create_codelab(
    data: CodeLabCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CodeLabResponse:
    codelab = await CodeLabService.create_codelab(db, data, current_user)
    return await _build_codelab_response(db, codelab, current_user)


@router.post(
    "/generate-expected-outputs",
    response_model=GenerateExpectedOutputsResponse,
    dependencies=[Depends(require_role("teacher", "admin"))],
)
async def generate_expected_outputs(data: GenerateExpectedOutputsRequest) -> GenerateExpectedOutputsResponse:
    result = await CodeLabService.generate_expected_outputs(data)
    return GenerateExpectedOutputsResponse.model_validate(result)


@router.get("/submissions/{submission_id}", response_model=SubmissionResponse)
async def get_submission_detail(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    submission = await CodeLabService.get_submission(db, submission_id, current_user)
    return _submission_response(submission, _can_view_hidden(submission.codelab, current_user))


@router.get("/{codelab_id}", response_model=CodeLabResponse)
async def get_codelab(
    codelab_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CodeLabResponse:
    codelab = await CodeLabService.get_codelab(db, codelab_id, current_user)
    return await _build_codelab_response(db, codelab, current_user)


@router.get("/{codelab_id}/teacher", response_model=CodeLabResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def get_teacher_codelab(
    codelab_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CodeLabResponse:
    codelab = await CodeLabService.get_codelab(db, codelab_id, current_user, teacher_view=True)
    return await _build_codelab_response(db, codelab, current_user)


@router.put("/{codelab_id}", response_model=CodeLabResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def update_codelab(
    codelab_id: str,
    data: CodeLabUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CodeLabResponse:
    codelab = await CodeLabService.update_codelab(db, codelab_id, data, current_user)
    return await _build_codelab_response(db, codelab, current_user)


@router.delete("/{codelab_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role("teacher", "admin"))])
async def delete_codelab(
    codelab_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await CodeLabService.delete_codelab(db, codelab_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{codelab_id}/publish", response_model=CodeLabResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def publish_codelab(
    codelab_id: str,
    data: PublishCodeLabRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CodeLabResponse:
    codelab = await CodeLabService.publish_codelab(db, codelab_id, data.is_published, current_user)
    return await _build_codelab_response(db, codelab, current_user)


@router.post("/{codelab_id}/run", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def run_samples(
    codelab_id: str,
    data: RunCodeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    submission = await CodeLabService.run_code(db, codelab_id, current_user, data.code, "run")
    return _submission_response(submission, _can_view_hidden(submission.codelab, current_user))


@router.post("/{codelab_id}/submit", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def submit_code(
    codelab_id: str,
    data: SubmitCodeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    submission = await CodeLabService.run_code(db, codelab_id, current_user, data.code, "submit")
    return _submission_response(submission, _can_view_hidden(submission.codelab, current_user))


@router.get("/{codelab_id}/submissions", response_model=PaginatedSubmissionResponse)
async def get_my_submissions(
    codelab_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedSubmissionResponse:
    submissions, total = await CodeLabService.list_submissions(db, codelab_id, current_user, page, page_size)
    data = [_submission_response(item, False) for item in submissions]
    return PaginatedSubmissionResponse(data=data, meta=PaginationMeta(page=page, page_size=page_size, total=total))


@router.get("/{codelab_id}/submissions/all", response_model=PaginatedSubmissionResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def get_all_submissions(
    codelab_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedSubmissionResponse:
    submissions, total = await CodeLabService.list_submissions(
        db,
        codelab_id,
        current_user,
        page,
        page_size,
        all_students=True,
    )
    data = [_submission_response(item, True) for item in submissions]
    return PaginatedSubmissionResponse(data=data, meta=PaginationMeta(page=page, page_size=page_size, total=total))
