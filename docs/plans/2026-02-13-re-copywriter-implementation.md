# RE调香室 AI文案助手 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Xiaohongshu/Douyin-style perfume marketing copy generation tool for RE调香室's sales team.

**Architecture:** FastAPI backend with SQLite/SQLAlchemy, async task processing via BackgroundTasks + SSE, Playwright for content scraping, Claude Sonnet 4.5 for style analysis and copy generation. React + TypeScript + Vite frontend with Tailwind CSS, mobile-first design.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy, Playwright, Anthropic SDK, React 18, TypeScript, Vite, Tailwind CSS, axios

---

## Phase 1: Backend Foundation

### Task 1: Backend project setup

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/config.py`
- Create: `backend/database.py`
- Create: `backend/main.py`

**Step 1: Create requirements.txt**

```txt
fastapi==0.115.0
uvicorn[standard]==0.32.0
sqlalchemy==2.0.35
pydantic==2.9.0
pydantic-settings==2.5.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.12
anthropic==0.39.0
playwright==1.48.0
httpx==0.27.0
sse-starlette==2.1.0
python-dotenv==1.0.1
```

**Step 2: Create config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./re_copywriter.db"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-5-20250929"
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours

    class Config:
        env_file = ".env"


settings = Settings()
```

**Step 3: Create database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from config import settings

engine = create_engine(
    settings.DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Step 4: Create main.py with health check**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base

app = FastAPI(title="RE调香室 AI文案助手", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "RE调香室 AI文案助手"}
```

**Step 5: Create .env template**

Create `backend/.env.example`:
```
ANTHROPIC_API_KEY=sk-ant-xxxxx
JWT_SECRET=your-secret-key-here
```

**Step 6: Install dependencies and verify**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

**Step 7: Run server and verify health check**

```bash
cd backend
uvicorn main:app --reload --port 8000
# GET http://localhost:8000/api/health -> {"status": "ok", ...}
```

**Step 8: Commit**

```bash
git add backend/
git commit -m "feat: backend project setup with FastAPI, SQLAlchemy, config"
```

---

### Task 2: Database models

**Files:**
- Create: `backend/models.py`

**Step 1: Write all SQLAlchemy models**

```python
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship

from database import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=False)
    role = Column(String(20), default="member")  # admin / member
    created_at = Column(DateTime, default=datetime.utcnow)

    generated_copies = relationship("GeneratedCopy", back_populates="user")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    top_notes = Column(String(255), default="")
    middle_notes = Column(String(255), default="")
    base_notes = Column(String(255), default="")
    price = Column(Float, default=0)
    spec = Column(String(50), default="")
    scenarios = Column(JSON, default=list)
    brand_story = Column(Text, default="")
    image_url = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    generated_copies = relationship("GeneratedCopy", back_populates="product")


class StyleTemplate(Base):
    __tablename__ = "style_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), default="")
    style_features = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sources = relationship(
        "StyleSource", back_populates="style", cascade="all, delete-orphan"
    )
    generated_copies = relationship("GeneratedCopy", back_populates="style")


class StyleSource(Base):
    __tablename__ = "style_sources"

    id = Column(Integer, primary_key=True, index=True)
    style_id = Column(Integer, ForeignKey("style_templates.id"), nullable=False)
    platform = Column(String(20), default="xiaohongshu")  # xiaohongshu / douyin
    source_url = Column(String(500), default="")
    source_content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    style = relationship("StyleTemplate", back_populates="sources")


class SceneTemplate(Base):
    __tablename__ = "scene_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False)  # festival / scene / custom
    description = Column(Text, default="")
    keywords = Column(JSON, default=list)
    prompt_hint = Column(Text, default="")
    is_builtin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    generated_copies = relationship("GeneratedCopy", back_populates="scene")


class GeneratedCopy(Base):
    __tablename__ = "generated_copies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    style_id = Column(Integer, ForeignKey("style_templates.id"), nullable=False)
    scene_id = Column(Integer, ForeignKey("scene_templates.id"), nullable=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    hashtags = Column(JSON, default=list)
    version = Column(Integer, default=1)
    batch_id = Column(String(36), default="")  # group versions from same generation
    is_favorite = Column(Boolean, default=False)
    rating = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="generated_copies")
    product = relationship("Product", back_populates="generated_copies")
    style = relationship("StyleTemplate", back_populates="generated_copies")
    scene = relationship("SceneTemplate", back_populates="generated_copies")


class AsyncTask(Base):
    __tablename__ = "async_tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    type = Column(String(20), nullable=False)  # scrape / analyze / generate
    status = Column(String(20), default="pending")  # pending/running/completed/failed
    progress = Column(Integer, default=0)
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**Step 2: Verify models load and tables create**

```bash
cd backend
python -c "from database import engine, Base; from models import *; Base.metadata.create_all(bind=engine); print('OK')"
```

**Step 3: Commit**

```bash
git add backend/models.py
git commit -m "feat: add all SQLAlchemy database models"
```

---

### Task 3: Pydantic schemas

**Files:**
- Create: `backend/schemas.py`

**Step 1: Write all request/response schemas**

```python
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


# ── Style ──
class StyleCreate(BaseModel):
    name: str
    description: str = ""


class StyleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class StyleSourceCreate(BaseModel):
    platform: str = "xiaohongshu"  # xiaohongshu / douyin
    source_url: str = ""
    source_content: str = ""  # if empty, will scrape from source_url


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
    type: str = "custom"  # festival / scene / custom
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
    count: int = 1  # 1-3 versions


class RefineRequest(BaseModel):
    copy_id: int
    feedback: str  # user's modification instructions


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
```

**Step 2: Commit**

```bash
git add backend/schemas.py
git commit -m "feat: add Pydantic request/response schemas"
```

---

### Task 4: Auth module

**Files:**
- Create: `backend/auth.py`
- Create: `backend/routers/__init__.py`
- Create: `backend/routers/auth.py`
- Modify: `backend/main.py` (add router)

**Step 1: Create auth utilities (JWT + password hashing)**

`backend/auth.py`:
```python
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return user
```

**Step 2: Create auth router**

`backend/routers/__init__.py`: empty file

`backend/routers/auth.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import hash_password, verify_password, create_token, get_current_user
from database import get_db
from models import User
from schemas import UserRegister, UserLogin, UserResponse, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists"
        )
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        display_name=data.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id)
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_token(user.id)
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
```

**Step 3: Register router in main.py**

Add to `backend/main.py`:
```python
from routers import auth

app.include_router(auth.router)
```

**Step 4: Test auth endpoints manually**

```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456","display_name":"Test User"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'
```

**Step 5: Commit**

```bash
git add backend/auth.py backend/routers/
git commit -m "feat: add JWT authentication module with register/login/me"
```

---

### Task 5: Products CRUD router

**Files:**
- Create: `backend/routers/products.py`
- Modify: `backend/main.py` (add router)

**Step 1: Write products router**

`backend/routers/products.py`:
```python
import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Product, User
from schemas import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/", response_model=list[ProductResponse])
def list_products(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Product)
    if search:
        query = query.filter(Product.name.contains(search))
    return query.order_by(Product.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", response_model=ProductResponse)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in data.model_dump().items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"detail": "Product deleted"}


@router.post("/import", response_model=list[ProductResponse])
async def import_products(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Import products from CSV. Expected columns:
    name, top_notes, middle_notes, base_notes, price, spec, scenarios, brand_story, image_url
    """
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    products = []
    for row in reader:
        scenarios = [s.strip() for s in row.get("scenarios", "").split("|") if s.strip()]
        product = Product(
            name=row.get("name", ""),
            top_notes=row.get("top_notes", ""),
            middle_notes=row.get("middle_notes", ""),
            base_notes=row.get("base_notes", ""),
            price=float(row.get("price", 0) or 0),
            spec=row.get("spec", ""),
            scenarios=scenarios,
            brand_story=row.get("brand_story", ""),
            image_url=row.get("image_url", ""),
        )
        db.add(product)
        products.append(product)
    db.commit()
    for p in products:
        db.refresh(p)
    return products
```

**Step 2: Register in main.py**

```python
from routers import auth, products

app.include_router(auth.router)
app.include_router(products.router)
```

**Step 3: Commit**

```bash
git add backend/routers/products.py backend/main.py
git commit -m "feat: add products CRUD with CSV import"
```

---

### Task 6: Styles CRUD router

**Files:**
- Create: `backend/routers/styles.py`
- Modify: `backend/main.py`

**Step 1: Write styles router**

`backend/routers/styles.py`:
```python
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
```

**Step 2: Register in main.py, commit**

```bash
git add backend/routers/styles.py backend/main.py
git commit -m "feat: add style templates CRUD with source management"
```

---

### Task 7: Scenes CRUD router + seed data

**Files:**
- Create: `backend/routers/scenes.py`
- Create: `backend/seed.py`
- Modify: `backend/main.py`

**Step 1: Write scenes router**

`backend/routers/scenes.py`:
```python
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


@router.post("/", response_model=SceneResponse)
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
```

**Step 2: Write seed data**

`backend/seed.py`:
```python
from database import SessionLocal
from models import SceneTemplate


BUILTIN_SCENES = [
    # Festivals
    {
        "name": "情人节",
        "type": "festival",
        "description": "2月14日情人节，浪漫告白、情侣礼物推荐场景",
        "keywords": ["情人节", "浪漫", "告白", "爱情", "礼物", "约会"],
        "prompt_hint": "以情人节浪漫氛围为背景，强调香水作为爱情信物的意义，营造甜蜜心动的感觉",
    },
    {
        "name": "七夕",
        "type": "festival",
        "description": "中国传统情人节，牛郎织女的浪漫传说",
        "keywords": ["七夕", "鹊桥", "浪漫", "中式浪漫", "告白", "爱情"],
        "prompt_hint": "融入中式浪漫元素，以七夕为背景，体现含蓄优雅的东方爱情观",
    },
    {
        "name": "520",
        "type": "festival",
        "description": "网络情人节，谐音我爱你",
        "keywords": ["520", "我爱你", "表白", "甜蜜", "恋爱"],
        "prompt_hint": "以520谐音我爱你为灵感，语气甜蜜活泼，适合年轻情侣",
    },
    {
        "name": "圣诞节",
        "type": "festival",
        "description": "12月25日圣诞节，温馨节日氛围，礼物交换",
        "keywords": ["圣诞", "礼物", "温馨", "冬日", "浪漫", "节日"],
        "prompt_hint": "营造圣诞温馨氛围，强调节日仪式感和送礼场景",
    },
    {
        "name": "母亲节",
        "type": "festival",
        "description": "感恩母亲，送礼表达爱意",
        "keywords": ["母亲节", "感恩", "妈妈", "温柔", "优雅", "礼物"],
        "prompt_hint": "以感恩母亲为主题，语气温柔有情感，强调优雅成熟的香气",
    },
    {
        "name": "新年/春节",
        "type": "festival",
        "description": "农历新年，辞旧迎新，新年新气象",
        "keywords": ["新年", "春节", "焕新", "好运", "开运", "红色"],
        "prompt_hint": "以新年焕新为主题，积极向上，可融入中国红、好运等元素",
    },
    {
        "name": "38女神节",
        "type": "festival",
        "description": "三八妇女节/女神节，女性力量与自我宠爱",
        "keywords": ["女神节", "女性力量", "宠爱自己", "独立", "优雅"],
        "prompt_hint": "以女性独立自信为主题，强调宠爱自己，展现女性魅力",
    },
    # Scenes
    {
        "name": "约会",
        "type": "scene",
        "description": "约会场景，初次见面或浪漫约会",
        "keywords": ["约会", "心动", "初见", "浪漫", "吸引力"],
        "prompt_hint": "以约会场景切入，强调香水带来的吸引力和自信感，描述令人心动的嗅觉印象",
    },
    {
        "name": "职场",
        "type": "scene",
        "description": "办公室/商务场景，专业干练的形象",
        "keywords": ["职场", "办公室", "专业", "干练", "高级感", "通勤"],
        "prompt_hint": "以职场形象为切入点，强调专业感和高级感，适度留香不张扬",
    },
    {
        "name": "送礼",
        "type": "scene",
        "description": "礼物推荐场景，送朋友/闺蜜/伴侣",
        "keywords": ["送礼", "礼物", "闺蜜", "伴侣", "惊喜", "仪式感"],
        "prompt_hint": "以送礼推荐的角度写，强调包装精美、仪式感、适合不同对象",
    },
    {
        "name": "夏日清爽",
        "type": "scene",
        "description": "夏天适用的清新香气，降温消暑",
        "keywords": ["夏天", "清爽", "清新", "降温", "海洋", "柑橘"],
        "prompt_hint": "以炎热夏天为背景，强调香水的清新凉爽感，营造清风拂面的意境",
    },
    {
        "name": "冬日温暖",
        "type": "scene",
        "description": "冬天适用的温暖香气，温暖治愈",
        "keywords": ["冬天", "温暖", "治愈", "木质", "甜暖", "拥抱"],
        "prompt_hint": "以冬日寒冷为背景，强调香水的温暖包裹感，营造被拥抱的治愈感",
    },
    {
        "name": "日常种草",
        "type": "scene",
        "description": "日常好物推荐，种草安利风格",
        "keywords": ["种草", "好物", "推荐", "回购", "必入", "安利"],
        "prompt_hint": "以日常好物分享的口吻，真实自然，强调使用感受和性价比",
    },
    {
        "name": "专业测评",
        "type": "scene",
        "description": "专业角度的香水测评，详细分析香调",
        "keywords": ["测评", "香调", "留香", "扩散", "性价比", "对比"],
        "prompt_hint": "以专业测评角度写，详细描述前中后调变化、留香时间、扩散力等",
    },
]


def seed_scenes():
    db = SessionLocal()
    try:
        existing = db.query(SceneTemplate).filter(
            SceneTemplate.is_builtin == True
        ).count()
        if existing > 0:
            print(f"Built-in scenes already exist ({existing}), skipping seed.")
            return
        for data in BUILTIN_SCENES:
            scene = SceneTemplate(**data, is_builtin=True)
            db.add(scene)
        db.commit()
        print(f"Seeded {len(BUILTIN_SCENES)} built-in scenes.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_scenes()
```

**Step 3: Call seed on startup in main.py**

Add to `main.py` startup:
```python
from seed import seed_scenes

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    seed_scenes()
```

**Step 4: Register scenes router, commit**

```bash
git add backend/routers/scenes.py backend/seed.py backend/main.py
git commit -m "feat: add scenes CRUD with 14 built-in festival/scene templates"
```

---

## Phase 2: Core Services

### Task 8: Async task management + SSE

**Files:**
- Create: `backend/services/__init__.py`
- Create: `backend/services/task_manager.py`
- Create: `backend/routers/tasks.py`
- Modify: `backend/main.py`

**Step 1: Write task manager**

`backend/services/__init__.py`: empty file

`backend/services/task_manager.py`:
```python
import asyncio
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
    """Update task in a new session (for use in background tasks)."""
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
```

**Step 2: Write tasks router with SSE**

`backend/routers/tasks.py`:
```python
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
    _: User = Depends(get_current_user),
):
    task = get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/{task_id}/stream")
async def stream_task(
    task_id: str,
    _: User = Depends(get_current_user),
):
    async def event_generator():
        while True:
            db = SessionLocal()
            try:
                task = db.query(AsyncTask).filter(AsyncTask.id == task_id).first()
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
```

**Step 3: Register, commit**

```bash
git add backend/services/ backend/routers/tasks.py backend/main.py
git commit -m "feat: add async task manager with SSE streaming"
```

---

### Task 9: Scraper service (Playwright)

**Files:**
- Create: `backend/services/scraper.py`
- Create: `backend/routers/scrape.py`
- Modify: `backend/main.py`

**Step 1: Write scraper service**

`backend/services/scraper.py`:
```python
import re
from dataclasses import dataclass

from playwright.async_api import async_playwright


@dataclass
class ScrapeResult:
    title: str = ""
    content: str = ""
    hashtags: list[str] = None
    platform: str = ""

    def __post_init__(self):
        if self.hashtags is None:
            self.hashtags = []

    def to_dict(self):
        return {
            "title": self.title,
            "content": self.content,
            "hashtags": self.hashtags,
            "platform": self.platform,
        }


def detect_platform(url: str) -> str:
    url_lower = url.lower()
    if "xiaohongshu.com" in url_lower or "xhslink.com" in url_lower:
        return "xiaohongshu"
    if "douyin.com" in url_lower:
        return "douyin"
    return ""


async def scrape_url(url: str) -> ScrapeResult:
    platform = detect_platform(url)
    if not platform:
        raise ValueError(f"Unsupported platform URL: {url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                    "Version/16.0 Mobile/15E148 Safari/604.1"
                ),
                viewport={"width": 390, "height": 844},
            )
            page = await context.new_page()
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3000)  # extra wait for dynamic content

            if platform == "xiaohongshu":
                return await _scrape_xiaohongshu(page)
            elif platform == "douyin":
                return await _scrape_douyin(page)
        finally:
            await browser.close()


async def _scrape_xiaohongshu(page) -> ScrapeResult:
    result = ScrapeResult(platform="xiaohongshu")

    # Try to get title
    title_el = await page.query_selector("#detail-title, .title, .note-title")
    if title_el:
        result.title = (await title_el.text_content() or "").strip()

    # Try to get content
    content_el = await page.query_selector(
        "#detail-desc, .desc, .note-text, .content"
    )
    if content_el:
        result.content = (await content_el.text_content() or "").strip()

    # If selectors didn't work, try broader approach
    if not result.content:
        body_text = await page.evaluate("""
            () => {
                const el = document.querySelector('article') ||
                           document.querySelector('.note-container') ||
                           document.querySelector('.content-container');
                return el ? el.innerText : document.body.innerText;
            }
        """)
        result.content = body_text.strip()[:5000]

    # Extract hashtags
    hashtag_els = await page.query_selector_all("a.tag, .hashtag, a[href*='tag']")
    for el in hashtag_els:
        tag_text = (await el.text_content() or "").strip()
        if tag_text:
            result.hashtags.append(tag_text)

    # Also extract hashtags from content via regex
    if result.content:
        found = re.findall(r"#(\S+?)(?:\s|#|$)", result.content)
        for tag in found:
            full_tag = f"#{tag}"
            if full_tag not in result.hashtags:
                result.hashtags.append(full_tag)

    return result


async def _scrape_douyin(page) -> ScrapeResult:
    result = ScrapeResult(platform="douyin")

    # Try to get video description / note content
    desc_el = await page.query_selector(
        ".video-info-detail, .desc, .content, [data-e2e='video-desc']"
    )
    if desc_el:
        result.content = (await desc_el.text_content() or "").strip()

    # Broader fallback
    if not result.content:
        body_text = await page.evaluate("""
            () => {
                const el = document.querySelector('.video-container') ||
                           document.querySelector('main') ||
                           document.querySelector('#app');
                return el ? el.innerText : document.body.innerText;
            }
        """)
        result.content = body_text.strip()[:5000]

    # Title from page title or first line
    result.title = await page.title()

    # Extract hashtags
    hashtag_els = await page.query_selector_all(
        "a.hashtag, a[href*='hashtag'], .hashtag-item"
    )
    for el in hashtag_els:
        tag_text = (await el.text_content() or "").strip()
        if tag_text:
            result.hashtags.append(tag_text)

    if result.content:
        found = re.findall(r"#(\S+?)(?:\s|#|$)", result.content)
        for tag in found:
            full_tag = f"#{tag}"
            if full_tag not in result.hashtags:
                result.hashtags.append(full_tag)

    return result
```

**Step 2: Write scrape router**

`backend/routers/scrape.py`:
```python
import asyncio

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
def submit_scrape(
    data: ScrapeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    platform = detect_platform(data.url)
    if not platform:
        raise HTTPException(
            status_code=400,
            detail="Unsupported URL. Only xiaohongshu.com and douyin.com are supported.",
        )
    task = create_task(db, "scrape")
    background_tasks.add_task(asyncio.ensure_future, _do_scrape(task.id, data.url))
    return task
```

**Step 3: Register, commit**

```bash
git add backend/services/scraper.py backend/routers/scrape.py backend/main.py
git commit -m "feat: add Playwright scraper for Xiaohongshu and Douyin"
```

---

### Task 10: Style analyzer service (Claude API)

**Files:**
- Create: `backend/services/analyzer.py`
- Modify: `backend/routers/styles.py` (add analyze endpoint)

**Step 1: Write analyzer service**

`backend/services/analyzer.py`:
```python
import json

import anthropic

from config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

ANALYZE_PROMPT = """你是一位专业的社交媒体内容分析师。请仔细分析以下博主文章，提取其写作风格特征。

{articles_section}

请用JSON格式输出分析结果，包含以下字段：
{{
  "tone": "语气调性描述（如：活泼俏皮/优雅知性/专业理性/文艺清新等）",
  "vocabulary": ["该博主常用的特色词汇/口头禅，列出5-10个"],
  "sentence_patterns": ["句式特点描述，如：短句为主、多用感叹号、反问句多等，列出3-5个"],
  "emoji_style": "emoji使用风格描述（频率、偏好的emoji类型）",
  "structure": "文章整体结构特点（如：开头hook+中间体验+结尾推荐）",
  "emotional_expression": "情感表达方式（如：感性热情/理性克制/幽默风趣）",
  "title_style": "标题写作风格（如：疑问句式、数字开头、emoji开头等）",
  "paragraph_style": "分段和排版特点",
  "summary": "用2-3句话总结这位博主的整体写作风格，要具体到足以让人模仿"
}}

只输出JSON，不要其他内容。"""


def build_articles_section(articles: list[str]) -> str:
    if len(articles) == 1:
        return f"以下是博主的一篇文章：\n\n{articles[0]}"
    sections = []
    for i, article in enumerate(articles, 1):
        sections.append(f"--- 文章 {i} ---\n{article}")
    return (
        f"以下是同一博主的{len(articles)}篇文章，请综合分析其共性风格特征：\n\n"
        + "\n\n".join(sections)
    )


def analyze_style(articles: list[str]) -> dict:
    articles_section = build_articles_section(articles)
    prompt = ANALYZE_PROMPT.format(articles_section=articles_section)

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    if text.startswith("json"):
        text = text[4:]

    return json.loads(text.strip())
```

**Step 2: Add analyze endpoint to styles router**

Add to `backend/routers/styles.py`:
```python
import asyncio
from fastapi import BackgroundTasks
from services.task_manager import create_task, update_task
from services.analyzer import analyze_style


async def _do_analyze(task_id: str, style_id: int):
    from database import SessionLocal
    db = SessionLocal()
    try:
        update_task(task_id, status="running", progress=20)
        style = db.query(StyleTemplate).filter(StyleTemplate.id == style_id).first()
        if not style or not style.sources:
            update_task(task_id, status="failed", error="No source articles found")
            return

        articles = [s.source_content for s in style.sources if s.source_content]
        if not articles:
            update_task(task_id, status="failed", error="No article content to analyze")
            return

        update_task(task_id, progress=50)
        features = analyze_style(articles)
        style.style_features = features
        db.commit()
        update_task(task_id, status="completed", progress=100, result=features)
    except Exception as e:
        update_task(task_id, status="failed", error=str(e))
    finally:
        db.close()


@router.post("/{style_id}/analyze", response_model=TaskResponse)
def trigger_analyze(
    style_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    style = db.query(StyleTemplate).filter(StyleTemplate.id == style_id).first()
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    if not style.sources:
        raise HTTPException(status_code=400, detail="Add source articles first")
    task = create_task(db, "analyze")
    background_tasks.add_task(asyncio.ensure_future, _do_analyze(task.id, style_id))
    return task
```

**Step 3: Commit**

```bash
git add backend/services/analyzer.py backend/routers/styles.py
git commit -m "feat: add Claude-powered style analysis with multi-article support"
```

---

### Task 11: Copy generator service (Claude API)

**Files:**
- Create: `backend/services/generator.py`
- Create: `backend/routers/generate.py`
- Modify: `backend/main.py`

**Step 1: Write generator service**

`backend/services/generator.py`:
```python
import json
import re

import anthropic

from config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """你是一位顶尖的小红书/社交媒体香水文案写手，为「RE调香室」品牌服务。
你的文案既能精准传达香水的嗅觉体验，又能打动读者的情感。
你熟悉小红书的内容生态，懂得如何创作高互动的种草内容。"""

GENERATE_PROMPT = """请按照以下要求创作{count}个版本的小红书香水文案。

## 写作风格要求
{style_section}

## 产品信息
- 产品名称：{product_name}
- 前调：{top_notes}
- 中调：{middle_notes}
- 后调：{base_notes}
- 价格：{price}
- 规格：{spec}
- 品牌故事：{brand_story}

{scene_section}

## 输出要求
请为每个版本输出以下内容，严格按照JSON数组格式：
[
  {{
    "title": "文案标题（15-25字，必须含emoji，要吸引眼球）",
    "content": "文案正文（300-500字，严格遵循上述风格要求，段落之间用\\n\\n分隔）",
    "hashtags": ["#话题标签1", "#话题标签2", "...（5-8个）"]
  }}
]

{count}个版本之间要有明显差异（不同的切入角度、不同的标题风格）。
只输出JSON数组，不要其他内容。"""

REFINE_PROMPT = """请根据用户反馈，在原文案基础上进行微调。

## 原文案
标题：{original_title}
正文：{original_content}

## 用户修改意见
{feedback}

## 输出要求
请输出修改后的版本，严格按照JSON格式：
{{
  "title": "修改后的标题",
  "content": "修改后的正文",
  "hashtags": ["#话题标签1", "..."]
}}

只输出JSON，不要其他内容。"""


def build_style_section(style_features: dict, sample_texts: list[str]) -> str:
    parts = []
    if style_features:
        parts.append("### 风格特征")
        if style_features.get("tone"):
            parts.append(f"- 语气调性：{style_features['tone']}")
        if style_features.get("vocabulary"):
            vocab = "、".join(style_features["vocabulary"][:10])
            parts.append(f"- 常用词汇：{vocab}")
        if style_features.get("sentence_patterns"):
            patterns = "；".join(style_features["sentence_patterns"])
            parts.append(f"- 句式特点：{patterns}")
        if style_features.get("emoji_style"):
            parts.append(f"- Emoji风格：{style_features['emoji_style']}")
        if style_features.get("structure"):
            parts.append(f"- 文章结构：{style_features['structure']}")
        if style_features.get("emotional_expression"):
            parts.append(f"- 情感表达：{style_features['emotional_expression']}")
        if style_features.get("title_style"):
            parts.append(f"- 标题风格：{style_features['title_style']}")
        if style_features.get("summary"):
            parts.append(f"\n**风格总结**：{style_features['summary']}")

    if sample_texts:
        parts.append("\n### 参考原文（模仿此风格）")
        for i, text in enumerate(sample_texts[:2], 1):
            # Truncate long samples
            truncated = text[:800] + "..." if len(text) > 800 else text
            parts.append(f"**样本{i}**：\n{truncated}")

    return "\n".join(parts)


def build_scene_section(scene_name: str, scene_desc: str, keywords: list[str], prompt_hint: str) -> str:
    if not scene_name:
        return ""
    parts = ["## 场景要求"]
    parts.append(f"- 场景：{scene_name}")
    if scene_desc:
        parts.append(f"- 描述：{scene_desc}")
    if keywords:
        parts.append(f"- 关键词：{'、'.join(keywords)}")
    if prompt_hint:
        parts.append(f"- 写作提示：{prompt_hint}")
    return "\n".join(parts)


def generate_copies(
    style_features: dict,
    sample_texts: list[str],
    product_name: str,
    top_notes: str,
    middle_notes: str,
    base_notes: str,
    price: float,
    spec: str,
    brand_story: str,
    scene_name: str = "",
    scene_desc: str = "",
    scene_keywords: list[str] = None,
    scene_prompt_hint: str = "",
    count: int = 1,
) -> list[dict]:
    style_section = build_style_section(style_features, sample_texts)
    scene_section = build_scene_section(
        scene_name, scene_desc, scene_keywords or [], scene_prompt_hint
    )

    prompt = GENERATE_PROMPT.format(
        count=count,
        style_section=style_section,
        product_name=product_name,
        top_notes=top_notes or "未指定",
        middle_notes=middle_notes or "未指定",
        base_notes=base_notes or "未指定",
        price=f"¥{price}" if price else "未指定",
        spec=spec or "未指定",
        brand_story=brand_story or "暂无",
        scene_section=scene_section,
    )

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    # Strip markdown code fences
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    if text.startswith("json"):
        text = text[4:]

    copies = json.loads(text.strip())
    if isinstance(copies, dict):
        copies = [copies]
    return copies


def refine_copy(original_title: str, original_content: str, feedback: str) -> dict:
    prompt = REFINE_PROMPT.format(
        original_title=original_title,
        original_content=original_content,
        feedback=feedback,
    )

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    if text.startswith("json"):
        text = text[4:]

    return json.loads(text.strip())
```

**Step 2: Write generate router**

`backend/routers/generate.py`:
```python
import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db, SessionLocal
from models import (
    GeneratedCopy, Product, StyleTemplate, SceneTemplate, User
)
from schemas import (
    GenerateRequest, RefineRequest, CopyResponse, CopyUpdateRequest, TaskResponse,
)
from services.generator import generate_copies, refine_copy
from services.task_manager import create_task, update_task

router = APIRouter(prefix="/api/generate", tags=["generate"])


def _copy_to_response(copy: GeneratedCopy) -> dict:
    data = CopyResponse.model_validate(copy).model_dump()
    data["product_name"] = copy.product.name if copy.product else ""
    data["style_name"] = copy.style.name if copy.style else ""
    data["scene_name"] = copy.scene.name if copy.scene else ""
    return data


async def _do_generate(
    task_id: str, user_id: int, product_id: int, style_id: int,
    scene_id: Optional[int], count: int
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
def start_generate(
    data: GenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.count < 1 or data.count > 3:
        raise HTTPException(status_code=400, detail="Count must be 1-3")
    task = create_task(db, "generate")
    background_tasks.add_task(
        asyncio.ensure_future,
        _do_generate(
            task.id, current_user.id, data.product_id, data.style_id,
            data.scene_id, data.count,
        ),
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
def start_refine(
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
    task = create_task(db, "generate")

    async def _do_refine():
        rdb = SessionLocal()
        try:
            update_task(task.id, status="running", progress=30)
            result = refine_copy(copy.title, copy.content, data.feedback)
            update_task(task.id, progress=80)

            new_copy = GeneratedCopy(
                user_id=current_user.id,
                product_id=copy.product_id,
                style_id=copy.style_id,
                scene_id=copy.scene_id,
                title=result.get("title", ""),
                content=result.get("content", ""),
                hashtags=result.get("hashtags", []),
                version=copy.version + 1,
                batch_id=copy.batch_id,
            )
            rdb.add(new_copy)
            rdb.commit()
            update_task(task.id, status="completed", progress=100, result=result)
        except Exception as e:
            update_task(task.id, status="failed", error=str(e))
        finally:
            rdb.close()

    background_tasks.add_task(asyncio.ensure_future, _do_refine())
    return task
```

**Step 3: Register in main.py, final main.py should include all routers:**

```python
from routers import auth, products, styles, scenes, generate, scrape, tasks

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(styles.router)
app.include_router(scenes.router)
app.include_router(generate.router)
app.include_router(scrape.router)
app.include_router(tasks.router)
```

**Step 4: Commit**

```bash
git add backend/services/generator.py backend/routers/generate.py backend/main.py
git commit -m "feat: add AI copy generation with multi-version output and refinement"
```

---

## Phase 3: Frontend

### Task 12: Frontend project setup

**Files:**
- Create: `frontend/` (via Vite scaffold)
- Create: `frontend/tailwind.config.js`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/types/index.ts`

**Step 1: Scaffold React + TypeScript + Vite project**

```bash
cd /Users/whq/re-copywriter
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install axios react-router-dom@6 lucide-react
```

**Step 2: Configure Tailwind**

Update `frontend/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#8B2252",
          light: "#A83279",
          dark: "#6B1A3F",
          50: "#FFF5EE",
          100: "#F5E6CC",
        },
      },
    },
  },
  plugins: [],
};
```

Update `frontend/src/index.css`:
```css
@import "tailwindcss";
```

**Step 3: Configure Vite proxy**

Update `frontend/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

**Step 4: Create TypeScript types**

`frontend/src/types/index.ts`:
```ts
export interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Product {
  id: number;
  name: string;
  top_notes: string;
  middle_notes: string;
  base_notes: string;
  price: number;
  spec: string;
  scenarios: string[];
  brand_story: string;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export interface StyleFeatures {
  tone?: string;
  vocabulary?: string[];
  sentence_patterns?: string[];
  emoji_style?: string;
  structure?: string;
  emotional_expression?: string;
  title_style?: string;
  paragraph_style?: string;
  summary?: string;
}

export interface StyleSource {
  id: number;
  style_id: number;
  platform: string;
  source_url: string;
  source_content: string;
  created_at: string;
}

export interface Style {
  id: number;
  name: string;
  description: string;
  style_features: StyleFeatures;
  sources?: StyleSource[];
  source_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Scene {
  id: number;
  name: string;
  type: string;
  description: string;
  keywords: string[];
  prompt_hint: string;
  is_builtin: boolean;
  created_at: string;
}

export interface GeneratedCopy {
  id: number;
  user_id: number;
  product_id: number;
  style_id: number;
  scene_id: number | null;
  title: string;
  content: string;
  hashtags: string[];
  version: number;
  batch_id: string;
  is_favorite: boolean;
  rating: number | null;
  created_at: string;
  product_name: string;
  style_name: string;
  scene_name: string;
}

export interface AsyncTask {
  id: string;
  type: string;
  status: string;
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
}
```

**Step 5: Create API client**

`frontend/src/api/client.ts`:
```ts
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// SSE helper
export function subscribeTask(
  taskId: string,
  onUpdate: (data: Record<string, unknown>) => void,
  onDone: () => void
): EventSource {
  const token = localStorage.getItem("token");
  const es = new EventSource(`/api/tasks/${taskId}/stream?token=${token}`);
  es.addEventListener("update", (event) => {
    const data = JSON.parse(event.data);
    onUpdate(data);
    if (data.status === "completed" || data.status === "failed") {
      es.close();
      onDone();
    }
  });
  es.addEventListener("error", () => {
    es.close();
    onDone();
  });
  return es;
}
```

**Step 6: Verify dev server starts**

```bash
cd frontend && npm run dev
```

**Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: frontend project setup with React, TypeScript, Vite, Tailwind"
```

---

### Task 13: Layout, routing, and auth pages

**Files:**
- Create: `frontend/src/components/BottomNav.tsx`
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

**Step 1: Create BottomNav component**

`frontend/src/components/BottomNav.tsx`:
```tsx
import { useLocation, useNavigate } from "react-router-dom";
import { PenTool, Palette, Package, Sparkles, User } from "lucide-react";

const tabs = [
  { path: "/", label: "工作台", icon: PenTool },
  { path: "/styles", label: "风格库", icon: Palette },
  { path: "/products", label: "产品库", icon: Package },
  { path: "/scenes", label: "场景库", icon: Sparkles },
  { path: "/profile", label: "我的", icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
      <div className="max-w-[430px] mx-auto flex">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                active ? "text-brand" : "text-gray-400"
              }`}
            >
              <tab.icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
```

**Step 2: Create Layout component**

`frontend/src/components/Layout.tsx`:
```tsx
import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

export default function Layout() {
  return (
    <div className="min-h-screen bg-brand-50 max-w-[430px] mx-auto relative">
      <main className="pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
```

**Step 3: Create Login page**

`frontend/src/pages/Login.tsx`:
```tsx
import { useState } from "react";
import api from "../api/client";
import type { TokenResponse } from "../types";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const body = isRegister
        ? { username, password, display_name: displayName }
        : { username, password };
      const { data } = await api.post<TokenResponse>(endpoint, body);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/";
    } catch (err: any) {
      setError(err.response?.data?.detail || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand">RE调香室</h1>
          <p className="text-gray-500 mt-2">AI文案助手</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-center">
            {isRegister ? "注册" : "登录"}
          </h2>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand"
            required
          />

          {isRegister && (
            <input
              type="text"
              placeholder="显示名称"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand"
              required
            />
          )}

          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {loading ? "处理中..." : isRegister ? "注册" : "登录"}
          </button>

          <p className="text-center text-sm text-gray-500">
            {isRegister ? "已有账号？" : "没有账号？"}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-brand ml-1"
            >
              {isRegister ? "登录" : "注册"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
```

**Step 4: Set up App.tsx with routing**

`frontend/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Workbench from "./pages/Workbench";
import StyleLibrary from "./pages/StyleLibrary";
import ProductLibrary from "./pages/ProductLibrary";
import SceneLibrary from "./pages/SceneLibrary";
import Profile from "./pages/Profile";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Workbench />} />
          <Route path="styles" element={<StyleLibrary />} />
          <Route path="products" element={<ProductLibrary />} />
          <Route path="scenes" element={<SceneLibrary />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 5: Create placeholder pages**

Create stub files for `Workbench.tsx`, `StyleLibrary.tsx`, `ProductLibrary.tsx`, `SceneLibrary.tsx`, `Profile.tsx` — each with a simple heading:

```tsx
// Example: frontend/src/pages/Workbench.tsx
export default function Workbench() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-brand">文案工作台</h1>
      <p className="text-gray-500 mt-2">选择风格、产品和场景，一键生成文案</p>
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: add routing, layout, bottom nav, login page, and placeholder pages"
```

---

### Task 14: Workbench page (core generation flow)

**Files:**
- Create: `frontend/src/pages/Workbench.tsx`

**Step 1: Implement the full Workbench page**

This is the core page with:
- Horizontal scrolling cards to select style, product, and scene
- Generate button with count selector
- Progress animation during generation
- Result cards with copy, favorite, and refine actions

The implementation should:
- Fetch styles, products, scenes on mount
- Use state to track selections
- POST to `/api/generate` and poll task status
- Display results in styled cards
- Support copy-to-clipboard and favorite toggle

**Step 2: Commit**

```bash
git add frontend/src/pages/Workbench.tsx
git commit -m "feat: implement workbench page with full generation flow"
```

---

### Task 15: Style Library page

**Files:**
- Create: `frontend/src/pages/StyleLibrary.tsx`

**Step 1: Implement StyleLibrary page**

Features:
- Style cards list with search
- Add style modal/flow (name → platform select → paste content or link → add more → analyze)
- Style detail view showing analyzed features and source articles
- Delete style, delete source
- Trigger analysis with progress tracking
- Platform icon display (小红书 red, 抖音 blue)

**Step 2: Commit**

```bash
git add frontend/src/pages/StyleLibrary.tsx
git commit -m "feat: implement style library with multi-source analysis flow"
```

---

### Task 16: Product Library page

**Files:**
- Create: `frontend/src/pages/ProductLibrary.tsx`

**Step 1: Implement ProductLibrary page**

Features:
- Product cards with search
- Add/edit product form (all fields)
- CSV import with drag-and-drop
- Product detail modal
- Delete confirmation

**Step 2: Commit**

```bash
git add frontend/src/pages/ProductLibrary.tsx
git commit -m "feat: implement product library with CRUD and CSV import"
```

---

### Task 17: Scene Library page

**Files:**
- Create: `frontend/src/pages/SceneLibrary.tsx`

**Step 1: Implement SceneLibrary page**

Features:
- Two sections: festivals and scenes
- Cards with keyword tags
- Built-in badge (cannot delete)
- Add custom scene form
- Edit/delete custom scenes

**Step 2: Commit**

```bash
git add frontend/src/pages/SceneLibrary.tsx
git commit -m "feat: implement scene library with built-in and custom scenes"
```

---

### Task 18: Profile page (history + settings)

**Files:**
- Create: `frontend/src/pages/Profile.tsx`

**Step 1: Implement Profile page**

Features:
- User info display
- History list with infinite scroll
- Favorites filter toggle
- Copy card: title preview, product name, timestamp
- Copy to clipboard, open detail
- Logout button

**Step 2: Commit**

```bash
git add frontend/src/pages/Profile.tsx
git commit -m "feat: implement profile page with history and favorites"
```

---

## Phase 4: Integration & Polish

### Task 19: End-to-end testing and bug fixes

**Step 1: Start both servers**

```bash
# Terminal 1
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

**Step 2: Test complete flow**

1. Register a new user
2. Add a product manually
3. Add a style with pasted content
4. Trigger style analysis
5. Generate a copy with style + product
6. Verify copy appears in history
7. Test favorite toggle
8. Test copy to clipboard
9. Test CSV import
10. Test link scraping (if network allows)

**Step 3: Fix any issues found, commit**

```bash
git add -A
git commit -m "fix: end-to-end integration fixes"
```

---

### Task 20: Final commit and verification

**Step 1: Add .gitignore**

```
# Python
__pycache__/
*.pyc
venv/
*.db
.env

# Node
node_modules/
dist/
```

**Step 2: Final commit**

```bash
git add -A
git commit -m "chore: add gitignore, final cleanup"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1. Backend Foundation | 1-7 | Project setup, models, schemas, auth, CRUD routers, seed data |
| 2. Core Services | 8-11 | Task manager, SSE, scraper, analyzer, generator |
| 3. Frontend | 12-18 | Project setup, layout, auth, all 5 pages |
| 4. Integration | 19-20 | E2E testing, bug fixes, final cleanup |

**Total: 20 tasks** across 4 phases.
