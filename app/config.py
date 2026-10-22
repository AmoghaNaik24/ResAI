import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
# Load .env file from workspace root
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
METHODOLOGY_DIR = DATA_DIR / "methodology"
REPORTS_DIR = DATA_DIR / "reports"
TEMPLATES_DIR = BASE_DIR / "app" / "templates"
STATIC_DIR = BASE_DIR / "app" / "static"

for directory in [UPLOAD_DIR, METHODOLOGY_DIR, REPORTS_DIR, STATIC_DIR, TEMPLATES_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

APP_TITLE = "ResAI - Research Data Analysis & Reporting Platform"
VERSION = "1.0.0"

# Gemini Intelligence Layer Settings
DEFAULT_LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")  # 'gemini', 'offline'
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
