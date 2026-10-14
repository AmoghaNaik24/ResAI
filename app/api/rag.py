# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Form, HTTPException
from app.core.rag_engine import rag_engine

router = APIRouter(prefix="/api/rag", tags=["RAG & Methodology Knowledge Base"])


@router.get("/documents")
async def list_rag_documents():
    """List all indexed laboratory guidelines, papers, and templates."""
    return rag_engine.list_documents()


@router.post("/upload-guideline")
async def upload_guideline(
    title: str = Form(...),
    category: str = Form("Lab Protocol"),
    content: str = Form(...)
):
    """Add a new methodology guideline or professor template to the knowledge base."""
    if not title.strip() or not content.strip():
        raise HTTPException(status_code=400, detail="Title and content are required.")

    doc = rag_engine.add_document(title=title, content=content, category=category)
    return {
        "status": "success",
        "message": f"Successfully indexed '{title}' into knowledge base.",
        "document": doc
    }


@router.get("/query")
async def query_knowledge_base(q: str):
    """Retrieve methodology context matching a specific search query."""
    return rag_engine.retrieve_relevant_context(q)
