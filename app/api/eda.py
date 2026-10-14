import os
import shutil
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.config import UPLOAD_DIR
from app.core.eda_profiler import EDAProfiler
from app.core.sample_datasets import (
    generate_clinical_trial_dataset,
    generate_student_performance_dataset,
    generate_sensor_materials_dataset
)

router = APIRouter(prefix="/api/eda", tags=["Data Profiling & Quality"])

from pathlib import Path
import numpy as np

# In-memory session store for current active dataset
ACTIVE_DATASET = {
    "df": None,
    "filename": None,
    "objective": "Evaluate treatment effectiveness across clinical groups"
}


def synthesize_dataset_objective(df: pd.DataFrame, filename: str) -> str:
    """Synthesizes a publication-grade, dataset-grounded research inquiry based on input file attributes."""
    clean_name = Path(filename).stem.replace("_", " ").title()
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    if cat_cols and num_cols:
        return f"Evaluate variations and differences in {num_cols[0]} across {cat_cols[0]} cohorts and analyze associated empirical predictors in {clean_name}."
    elif len(num_cols) >= 2:
        return f"Investigate bivariate distributions, linear correlations, and predictive determinants across {num_cols[0]} and {num_cols[1]} in {clean_name}."
    elif num_cols:
        return f"Examine quantitative distributions, central tendencies, and normality profiles of {num_cols[0]} in {clean_name}."
    elif cat_cols:
        return f"Assess categorical distributions and independence relationships across {', '.join(cat_cols[:3])} in {clean_name}."
    else:
        return f"Empirical quantitative data analysis and exploratory profiling of {clean_name}."


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...), objective: str = Form("General Exploratory Analysis")):
    """Upload CSV or Excel dataset and return automated data profiling audit."""
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only CSV or Excel files (.xlsx, .xls) are supported.")

    file_path = UPLOAD_DIR / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse data file: {str(e)}")

    # Dynamically synthesize objective if generic, empty, or residual placeholder from sample
    is_placeholder_obj = (
        not objective or
        objective.strip() in ["", "General Exploratory Analysis", "Empirical Laboratory Data Analysis"] or
        "Evaluate recovery days and biomarker reduction" in objective or
        "Placebo vs Drug A vs Drug B" in objective
    )
    if is_placeholder_obj:
        objective = synthesize_dataset_objective(df, file.filename)

    ACTIVE_DATASET["df"] = df
    ACTIVE_DATASET["filename"] = file.filename
    ACTIVE_DATASET["objective"] = objective

    profile = EDAProfiler.profile_dataset(df)
    return {
        "status": "success",
        "filename": file.filename,
        "objective": objective,
        "profile": profile
    }


@router.post("/load-sample")
async def load_sample(sample_type: str = Form("clinical")):
    """Load a pre-configured laboratory research dataset."""
    if sample_type == "clinical":
        df = generate_clinical_trial_dataset()
        fname = "Clinical_Drug_Trial_Phase_II.csv"
        obj = "Evaluate recovery days and biomarker reduction across treatment arms (Placebo vs Drug A vs Drug B)."
    elif sample_type == "education":
        df = generate_student_performance_dataset()
        fname = "Student_Academic_Predictors.csv"
        obj = "Determine the predictive influence of study hours, attendance, and tutoring on final exam scores."
    elif sample_type == "materials":
        df = generate_sensor_materials_dataset()
        fname = "Catalytic_Yield_Experiment.csv"
        obj = "Analyze the impact of temperature, pressure, and catalyst type on chemical yield percentage."
    else:
        raise HTTPException(status_code=400, detail="Unknown sample type.")

    ACTIVE_DATASET["df"] = df
    ACTIVE_DATASET["filename"] = fname
    ACTIVE_DATASET["objective"] = obj

    profile = EDAProfiler.profile_dataset(df)
    return {
        "status": "success",
        "filename": fname,
        "objective": obj,
        "profile": profile
    }


@router.get("/current")
async def get_current_profile():
    """Retrieve profile of the currently loaded dataset."""
    df = ACTIVE_DATASET.get("df")
    if df is None:
        return {"status": "empty", "message": "No active dataset loaded."}

    profile = EDAProfiler.profile_dataset(df)
    return {
        "status": "success",
        "filename": ACTIVE_DATASET.get("filename"),
        "objective": ACTIVE_DATASET.get("objective"),
        "profile": profile
    }


@router.post("/clean")
async def clean_active_dataset(
    drop_duplicates: bool = Form(True),
    impute_numeric: str = Form("median"),
    impute_categorical: str = Form("mode")
):
    """Execute automated research data cleansing and return updated profile."""
    df = ACTIVE_DATASET.get("df")
    if df is None:
        raise HTTPException(status_code=400, detail="No active dataset.")

    cleaned_df = EDAProfiler.clean_dataset(
        df,
        drop_duplicates=drop_duplicates,
        impute_numeric=impute_numeric,
        impute_categorical=impute_categorical
    )
    ACTIVE_DATASET["df"] = cleaned_df
    profile = EDAProfiler.profile_dataset(cleaned_df)
    return {
        "status": "success",
        "message": "Dataset successfully cleansed and updated in active memory.",
        "profile": profile
    }


from pydantic import BaseModel
from app.core.dataset_qa import DatasetQA


class AskQuestionRequest(BaseModel):
    question: str


@router.post("/ask")
async def ask_dataset_question(req: AskQuestionRequest):
    """
    Answers natural language research questions grounded in the active dataset,
    computed EDA profiles, and RAG methodology guidelines.
    If outside the scope of the dataset, returns a strict limited-knowledge disclaimer.
    """
    df = ACTIVE_DATASET.get("df")
    profile = EDAProfiler.profile_dataset(df) if df is not None else None
    
    # Check for any previously computed report tests
    from app.api.report import CURRENT_REPORT
    stats_results = []
    if CURRENT_REPORT.get("data") and CURRENT_REPORT["data"].get("results"):
        stats_results = CURRENT_REPORT["data"]["results"]

    ans = DatasetQA.answer_question(
        query=req.question,
        df=df,
        profile=profile,
        statistical_results=stats_results,
        research_objective=ACTIVE_DATASET.get("objective", ""),
        dataset_name=ACTIVE_DATASET.get("filename", "Active Dataset")
    )
    return {
        "status": "success",
        "question": req.question,
        "answer": ans["answer"],
        "source": ans["source"],
        "grounded": ans["grounded"]
    }


class UpdateObjectiveRequest(BaseModel):
    objective: str


@router.post("/update-objective")
async def update_research_objective(req: UpdateObjectiveRequest):
    """Dynamically updates the active natural language research objective."""
    ACTIVE_DATASET["objective"] = req.objective
    return {
        "status": "success",
        "objective": req.objective,
        "message": "Research objective updated successfully."
    }

