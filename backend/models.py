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

    sources = relationship("StyleSource", back_populates="style", cascade="all, delete-orphan")
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
    batch_id = Column(String(36), default="")
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
