from fastapi import APIRouter, HTTPException, Response, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from pathlib import Path
import json
import datetime
import pandas as pd
from app.api.eda import ACTIVE_DATASET
from app.core.eda_profiler import EDAProfiler
from app.core.statistical_engine import StatisticalEngine
from app.core.report_generator import ReportGenerator
from app.core.rag_engine import rag_engine
from app.core.claim_validator import ClaimValidator
from app.core.llm_service import LLMService
from app.core.docx_template_engine import DocxTemplateEngine
from app.core.adaptive_report_engine import AdaptiveReportEngine
from app.config import REPORTS_DIR, UPLOAD_DIR, GEMINI_API_KEY

router = APIRouter(prefix="/api/report", tags=["Academic Report Generation & Human Validation"])

# Session store for active research report
CURRENT_REPORT = {
    "data": None
}


class TemplateModel(BaseModel):
    id: Optional[str] = None
    name: str
    version: Optional[str] = "v1.0"
    category: Optional[str] = "Custom User"
    description: Optional[str] = ""
    content: str


@router.get("/templates")
async def list_templates():
    """Returns standard pre-configured templates plus any user-saved custom templates."""
    return {
        "status": "success",
        "templates": ReportGenerator.get_templates()
    }


@router.post("/templates")
async def create_or_update_template(tpl: TemplateModel):
    """Saves a new custom template version to disk."""
    saved = ReportGenerator.save_custom_template(tpl.dict())
    return {
        "status": "success",
        "message": f"Template '{saved.get('name')}' saved successfully.",
        "template": saved
    }


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    """Deletes a custom template version by ID."""
    success = ReportGenerator.delete_custom_template(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found or default template cannot be deleted.")
    return {
        "status": "success",
        "message": f"Template '{template_id}' deleted successfully."
    }


class GenerateReportRequest(BaseModel):
    title: Optional[str] = None
    researcher_name: Optional[str] = "Lead Lab Researcher"
    professor_template: Optional[str] = "Standard Empirical Research Report"
    custom_template_content: Optional[str] = None
    template_name: Optional[str] = None
    selected_tests: Optional[List[Dict[str, Any]]] = None
    custom_notes: Optional[str] = ""
    attached_charts: Optional[List[Dict[str, Any]]] = None
    data_rows: Optional[List[Dict[str, Any]]] = None
    filename: Optional[str] = None
    objective: Optional[str] = None


@router.post("/generate")
async def generate_draft_report(req: GenerateReportRequest):
    df = ACTIVE_DATASET.get("df")
    if df is None and req.data_rows and len(req.data_rows) > 0:
        df = pd.DataFrame(req.data_rows)
        ACTIVE_DATASET["df"] = df
        ACTIVE_DATASET["filename"] = req.filename or "Uploaded Research Dataset"
        ACTIVE_DATASET["objective"] = req.objective or "Quantitative Research Evaluation"

    if df is None:
        raise HTTPException(status_code=400, detail="No active dataset loaded.")

    objective = req.objective or ACTIVE_DATASET.get("objective") or "Quantitative Research Evaluation"
    eda_summary = EDAProfiler.profile_dataset(df)
    eda_summary["filename"] = req.filename or ACTIVE_DATASET.get("filename") or "Uploaded Research Dataset"

    # Compute statistical tests
    computed_tests = _compute_statistical_tests(df, objective, req.selected_tests)

    # Retrieve relevant RAG guidelines
    rag_context = rag_engine.retrieve_relevant_context(objective + " APA reporting")

    # Determine template content for adaptive reasoning
    template_content = req.custom_template_content or ""
    template_name = req.template_name or req.professor_template or "Standard Empirical Research Report"
    if not template_content:
        all_tpls = ReportGenerator.get_templates()
        matched = next((t for t in all_tpls if t.get("name") == template_name or t.get("id") == template_name), None)
        if matched:
            template_content = matched.get("content", "")

    # Use ADAPTIVE Gemini pipeline if API key is configured
    has_gemini = bool(GEMINI_API_KEY and GEMINI_API_KEY.strip() and GEMINI_API_KEY != "YOUR_GEMINI_API_KEY_HERE")
    if has_gemini:
        try:
            report_data = await AdaptiveReportEngine.generate_adaptive_report(
                df=df,
                eda_summary=eda_summary,
                statistical_results=computed_tests,
                rag_context=rag_context,
                research_objective=objective,
                researcher_name=req.researcher_name or "Lead Researcher",
                template_content=template_content,
                template_name=template_name,
                human_notes=req.custom_notes or "",
                attached_charts=req.attached_charts,
                title=req.title or ""
            )
            CURRENT_REPORT["data"] = report_data
            return report_data
        except Exception as e:
            print(f"[ResAI] Adaptive pipeline error, falling back to standard: {e}")

    # Fallback: Standard template-based report
    report_data = ReportGenerator.construct_academic_report(
        title=req.title,
        research_objective=objective,
        eda_summary=eda_summary,
        statistical_results=computed_tests,
        rag_context=rag_context,
        researcher_name=req.researcher_name,
        professor_template=template_name,
        human_notes=req.custom_notes,
        attached_charts=req.attached_charts,
        custom_template_content=req.custom_template_content,
        df=df
    )

    CURRENT_REPORT["data"] = report_data
    return report_data


def _compute_statistical_tests(df, objective: str, selected_tests=None) -> list:
    """Computes statistical tests from user selections or auto-recommendations."""
    computed = []
    if selected_tests and len(selected_tests) > 0:
        for t in selected_tests:
            t_type = t.get("test")
            p = t.get("params", {})
            try:
                res = _run_single_test(df, t_type, p)
                if res and "error" not in res:
                    computed.append(res)
            except Exception:
                pass

    if not computed:
        recs = StatisticalEngine.auto_recommend_analysis(df, objective)
        for r in recs[:3]:
            try:
                res = _run_single_test(df, r.get("test"), r.get("params", {}))
                if res and "error" not in res:
                    computed.append(res)
            except Exception:
                pass

    return computed


def _run_single_test(df, t_type: str, params: dict):
    """Runs a single statistical test and returns the result."""
    if t_type == "two_sample_test":
        return StatisticalEngine.two_sample_test(df, params["continuous_col"], params["group_col"])
    elif t_type == "anova_test":
        return StatisticalEngine.anova_test(df, params["continuous_col"], params["group_col"])
    elif t_type == "chi_square_test":
        return StatisticalEngine.chi_square_test(df, params["var1"], params["var2"])
    elif t_type == "linear_regression":
        return StatisticalEngine.linear_regression(df, params["target_col"], params["feature_cols"])
    elif t_type == "correlation_analysis":
        return StatisticalEngine.calculate_correlations(df, params.get("method", "pearson"))
    return None



class AutoPipelineRequest(BaseModel):
    title: Optional[str] = None
    researcher_name: Optional[str] = "Lead Lab Researcher"
    professor_template: Optional[str] = "Standard Empirical Research Report"
    llm_provider: Optional[str] = "offline"


@router.post("/auto-pipeline")
async def run_auto_pipeline(req: Optional[AutoPipelineRequest] = None):
    """Executes automated end-to-end data analysis, recommended tests, and drafts report."""
    df = ACTIVE_DATASET.get("df")
    if df is None:
        raise HTTPException(status_code=400, detail="No active dataset loaded.")

    gen_req = GenerateReportRequest(
        title=req.title if req and req.title else "",
        researcher_name=req.researcher_name if req and req.researcher_name else "Lead Lab Researcher",
        professor_template=req.professor_template if req and req.professor_template else "Standard Empirical Research Report"
    )
    report_data = await generate_draft_report(gen_req)
    return {
        "status": "success",
        "message": "Automated pipeline executed successfully.",
        "report": report_data,
        "is_adaptive": report_data.get("is_adaptive", False),
        "domain_detected": report_data.get("domain_detected", ""),
        "executed_tests": report_data.get("results", [])
    }


@router.get("/adaptive-plan")
async def get_adaptive_plan():
    """Returns the adaptive report plan from the last generated report."""
    if CURRENT_REPORT["data"] is None:
        return {"status": "empty", "message": "No report generated yet."}
    plan = CURRENT_REPORT["data"].get("adaptive_plan")
    validation = CURRENT_REPORT["data"].get("llm_validation")
    return {
        "status": "success",
        "is_adaptive": CURRENT_REPORT["data"].get("is_adaptive", False),
        "domain_detected": CURRENT_REPORT["data"].get("domain_detected", ""),
        "plan": plan,
        "validation": validation
    }


@router.get("/current")
async def get_current_report():
    if CURRENT_REPORT["data"] is None:
        return {"status": "empty", "message": "No draft report generated yet."}
    return CURRENT_REPORT["data"]


class HumanValidationRequest(BaseModel):
    validation_status: str  # 'VERIFIED_BY_RESEARCHER' or 'APPROVED_FOR_PUBLICATION' or 'DRAFT_PENDING_REVIEW'
    human_notes: str
    edited_abstract: Optional[str] = None
    edited_discussion: Optional[str] = None
    edited_conclusions: Optional[str] = None


@router.post("/validate")
async def update_human_validation(req: HumanValidationRequest):
    """Human-in-the-loop sign-off and custom revisions."""
    if CURRENT_REPORT["data"] is None:
        raise HTTPException(status_code=400, detail="No active draft report to validate.")

    report = CURRENT_REPORT["data"]
    report["validation_status"] = req.validation_status
    report["human_notes"] = req.human_notes

    if req.edited_abstract:
        report["abstract"] = req.edited_abstract
    if req.edited_discussion:
        report["discussion"] = req.edited_discussion
    if req.edited_conclusions:
        report["conclusions"] = req.edited_conclusions

    return {
        "status": "success",
        "message": f"Report validation status updated to '{req.validation_status}'",
        "report": report
    }


@router.get("/export-docx")
async def export_docx():
    if CURRENT_REPORT["data"] is None:
        raise HTTPException(status_code=400, detail="No active draft report to export.")

    report_id = CURRENT_REPORT["data"].get("report_id", "report")
    docx_path = REPORTS_DIR / f"{report_id}.docx"
    ReportGenerator.export_to_docx(CURRENT_REPORT["data"], docx_path)

    return FileResponse(
        path=docx_path,
        filename=f"Research_Report_{report_id}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


@router.get("/export-markdown")
async def export_markdown():
    if CURRENT_REPORT["data"] is None:
        raise HTTPException(status_code=400, detail="No active draft report to export.")

    r = CURRENT_REPORT["data"]
    if (r.get("is_custom_template") or r.get("is_adaptive")) and r.get("rendered_content"):
        return Response(
            content=r.get("rendered_content"),
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=Report_{r.get('report_id')}.md"}
        )

    md = f"""# {r.get('title')}
**Author:** {r.get('researcher_name')} | **Date:** {r.get('date')} | **Status:** {r.get('validation_status')}

---

## Abstract
{r.get('abstract')}

## 1. Introduction & Research Objectives
{r.get('introduction')}

## 2. Methodology & Data Preprocessing
{r.get('methodology')}

## 3. Statistical Analysis & Hypothesis Testing
"""
    for res in r.get('results', []):
        md += f"\n### {res.get('title')}\n{res.get('narrative')}\n"

    md += f"""
## 4. Discussion & Interpretation
{r.get('discussion')}

## 5. Limitations & Threats to Validity
{r.get('limitations')}

## 6. Conclusion & Recommendations
{r.get('conclusions')}

---
**Researcher Validation Sign-Off:**
{r.get('human_notes', 'Pending final verification')}
"""
    return Response(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=Report_{r.get('report_id')}.md"}
    )


@router.get("/export-html")
async def export_html():
    if CURRENT_REPORT["data"] is None:
        raise HTTPException(status_code=400, detail="No active draft report to export.")

    r = CURRENT_REPORT["data"]
    results_html = ""
    for res in r.get('results', []):
        results_html += f"""
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f8fafc; border-left: 4px solid #2563eb; border-radius: 4px;">
            <h3 style="color: #1e3a8a; margin-top: 0;">{res.get('title')}</h3>
            <p>{res.get('narrative', '').replace('**', '')}</p>
        </div>
        """

    charts_html = ""
    if r.get('attached_charts'):
        charts_html = "<h2>Attached Scientific Visualizations</h2><ul>"
        for idx, ch in enumerate(r['attached_charts'], 1):
            charts_html += f"<li><strong>Figure {idx}:</strong> {ch.get('title')} [{ch.get('chart_type')}]</li>"
        charts_html += "</ul>"

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{r.get('title')}</title>
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #1e293b; }}
        h1 {{ color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }}
        h2 {{ color: #1e40af; margin-top: 2rem; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }}
        .meta {{ font-style: italic; color: #64748b; margin-bottom: 2rem; }}
        .abstract {{ background: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem 1.25rem; border-radius: 4px; font-style: italic; }}
        .signoff {{ background: #f0fdf4; border: 1px solid #86efac; padding: 1rem; border-radius: 6px; margin-top: 2rem; }}
    </style>
</head>
<body>
    <h1>{r.get('title')}</h1>
    <div class="meta"><strong>Author:</strong> {r.get('researcher_name')} &bull; <strong>Date:</strong> {r.get('date')} &bull; <strong>Status:</strong> {r.get('validation_status')}</div>

    <h2>Abstract</h2>
    <div class="abstract">{r.get('abstract')}</div>

    <h2>1. Introduction & Research Objectives</h2>
    <p>{r.get('introduction')}</p>

    <h2>2. Data Quality & Preprocessing Methodology</h2>
    <p>{r.get('methodology')}</p>

    <h2>3. Statistical Analysis & Hypothesis Testing</h2>
    {results_html}

    {charts_html}

    <h2>4. Discussion & Interpretation</h2>
    <p>{r.get('discussion')}</p>

    <h2>5. Limitations & Threats to Validity</h2>
    <p>{r.get('limitations')}</p>

    <h2>6. Conclusion & Recommendations</h2>
    <p>{r.get('conclusions')}</p>

    <div class="signoff">
        <strong>Researcher Validation Sign-Off:</strong><br>
        {r.get('human_notes', 'Verified by Principal Investigator')}
    </div>
</body>
</html>"""

    return Response(
        content=html_content,
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename=Report_{r.get('report_id')}.html"}
    )


@router.get("/llm-status")
async def get_llm_status():
    """Returns Gemini AI intelligence layer status and configuration."""
    status = await LLMService.get_ollama_status()
    gemini_cfg = LLMService.get_gemini_config()
    status["gemini"] = gemini_cfg
    return status


@router.get("/gemini-config")
async def get_gemini_config():
    """Returns current Gemini API configuration (key masked)."""
    return LLMService.get_gemini_config()


class GeminiInterpretRequest(BaseModel):
    prompt: str
    statistical_schema: Dict[str, Any]
    model: Optional[str] = None


@router.post("/gemini-interpret")
async def gemini_interpret(req: GeminiInterpretRequest):
    """Executes Gemini grounded narrative synthesis for the given prompt and facts."""
    interpretation = await LLMService.generate_grounded_interpretation(
        prompt=req.prompt,
        statistical_schema=req.statistical_schema,
        provider="gemini",
        model=req.model
    )
    return {
        "status": "success",
        "interpretation": interpretation,
        "engine": "gemini" if LLMService.get_gemini_config()["available"] else "deterministic"
    }


class ValidateClaimsRequest(BaseModel):
    report_text: str


@router.post("/validate-claims")
async def validate_narrative_claims(req: ValidateClaimsRequest):
    """
    Audits narrative text against active dataset ground-truth computations,
    flagging ungrounded p-values, altered statistics, or hallucinated numbers.
    """
    df = ACTIVE_DATASET.get("df")
    if df is None:
        raise HTTPException(status_code=400, detail="No active dataset loaded.")

    eda_summary = EDAProfiler.profile_dataset(df)
    summary_stats = StatisticalEngine.get_summary_statistics(df)
    statistical_results = []
    if CURRENT_REPORT["data"] and "results" in CURRENT_REPORT["data"]:
        statistical_results = [r.get("raw_data") for r in CURRENT_REPORT["data"]["results"] if r.get("raw_data")]

    audit = ClaimValidator.audit_report_text(
        report_text=req.report_text,
        eda_summary=eda_summary,
        statistical_results=statistical_results,
        summary_stats=summary_stats
    )
    return {
        "status": "success",
        "audit": audit.model_dump() if hasattr(audit, "model_dump") else audit.dict()
    }


@router.post("/upload-template")
async def upload_custom_template(file: UploadFile = File(...)):
    """Uploads and parses a custom DOCX or Markdown report template."""
    filename = file.filename or "custom_template.docx"
    ext = Path(filename).suffix.lower()

    if ext not in [".docx", ".md", ".txt"]:
        raise HTTPException(status_code=400, detail="Only .docx, .md, and .txt templates are supported.")

    content_bytes = await file.read()
    template_id = f"tpl_{int(datetime.datetime.now().timestamp())}"

    if ext == ".docx":
        # Save temporary template file
        save_path = REPORTS_DIR / f"{template_id}_{filename}"
        with open(save_path, "wb") as f:
            f.write(content_bytes)

        # Parse text from DOCX
        try:
            from docx import Document
            doc = Document(save_path)
            extracted_text = "\n\n".join([p.text for p in doc.paragraphs if p.text.strip()])
            tpl_obj = ReportGenerator.save_custom_template({
                "id": template_id,
                "name": f"Uploaded DOCX: {filename}",
                "category": "Uploaded DOCX",
                "description": f"Custom template parsed from {filename}",
                "content": extracted_text
            })
            return {"status": "success", "template": tpl_obj}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse DOCX template: {str(e)}")
    else:
        # Plain text / Markdown
        text = content_bytes.decode("utf-8", errors="replace")
        tpl_obj = ReportGenerator.save_custom_template({
            "id": template_id,
            "name": f"Uploaded Outline: {filename}",
            "category": "Uploaded Outline",
            "description": f"Custom template parsed from {filename}",
            "content": text
        })
        return {"status": "success", "template": tpl_obj}
