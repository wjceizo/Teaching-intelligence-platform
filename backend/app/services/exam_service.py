from __future__ import annotations

import random
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Chapter, Course, Enrollment
from app.models.exam import Exam, ExamAttempt, ExamAttemptAnswer, ExamQuestion, ExamQuestionInPaper
from app.models.user import User
from app.schemas.exam import (
    AnswerValue,
    ExamCreate,
    ExamQuestionCreate,
    ExamQuestionInPaperCreate,
    ExamQuestionUpdate,
    ExamUpdate,
    GradeAttemptRequest,
)


class ExamService:
    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC)

    @staticmethod
    def _aware(value: object | None) -> datetime | None:
        if not isinstance(value, datetime):
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value

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

    @classmethod
    async def _validate_course_access(cls, db: AsyncSession, course_id: str, user: User) -> Course:
        course = await cls._get_course(db, course_id)
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
    async def _assert_student_enrolled(db: AsyncSession, course_id: str, user: User) -> None:
        if user.role != "student":
            return
        result = await db.execute(
            select(Enrollment.id).where(Enrollment.course_id == course_id, Enrollment.user_id == user.id).limit(1)
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Enroll in this course to access exams")

    @staticmethod
    def _choice_answer_set(value: AnswerValue) -> set[str]:
        if isinstance(value, str):
            return {value}
        if isinstance(value, list):
            return {str(item) for item in value}
        return set()

    @staticmethod
    def _normalize_fill(value: AnswerValue) -> str:
        if isinstance(value, list):
            return ",".join(str(item).strip() for item in value)
        if value is None:
            return ""
        return str(value).strip()

    @staticmethod
    def _answer_correct(question: ExamQuestion, user_answer: AnswerValue) -> bool:
        if question.type == "single":
            return isinstance(user_answer, str) and user_answer == question.answer
        if question.type == "multi":
            return ExamService._choice_answer_set(user_answer) == ExamService._choice_answer_set(question.answer)
        if question.type == "fill":
            expected = question.answer
            accepted = expected if isinstance(expected, list) else [expected]
            normalized = ExamService._normalize_fill(user_answer)
            return any(normalized == str(item).strip() for item in accepted)
        return False

    @staticmethod
    def _sum_points(questions: list[ExamQuestionInPaperCreate]) -> int:
        return sum(item.points for item in questions)

    @staticmethod
    def _validate_points(total_score: int, questions: list[ExamQuestionInPaperCreate]) -> None:
        if not questions:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exam requires at least one question")
        if ExamService._sum_points(questions) != total_score:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question points must equal total score")

    @staticmethod
    async def _get_exam_for_user(db: AsyncSession, exam_id: str, user: User, teacher_view: bool = False) -> Exam:
        result = await db.execute(
            select(Exam)
            .where(Exam.id == exam_id)
            .options(
                selectinload(Exam.course),
                selectinload(Exam.chapter),
                selectinload(Exam.teacher),
                selectinload(Exam.paper_questions).selectinload(ExamQuestionInPaper.question),
            )
        )
        exam = result.scalar_one_or_none()
        if exam is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

        if user.role == "admin":
            return exam
        if user.role == "teacher":
            owns_exam = exam.teacher_id == user.id or exam.course.teacher_id == user.id
            if owns_exam:
                return exam
            if teacher_view:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this exam")
        if not teacher_view and exam.status in {"published", "closed"}:
            await ExamService._assert_student_enrolled(db, exam.course_id, user)
            return exam
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this exam")

    @staticmethod
    async def _get_attempt_for_user(
        db: AsyncSession,
        attempt_id: str,
        user: User,
        teacher_view: bool = False,
    ) -> ExamAttempt:
        result = await db.execute(
            select(ExamAttempt)
            .where(ExamAttempt.id == attempt_id)
            .options(
                selectinload(ExamAttempt.user),
                selectinload(ExamAttempt.exam).selectinload(Exam.course),
                selectinload(ExamAttempt.exam).selectinload(Exam.paper_questions).selectinload(ExamQuestionInPaper.question),
                selectinload(ExamAttempt.answer_items).selectinload(ExamAttemptAnswer.question),
            )
        )
        attempt = result.scalar_one_or_none()
        if attempt is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
        if user.role == "admin":
            return attempt
        if teacher_view:
            if user.role == "teacher" and (attempt.exam.teacher_id == user.id or attempt.exam.course.teacher_id == user.id):
                return attempt
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this attempt")
        if attempt.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this attempt")
        return attempt

    @staticmethod
    async def create_question(db: AsyncSession, data: ExamQuestionCreate, user: User) -> ExamQuestion:
        ExamService._assert_teacher_or_admin(user)
        course = await ExamService._validate_course_access(db, data.course_id, user)
        await ExamService._validate_chapter(db, data.course_id, data.chapter_id)
        question = ExamQuestion(
            course_id=data.course_id,
            chapter_id=data.chapter_id,
            teacher_id=course.teacher_id if user.role == "admin" else user.id,
            type=data.type,
            content=data.content,
            options=[item.model_dump() for item in data.options] if data.options else None,
            answer=data.answer,
            explanation=data.explanation,
            difficulty=data.difficulty,
            tags=data.tags,
            is_active=True,
        )
        db.add(question)
        await db.commit()
        await db.refresh(question)
        return question

    @staticmethod
    async def list_questions(
        db: AsyncSession,
        user: User,
        page: int,
        page_size: int,
        course_id: str | None = None,
        chapter_id: str | None = None,
        type_value: str | None = None,
        difficulty: int | None = None,
        q: str | None = None,
    ) -> tuple[list[ExamQuestion], int]:
        ExamService._assert_teacher_or_admin(user)
        conditions = [ExamQuestion.is_active.is_(True)]
        if user.role == "teacher":
            conditions.append(or_(ExamQuestion.teacher_id == user.id, Course.teacher_id == user.id))
        if course_id:
            conditions.append(ExamQuestion.course_id == course_id)
        if chapter_id:
            conditions.append(ExamQuestion.chapter_id == chapter_id)
        if type_value:
            conditions.append(ExamQuestion.type == type_value)
        if difficulty:
            conditions.append(ExamQuestion.difficulty == difficulty)
        if q:
            conditions.append(ExamQuestion.content.ilike(f"%{q.strip()}%"))

        base = select(ExamQuestion).join(Course, Course.id == ExamQuestion.course_id)
        count_stmt = select(func.count()).select_from(ExamQuestion).join(Course, Course.id == ExamQuestion.course_id)
        if conditions:
            base = base.where(and_(*conditions))
            count_stmt = count_stmt.where(and_(*conditions))
        total = int(await db.scalar(count_stmt) or 0)
        result = await db.execute(
            base.order_by(ExamQuestion.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
        return list(result.scalars().all()), total

    @staticmethod
    async def get_question(db: AsyncSession, question_id: str, user: User) -> ExamQuestion:
        ExamService._assert_teacher_or_admin(user)
        result = await db.execute(
            select(ExamQuestion)
            .join(Course, Course.id == ExamQuestion.course_id)
            .where(ExamQuestion.id == question_id)
        )
        question = result.scalar_one_or_none()
        if question is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
        if user.role != "admin":
            course = await ExamService._get_course(db, question.course_id)
            if question.teacher_id != user.id and course.teacher_id != user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this question")
        return question

    @staticmethod
    async def update_question(db: AsyncSession, question_id: str, data: ExamQuestionUpdate, user: User) -> ExamQuestion:
        question = await ExamService.get_question(db, question_id, user)
        target_course_id = data.course_id if data.course_id is not None else question.course_id
        await ExamService._validate_course_access(db, target_course_id, user)
        target_chapter_id = data.chapter_id if data.chapter_id is not None else question.chapter_id
        await ExamService._validate_chapter(db, target_course_id, target_chapter_id)
        payload = data.model_dump(exclude_unset=True)
        if "options" in payload and payload["options"] is not None:
            payload["options"] = [item.model_dump() for item in data.options or []]
        for key, value in payload.items():
            setattr(question, key, value)
        await db.commit()
        await db.refresh(question)
        return question

    @staticmethod
    async def delete_question(db: AsyncSession, question_id: str, user: User) -> None:
        question = await ExamService.get_question(db, question_id, user)
        used = await db.scalar(
            select(func.count()).select_from(ExamQuestionInPaper).where(ExamQuestionInPaper.question_id == question_id)
        )
        if used:
            question.is_active = False
        else:
            await db.delete(question)
        await db.commit()

    @staticmethod
    def _paper_models(exam_id: str, questions: list[ExamQuestionInPaperCreate]) -> list[ExamQuestionInPaper]:
        return [
            ExamQuestionInPaper(
                exam_id=exam_id,
                question_id=item.question_id,
                points=item.points,
                order_index=item.order_index,
            )
            for item in questions
        ]

    @staticmethod
    async def _validate_exam_questions(db: AsyncSession, course_id: str, questions: list[ExamQuestionInPaperCreate]) -> None:
        if not questions:
            return
        ids = [item.question_id for item in questions]
        result = await db.execute(select(ExamQuestion).where(ExamQuestion.id.in_(ids), ExamQuestion.is_active.is_(True)))
        found = {item.id: item for item in result.scalars().all()}
        if set(ids) != set(found):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid question in exam")
        if any(item.course_id != course_id for item in found.values()):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="All questions must belong to exam course")

    @staticmethod
    async def create_exam(db: AsyncSession, data: ExamCreate, user: User) -> Exam:
        ExamService._assert_teacher_or_admin(user)
        course = await ExamService._validate_course_access(db, data.course_id, user)
        await ExamService._validate_chapter(db, data.course_id, data.chapter_id)
        await ExamService._validate_exam_questions(db, data.course_id, data.questions)
        if data.status == "published":
            ExamService._validate_points(data.total_score, data.questions)

        exam = Exam(
            course_id=data.course_id,
            chapter_id=data.chapter_id,
            teacher_id=course.teacher_id if user.role == "admin" else user.id,
            title=data.title,
            description=data.description,
            total_score=data.total_score,
            pass_score=data.pass_score or round(data.total_score * 0.6),
            time_limit=data.time_limit_minutes,
            time_limit_minutes=data.time_limit_minutes,
            start_time=data.start_time,
            end_time=data.end_time,
            max_attempts=data.max_attempts,
            is_shuffled=data.is_shuffled,
            show_result_policy=data.show_result_policy,
            status=data.status,
        )
        db.add(exam)
        await db.flush()
        db.add_all(ExamService._paper_models(exam.id, data.questions))
        await db.commit()
        return await ExamService.get_exam(db, exam.id, user, teacher_view=True)

    @staticmethod
    async def list_exams(
        db: AsyncSession,
        user: User,
        page: int,
        page_size: int,
        course_id: str | None = None,
        chapter_id: str | None = None,
        status_value: str | None = None,
        q: str | None = None,
    ) -> tuple[list[Exam], int]:
        conditions = []
        if user.role == "student":
            conditions.append(Exam.status.in_(["published", "closed"]))
            conditions.append(Exam.course_id.in_(select(Enrollment.course_id).where(Enrollment.user_id == user.id)))
        elif user.role == "teacher":
            conditions.append(or_(Exam.teacher_id == user.id, Course.teacher_id == user.id))
        if course_id:
            conditions.append(Exam.course_id == course_id)
        if chapter_id:
            conditions.append(Exam.chapter_id == chapter_id)
        if status_value:
            conditions.append(Exam.status == status_value)
        if q:
            conditions.append(or_(Exam.title.ilike(f"%{q.strip()}%"), Exam.description.ilike(f"%{q.strip()}%")))

        base = select(Exam).join(Course, Course.id == Exam.course_id)
        count_stmt = select(func.count()).select_from(Exam).join(Course, Course.id == Exam.course_id)
        if conditions:
            base = base.where(and_(*conditions))
            count_stmt = count_stmt.where(and_(*conditions))
        total = int(await db.scalar(count_stmt) or 0)
        result = await db.execute(
            base.options(
                selectinload(Exam.course),
                selectinload(Exam.chapter),
                selectinload(Exam.paper_questions).selectinload(ExamQuestionInPaper.question),
            )
            .order_by(Exam.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result.scalars().unique().all()), total

    @staticmethod
    async def get_exam(db: AsyncSession, exam_id: str, user: User, teacher_view: bool = False) -> Exam:
        return await ExamService._get_exam_for_user(db, exam_id, user, teacher_view=teacher_view)

    @staticmethod
    async def update_exam(db: AsyncSession, exam_id: str, data: ExamUpdate, user: User) -> Exam:
        exam = await ExamService._get_exam_for_user(db, exam_id, user, teacher_view=True)
        target_course_id = data.course_id if data.course_id is not None else exam.course_id
        await ExamService._validate_course_access(db, target_course_id, user)
        target_chapter_id = data.chapter_id if data.chapter_id is not None else exam.chapter_id
        await ExamService._validate_chapter(db, target_course_id, target_chapter_id)
        if data.questions is not None:
            await ExamService._validate_exam_questions(db, target_course_id, data.questions)
        target_total = data.total_score if data.total_score is not None else exam.total_score
        target_status = data.status if data.status is not None else exam.status
        target_questions = data.questions if data.questions is not None else [
            ExamQuestionInPaperCreate(question_id=item.question_id, points=item.points, order_index=item.order_index)
            for item in exam.paper_questions
        ]
        if target_status == "published":
            ExamService._validate_points(target_total, target_questions)
        if data.pass_score is not None and data.pass_score > target_total:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pass score cannot exceed total score")

        payload = data.model_dump(exclude_unset=True, exclude={"questions"})
        for key, value in payload.items():
            setattr(exam, key, value)
        if data.time_limit_minutes is not None:
            exam.time_limit = data.time_limit_minutes
        if data.pass_score is None and data.total_score is not None:
            exam.pass_score = round(data.total_score * 0.6)
        if data.questions is not None:
            await db.execute(delete(ExamQuestionInPaper).where(ExamQuestionInPaper.exam_id == exam.id))
            db.add_all(ExamService._paper_models(exam.id, data.questions))
        await db.commit()
        return await ExamService.get_exam(db, exam.id, user, teacher_view=True)

    @staticmethod
    async def publish_exam(db: AsyncSession, exam_id: str, user: User) -> Exam:
        exam = await ExamService._get_exam_for_user(db, exam_id, user, teacher_view=True)
        questions = [
            ExamQuestionInPaperCreate(question_id=item.question_id, points=item.points, order_index=item.order_index)
            for item in exam.paper_questions
        ]
        ExamService._validate_points(exam.total_score, questions)
        exam.status = "published"
        await db.commit()
        return await ExamService.get_exam(db, exam_id, user, teacher_view=True)

    @staticmethod
    async def close_exam(db: AsyncSession, exam_id: str, user: User) -> Exam:
        exam = await ExamService._get_exam_for_user(db, exam_id, user, teacher_view=True)
        exam.status = "closed"
        await db.commit()
        return await ExamService.get_exam(db, exam_id, user, teacher_view=True)

    @staticmethod
    async def delete_exam(db: AsyncSession, exam_id: str, user: User) -> None:
        exam = await ExamService._get_exam_for_user(db, exam_id, user, teacher_view=True)
        attempts = await db.scalar(select(func.count()).select_from(ExamAttempt).where(ExamAttempt.exam_id == exam.id))
        if attempts:
            exam.status = "closed"
        else:
            await db.delete(exam)
        await db.commit()

    @staticmethod
    async def latest_attempt(db: AsyncSession, exam_id: str, user_id: str) -> ExamAttempt | None:
        result = await db.execute(
            select(ExamAttempt)
            .where(ExamAttempt.exam_id == exam_id, ExamAttempt.user_id == user_id)
            .order_by(ExamAttempt.started_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def best_score(db: AsyncSession, exam_id: str, user_id: str) -> int | None:
        return await db.scalar(
            select(func.max(ExamAttempt.score)).where(
                ExamAttempt.exam_id == exam_id,
                ExamAttempt.user_id == user_id,
                ExamAttempt.status.in_(["graded", "submitted"]),
            )
        )

    @staticmethod
    async def start_attempt(db: AsyncSession, exam_id: str, user: User) -> ExamAttempt:
        exam = await ExamService._get_exam_for_user(db, exam_id, user)
        if user.role != "student":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can start attempts")
        if exam.status != "published":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exam is not available")
        now = ExamService._now()
        start_time = ExamService._aware(exam.start_time)
        end_time = ExamService._aware(exam.end_time)
        if start_time and now < start_time:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exam has not started")
        if end_time and now > end_time:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exam has ended")

        existing = await ExamService.latest_attempt(db, exam.id, user.id)
        if existing and existing.status == "in_progress":
            return await ExamService._get_attempt_for_user(db, existing.id, user)

        attempts_count = await db.scalar(
            select(func.count()).select_from(ExamAttempt).where(ExamAttempt.exam_id == exam.id, ExamAttempt.user_id == user.id)
        )
        if int(attempts_count or 0) >= exam.max_attempts:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum attempts reached")

        question_ids = [item.question_id for item in exam.paper_questions]
        if exam.is_shuffled:
            random.shuffle(question_ids)
        deadline = now + timedelta(minutes=exam.time_limit_minutes)
        if end_time and deadline > end_time:
            deadline = end_time
        attempt = ExamAttempt(
            exam_id=exam.id,
            user_id=user.id,
            answers={},
            score=None,
            auto_score=0,
            manual_score=0,
            total_score=exam.total_score,
            question_order=question_ids,
            status="in_progress",
            deadline_at=deadline,
            last_saved_at=now,
        )
        db.add(attempt)
        await db.commit()
        return await ExamService._get_attempt_for_user(db, attempt.id, user)

    @staticmethod
    async def save_draft(db: AsyncSession, attempt_id: str, user: User, answers: dict[str, AnswerValue]) -> ExamAttempt:
        attempt = await ExamService._get_attempt_for_user(db, attempt_id, user)
        if attempt.status != "in_progress":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attempt is not in progress")
        now = ExamService._now()
        deadline = ExamService._aware(attempt.deadline_at)
        if deadline and now > deadline:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attempt deadline has passed")
        await ExamService._upsert_answers(db, attempt, answers, grade=False)
        attempt.answers = answers
        attempt.last_saved_at = now
        await db.commit()
        return await ExamService._get_attempt_for_user(db, attempt_id, user)

    @staticmethod
    async def _upsert_answers(
        db: AsyncSession,
        attempt: ExamAttempt,
        answers: dict[str, AnswerValue],
        grade: bool,
    ) -> None:
        existing = {item.question_id: item for item in attempt.answer_items}
        paper_by_question = {item.question_id: item for item in attempt.exam.paper_questions}
        for question_id, value in answers.items():
            paper_item = paper_by_question.get(question_id)
            if paper_item is None:
                continue
            answer_item = existing.get(question_id)
            if answer_item is None:
                answer_item = ExamAttemptAnswer(
                    attempt_id=attempt.id,
                    question_id=question_id,
                    answer=value,
                    max_score=paper_item.points,
                )
                db.add(answer_item)
                existing[question_id] = answer_item
            answer_item.answer = value
            answer_item.max_score = paper_item.points
            if grade:
                question = paper_item.question
                if question.type in {"single", "multi", "fill"}:
                    correct = ExamService._answer_correct(question, value)
                    answer_item.is_correct = correct
                    answer_item.auto_score = paper_item.points if correct else 0
                    answer_item.manual_score = None
                    answer_item.final_score = answer_item.auto_score
                else:
                    answer_item.is_correct = None
                    answer_item.auto_score = 0
                    answer_item.manual_score = None
                    answer_item.final_score = None
        if grade:
            for paper_item in attempt.exam.paper_questions:
                if paper_item.question_id in existing:
                    continue
                answer_item = ExamAttemptAnswer(
                    attempt_id=attempt.id,
                    question_id=paper_item.question_id,
                    answer=None,
                    max_score=paper_item.points,
                )
                if paper_item.question.type in {"single", "multi", "fill"}:
                    answer_item.is_correct = False
                    answer_item.auto_score = 0
                    answer_item.final_score = 0
                else:
                    answer_item.auto_score = 0
                    answer_item.final_score = None
                db.add(answer_item)

    @staticmethod
    async def submit_attempt(db: AsyncSession, attempt_id: str, user: User, answers: dict[str, AnswerValue]) -> ExamAttempt:
        attempt = await ExamService._get_attempt_for_user(db, attempt_id, user)
        if attempt.status != "in_progress":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attempt is not in progress")
        merged_answers = dict(attempt.answers or {})
        merged_answers.update(answers)
        await ExamService._upsert_answers(db, attempt, merged_answers, grade=True)
        await db.flush()

        refreshed = await ExamService._get_attempt_for_user(db, attempt_id, user)
        auto_score = sum((item.auto_score or 0) for item in refreshed.answer_items)
        has_subjective = any(item.question.type in {"short", "proof"} for item in refreshed.answer_items)
        refreshed.answers = merged_answers
        refreshed.auto_score = auto_score
        refreshed.manual_score = sum((item.manual_score or 0) for item in refreshed.answer_items)
        refreshed.score = None if has_subjective else auto_score
        refreshed.status = "pending_review" if has_subjective else "graded"
        refreshed.submitted_at = ExamService._now()
        refreshed.last_saved_at = refreshed.submitted_at
        if not has_subjective:
            refreshed.graded_at = refreshed.submitted_at
        await db.commit()
        return await ExamService._get_attempt_for_user(db, attempt_id, user)

    @staticmethod
    async def report_violation(db: AsyncSession, attempt_id: str, user: User, reason: str) -> ExamAttempt:
        _ = reason
        attempt = await ExamService._get_attempt_for_user(db, attempt_id, user)
        attempt.violation_count += 1
        await db.commit()
        return await ExamService._get_attempt_for_user(db, attempt_id, user)

    @staticmethod
    async def list_attempts(
        db: AsyncSession,
        exam_id: str,
        user: User,
        page: int,
        page_size: int,
        pending_only: bool = False,
    ) -> tuple[list[ExamAttempt], int]:
        exam = await ExamService._get_exam_for_user(db, exam_id, user, teacher_view=True)
        conditions = [ExamAttempt.exam_id == exam.id]
        if pending_only:
            conditions.append(ExamAttempt.status == "pending_review")
        count_stmt = select(func.count()).select_from(ExamAttempt).where(and_(*conditions))
        total = int(await db.scalar(count_stmt) or 0)
        result = await db.execute(
            select(ExamAttempt)
            .where(and_(*conditions))
            .options(selectinload(ExamAttempt.user))
            .order_by(ExamAttempt.started_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    @staticmethod
    async def grade_attempt(db: AsyncSession, attempt_id: str, data: GradeAttemptRequest, user: User) -> ExamAttempt:
        attempt = await ExamService._get_attempt_for_user(db, attempt_id, user, teacher_view=True)
        answer_by_question = {item.question_id: item for item in attempt.answer_items}
        now = ExamService._now()
        for item in data.answers:
            answer = answer_by_question.get(item.question_id)
            if answer is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Answer not found")
            if answer.question.type not in {"short", "proof"}:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only subjective answers can be graded")
            if item.score > answer.max_score:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Score exceeds question points")
            answer.manual_score = item.score
            answer.final_score = item.score
            answer.is_correct = item.score == answer.max_score
            answer.teacher_comment = item.teacher_comment
            answer.graded_by = user.id
            answer.graded_at = now

        await db.flush()
        refreshed = await ExamService._get_attempt_for_user(db, attempt_id, user, teacher_view=True)
        manual_score = sum((item.manual_score or 0) for item in refreshed.answer_items)
        auto_score = sum((item.auto_score or 0) for item in refreshed.answer_items)
        pending = any(item.question.type in {"short", "proof"} and item.manual_score is None for item in refreshed.answer_items)
        refreshed.auto_score = auto_score
        refreshed.manual_score = manual_score
        refreshed.score = auto_score + manual_score if not pending else None
        refreshed.status = "graded" if not pending else "pending_review"
        if not pending:
            refreshed.graded_at = now
        await db.commit()
        return await ExamService._get_attempt_for_user(db, attempt_id, user, teacher_view=True)

    @staticmethod
    def can_view_result_detail(attempt: ExamAttempt, user: User) -> bool:
        if user.role in {"teacher", "admin"}:
            return True
        policy = attempt.exam.show_result_policy
        if policy == "after_submit":
            return attempt.status in {"pending_review", "graded", "submitted"}
        if policy == "after_end":
            end_time = ExamService._aware(attempt.exam.end_time)
            return end_time is not None and ExamService._now() >= end_time
        return False

    @staticmethod
    async def get_result(db: AsyncSession, attempt_id: str, user: User) -> ExamAttempt:
        teacher_view = user.role in {"teacher", "admin"}
        return await ExamService._get_attempt_for_user(db, attempt_id, user, teacher_view=teacher_view)

    @staticmethod
    async def get_exam_stats(db: AsyncSession, exam_id: str, user: User) -> dict[str, object]:
        exam = await ExamService._get_exam_for_user(db, exam_id, user, teacher_view=True)
        attempts_result = await db.execute(
            select(ExamAttempt)
            .where(ExamAttempt.exam_id == exam.id)
            .options(selectinload(ExamAttempt.answer_items).selectinload(ExamAttemptAnswer.question))
        )
        attempts = list(attempts_result.scalars().unique().all())
        submitted = [item for item in attempts if item.status in {"pending_review", "graded", "submitted"}]
        graded = [item for item in attempts if item.score is not None]
        scores = [int(item.score or 0) for item in graded]
        avg_score = round(sum(scores) / len(scores), 1) if scores else None
        pass_rate = round((sum(1 for score in scores if score >= exam.pass_score) / len(scores)) * 100, 1) if scores else None
        buckets = [{"label": f"{start}-{start + 19}", "count": 0} for start in range(0, 100, 20)]
        for score in scores:
            pct = int((score / exam.total_score) * 100) if exam.total_score else 0
            index = min(4, max(0, pct // 20))
            buckets[index]["count"] += 1

        question_stats = []
        for paper in exam.paper_questions:
            answers = [
                answer
                for attempt in attempts
                for answer in attempt.answer_items
                if answer.question_id == paper.question_id
            ]
            scored = [answer.final_score for answer in answers if answer.final_score is not None]
            objective = [answer for answer in answers if answer.is_correct is not None]
            question_stats.append(
                {
                    "question_id": paper.question_id,
                    "content": paper.question.content,
                    "type": paper.question.type,
                    "max_score": paper.points,
                    "answered_count": len(answers),
                    "correct_rate": round((sum(1 for item in objective if item.is_correct) / len(objective)) * 100, 1)
                    if objective
                    else None,
                    "avg_score": round(sum(scored) / len(scored), 1) if scored else None,
                    "pending_review_count": sum(
                        1 for item in answers if item.question.type in {"short", "proof"} and item.manual_score is None
                    ),
                }
            )
        return {
            "participants_count": len({item.user_id for item in attempts}),
            "submitted_count": len(submitted),
            "pending_review_count": sum(1 for item in attempts if item.status == "pending_review"),
            "avg_score": avg_score,
            "pass_rate": pass_rate,
            "max_score": max(scores) if scores else None,
            "min_score": min(scores) if scores else None,
            "score_distribution": buckets,
            "question_stats": question_stats,
        }
