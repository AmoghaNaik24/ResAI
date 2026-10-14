from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from pathlib import Path
import json
from app.api.eda import ACTIVE_DATASET
from app.core.eda_profiler import EDAProfiler
from app.core.statistical_engine import StatisticalEngine
from app.core.report_generator import ReportGenerator
from app.core.rag_engine import rag_engine
from app.config import REPORTS_DIR

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


@router.post("/generate")
async def generate_draft_report(req: GenerateReportRequest):
    df = ACTIVE_DATASET.get("df")
    if df is None:
        raise HTTPException(status_code=400, detail="No active dataset loaded.")

    objective = ACTIVE_DATASET.get("objective", "Quantitative Research Evaluation")
    eda_summary = EDAProfiler.profile_dataset(df)
    eda_summary["filename"] = ACTIVE_DATASET.get("filename") or "Uploaded Research Dataset"

    # If user provided specific tests, use them; otherwise automatically compute recommended tests
    computed_tests = []
    if req.selected_tests and len(req.selected_tests) > 0:
        for t in req.selected_tests:
            t_type = t.get("test")
            p = t.get("params", {})
            try:
                if t_type == "two_sample_test":
                    res = StatisticalEngine.two_sample_test(df, p["continuous_col"], p["group_col"])
                elif t_type == "anova_test":
                    res = StatisticalEngine.anova_test(df, p["continuous_col"], p["group_col"])
                elif t_type == "chi_square_test":
                    res = StatisticalEngine.chi_square_test(df, p["var1"], p["var2"])
                elif t_type == "linear_regression":
                    res = StatisticalEngine.linear_regression(df, p["target_col"], p["feature_cols"])
                elif t_type == "correlation_analysis":
                    res = StatisticalEngine.calculate_correlations(df, p.get("method", "pearson"))
                else:
                    res = None

                if res and "error" not in res:
                    computed_tests.append(res)
            except Exception:
                pass

    # If no tests were provided or computed, run automated recommendations
    if not computed_tests:
        recs = StatisticalEngine.auto_recommend_analysis(df, objective)
        for r in recs[:3]:
            t_type = r.get("test")
            p = r.get("params", {})
            try:
                if t_type == "two_sample_test":
                    res = StatisticalEngine.two_sample_test(df, p["continuous_col"], p["group_col"])
                elif t_type == "anova_test":
                    res = StatisticalEngine.anova_test(df, p["continuous_col"], p["group_col"])
                elif t_type == "linear_regression":
                    res = StatisticalEngine.linear_regression(df, p["target_col"], p["feature_cols"])
                elif t_type == "correlation_analysis":
                    res = StatisticalEngine.calculate_correlations(df, p.get("method", "pearson"))
                elif t_type == "chi_square_test":
                    res = StatisticalEngine.chi_square_test(df, p["var1"], p["var2"])
                else:
                    res = None

                if res and "error" not in res:
                    computed_tests.append(res)
            except Exception:
                pass

    # Retrieve relevant RAG guidelines
    rag_context = rag_engine.retrieve_relevant_context(objective + " APA reporting")

    report_data = ReportGenerator.construct_academic_report(
        title=req.title,
        research_objective=objective,
        eda_summary=eda_summary,
        statistical_results=computed_tests,
        rag_context=rag_context,
        researcher_name=req.researcher_name,
        professor_template=req.template_name or req.professor_template,
        human_notes=req.custom_notes,
        attached_charts=req.attached_charts,
        custom_template_content=req.custom_template_content,
        df=df
    )

    CURRENT_REPORT["data"] = report_data
    return report_data



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
        "executed_tests": report_data.get("results", [])
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
    if r.get("is_custom_template") and r.get("rendered_content"):
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
