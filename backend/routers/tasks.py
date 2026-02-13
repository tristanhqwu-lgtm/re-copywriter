import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from auth import get_current_user
from database import get_db, SessionLocal
from models import AsyncTask, User
from schemas import TaskResponse
from services.task_manager import get_task

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/{task_id}", response_model=TaskResponse)
def get_task_status(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = get_task(db, task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/{task_id}/stream")
async def stream_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    async def event_generator():
        while True:
            db = SessionLocal()
            try:
                task = db.query(AsyncTask).filter(
                    AsyncTask.id == task_id,
                    AsyncTask.user_id == current_user.id,
                ).first()
                if not task:
                    yield {"event": "error", "data": json.dumps({"error": "Task not found"})}
                    return
                data = {
                    "id": task.id,
                    "type": task.type,
                    "status": task.status,
                    "progress": task.progress,
                    "result": task.result,
                    "error": task.error,
                }
                yield {"event": "update", "data": json.dumps(data, ensure_ascii=False)}
                if task.status in ("completed", "failed"):
                    return
            finally:
                db.close()
            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())
