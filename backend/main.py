from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models  # noqa: F401 - ensure all models are registered with Base.metadata
from routers import auth

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


app.include_router(auth.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "RE调香室 AI文案助手"}
