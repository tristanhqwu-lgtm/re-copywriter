from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import engine, Base
import models  # noqa: F401 - ensure all models are registered with Base.metadata
from routers import auth, products, styles, scenes, scrape, tasks, generate
from seed import seed_scenes

app = FastAPI(title="RE调香室 AI文案助手", version="1.0.0")

origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    if settings.JWT_SECRET == "change-me-in-production":
        print("WARNING: JWT_SECRET is using the default value. Set a secure secret in production.")
    Base.metadata.create_all(bind=engine)
    seed_scenes()


app.include_router(auth.router)
app.include_router(products.router)
app.include_router(styles.router)
app.include_router(scenes.router)
app.include_router(scrape.router)
app.include_router(tasks.router)
app.include_router(generate.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "RE调香室 AI文案助手"}

# Serve frontend static files
import os
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
