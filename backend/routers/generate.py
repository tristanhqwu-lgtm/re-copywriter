import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db, SessionLocal
from models import GeneratedCopy, Product, StyleTemplate, SceneTemplate, User
from schemas import (
    GenerateRequest, RefineRequest, CopyResponse, CopyUpdateRequest, TaskResponse,
)
from services.generator import generate_copies, refine_copy
from services.task_manager import create_task, update_task

router = APIRouter(prefix="/api/generate", tags=["generate"])


def _copy_to_response(copy: GeneratedCopy) -> dict:
    data = {
        "id": copy.id,
        "user_id": copy.user_id,
        "product_id": copy.product_id,
        "style_id": copy.style_id,
        "scene_id": copy.scene_id,
        "title": copy.title,
        "content": copy.content,
        "hashtags": copy.hashtags or [],
        "version": copy.version,
        "batch_id": copy.batch_id or "",
        "is_favorite": copy.is_favorite,
        "rating": copy.rating,
        "created_at": copy.created_at,
        "product_name": copy.product.name if copy.product else "",
        "style_name": copy.style.name if copy.style else "",
        "scene_name": copy.scene.name if copy.scene else "",
    }
    return data


async def _do_generate(
    task_id: str, user_id: int, product_id: int, style_id: int,
    scene_id: Optional[int], count: int, platform: str = "xiaohongshu",
    model_choice: str = "gemini",
):
    db = SessionLocal()
    try:
        update_task(task_id, status="running", progress=10)

        product = db.query(Product).filter(Product.id == product_id).first()
        style = db.query(StyleTemplate).filter(StyleTemplate.id == style_id).first()
        scene = None
        if scene_id:
            scene = db.query(SceneTemplate).filter(SceneTemplate.id == scene_id).first()

        if not product or not style:
            update_task(task_id, status="failed", error="Product or style not found")
            return

        sample_texts = [s.source_content for s in style.sources if s.source_content][:2]

        update_task(task_id, progress=30)

        copies_data = generate_copies(
            style_features=style.style_features or {},
            sample_texts=sample_texts,
            product_name=product.name,
            top_notes=product.top_notes,
            middle_notes=product.middle_notes,
            base_notes=product.base_notes,
            price=product.price,
            spec=product.spec,
            brand_story=product.brand_story,
            scene_name=scene.name if scene else "",
            scene_desc=scene.description if scene else "",
            scene_keywords=scene.keywords if scene else [],
            scene_prompt_hint=scene.prompt_hint if scene else "",
            count=count,
            platform=platform,
            model_choice=model_choice,
        )

        update_task(task_id, progress=80)

        batch_id = str(uuid.uuid4())
        result_copies = []
        for i, copy_data in enumerate(copies_data, 1):
            copy = GeneratedCopy(
                user_id=user_id,
                product_id=product_id,
                style_id=style_id,
                scene_id=scene_id,
                title=copy_data.get("title", ""),
                content=copy_data.get("content", ""),
                hashtags=copy_data.get("hashtags", []),
                version=i,
                batch_id=batch_id,
            )
            db.add(copy)
            result_copies.append(copy_data)

        db.commit()

        update_task(
            task_id,
            status="completed",
            progress=100,
            result={"batch_id": batch_id, "copies": result_copies},
        )
    except Exception as e:
        update_task(task_id, status="failed", error=str(e))
    finally:
        db.close()


@router.post("/", response_model=TaskResponse)
async def start_generate(
    data: GenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.count < 1 or data.count > 3:
        raise HTTPException(status_code=400, detail="Count must be 1-3")
    task = create_task(db, "generate", current_user.id)
    background_tasks.add_task(
        _do_generate,
        task.id, current_user.id, data.product_id, data.style_id,
        data.scene_id, data.count, data.platform, data.model,
    )
    return task


@router.get("/history", response_model=list[CopyResponse])
def list_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    favorites_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(GeneratedCopy).filter(
        GeneratedCopy.user_id == current_user.id
    )
    if favorites_only:
        query = query.filter(GeneratedCopy.is_favorite == True)
    copies = query.order_by(GeneratedCopy.created_at.desc()).offset(skip).limit(limit).all()
    return [_copy_to_response(c) for c in copies]


@router.get("/history/{copy_id}", response_model=CopyResponse)
def get_copy(
    copy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    copy = db.query(GeneratedCopy).filter(
        GeneratedCopy.id == copy_id, GeneratedCopy.user_id == current_user.id
    ).first()
    if not copy:
        raise HTTPException(status_code=404, detail="Copy not found")
    return _copy_to_response(copy)


@router.put("/history/{copy_id}", response_model=CopyResponse)
def update_copy(
    copy_id: int,
    data: CopyUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    copy = db.query(GeneratedCopy).filter(
        GeneratedCopy.id == copy_id, GeneratedCopy.user_id == current_user.id
    ).first()
    if not copy:
        raise HTTPException(status_code=404, detail="Copy not found")
    if data.is_favorite is not None:
        copy.is_favorite = data.is_favorite
    if data.rating is not None:
        copy.rating = data.rating
    db.commit()
    db.refresh(copy)
    return _copy_to_response(copy)


@router.post("/refine", response_model=TaskResponse)
async def start_refine(
    data: RefineRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    copy = db.query(GeneratedCopy).filter(
        GeneratedCopy.id == data.copy_id, GeneratedCopy.user_id == current_user.id
    ).first()
    if not copy:
        raise HTTPException(status_code=404, detail="Copy not found")
    task = create_task(db, "generate", current_user.id)

    copy_title = copy.title
    copy_content = copy.content
    copy_product_id = copy.product_id
    copy_style_id = copy.style_id
    copy_scene_id = copy.scene_id
    copy_version = copy.version
    copy_batch_id = copy.batch_id
    user_id = current_user.id
    model_choice = data.model

    async def _do_refine():
        rdb = SessionLocal()
        try:
            update_task(task.id, status="running", progress=30)
            result = refine_copy(
                copy_title, copy_content, data.feedback,
                model_choice=model_choice,
            )
            update_task(task.id, progress=80)

            new_copy = GeneratedCopy(
                user_id=user_id,
                product_id=copy_product_id,
                style_id=copy_style_id,
                scene_id=copy_scene_id,
                title=result.get("title", ""),
                content=result.get("content", ""),
                hashtags=result.get("hashtags", []),
                version=copy_version + 1,
                batch_id=copy_batch_id,
            )
            rdb.add(new_copy)
            rdb.commit()
            update_task(task.id, status="completed", progress=100, result=result)
        except Exception as e:
            update_task(task.id, status="failed", error=str(e))
        finally:
            rdb.close()

    background_tasks.add_task(_do_refine)
    return task
