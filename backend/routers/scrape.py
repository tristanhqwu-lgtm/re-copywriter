import asyncio
import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User
from schemas import ScrapeRequest, TaskResponse
from services.scraper import scrape_url, detect_platform
from services.task_manager import create_task, update_task

router = APIRouter(prefix="/api/scrape", tags=["scrape"])


async def _do_scrape(task_id: str, url: str):
    try:
        update_task(task_id, status="running", progress=30)
        result = await scrape_url(url)
        update_task(
            task_id,
            status="completed",
            progress=100,
            result=result.to_dict(),
        )
    except Exception as e:
        update_task(task_id, status="failed", error=str(e))


@router.post("/", response_model=TaskResponse)
async def submit_scrape(
    data: ScrapeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Extract URL from share text (e.g. Douyin/Xiaohongshu share messages)
    url = data.url.strip()
    url_match = re.search(r'https?://[^\s\u4e00-\u9fff]+', url)
    if url_match:
        url = url_match.group(0)

    platform = detect_platform(url)
    if not platform:
        raise HTTPException(
            status_code=400,
            detail="Unsupported URL. Only xiaohongshu.com and douyin.com are supported.",
        )
    task = create_task(db, "scrape", current_user.id)
    background_tasks.add_task(_do_scrape, task.id, url)
    return task
