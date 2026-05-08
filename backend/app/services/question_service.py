from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Chapter, Course
from app.models.question import Answer, AnswerVote, Question
from app.models.user import User
from app.schemas.question import AnswerCreate, AnswerUpdate, QuestionCreate, QuestionFilter


@dataclass
class QuestionListItem:
    question: Question
    answers_count: int


@dataclass
class QuestionListResult:
    items: list[QuestionListItem]
    total: int


@dataclass
class QuestionDetailResult:
    question: Question
    answers: list[Answer]
    user_votes: dict[str, int]
    paragraph_excerpt: str | None


class QuestionService:
    @staticmethod
    async def _get_question_with_user(db: AsyncSession, question_id: str) -> Question:
        result = await db.execute(
            select(Question).where(Question.id == question_id).options(selectinload(Question.user))
        )
        question = result.scalar_one_or_none()
        if question is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
        return question

    @staticmethod
    async def _get_answer_with_user(db: AsyncSession, answer_id: str) -> Answer:
        result = await db.execute(
            select(Answer).where(Answer.id == answer_id).options(selectinload(Answer.user))
        )
        answer = result.scalar_one_or_none()
        if answer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")
        return answer

    @staticmethod
    def _extract_paragraph(markdown_content: str, paragraph_ref: str) -> str | None:
        ref = paragraph_ref.strip().lower()
        if not ref:
            return None

        blocks = [block.strip() for block in markdown_content.split("\n\n") if block.strip()]
        for block in blocks:
            if ref in block.lower():
                return block[:500]
        return None

    @staticmethod
    async def _validate_course_and_chapter(
        db: AsyncSession,
        course_id: str,
        chapter_id: str | None,
    ) -> None:
        course = await db.get(Course, course_id)
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        if chapter_id is None:
            return

        chapter = await db.get(Chapter, chapter_id)
        if chapter is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
        if chapter.course_id != course_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chapter does not belong to course")

    @staticmethod
    async def list_questions(
        db: AsyncSession,
        user_id: str,
        filters: QuestionFilter,
        page: int,
        page_size: int,
    ) -> QuestionListResult:
        answers_stats_subquery = (
            select(
                Answer.question_id.label("question_id"),
                func.count(Answer.id).label("answers_count"),
                func.coalesce(func.sum(Answer.upvotes - Answer.downvotes), 0).label("hot_score"),
            )
            .group_by(Answer.question_id)
            .subquery()
        )

        conditions = []
        if filters.course_id:
            conditions.append(Question.course_id == filters.course_id)
        if filters.chapter_id:
            conditions.append(Question.chapter_id == filters.chapter_id)
        if filters.type:
            conditions.append(Question.type == filters.type)
        if filters.status:
            conditions.append(Question.status == filters.status)
        if filters.sort == "unanswered":
            conditions.append(func.coalesce(answers_stats_subquery.c.answers_count, 0) == 0)

        total_query = select(func.count()).select_from(Question).outerjoin(
            answers_stats_subquery,
            Question.id == answers_stats_subquery.c.question_id,
        )
        if conditions:
            total_query = total_query.where(*conditions)
        total = int(await db.scalar(total_query) or 0)

        answers_count_column = func.coalesce(answers_stats_subquery.c.answers_count, 0)
        hot_score_column = func.coalesce(answers_stats_subquery.c.hot_score, 0)

        query: Select[tuple[Question, int]] = (
            select(Question, answers_count_column.label("answers_count"))
            .options(selectinload(Question.user))
            .outerjoin(answers_stats_subquery, Question.id == answers_stats_subquery.c.question_id)
        )
        if conditions:
            query = query.where(*conditions)

        if filters.sort == "hot":
            query = query.order_by(Question.is_pinned.desc(), hot_score_column.desc(), Question.created_at.desc())
        elif filters.sort == "unanswered":
            query = query.order_by(Question.is_pinned.desc(), Question.created_at.desc())
        else:
            query = query.order_by(Question.is_pinned.desc(), Question.created_at.desc())

        query = query.offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(query)).all()

        items = [QuestionListItem(question=row[0], answers_count=int(row[1] or 0)) for row in rows]
        return QuestionListResult(items=items, total=total)

    @classmethod
    async def get_question_detail(
        cls,
        db: AsyncSession,
        question_id: str,
        user_id: str,
    ) -> QuestionDetailResult:
        question_query = await db.execute(
            select(Question)
            .where(Question.id == question_id)
            .options(selectinload(Question.user))
        )
        question = question_query.scalar_one_or_none()
        if question is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

        question.view_count += 1
        await db.commit()
        await db.refresh(question)

        answers_query = await db.execute(
            select(Answer)
            .where(Answer.question_id == question_id)
            .options(selectinload(Answer.user))
            .order_by((Answer.upvotes - Answer.downvotes).desc(), Answer.created_at.asc())
        )
        answers = list(answers_query.scalars().all())

        user_votes: dict[str, int] = {}
        if answers:
            vote_rows = await db.execute(
                select(AnswerVote.answer_id, AnswerVote.vote).where(
                    AnswerVote.user_id == user_id,
                    AnswerVote.answer_id.in_([answer.id for answer in answers]),
                )
            )
            user_votes = {answer_id: int(vote) for answer_id, vote in vote_rows.all()}

        paragraph_excerpt: str | None = None
        if question.paragraph_ref and question.chapter_id:
            chapter = await db.get(Chapter, question.chapter_id)
            if chapter is not None:
                paragraph_excerpt = cls._extract_paragraph(chapter.content, question.paragraph_ref)

        return QuestionDetailResult(
            question=question,
            answers=answers,
            user_votes=user_votes,
            paragraph_excerpt=paragraph_excerpt,
        )

    @classmethod
    async def create_question(cls, db: AsyncSession, user_id: str, data: QuestionCreate) -> Question:
        await cls._validate_course_and_chapter(db=db, course_id=data.course_id, chapter_id=data.chapter_id)

        question = Question(
            user_id=user_id,
            course_id=data.course_id,
            chapter_id=data.chapter_id,
            title=data.title.strip(),
            content=data.content,
            type=data.type,
            paragraph_ref=data.paragraph_ref,
            status="open",
            is_pinned=False,
            view_count=0,
        )
        db.add(question)
        await db.commit()
        return await cls._get_question_with_user(db=db, question_id=question.id)

    @staticmethod
    async def delete_question(db: AsyncSession, question_id: str, user: User) -> None:
        question = await db.get(Question, question_id)
        if question is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
        if question.user_id != user.id and user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        await db.delete(question)
        await db.commit()

    @staticmethod
    async def create_answer(
        db: AsyncSession,
        question_id: str,
        user_id: str,
        role: str,
        data: AnswerCreate,
    ) -> Answer:
        question = await db.get(Question, question_id)
        if question is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

        answer = Answer(
            question_id=question_id,
            user_id=user_id,
            content=data.content,
            is_teacher=(role == "teacher"),
            is_ai=False,
            upvotes=0,
            downvotes=0,
        )
        db.add(answer)
        await db.commit()
        return await QuestionService._get_answer_with_user(db=db, answer_id=answer.id)

    @staticmethod
    async def update_answer(
        db: AsyncSession,
        answer_id: str,
        user_id: str,
        role: str,
        data: AnswerUpdate,
    ) -> Answer:
        answer = await db.get(Answer, answer_id)
        if answer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")
        if answer.user_id != user_id and role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        answer.content = data.content
        await db.commit()
        return await QuestionService._get_answer_with_user(db=db, answer_id=answer.id)

    @staticmethod
    async def delete_answer(db: AsyncSession, answer_id: str, user: User) -> None:
        answer = await db.get(Answer, answer_id)
        if answer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")
        if answer.user_id != user.id and user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        await db.delete(answer)
        await db.commit()

    @staticmethod
    async def vote_answer(db: AsyncSession, answer_id: str, user_id: str, vote: int) -> Answer:
        answer = await db.get(Answer, answer_id)
        if answer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")

        vote_query = await db.execute(
            select(AnswerVote).where(AnswerVote.answer_id == answer_id, AnswerVote.user_id == user_id)
        )
        existing_vote = vote_query.scalar_one_or_none()

        previous = int(existing_vote.vote) if existing_vote is not None else 0
        next_vote = int(vote)

        if previous == 1:
            answer.upvotes = max(0, answer.upvotes - 1)
        elif previous == -1:
            answer.downvotes = max(0, answer.downvotes - 1)

        if next_vote == 1:
            answer.upvotes += 1
        elif next_vote == -1:
            answer.downvotes += 1

        if next_vote == 0:
            if existing_vote is not None:
                await db.delete(existing_vote)
        elif existing_vote is None:
            db.add(AnswerVote(user_id=user_id, answer_id=answer_id, vote=next_vote))
        else:
            existing_vote.vote = next_vote

        await db.commit()
        return await QuestionService._get_answer_with_user(db=db, answer_id=answer.id)

    @staticmethod
    async def toggle_pin(db: AsyncSession, question_id: str, user: User) -> Question:
        if user.role not in {"teacher", "admin"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        question = await db.get(Question, question_id)
        if question is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

        question.is_pinned = not bool(question.is_pinned)
        await db.commit()
        return await QuestionService._get_question_with_user(db=db, question_id=question.id)

    @staticmethod
    async def resolve_question(db: AsyncSession, question_id: str, user: User) -> Question:
        question = await db.get(Question, question_id)
        if question is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

        if question.user_id != user.id and user.role not in {"teacher", "admin"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        question.status = "resolved"
        await db.commit()
        return await QuestionService._get_question_with_user(db=db, question_id=question.id)
