"""
ResAI - Validated Statistical Result Schema
Defines strictly typed, validated models for descriptive metrics, inferential hypothesis tests,
data hygiene profiles, and full research reports. Serves as the single source of truth for narrative
synthesis, preventing LLM hallucinations.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DescriptiveMetric(BaseModel):
    variable: str
    count: int
    missing: int = 0
    mean: float
    std: float
    sem: float = 0.0
    ci95: List[float] = Field(default_factory=list)
    median: float
    iqr: float
    min: float
    max: float
    q25: float = 0.0
    q75: float = 0.0
    skewness: float = 0.0
    kurtosis: float = 0.0
    outliers_count: int = 0
    is_normally_distributed: bool = False
    normality_p_value: Optional[float] = None


class EffectSize(BaseModel):
    metric: str  # e.g., "Cohen's d", "Eta-squared (η²)", "R²", "Cramér's V"
    value: float
    magnitude: str  # "negligible", "small", "medium", "large"


class HypothesisTestResult(BaseModel):
    test_id: str
    test_type: str  # "Two-Sample Comparison", "One-Way ANOVA", "OLS Linear Regression", "Correlation", "Chi-Square"
    variable_y: Optional[str] = None
    variable_x: Optional[str] = None
    test_statistic_name: str  # "t", "F", "r", "chi2", "U"
    test_statistic_value: float
    p_value: float
    degrees_of_freedom: Optional[Any] = None
    effect_size: Optional[EffectSize] = None
    formatted_apa: str
    is_significant: bool
    assumptions_met: bool = True
    assumption_notes: List[str] = Field(default_factory=list)
    group_stats: Optional[List[Dict[str, Any]]] = None
    post_hoc_results: Optional[List[Dict[str, Any]]] = None
    warnings: List[str] = Field(default_factory=list)


class DataHygieneProfile(BaseModel):
    filename: str
    total_rows: int
    total_columns: int
    health_score: float
    total_missing_cells: int = 0
    missing_rate_overall: float = 0.0
    duplicate_rows: int = 0
    continuous_columns: List[str] = Field(default_factory=list)
    categorical_columns: List[str] = Field(default_factory=list)
    hygiene_warnings: List[str] = Field(default_factory=list)


class ClaimAuditItem(BaseModel):
    claim_text: str
    extracted_number: Optional[float] = None
    metric_type: Optional[str] = None  # "p_value", "mean", "std", "sample_size", "percentage", "statistic"
    is_verified: bool
    source_reference: Optional[str] = None
    warning: Optional[str] = None


class ClaimValidationReport(BaseModel):
    total_claims_checked: int
    verified_claims_count: int
    unsupported_claims_count: int
    grounding_score_percent: float
    claims: List[ClaimAuditItem] = Field(default_factory=list)
    general_warnings: List[str] = Field(default_factory=list)


class ValidatedResearchReport(BaseModel):
    report_id: str
    title: str
    research_objective: str
    date: str
    researcher_name: str
    professor_template: str
    validation_status: str = "DRAFT_PENDING_REVIEW"
    human_notes: str = ""
    hygiene_profile: DataHygieneProfile
    descriptive_statistics: List[DescriptiveMetric] = Field(default_factory=list)
    hypothesis_tests: List[HypothesisTestResult] = Field(default_factory=list)
    abstract: str = ""
    introduction: str = ""
    methodology: str = ""
    results_narrative: str = ""
    discussion: str = ""
    limitations: str = ""
    conclusions: str = ""
    claim_audit: Optional[ClaimValidationReport] = None
    attached_charts: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
