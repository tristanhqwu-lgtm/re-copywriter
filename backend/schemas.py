from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ── Auth ──
class UserRegister(BaseModel):
    username: str
    password: str
    display_name: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Product ──
class ProductCreate(BaseModel):
    name: str
    top_notes: str = ""
    middle_notes: str = ""
    base_notes: str = ""
    price: float = 0
    spec: str = ""
    scenarios: list[str] = []
    brand_story: str = ""
    image_url: str = ""


class ProductUpdate(ProductCreate):
    pass


class ProductResponse(BaseModel):
    id: int
    name: str
    top_notes: str
    middle_notes: str
    base_notes: str
    price: float
    spec: str
    scenarios: list[str]
    brand_story: str
    image_url: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductImportError(BaseModel):
    row: int
    message: str


class ProductImportResponse(BaseModel):
    products: list[ProductResponse]
    errors: list[ProductImportError]


# ── Style ──
class StyleCreate(BaseModel):
    name: str
    description: str = ""


class StyleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class StyleSourceCreate(BaseModel):
    platform: str = "xiaohongshu"
    source_url: str = ""
    source_content: str = ""


class StyleSourceResponse(BaseModel):
    id: int
    style_id: int
    platform: str
    source_url: str
    source_content: str
    created_at: datetime

    class Config:
        from_attributes = True


class StyleResponse(BaseModel):
    id: int
    name: str
    description: str
    style_features: dict
    sources: list[StyleSourceResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StyleListResponse(BaseModel):
    id: int
    name: str
    description: str
    style_features: dict
    source_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# ── Scene ──
class SceneCreate(BaseModel):
    name: str
    type: str = "custom"
    description: str = ""
    keywords: list[str] = []
    prompt_hint: str = ""


class SceneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[list[str]] = None
    prompt_hint: Optional[str] = None


class SceneResponse(BaseModel):
    id: int
    name: str
    type: str
    description: str
    keywords: list[str]
    prompt_hint: str
    is_builtin: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Generate ──
class GenerateRequest(BaseModel):
    product_id: int
    style_id: int
    scene_id: Optional[int] = None
    count: int = 1
    platform: str = "xiaohongshu"


class RefineRequest(BaseModel):
    copy_id: int
    feedback: str


class CopyResponse(BaseModel):
    id: int
    user_id: int
    product_id: int
    style_id: int
    scene_id: Optional[int]
    title: str
    content: str
    hashtags: list[str]
    version: int
    batch_id: str
    is_favorite: bool
    rating: Optional[int]
    created_at: datetime
    product_name: str = ""
    style_name: str = ""
    scene_name: str = ""

    class Config:
        from_attributes = True


class CopyUpdateRequest(BaseModel):
    is_favorite: Optional[bool] = None
    rating: Optional[int] = None


# ── Scrape ──
class ScrapeRequest(BaseModel):
    url: str


class ScrapeResponse(BaseModel):
    title: str = ""
    content: str = ""
    hashtags: list[str] = []
    platform: str = ""


# ── Task ──
class TaskResponse(BaseModel):
    id: str
    type: str
    status: str
    progress: int
    result: Optional[dict] = None
    error: Optional[str] = None

    class Config:
        from_attributes = True
