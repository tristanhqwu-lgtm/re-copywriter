from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import SceneTemplate, User
from schemas import SceneCreate, SceneUpdate, SceneResponse

router = APIRouter(prefix="/api/scenes", tags=["scenes"])


@router.get("/", response_model=list[SceneResponse])
def list_scenes(
    type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(SceneTemplate)
    if type:
        query = query.filter(SceneTemplate.type == type)
    return query.order_by(SceneTemplate.type, SceneTemplate.name).all()


@router.post("/", response_model=SceneResponse, status_code=201)
def create_scene(
    data: SceneCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    scene = SceneTemplate(**data.model_dump(), is_builtin=False)
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return scene


@router.put("/{scene_id}", response_model=SceneResponse)
def update_scene(
    scene_id: int,
    data: SceneUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    scene = db.query(SceneTemplate).filter(SceneTemplate.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.is_builtin:
        raise HTTPException(status_code=400, detail="Cannot edit built-in scene")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(scene, key, value)
    db.commit()
    db.refresh(scene)
    return scene


@router.delete("/{scene_id}")
def delete_scene(
    scene_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    scene = db.query(SceneTemplate).filter(SceneTemplate.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.is_builtin:
        raise HTTPException(status_code=400, detail="Cannot delete built-in scene")
    db.delete(scene)
    db.commit()
    return {"detail": "Scene deleted"}
