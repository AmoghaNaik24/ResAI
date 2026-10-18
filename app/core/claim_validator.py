"""
ResAI - Numerical Claim Validation Engine
Audits AI-generated or researcher-authored narrative prose against deterministically
computed mathematical results. Detects ungrounded statistical figures, altered p-values,
sample size hallucinations, and flags discrepancies with actionable warnings.
"""

import re
import math
from typing import List, Dict, Any, Optional
from app.core.statistical_schema import ClaimAuditItem, ClaimValidationReport


class ClaimValidator:
    """
    Zero-Hallucination Claim Validation Engine.
    Cross-checks all numerical claims against active dataset ground-truth metrics.
    """

    @staticmethod
    def audit_report_text(
        report_text: str,
        eda_summary: Dict[str, Any],
        statistical_results: List[Dict[str, Any]],
        summary_stats: Optional[Dict[str, Any]] = None
    ) -> ClaimValidationReport:
        """
        Scans narrative text for numerical claims, statistics, p-values, and percentages,
        cross-referencing each against active verified mathematical outputs.
        """
        ground_truth_numbers = ClaimValidator._build_ground_truth_registry(
            eda_summary, statistical_results, summary_stats
        )

        claims: List[ClaimAuditItem] = []
        general_warnings: List[str] = []

        if not report_text or not report_text.strip():
            return ClaimValidationReport(
                total_claims_checked=0,
                verified_claims_count=0,
                unsupported_claims_count=0,
                grounding_score_percent=100.0,
                claims=[],
                general_warnings=["No text provided for claim verification."]
            )

        # 1. Regex patterns for numerical academic claims:
        # e.g., p < .05, p = 0.003, M = 14.2, SD = 2.1, N = 120, t(48) = 3.12, F(2, 57) = 14.8, 12.5%
        patterns = [
            (r"\b[pP]\s*[<=><≥≤]\s*([0-9]*\.[0-9]+)\b", "p_value", "p-value"),
            (r"\b[mM]\s*=\s*([0-9]+\.?[0-9]*)\b", "mean", "Mean (M)"),
            (r"\b[sS][dD]\s*=\s*([0-9]+\.?[0-9]*)\b", "std", "Standard Deviation (SD)"),
            (r"\b[nN]\s*=\s*([0-9]+)\b", "sample_size", "Sample size (N)"),
            (r"\b[tT]\s*\([0-9.]+\)\s*=\s*([0-9]+\.?[0-9]*)\b", "statistic", "t-statistic"),
            (r"\b[fF]\s*\([0-9.,\s]+\)\s*=\s*([0-9]+\.?[0-9]*)\b", "statistic", "F-statistic"),
            (r"\b[rR]\s*=\s*([0-9]*\.[0-9]+)\b", "correlation", "Correlation coefficient (r)"),
            (r"\b(?:Cohen['’]?s\s*d|d)\s*=\s*([0-9]+\.?[0-9]*)\b", "effect_size", "Cohen's d"),
            (r"\b(?:η²|eta-squared|eta²)\s*=\s*([0-9]+\.?[0-9]*)\b", "effect_size", "Eta-squared (η²)"),
            (r"\b(?:R²|r²|R-squared)\s*=\s*([0-9]+\.?[0-9]*)\b", "effect_size", "R-squared"),
            (r"\b([0-9]+\.?[0-9]*)\s*%", "percentage", "Percentage (%)"),
        ]

        # Extract sentences to provide context for each claim
        sentences = re.split(r"(?<=[.!?])\s+", report_text)

        found_claims = []
        for sentence in sentences:
            sentence_clean = sentence.strip()
            if not sentence_clean or len(sentence_clean) < 10:
                continue

            for pat, metric_type, label in patterns:
                matches = re.finditer(pat, sentence_clean)
                for m in matches:
                    val_str = m.group(1)
                    try:
                        val = float(val_str)
                    except ValueError:
                        continue

                    # Check against ground truth
                    is_verified, ref = ClaimValidator._verify_number(val, metric_type, ground_truth_numbers)

                    audit_item = ClaimAuditItem(
                        claim_text=sentence_clean[:180] + ("..." if len(sentence_clean) > 180 else ""),
                        extracted_number=val,
                        metric_type=metric_type,
                        is_verified=is_verified,
                        source_reference=ref if is_verified else None,
                        warning=None if is_verified else f"Value '{val}' ({label}) does not match any computed metric in active dataset."
                    )
                    found_claims.append(audit_item)

        total_checked = len(found_claims)
        verified_count = sum(1 for c in found_claims if c.is_verified)
        unsupported_count = total_checked - verified_count
        score = (verified_count / total_checked * 100.0) if total_checked > 0 else 100.0

        if unsupported_count > 0:
            general_warnings.append(
                f"Flagged {unsupported_count} numerical statement(s) that lack exact mathematical grounding in the computed results."
            )
        else:
            general_warnings.append("All detected numerical claims verified against active dataset ground truth.")

        return ClaimValidationReport(
            total_claims_checked=total_checked,
            verified_claims_count=verified_count,
            unsupported_claims_count=unsupported_count,
            grounding_score_percent=round(score, 1),
            claims=found_claims,
            general_warnings=general_warnings
        )

    @staticmethod
    def _build_ground_truth_registry(
        eda_summary: Dict[str, Any],
        statistical_results: List[Dict[str, Any]],
        summary_stats: Optional[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Builds a comprehensive registry of all numbers verified by python computation.
        """
        registry: Dict[str, List[Dict[str, Any]]] = {
            "p_value": [],
            "mean": [],
            "std": [],
            "sample_size": [],
            "statistic": [],
            "correlation": [],
            "effect_size": [],
            "percentage": [],
            "any": []
        }

        # 1. EDA Summary Metrics
        if eda_summary:
            total_rows = eda_summary.get("total_rows") or eda_summary.get("row_count")
            if total_rows is not None:
                registry["sample_size"].append({"val": float(total_rows), "ref": f"Total Dataset Observations (N={total_rows})"})

            health = eda_summary.get("health_score")
            if health is not None:
                registry["percentage"].append({"val": float(health), "ref": f"Data Health Index ({health}%)"})

            missing_rate = eda_summary.get("missing_rate_overall")
            if missing_rate is not None:
                registry["percentage"].append({"val": float(missing_rate), "ref": f"Missingness Rate ({missing_rate}%)"})

        # 2. Descriptive Summary Statistics
        if summary_stats and "numerical_summary" in summary_stats:
            for col, stats_dict in summary_stats["numerical_summary"].items():
                if "mean" in stats_dict:
                    registry["mean"].append({"val": float(stats_dict["mean"]), "ref": f"Mean of {col}"})
                if "std" in stats_dict:
                    registry["std"].append({"val": float(stats_dict["std"]), "ref": f"Std Dev of {col}"})
                if "median" in stats_dict:
                    registry["mean"].append({"val": float(stats_dict["median"]), "ref": f"Median of {col}"})
                if "count" in stats_dict:
                    registry["sample_size"].append({"val": float(stats_dict["count"]), "ref": f"Count for {col}"})
                if "normality_p_value" in stats_dict and stats_dict["normality_p_value"] is not None:
                    registry["p_value"].append({"val": float(stats_dict["normality_p_value"]), "ref": f"Normality p-value for {col}"})

        # 3. Statistical Test Results
        for idx, res in enumerate(statistical_results or [], 1):
            t_type = res.get("test_type", f"Test {idx}")

            # p-values
            for p_key in ["p_value", "p_val", "f_p_value"]:
                if p_key in res and res[p_key] is not None:
                    try:
                        pv = float(res[p_key])
                        registry["p_value"].append({"val": pv, "ref": f"{t_type} p-value"})
                    except (ValueError, TypeError):
                        pass

            # Test statistics (t, F, chi2, U)
            for s_key in ["t_statistic", "f_statistic", "chi2_statistic", "u_statistic", "statistic"]:
                if s_key in res and res[s_key] is not None:
                    try:
                        sv = float(res[s_key])
                        registry["statistic"].append({"val": sv, "ref": f"{t_type} test statistic"})
                    except (ValueError, TypeError):
                        pass

            # Group statistics (Two-Sample, ANOVA)
            for g_key in ["group_1", "group_2"]:
                if g_key in res and isinstance(res[g_key], dict):
                    grp = res[g_key]
                    g_name = grp.get("name", g_key)
                    if "mean" in grp:
                        registry["mean"].append({"val": float(grp["mean"]), "ref": f"{g_name} Mean"})
                    if "std" in grp:
                        registry["std"].append({"val": float(grp["std"]), "ref": f"{g_name} Std Dev"})
                    if "n" in grp:
                        registry["sample_size"].append({"val": float(grp["n"]), "ref": f"{g_name} sample size"})

            if "group_stats" in res and isinstance(res["group_stats"], list):
                for grp in res["group_stats"]:
                    g_name = grp.get("group", "Group")
                    if "mean" in grp:
                        registry["mean"].append({"val": float(grp["mean"]), "ref": f"{g_name} Mean"})
                    if "std" in grp:
                        registry["std"].append({"val": float(grp["std"]), "ref": f"{g_name} Std Dev"})
                    if "n" in grp:
                        registry["sample_size"].append({"val": float(grp["n"]), "ref": f"{g_name} sample size"})

            # Effect size
            if "effect_size" in res and isinstance(res["effect_size"], dict):
                eff = res["effect_size"]
                if "value" in eff:
                    try:
                        ev = float(eff["value"])
                        registry["effect_size"].append({"val": ev, "ref": f"{t_type} effect size ({eff.get('metric', 'value')})"})
                    except (ValueError, TypeError):
                        pass
            if "eta_squared" in res:
                registry["effect_size"].append({"val": float(res["eta_squared"]), "ref": f"{t_type} eta-squared (η²)"})
            if "r_squared" in res:
                registry["effect_size"].append({"val": float(res["r_squared"]), "ref": f"{t_type} R²"})

            # Correlations
            if "correlation" in res:
                registry["correlation"].append({"val": float(res["correlation"]), "ref": f"{t_type} r"})

        return registry

    @staticmethod
    def _verify_number(
        number: float,
        metric_type: str,
        registry: Dict[str, List[Dict[str, Any]]]
    ) -> tuple[bool, Optional[str]]:
        """
        Tests if number exists in registry within a reasonable rounding tolerance.
        """
        # Standard academic thresholds: p < .05, p < .01, p < .001 are standard conventional thresholds
        if metric_type == "p_value" and number in (0.05, 0.01, 0.001, 0.1):
            return True, f"Standard significance threshold (alpha = {number})"

        targets = registry.get(metric_type, [])
        # Also check all numbers if type-specific list misses due to alternative formatting
        if not targets:
            targets = [item for sublist in registry.values() for item in sublist]

        for item in targets:
            gt_val = item["val"]
            # Tolerance: relative 2% or absolute 0.05
            abs_diff = abs(number - gt_val)
            rel_diff = abs_diff / (abs(gt_val) + 1e-9)

            if abs_diff <= 0.05 or rel_diff <= 0.025:
                return True, item["ref"]

        # Check rounded to 1 or 2 decimals
        for item in [it for sub in registry.values() for it in sub]:
            if round(number, 1) == round(item["val"], 1) or round(number, 2) == round(item["val"], 2):
                return True, item["ref"]

        return False, None
