from __future__ import annotations

import json
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, Response, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal, get_db
from app.dependencies import get_current_user, require_role
from app.models.question import Answer, AnswerVote, Question
from app.models.user import User
from app.schemas.question import (
    AnswerCreate,
    AnswerResponse,
    AnswerUpdate,
    AnswerUserSummary,
    AnswerVoteRequest,
    PaginatedQuestionResponse,
    PaginationMeta,
    QuestionDetailResponse,
    QuestionCreate,
    QuestionFilter,
    QuestionResponse,
    QuestionUpdate,
    QuestionUserSummary,
)
from app.services.question_service import QuestionService

router = APIRouter(prefix="/api/v1/questions", tags=["questions"])
settings = get_settings()


class QuestionEventHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, question_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[question_id].add(websocket)

    def disconnect(self, question_id: str, websocket: WebSocket) -> None:
        if question_id not in self._connections:
            return
        self._connections[question_id].discard(websocket)
        if not self._connections[question_id]:
            self._connections.pop(question_id, None)

    async def broadcast_answer_created(self, question_id: str, answer_id: str) -> None:
        payload = json.dumps({"type": "answer_created", "question_id": question_id, "answer_id": answer_id})
        for websocket in list(self._connections.get(question_id, set())):
            try:
                await websocket.send_text(payload)
            except RuntimeError:
                self.disconnect(question_id, websocket)


event_hub = QuestionEventHub()


def _build_question_response(question: Question, answers_count: int) -> QuestionResponse:
    return QuestionResponse(
        id=question.id,
        user_id=question.user_id,
        course_id=question.course_id,
        chapter_id=question.chapter_id,
        title=question.title,
        content=question.content,
        type=question.type,
        status=question.status,
        is_pinned=question.is_pinned,
        view_count=question.view_count,
        paragraph_ref=question.paragraph_ref,
        course_title=question.course.title if question.course is not None else None,
        chapter_title=question.chapter.title if question.chapter is not None else None,
        created_at=question.created_at,
        user=QuestionUserSummary.model_validate(question.user),
        answers_count=answers_count,
    )


def _build_answer_response(answer: Answer, user_vote: int) -> AnswerResponse:
    author = AnswerUserSummary.model_validate(answer.user) if answer.user is not None else None
    normalized_vote = user_vote if user_vote in (-1, 0, 1) else 0
    return AnswerResponse(
        id=answer.id,
        question_id=answer.question_id,
        content=answer.content,
        is_teacher=answer.is_teacher,
        is_ai=answer.is_ai,
        upvotes=answer.upvotes,
        downvotes=answer.downvotes,
        created_at=answer.created_at,
        user=author,
        user_vote=normalized_vote,
    )


async def _get_current_user_by_token(token: str, db: AsyncSession) -> User:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")
    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")

    user_query = await db.execute(select(User).where(User.id == user_id))
    user = user_query.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.get("", response_model=PaginatedQuestionResponse)
async def list_questions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    course_id: str | None = Query(default=None),
    chapter_id: str | None = Query(default=None),
    type: str | None = Query(default=None, pattern="^(ai|teacher)$"),  # noqa: A002
    status_value: str | None = Query(default=None, alias="status", pattern="^(open|resolved)$"),
    sort: str = Query(default="latest", pattern="^(latest|hot|unanswered)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedQuestionResponse:
    filters = QuestionFilter(
        course_id=course_id,
        chapter_id=chapter_id,
        type=type,
        status=status_value,
        sort=sort,
    )
    result = await QuestionService.list_questions(
        db=db,
        user_id=current_user.id,
        filters=filters,
        page=page,
        page_size=page_size,
    )
    return PaginatedQuestionResponse(
        data=[_build_question_response(item.question, item.answers_count) for item in result.items],
        meta=PaginationMeta(page=page, page_size=page_size, total=result.total),
    )


@router.post("", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    data: QuestionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    question = await QuestionService.create_question(db=db, user_id=current_user.id, data=data)
    return _build_question_response(question, answers_count=0)


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: str,
    data: QuestionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    question = await QuestionService.update_question(db=db, question_id=question_id, user=current_user, data=data)
    answers_count = int(
        await db.scalar(select(func.count(Answer.id)).where(Answer.question_id == question.id)) or 0
    )
    return _build_question_response(question, answers_count=answers_count)


@router.get("/{question_id}", response_model=QuestionDetailResponse)
async def get_question_detail(
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuestionDetailResponse:
    detail = await QuestionService.get_question_detail(db=db, question_id=question_id, user_id=current_user.id)
    answers_count = len(detail.answers)
    base = _build_question_response(detail.question, answers_count=answers_count)
    return QuestionDetailResponse(
        **base.model_dump(),
        answers=[_build_answer_response(answer, detail.user_votes.get(answer.id, 0)) for answer in detail.answers],
        paragraph_excerpt=detail.paragraph_excerpt,
    )


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await QuestionService.delete_question(db=db, question_id=question_id, user=current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{question_id}/answers", response_model=AnswerResponse, status_code=status.HTTP_201_CREATED)
async def create_answer(
    question_id: str,
    data: AnswerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnswerResponse:
    answer = await QuestionService.create_answer(
        db=db,
        question_id=question_id,
        user_id=current_user.id,
        role=current_user.role,
        data=data,
    )
    await event_hub.broadcast_answer_created(question_id=question_id, answer_id=answer.id)
    return _build_answer_response(answer, user_vote=0)


@router.put("/answers/{answer_id}", response_model=AnswerResponse)
async def update_answer(
    answer_id: str,
    data: AnswerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnswerResponse:
    answer = await QuestionService.update_answer(
        db=db,
        answer_id=answer_id,
        user_id=current_user.id,
        role=current_user.role,
        data=data,
    )
    user_vote_value = await db.scalar(
        select(func.coalesce(func.max(AnswerVote.vote), 0)).where(
            AnswerVote.answer_id == answer_id,
            AnswerVote.user_id == current_user.id,
        )
    )
    return _build_answer_response(answer, user_vote=int(user_vote_value or 0))


@router.delete("/answers/{answer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_answer(
    answer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await QuestionService.delete_answer(db=db, answer_id=answer_id, user=current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/answers/{answer_id}/vote", response_model=AnswerResponse)
async def vote_answer(
    answer_id: str,
    data: AnswerVoteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnswerResponse:
    answer = await QuestionService.vote_answer(db=db, answer_id=answer_id, user_id=current_user.id, vote=data.vote)
    user_vote_value = await db.scalar(
        select(func.coalesce(func.max(AnswerVote.vote), 0)).where(
            AnswerVote.answer_id == answer_id,
            AnswerVote.user_id == current_user.id,
        )
    )
    return _build_answer_response(answer, user_vote=int(user_vote_value or 0))


@router.post("/{question_id}/pin", response_model=QuestionResponse, dependencies=[Depends(require_role("teacher", "admin"))])
async def toggle_pin(
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    question = await QuestionService.toggle_pin(db=db, question_id=question_id, user=current_user)
    answers_count = int(
        await db.scalar(select(func.count(Answer.id)).where(Answer.question_id == question_id)) or 0
    )
    return _build_question_response(question, answers_count=answers_count)


@router.post("/{question_id}/resolve", response_model=QuestionResponse)
async def resolve_question(
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    question = await QuestionService.resolve_question(db=db, question_id=question_id, user=current_user)
    answers_count = int(
        await db.scalar(select(func.count(Answer.id)).where(Answer.question_id == question_id)) or 0
    )
    return _build_question_response(question, answers_count=answers_count)


@router.websocket("/{question_id}/ws")
async def question_events_socket(websocket: WebSocket, question_id: str, token: str | None = Query(default=None)) -> None:
    if not token:
        await websocket.close(code=4401)
        return

    async with AsyncSessionLocal() as db:
        try:
            await _get_current_user_by_token(token=token, db=db)
            await event_hub.connect(question_id=question_id, websocket=websocket)
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            event_hub.disconnect(question_id=question_id, websocket=websocket)
        except HTTPException:
            await websocket.close(code=4401)
