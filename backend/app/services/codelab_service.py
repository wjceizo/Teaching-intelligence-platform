from __future__ import annotations

from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.codelab import CodeLab, CodeLabTestCase, CodeSubmission
from app.models.course import Chapter, Course
from app.models.user import User
from app.schemas.codelab import CodeLabCreate, CodeLabUpdate, TestCaseCreate
from app.services.sandbox_service import SandboxService, SandboxTestCase


class CodeLabService:
    @staticmethod
    def _assert_teacher_or_admin(user: User) -> None:
        if user.role not in {"teacher", "admin"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    @staticmethod
    async def _get_course(db: AsyncSession, course_id: str) -> Course:
        course = await db.get(Course, course_id)
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        return course

    @staticmethod
    async def _validate_course_access(db: AsyncSession, course_id: str, user: User) -> Course:
        course = await CodeLabService._get_course(db, course_id)
        if user.role != "admin" and course.teacher_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot manage this course")
        return course

    @staticmethod
    async def _validate_chapter(db: AsyncSession, course_id: str, chapter_id: str | None) -> None:
        if chapter_id is None:
            return
        chapter = await db.get(Chapter, chapter_id)
        if chapter is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
        if chapter.course_id != course_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chapter does not belong to course")

    @staticmethod
    async def _get_codelab_for_user(db: AsyncSession, codelab_id: str, user: User, teacher_view: bool = False) -> CodeLab:
        result = await db.execute(
            select(CodeLab)
            .where(CodeLab.id == codelab_id)
            .options(
                selectinload(CodeLab.course),
                selectinload(CodeLab.chapter),
                selectinload(CodeLab.teacher),
                selectinload(CodeLab.test_cases),
            )
        )
        codelab = result.scalar_one_or_none()
        if codelab is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Code lab not found")

        if user.role == "admin":
            return codelab
        if user.role == "teacher":
            owns_lab = codelab.teacher_id == user.id or codelab.course.teacher_id == user.id
            if owns_lab:
                return codelab
            if teacher_view:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this code lab")
        if codelab.is_published and not teacher_view:
            return codelab
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this code lab")

    @staticmethod
    def _test_case_models(codelab_id: str, test_cases: Sequence[TestCaseCreate]) -> list[CodeLabTestCase]:
        return [
            CodeLabTestCase(
                codelab_id=codelab_id,
                name=item.name,
                input_data=item.input_data,
                expected_output=item.expected_output,
                is_hidden=item.is_hidden,
                points=item.points,
                order_index=item.order_index,
            )
            for index, item in enumerate(test_cases)
        ]

    @staticmethod
    async def list_codelabs(
        db: AsyncSession,
        user: User,
        page: int,
        page_size: int,
        course_id: str | None = None,
        chapter_id: str | None = None,
        language: str | None = None,
        difficulty: int | None = None,
        is_published: bool | None = None,
        q: str | None = None,
    ) -> tuple[list[CodeLab], int]:
        conditions = []
        if user.role == "student":
            conditions.append(CodeLab.is_published.is_(True))
        elif user.role == "teacher":
            conditions.append(or_(CodeLab.teacher_id == user.id, Course.teacher_id == user.id))

        if course_id:
            conditions.append(CodeLab.course_id == course_id)
        if chapter_id:
            conditions.append(CodeLab.chapter_id == chapter_id)
        if language:
            conditions.append(CodeLab.language == language)
        if difficulty:
            conditions.append(CodeLab.difficulty == difficulty)
        if is_published is not None and user.role in {"teacher", "admin"}:
            conditions.append(CodeLab.is_published.is_(is_published))
        if q:
            search = f"%{q.strip()}%"
            conditions.append(or_(CodeLab.title.ilike(search), CodeLab.description.ilike(search)))

        base = select(CodeLab).join(Course, Course.id == CodeLab.course_id)
        count_stmt = select(func.count()).select_from(CodeLab).join(Course, Course.id == CodeLab.course_id)
        if conditions:
            base = base.where(and_(*conditions))
            count_stmt = count_stmt.where(and_(*conditions))

        total = await db.scalar(count_stmt) or 0
        result = await db.execute(
            base.options(
                selectinload(CodeLab.course),
                selectinload(CodeLab.chapter),
                selectinload(CodeLab.teacher),
                selectinload(CodeLab.test_cases),
            )
            .order_by(CodeLab.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result.scalars().unique().all()), total

    @staticmethod
    async def get_codelab(db: AsyncSession, codelab_id: str, user: User, teacher_view: bool = False) -> CodeLab:
        return await CodeLabService._get_codelab_for_user(db, codelab_id, user, teacher_view=teacher_view)

    @staticmethod
    async def create_codelab(db: AsyncSession, data: CodeLabCreate, user: User) -> CodeLab:
        CodeLabService._assert_teacher_or_admin(user)
        course = await CodeLabService._validate_course_access(db, data.course_id, user)
        await CodeLabService._validate_chapter(db, data.course_id, data.chapter_id)
        if data.is_published and not data.test_cases:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Published codelabs require test cases")

        codelab = CodeLab(
            course_id=data.course_id,
            chapter_id=data.chapter_id,
            teacher_id=course.teacher_id if user.role == "admin" else user.id,
            title=data.title,
            description=data.description,
            language=data.language,
            starter_code=data.starter_code,
            difficulty=data.difficulty,
            time_limit_ms=data.time_limit_ms,
            memory_limit_mb=data.memory_limit_mb,
            is_published=data.is_published,
        )
        db.add(codelab)
        await db.flush()
        db.add_all(CodeLabService._test_case_models(codelab.id, data.test_cases))
        await db.commit()
        return await CodeLabService.get_codelab(db, codelab.id, user, teacher_view=True)

    @staticmethod
    async def update_codelab(db: AsyncSession, codelab_id: str, data: CodeLabUpdate, user: User) -> CodeLab:
        codelab = await CodeLabService._get_codelab_for_user(db, codelab_id, user, teacher_view=True)
        target_course_id = data.course_id if data.course_id is not None else codelab.course_id
        await CodeLabService._validate_course_access(db, target_course_id, user)
        target_chapter_id = data.chapter_id if data.chapter_id is not None else codelab.chapter_id
        await CodeLabService._validate_chapter(db, target_course_id, target_chapter_id)

        payload = data.model_dump(exclude_unset=True, exclude={"test_cases"})
        for key, value in payload.items():
            setattr(codelab, key, value)

        if data.test_cases is not None:
            await db.execute(delete(CodeLabTestCase).where(CodeLabTestCase.codelab_id == codelab.id))
            db.add_all(CodeLabService._test_case_models(codelab.id, data.test_cases))

        if codelab.is_published:
            result = await db.execute(select(func.count()).select_from(CodeLabTestCase).where(CodeLabTestCase.codelab_id == codelab.id))
            if (result.scalar_one() or 0) == 0 and data.test_cases is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Published codelabs require test cases")
            if data.test_cases is not None and not data.test_cases:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Published codelabs require test cases")

        await db.commit()
        return await CodeLabService.get_codelab(db, codelab.id, user, teacher_view=True)

    @staticmethod
    async def delete_codelab(db: AsyncSession, codelab_id: str, user: User) -> None:
        codelab = await CodeLabService._get_codelab_for_user(db, codelab_id, user, teacher_view=True)
        await db.delete(codelab)
        await db.commit()

    @staticmethod
    async def publish_codelab(db: AsyncSession, codelab_id: str, is_published: bool, user: User) -> CodeLab:
        codelab = await CodeLabService._get_codelab_for_user(db, codelab_id, user, teacher_view=True)
        if is_published and not codelab.test_cases:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Published codelabs require test cases")
        codelab.is_published = is_published
        await db.commit()
        return await CodeLabService.get_codelab(db, codelab_id, user, teacher_view=True)

    @staticmethod
    async def run_code(db: AsyncSession, codelab_id: str, user: User, code: str, mode: str) -> CodeSubmission:
        codelab = await CodeLabService._get_codelab_for_user(db, codelab_id, user)
        selected_cases = [item for item in codelab.test_cases if mode == "submit" or not item.is_hidden]
        if not selected_cases:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No runnable test cases")

        submission = CodeSubmission(
            codelab_id=codelab.id,
            user_id=user.id,
            code=code,
            mode=mode,
            status="running",
            max_score=sum(item.points for item in selected_cases),
            result_json=[],
        )
        db.add(submission)
        await db.commit()
        await db.refresh(submission)

        sandbox_cases: list[SandboxTestCase] = [
            {
                "id": item.id,
                "name": item.name,
                "input_data": item.input_data,
                "expected_output": item.expected_output,
                "is_hidden": item.is_hidden,
                "points": item.points,
            }
            for item in selected_cases
        ]
        result = await SandboxService.run_code_against_tests(
            code=code,
            language=codelab.language,
            test_cases=sandbox_cases,
            time_limit_ms=codelab.time_limit_ms,
            memory_limit_mb=codelab.memory_limit_mb,
        )

        submission.status = str(result["status"])
        submission.score = int(result["score"])
        submission.max_score = int(result["max_score"])
        submission.tests_passed = int(result["tests_passed"])
        submission.tests_total = int(result["tests_total"])
        submission.result_json = result["results"]  # type: ignore[assignment]
        submission.logs = result["logs"] if isinstance(result["logs"], str) else None
        submission.execution_time_ms = int(result["execution_time_ms"])
        await db.commit()
        return await CodeLabService.get_submission(db, submission.id, user)

    @staticmethod
    async def get_submission(db: AsyncSession, submission_id: str, user: User) -> CodeSubmission:
        result = await db.execute(
            select(CodeSubmission)
            .where(CodeSubmission.id == submission_id)
            .options(selectinload(CodeSubmission.codelab).selectinload(CodeLab.course))
        )
        submission = result.scalar_one_or_none()
        if submission is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
        if user.role == "admin" or submission.user_id == user.id:
            return submission
        if user.role == "teacher" and (
            submission.codelab.teacher_id == user.id or submission.codelab.course.teacher_id == user.id
        ):
            return submission
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this submission")

    @staticmethod
    async def list_submissions(
        db: AsyncSession,
        codelab_id: str,
        user: User,
        page: int,
        page_size: int,
        all_students: bool = False,
    ) -> tuple[list[CodeSubmission], int]:
        codelab = await CodeLabService._get_codelab_for_user(db, codelab_id, user, teacher_view=all_students)
        conditions = [CodeSubmission.codelab_id == codelab.id]
        if not all_students:
            conditions.append(CodeSubmission.user_id == user.id)
        elif user.role not in {"teacher", "admin"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        count_stmt = select(func.count()).select_from(CodeSubmission).where(and_(*conditions))
        total = await db.scalar(count_stmt) or 0
        result = await db.execute(
            select(CodeSubmission)
            .where(and_(*conditions))
            .order_by(CodeSubmission.submitted_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    @staticmethod
    async def latest_submission(db: AsyncSession, codelab_id: str, user_id: str) -> CodeSubmission | None:
        result = await db.execute(
            select(CodeSubmission)
            .where(
                CodeSubmission.codelab_id == codelab_id,
                CodeSubmission.user_id == user_id,
                CodeSubmission.mode == "submit",
            )
            .order_by(CodeSubmission.submitted_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def best_score(db: AsyncSession, codelab_id: str, user_id: str) -> int | None:
        result = await db.execute(
            select(func.max(CodeSubmission.score)).where(
                CodeSubmission.codelab_id == codelab_id,
                CodeSubmission.user_id == user_id,
                CodeSubmission.mode == "submit",
            )
        )
        value = result.scalar_one_or_none()
        return int(value) if value is not None else None

    @staticmethod
    async def submissions_count(db: AsyncSession, codelab_id: str, user_id: str | None = None) -> int:
        conditions = [CodeSubmission.codelab_id == codelab_id]
        if user_id is not None:
            conditions.append(CodeSubmission.user_id == user_id)
        result = await db.execute(select(func.count()).select_from(CodeSubmission).where(and_(*conditions)))
        return int(result.scalar_one() or 0)
