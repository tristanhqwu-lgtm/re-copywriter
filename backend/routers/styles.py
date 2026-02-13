from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import StyleTemplate, StyleSource, User
from schemas import (
    StyleCreate, StyleUpdate, StyleResponse, StyleListResponse,
    StyleSourceCreate, StyleSourceResponse,
)

router = APIRouter(prefix="/api/styles", tags=["styles"])


@router.get("/", response_model=list[StyleListResponse])
def list_styles(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    styles = db.query(StyleTemplate).order_by(StyleTemplate.created_at.desc()).all()
    result = []
    for s in styles:
        item = StyleListResponse.model_validate(s)
        item.source_count = len(s.sources)
        result.append(item)
    return result


@router.get("/{style_id}", response_model=StyleResponse)
def get_style(
    style_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    style = db.query(StyleTemplate).filter(StyleTemplate.id == style_id).first()
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    return style


@router.post("/", response_model=StyleResponse)
def create_style(
    data: StyleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    style = StyleTemplate(name=data.name, description=data.description)
    db.add(style)
    db.commit()
    db.refresh(style)
    return style


@router.put("/{style_id}", response_model=StyleResponse)
def update_style(
    style_id: int,
    data: StyleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    style = db.query(StyleTemplate).filter(StyleTemplate.id == style_id).first()
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(style, key, value)
    db.commit()
    db.refresh(style)
    return style


@router.delete("/{style_id}")
def delete_style(
    style_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    style = db.query(StyleTemplate).filter(StyleTemplate.id == style_id).first()
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    db.delete(style)
    db.commit()
    return {"detail": "Style deleted"}


@router.post("/{style_id}/sources", response_model=StyleSourceResponse)
def add_source(
    style_id: int,
    data: StyleSourceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    style = db.query(StyleTemplate).filter(StyleTemplate.id == style_id).first()
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    if not data.source_content and not data.source_url:
        raise HTTPException(
            status_code=400, detail="Either source_content or source_url is required"
        )
    source = StyleSource(
        style_id=style_id,
        platform=data.platform,
        source_url=data.source_url,
        source_content=data.source_content,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@router.delete("/{style_id}/sources/{source_id}")
def delete_source(
    style_id: int,
    source_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    source = db.query(StyleSource).filter(
        StyleSource.id == source_id, StyleSource.style_id == style_id
    ).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()
    return {"detail": "Source deleted"}
