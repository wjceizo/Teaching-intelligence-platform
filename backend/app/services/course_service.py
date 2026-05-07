from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Chapter, ChapterProgress, Course, Enrollment
from app.models.user import User
from app.schemas.course import ChapterCreate, ChapterReorder, ChapterUpdate, CourseCreate, CourseUpdate


class CourseService:
    @staticmethod
    def _assert_teacher_or_admin(user: User) -> None:
        if user.role not in {"teacher", "admin"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    @classmethod
    def _assert_course_edit_permission(cls, user: User, course: Course) -> None:
        if user.role == "admin":
            return
        if user.role == "teacher" and course.teacher_id == user.id:
            return
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    @staticmethod
    async def list_courses(
        db: AsyncSession,
        page: int,
        page_size: int,
        status_value: str | None = None,
    ) -> tuple[list[Course], int]:
        filters = []
        if status_value is not None:
            filters.append(Course.status == status_value)

        count_query = select(func.count()).select_from(Course)
        if filters:
            count_query = count_query.where(*filters)
        total = int(await db.scalar(count_query) or 0)

        query: Select[tuple[Course]] = (
            select(Course)
            .options(selectinload(Course.teacher), selectinload(Course.chapters))
            .order_by(Course.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        if filters:
            query = query.where(*filters)

        result = await db.execute(query)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_course_with_chapters(db: AsyncSession, course_id: str) -> Course:
        result = await db.execute(
            select(Course)
            .where(Course.id == course_id)
            .options(selectinload(Course.teacher), selectinload(Course.chapters))
        )
        course = result.scalar_one_or_none()
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        return course

    @staticmethod
    async def create_course(db: AsyncSession, data: CourseCreate, teacher_id: str) -> Course:
        course = Course(
            title=data.title.strip(),
            description=data.description,
            cover_image=data.cover_image,
            teacher_id=teacher_id,
            status="draft",
        )
        db.add(course)
        await db.commit()
        await db.refresh(course)
        return await CourseService.get_course_with_chapters(db, course.id)

    @classmethod
    async def update_course(cls, db: AsyncSession, course_id: str, data: CourseUpdate, user: User) -> Course:
        course = await cls.get_course_with_chapters(db, course_id)
        cls._assert_course_edit_permission(user, course)

        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            if key == "title" and value is not None:
                setattr(course, key, value.strip())
            else:
                setattr(course, key, value)

        await db.commit()
        await db.refresh(course)
        return await cls.get_course_with_chapters(db, course.id)

    @classmethod
    async def delete_course(cls, db: AsyncSession, course_id: str, user: User) -> None:
        course = await cls.get_course_with_chapters(db, course_id)
        cls._assert_course_edit_permission(user, course)
        await db.delete(course)
        await db.commit()

    @classmethod
    async def create_chapter(
        cls,
        db: AsyncSession,
        course_id: str,
        data: ChapterCreate,
        user: User,
    ) -> Chapter:
        course = await cls.get_course_with_chapters(db, course_id)
        cls._assert_course_edit_permission(user, course)

        chapter = Chapter(
            course_id=course_id,
            title=data.title.strip(),
            content=data.content,
            order_index=data.order_index,
        )
        db.add(chapter)
        await db.commit()
        await db.refresh(chapter)
        return chapter

    @classmethod
    async def update_chapter(cls, db: AsyncSession, chapter_id: str, data: ChapterUpdate, user: User) -> Chapter:
        result = await db.execute(
            select(Chapter).where(Chapter.id == chapter_id).options(selectinload(Chapter.course))
        )
        chapter = result.scalar_one_or_none()
        if chapter is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

        cls._assert_course_edit_permission(user, chapter.course)

        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            if key == "title" and value is not None:
                setattr(chapter, key, value.strip())
            else:
                setattr(chapter, key, value)

        await db.commit()
        await db.refresh(chapter)
        return chapter

    @classmethod
    async def delete_chapter(cls, db: AsyncSession, chapter_id: str, user: User) -> None:
        result = await db.execute(
            select(Chapter).where(Chapter.id == chapter_id).options(selectinload(Chapter.course))
        )
        chapter = result.scalar_one_or_none()
        if chapter is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

        cls._assert_course_edit_permission(user, chapter.course)
        await db.delete(chapter)
        await db.commit()

    @classmethod
    async def reorder_chapters(
        cls,
        db: AsyncSession,
        course_id: str,
        order_data: ChapterReorder,
        user: User,
    ) -> None:
        course = await cls.get_course_with_chapters(db, course_id)
        cls._assert_course_edit_permission(user, course)

        if not order_data.chapters:
            return

        chapter_map = {chapter.id: chapter for chapter in course.chapters}
        for item in order_data.chapters:
            chapter = chapter_map.get(item.id)
            if chapter is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chapter id in reorder payload")
            chapter.order_index = item.order_index

        await db.commit()

    @staticmethod
    async def update_progress(
        db: AsyncSession,
        user_id: str,
        chapter_id: str,
        completed: bool,
    ) -> ChapterProgress:
        chapter = await db.get(Chapter, chapter_id)
        if chapter is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

        enrollment = await CourseService.get_enrollment(db=db, user_id=user_id, course_id=chapter.course_id)
        if enrollment is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please enroll in the course before updating progress",
            )

        result = await db.execute(
            select(ChapterProgress).where(
                ChapterProgress.user_id == user_id,
                ChapterProgress.chapter_id == chapter_id,
            )
        )
        progress = result.scalar_one_or_none()
        now = datetime.now(UTC)

        if progress is None:
            progress = ChapterProgress(
                user_id=user_id,
                chapter_id=chapter_id,
                completed_at=now if completed else None,
                last_read_at=now,
            )
            db.add(progress)
        else:
            progress.completed_at = now if completed else None
            progress.last_read_at = now

        await db.commit()
        await db.refresh(progress)
        return progress

    @staticmethod
    async def get_enrollment(db: AsyncSession, user_id: str, course_id: str) -> Enrollment | None:
        result = await db.execute(
            select(Enrollment).where(Enrollment.user_id == user_id, Enrollment.course_id == course_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def enroll(db: AsyncSession, user_id: str, course_id: str) -> Enrollment:
        course = await db.get(Course, course_id)
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        existing = await CourseService.get_enrollment(db, user_id=user_id, course_id=course_id)
        if existing is not None:
            return existing

        enrollment = Enrollment(user_id=user_id, course_id=course_id)
        db.add(enrollment)
        await db.commit()
        await db.refresh(enrollment)
        return enrollment
