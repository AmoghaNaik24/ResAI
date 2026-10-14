from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from app.config import STATIC_DIR, TEMPLATES_DIR, APP_TITLE, VERSION
from app.api.eda import router as eda_router
from app.api.analysis import router as analysis_router
from app.api.report import router as report_router
from app.api.rag import router as rag_router

app = FastAPI(
    title=APP_TITLE,
    version=VERSION,
    description="Precision AI-Assisted Research Data Analysis, Hypothesis Testing, and Reporting Platform"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static and Templates
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# Include API Routers
app.include_router(eda_router)
app.include_router(analysis_router)
app.include_router(report_router)
app.include_router(rag_router)


@app.get("/")
async def render_home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "app_title": APP_TITLE})


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": APP_TITLE,
        "version": VERSION
    }
