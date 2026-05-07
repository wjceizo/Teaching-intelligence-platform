from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.course import Chapter, ChapterProgress, Enrollment
from app.models.user import User
from app.schemas.course import (
    ChapterCreate,
    ChapterDetailResponse,
    ChapterReorder,
    ChapterResponse,
    ChapterUpdate,
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    PaginatedCourseResponse,
    PaginationMeta,
    ProgressUpdate,
    TeacherSummary,
)
from app.services.course_service import CourseService

router = APIRouter(prefix="/api/v1/courses", tags=["courses"])


def _build_course_response(
    course,
    chapters: list[Chapter],
    is_enrolled: bool = False,
    progress_percent: float = 0.0,
    completed_chapter_ids: list[str] | None = None,
) -> CourseResponse:
    chapter_items = [ChapterResponse.model_validate(chapter) for chapter in chapters]
    teacher = TeacherSummary.model_validate(course.teacher)
    return CourseResponse(
        id=course.id,
        title=course.title,
        description=course.description,
        teacher_id=course.teacher_id,
        cover_image=course.cover_image,
        status=course.status,
        created_at=course.created_at,
        updated_at=course.updated_at,
        teacher=teacher,
        chapters_count=len(chapter_items),
        chapters=chapter_items,
        is_enrolled=is_enrolled,
        progress_percent=progress_percent,
        completed_chapter_ids=completed_chapter_ids or [],
    )


@router.get("", response_model=PaginatedCourseResponse)
async def list_courses(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_value: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedCourseResponse:
    courses, total = await CourseService.list_courses(db=db, page=page, page_size=page_size, status_value=status_value)

    course_ids = [course.id for course in courses]
    enrolled_set: set[str] = set()
    progress_by_course: dict[str, float] = {}

    if course_ids:
        enrollment_rows = await db.execute(
            select(Chapter.course_id)
            .join(ChapterProgress, ChapterProgress.chapter_id == Chapter.id)
            .where(
                ChapterProgress.user_id == current_user.id,
                ChapterProgress.completed_at.is_not(None),
                Chapter.course_id.in_(course_ids),
            )
        )
        completed_map: dict[str, int] = defaultdict(int)
        for (course_id,) in enrollment_rows.all():
            completed_map[course_id] += 1

        enrollment_rows = await db.execute(
            select(Enrollment.course_id).where(
                Enrollment.user_id == current_user.id,
                Enrollment.course_id.in_(course_ids),
            )
        )
        enrolled_set = {course_id for (course_id,) in enrollment_rows.all()}

        for course in courses:
            chapters_total = len(course.chapters)
            if chapters_total > 0:
                progress_by_course[course.id] = round(
                    (completed_map.get(course.id, 0) / chapters_total) * 100,
                    1,
                )
            else:
                progress_by_course[course.id] = 0.0

    data = [
        _build_course_response(
            course=course,
            chapters=course.chapters,
            is_enrolled=course.id in enrolled_set,
            progress_percent=progress_by_course.get(course.id, 0.0),
            completed_chapter_ids=[],
        )
        for course in courses
    ]

    return PaginatedCourseResponse(data=data, meta=PaginationMeta(page=page, page_size=page_size, total=total))


@router.post(
    "",
    response_model=CourseResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("teacher", "admin"))],
)
async def create_course(
    data: CourseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CourseResponse:
    course = await CourseService.create_course(db=db, data=data, teacher_id=current_user.id)
    return _build_course_response(course=course, chapters=course.chapters)


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course_detail(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CourseResponse:
    course = await CourseService.get_course_with_chapters(db=db, course_id=course_id)
    enrollment = await CourseService.get_enrollment(db=db, user_id=current_user.id, course_id=course_id)

    completed_count = 0
    completed_chapter_ids: list[str] = []
    if course.chapters:
        chapter_ids = [chapter.id for chapter in course.chapters]
        rows = await db.execute(
            select(ChapterProgress.chapter_id).where(
                ChapterProgress.user_id == current_user.id,
                ChapterProgress.chapter_id.in_(chapter_ids),
                ChapterProgress.completed_at.is_not(None),
            )
        )
        completed_chapter_ids = [chapter_id for (chapter_id,) in rows.all()]
        completed_count = len(completed_chapter_ids)

    progress_percent = round((completed_count / len(course.chapters)) * 100, 1) if course.chapters else 0.0
    return _build_course_response(
        course=course,
        chapters=course.chapters,
        is_enrolled=enrollment is not None,
        progress_percent=progress_percent,
        completed_chapter_ids=completed_chapter_ids,
    )


@router.put(
    "/{course_id}",
    response_model=CourseResponse,
    dependencies=[Depends(require_role("teacher", "admin"))],
)
async def update_course(
    course_id: str,
    data: CourseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CourseResponse:
    course = await CourseService.update_course(db=db, course_id=course_id, data=data, user=current_user)
    return _build_course_response(course=course, chapters=course.chapters)


@router.delete(
    "/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role("teacher", "admin"))],
)
async def delete_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await CourseService.delete_course(db=db, course_id=course_id, user=current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{course_id}/enroll",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("student"))],
)
async def enroll_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await CourseService.enroll(db=db, user_id=current_user.id, course_id=course_id)
    return {"detail": "Enrolled successfully"}


@router.get("/{course_id}/chapters", response_model=list[ChapterResponse])
async def get_course_chapters(
    course_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ChapterResponse]:
    course = await CourseService.get_course_with_chapters(db=db, course_id=course_id)
    return [ChapterResponse.model_validate(chapter) for chapter in course.chapters]


@router.post(
    "/{course_id}/chapters",
    response_model=ChapterResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("teacher", "admin"))],
)
async def create_chapter(
    course_id: str,
    data: ChapterCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChapterResponse:
    chapter = await CourseService.create_chapter(db=db, course_id=course_id, data=data, user=current_user)
    return ChapterResponse.model_validate(chapter)


@router.put(
    "/chapters/{chapter_id}",
    response_model=ChapterDetailResponse,
    dependencies=[Depends(require_role("teacher", "admin"))],
)
async def update_chapter(
    chapter_id: str,
    data: ChapterUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChapterDetailResponse:
    chapter = await CourseService.update_chapter(db=db, chapter_id=chapter_id, data=data, user=current_user)
    return ChapterDetailResponse.model_validate(chapter)


@router.delete(
    "/chapters/{chapter_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role("teacher", "admin"))],
)
async def delete_chapter(
    chapter_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await CourseService.delete_chapter(db=db, chapter_id=chapter_id, user=current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{course_id}/chapters/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role("teacher", "admin"))],
)
async def reorder_chapters(
    course_id: str,
    data: ChapterReorder,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await CourseService.reorder_chapters(db=db, course_id=course_id, order_data=data, user=current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/chapters/{chapter_id}/content", response_model=ChapterDetailResponse)
async def get_chapter_content(
    chapter_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ChapterDetailResponse:
    chapter = await db.get(Chapter, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return ChapterDetailResponse.model_validate(chapter)


@router.post(
    "/chapters/{chapter_id}/progress",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role("student"))],
)
async def update_progress(
    chapter_id: str,
    data: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await CourseService.update_progress(
        db=db,
        user_id=current_user.id,
        chapter_id=chapter_id,
        completed=data.completed,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
