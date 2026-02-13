from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from database import SessionLocal
from models import AsyncTask


def create_task(db: Session, task_type: str) -> AsyncTask:
    task = AsyncTask(type=task_type, status="pending", progress=0)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task(
    task_id: str,
    status: Optional[str] = None,
    progress: Optional[int] = None,
    result: Optional[dict] = None,
    error: Optional[str] = None,
):
    db = SessionLocal()
    try:
        task = db.query(AsyncTask).filter(AsyncTask.id == task_id).first()
        if not task:
            return
        if status:
            task.status = status
        if progress is not None:
            task.progress = progress
        if result is not None:
            task.result = result
        if error is not None:
            task.error = error
        task.updated_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()


def get_task(db: Session, task_id: str) -> Optional[AsyncTask]:
    return db.query(AsyncTask).filter(AsyncTask.id == task_id).first()
