from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models  # noqa: F401 - ensure all models are registered with Base.metadata
from routers import auth, products, styles, scenes, scrape, tasks
from seed import seed_scenes

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
    seed_scenes()


app.include_router(auth.router)
app.include_router(products.router)
app.include_router(styles.router)
app.include_router(scenes.router)
app.include_router(scrape.router)
app.include_router(tasks.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "RE调香室 AI文案助手"}
