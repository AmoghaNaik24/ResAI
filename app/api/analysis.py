from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import pandas as pd
from app.api.eda import ACTIVE_DATASET
from app.core.statistical_engine import StatisticalEngine, sanitize_for_json
from app.core.visualizer import Visualizer

router = APIRouter(prefix="/api/analysis", tags=["Statistical Analysis & Computation"])


def get_active_df():
    df = ACTIVE_DATASET.get("df")
    if df is None:
        raise HTTPException(status_code=400, detail="No active dataset loaded. Please upload a file or select a sample dataset.")
    return df


@router.get("/summary-stats")
async def get_summary_stats():
    df = get_active_df()
    return StatisticalEngine.get_summary_statistics(df)


@router.get("/recommendations")
async def get_recommendations():
    df = get_active_df()
    obj = ACTIVE_DATASET.get("objective", "")
    recs = StatisticalEngine.auto_recommend_analysis(df, obj)
    return {
        "status": "success",
        "recommended_tests": recs,
        "count": len(recs)
    }


class CorrelationRequest(BaseModel):
    method: str = "pearson"


@router.post("/correlation")
async def run_correlation(req: CorrelationRequest):
    df = get_active_df()
    result = StatisticalEngine.calculate_correlations(df, method=req.method)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


class TwoSampleRequest(BaseModel):
    continuous_col: str
    group_col: str


@router.post("/two-sample")
async def run_two_sample(req: TwoSampleRequest):
    df = get_active_df()
    result = StatisticalEngine.two_sample_test(df, req.continuous_col, req.group_col)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


class AnovaRequest(BaseModel):
    continuous_col: str
    group_col: str


@router.post("/anova")
async def run_anova(req: AnovaRequest):
    df = get_active_df()
    result = StatisticalEngine.anova_test(df, req.continuous_col, req.group_col)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


class ChiSquareRequest(BaseModel):
    var1: str
    var2: str


@router.post("/chi-square")
async def run_chi_square(req: ChiSquareRequest):
    df = get_active_df()
    result = StatisticalEngine.chi_square_test(df, req.var1, req.var2)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


class RegressionRequest(BaseModel):
    target_col: str
    feature_cols: List[str]


@router.post("/regression")
async def run_regression(req: RegressionRequest):
    df = get_active_df()
    result = StatisticalEngine.linear_regression(df, req.target_col, req.feature_cols)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/visualize/{chart_type}")
async def get_visualization(
    chart_type: str,
    col1: Optional[str] = None,
    col2: Optional[str] = None,
    group_by: Optional[str] = None
):
    df = get_active_df()
    if chart_type in ["heatmap", "correlation_heatmap"]:
        return Visualizer.correlation_heatmap(df)
    elif chart_type == "distribution":
        if not col1:
            raise HTTPException(status_code=400, detail="Missing parameter col1")
        return Visualizer.distribution_plot(df, column=col1, group_by=group_by)
    elif chart_type in ["box_violin", "boxplot"]:
        if not col1 or not col2:
            raise HTTPException(status_code=400, detail="Need col1 (continuous) and col2 (group)")
        return Visualizer.box_violin_plot(df, continuous_col=col1, group_col=col2)
    elif chart_type in ["scatter", "scatter_regression"]:
        if not col1 or not col2:
            raise HTTPException(status_code=400, detail="Need col1 (x) and col2 (y)")
        return Visualizer.scatter_regression_plot(df, x_col=col1, y_col=col2, color_col=group_by)
    elif chart_type in ["pie", "donut"]:
        if not col1:
            raise HTTPException(status_code=400, detail="Missing parameter col1 (categorical column)")
        hole = 0.38 if chart_type == "donut" else 0.0
        return Visualizer.pie_chart(df, cat_col=col1, hole=hole)
    elif chart_type in ["bar", "research_bar", "categorical"]:
        if not col1:
            raise HTTPException(status_code=400, detail="Missing parameter col1 (x axis category)")
        return Visualizer.research_bar_chart(df, x_col=col1, y_col=col2, group_col=group_by)
    elif chart_type in ["line", "line_trend"]:
        if not col1 or not col2:
            raise HTTPException(status_code=400, detail="Need col1 (x) and col2 (y)")
        return Visualizer.line_trend_chart(df, x_col=col1, y_col=col2, group_col=group_by)
    elif chart_type in ["crosstab", "crosstab_heatmap"]:
        if not col1 or not col2:
            raise HTTPException(status_code=400, detail="Need col1 (row category) and col2 (column category)")
        return Visualizer.crosstab_heatmap(df, row_cat=col1, col_cat=col2)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown chart type '{chart_type}'")


class RunTestRequest(BaseModel):
    test_type: str
    continuous_col: Optional[str] = None
    group_col: Optional[str] = None
    numeric_col: Optional[str] = None
    var1: Optional[str] = None
    var2: Optional[str] = None
    target_col: Optional[str] = None
    feature_cols: Optional[List[str]] = None
    method: Optional[str] = "pearson"


@router.post("/run-test")
async def run_unified_test(req: RunTestRequest):
    df = get_active_df()
    t_type = req.test_type.lower().replace("-", "_").replace(" ", "_")
    cont_col = req.continuous_col or req.numeric_col or req.var1

    if t_type in ["anova", "anova_test", "one_way_anova"]:
        if not cont_col or not req.group_col:
            raise HTTPException(status_code=400, detail="ANOVA requires continuous/numeric_col and group_col")
        result = StatisticalEngine.anova_test(df, cont_col, req.group_col)
    elif t_type in ["two_sample", "two_sample_test", "ttest", "t_test"]:
        if not cont_col or not req.group_col:
            raise HTTPException(status_code=400, detail="Two-sample test requires continuous/numeric_col and group_col")
        result = StatisticalEngine.two_sample_test(df, cont_col, req.group_col)
    elif t_type in ["chi_square", "chi_square_test", "chisquare"]:
        v1 = req.var1 or req.group_col
        v2 = req.var2 or cont_col
        if not v1 or not v2:
            raise HTTPException(status_code=400, detail="Chi-Square requires var1 and var2")
        result = StatisticalEngine.chi_square_test(df, v1, v2)
    elif t_type in ["regression", "linear_regression"]:
        if not req.target_col or not req.feature_cols:
            raise HTTPException(status_code=400, detail="Regression requires target_col and feature_cols")
        result = StatisticalEngine.linear_regression(df, req.target_col, req.feature_cols)
    elif t_type in ["correlation", "correlation_analysis"]:
        result = StatisticalEngine.calculate_correlations(df, method=req.method or "pearson")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported test type '{req.test_type}'")

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    result_copy = dict(result)
    result_copy["status"] = "success"
    result_copy["apa_statement"] = result.get("formatted_apa", "").replace("\u03b7\u00b2", "eta^2").replace("\u03b7", "eta")
    return sanitize_for_json(result_copy)


class VisualizeRequest(BaseModel):
    viz_type: Optional[str] = "distribution"
    chart_type: Optional[str] = None
    x_col: Optional[str] = None
    y_col: Optional[str] = None
    col1: Optional[str] = None
    col2: Optional[str] = None
    group_by: Optional[str] = None


@router.post("/visualize")
async def create_visualization(req: VisualizeRequest):
    df = get_active_df()
    v_type = (req.viz_type or req.chart_type or "distribution").lower().replace("-", "_")
    c1 = req.col1 or req.x_col
    c2 = req.col2 or req.y_col

    if v_type in ["boxplot", "box_violin"]:
        cont = req.y_col or req.col1
        grp = req.x_col or req.col2
        if cont in df.columns and grp in df.columns:
            if not pd.api.types.is_numeric_dtype(df[cont]) and pd.api.types.is_numeric_dtype(df[grp]):
                cont, grp = grp, cont
        return Visualizer.box_violin_plot(df, continuous_col=cont, group_col=grp)
    elif v_type in ["heatmap", "correlation_heatmap"]:
        return Visualizer.correlation_heatmap(df)
    elif v_type == "distribution":
        num_cols = df.select_dtypes(include="number").columns
        col = c1 or (num_cols[0] if len(num_cols) > 0 else df.columns[0])
        return Visualizer.distribution_plot(df, column=col, group_by=req.group_by)
    elif v_type in ["scatter", "scatter_regression"]:
        return Visualizer.scatter_regression_plot(df, x_col=req.x_col or c1, y_col=req.y_col or c2, color_col=req.group_by)
    elif v_type in ["pie", "donut"]:
        cat_cols = df.select_dtypes(include=["object", "category"]).columns
        col = c1 or (cat_cols[0] if len(cat_cols) > 0 else df.columns[0])
        hole = 0.38 if v_type == "donut" else 0.0
        return Visualizer.pie_chart(df, cat_col=col, hole=hole)
    elif v_type in ["bar", "research_bar", "categorical"]:
        x = req.x_col or c1
        y = req.y_col or c2
        return Visualizer.research_bar_chart(df, x_col=x, y_col=y, group_col=req.group_by)
    elif v_type in ["line", "line_trend"]:
        return Visualizer.line_trend_chart(df, x_col=req.x_col or c1, y_col=req.y_col or c2, group_col=req.group_by)
    elif v_type in ["crosstab", "crosstab_heatmap"]:
        return Visualizer.crosstab_heatmap(df, row_cat=req.x_col or c1, col_cat=req.y_col or c2)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown visualization type: {v_type}")

