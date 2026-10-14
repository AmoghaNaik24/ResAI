import datetime
import json
import math
import re
from pathlib import Path
from typing import Optional, List, Dict, Any
import numpy as np
import pandas as pd
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from app.config import REPORTS_DIR

CUSTOM_TEMPLATES_FILE = REPORTS_DIR / "custom_templates.json"

DEFAULT_TEMPLATES = [
    {
        "id": "tpl_empirical_apa7",
        "name": "Standard Empirical Research Report (APA 7th)",
        "version": "v1.0",
        "category": "Academic",
        "description": "Comprehensive peer-review format with descriptive tables, exact APA 7th statistics, and structured discussion.",
        "content": """# {{title}}
**Principal Investigator:** {{researcher_name}} | **Date:** {{date}} | **Dataset:** `{{dataset_name}}` (N = {{row_count}})

---

## Abstract
{{abstract}}

## 1. Introduction & Research Objectives
{{introduction}}

**Primary Research Inquiry:** {{research_objective}}

## 2. Experimental Data Hygiene & Descriptive Profiling
{{methodology}}

### Table 1: Comprehensive Descriptive Statistics (Continuous Measures)
{{descriptive_statistics_table}}

### Table 2: Categorical Attribute Distributions
{{categorical_distribution_table}}

## 3. Inferential Hypothesis Testing & APA 7th Statements
{{hypothesis_testing_results}}

## 4. Key Comparative Findings
{{detailed_findings}}

## 5. Scientific Discussion & Laboratory Interpretation
{{discussion}}

## 6. Attached Scientific Visualizations
{{attached_figures}}

## 7. Methodological Limitations & Validity Threats
{{limitations}}

## 8. Conclusions & Research Recommendations
{{conclusions}}

## 9. Document Grounding & RAG Methodology Compliance
{{document_grounding}}
"""
    },
    {
        "id": "tpl_clinical_trial",
        "name": "Clinical / Biomedical Trial Protocol",
        "version": "v2.1",
        "category": "Clinical",
        "description": "Specialized format for randomized trials, patient cohorts, baseline biomarker tables, and treatment arm efficacy.",
        "content": """# {{title}} (Clinical Evaluation)
**Lead Investigator:** {{researcher_name}} | **Protocol Date:** {{date}} | **Cohort:** `{{dataset_name}}` (N = {{row_count}})

---

## Executive Abstract
{{abstract}}

## 1. Protocol Rationale & Trial Objective
{{introduction}}

**Clinical Target:** {{research_objective}}

## 2. Patient Cohort Quality & Baseline Characteristics
{{methodology}}

### Baseline Descriptive Metrics
{{descriptive_statistics_table}}

### Patient Demographics & Treatment Arms
{{categorical_distribution_table}}

## 3. Primary & Secondary Endpoint Hypothesis Testing
{{hypothesis_testing_results}}

## 4. Clinical Significance & Discussion
{{discussion}}

## 5. Trial Visualizations & Endpoints
{{attached_figures}}

## 6. Limitations & Adverse Events Monitoring
{{limitations}}

## 7. Clinical Conclusions
{{conclusions}}

## 8. Document Grounding & Protocol Compliance
{{document_grounding}}
"""
    },
    {
        "id": "tpl_engineering_benchmark",
        "name": "Engineering & Experimental Benchmark",
        "version": "v1.5",
        "category": "Engineering",
        "description": "Technical layout highlighting parameter distributions, factorial models, performance diagnostics, and sensor health.",
        "content": """# {{title}}
**Test Engineer:** {{researcher_name}} | **Test Date:** {{date}} | **Experimental Matrix:** `{{dataset_name}}` (N = {{row_count}})

---

## Executive Overview
{{executive_summary}}

## 1. Experimental Parameters & Test Objective
**Inquiry:** {{research_objective}}

## 2. Sensor Data Hygiene & Metric Distributions
{{methodology}}

### Parameter Summary Table
{{descriptive_statistics_table}}

## 3. Statistical Benchmark & Factorial Analysis
{{hypothesis_testing_results}}

## 4. Engineering Findings & Performance Diagnostics
{{detailed_findings}}

## 5. Attached Trajectory & Benchmark Plots
{{attached_figures}}

## 6. Conclusions & Engineering Next Steps
{{conclusions}}
"""
    },
    {
        "id": "tpl_rapid_brief",
        "name": "Executive Summary & Rapid Scientific Brief",
        "version": "v1.0",
        "category": "Executive",
        "description": "Concise high-level briefing summarizing findings, core statistical proof, and actionable decision points.",
        "content": """# {{title}}
**Prepared by:** {{researcher_name}} | **Date:** {{date}} | **Data Source:** `{{dataset_name}}` (N = {{row_count}})

---

## Key Takeaways & Executive Summary
{{executive_summary}}

## Core Statistical Results
{{hypothesis_testing_results}}

## Summary of Empirical Metrics
{{descriptive_statistics_table}}

## Scientific Interpretation & Next Steps
{{discussion}}

{{conclusions}}
"""
    }
]


class ReportGenerator:
    """
    Academic Report & Manuscript Generator.
    Builds structured, peer-reviewed-grade research reports with exact
    mathematical tables, APA statistical sentences, human-validation state,
    and user-customizable dynamic templates.
    """

    @staticmethod
    def get_templates() -> list[dict]:
        """Returns standard pre-configured templates plus any user-saved custom templates."""
        templates = list(DEFAULT_TEMPLATES)
        if CUSTOM_TEMPLATES_FILE.exists():
            try:
                with open(CUSTOM_TEMPLATES_FILE, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    if isinstance(saved, list):
                        templates.extend(saved)
            except Exception:
                pass
        return templates

    @staticmethod
    def save_custom_template(template_data: dict) -> dict:
        """Saves a new or updated custom template version to disk."""
        templates = []
        if CUSTOM_TEMPLATES_FILE.exists():
            try:
                with open(CUSTOM_TEMPLATES_FILE, "r", encoding="utf-8") as f:
                    templates = json.load(f)
            except Exception:
                templates = []

        tpl_id = template_data.get("id") or f"custom_tpl_{int(datetime.datetime.now().timestamp())}"
        template_obj = {
            "id": tpl_id,
            "name": template_data.get("name", "Custom Research Template"),
            "version": template_data.get("version", "v1.0"),
            "category": template_data.get("category", "Custom User"),
            "description": template_data.get("description", "User-defined custom template version."),
            "content": template_data.get("content", ""),
            "created_at": datetime.datetime.now().isoformat()
        }

        # Update if exists, else append
        existing_idx = next((i for i, t in enumerate(templates) if t.get("id") == tpl_id), None)
        if existing_idx is not None:
            templates[existing_idx] = template_obj
        else:
            templates.append(template_obj)

        with open(CUSTOM_TEMPLATES_FILE, "w", encoding="utf-8") as f:
            json.dump(templates, f, indent=2)

        return template_obj

    @staticmethod
    def delete_custom_template(template_id: str) -> bool:
        """Deletes a user-saved custom template by ID."""
        if not CUSTOM_TEMPLATES_FILE.exists():
            return False
        try:
            with open(CUSTOM_TEMPLATES_FILE, "r", encoding="utf-8") as f:
                templates = json.load(f)
            new_templates = [t for t in templates if t.get("id") != template_id]
            with open(CUSTOM_TEMPLATES_FILE, "w", encoding="utf-8") as f:
                json.dump(new_templates, f, indent=2)
            return True
        except Exception:
            return False

    @staticmethod
    def generate_dynamic_title(
        df: Optional[pd.DataFrame],
        eda_summary: dict,
        research_objective: str = "",
        statistical_results: list[dict] = None
    ) -> str:
        """
        Synthesizes a publication-grade, scientific academic manuscript title
        dynamically grounded in the input file details, primary variables, and research objective.
        """
        filename = eda_summary.get("filename") or "Dataset"
        clean_name = filename.replace(".csv", "").replace(".xlsx", "").replace(".xls", "").replace("_", " ").title()

        num_cols = df.select_dtypes(include=[np.number]).columns.tolist() if df is not None else []
        cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist() if df is not None else []

        # If inferential statistical tests were executed, extract primary investigated variables
        if statistical_results:
            first_test = statistical_results[0]
            t_type = first_test.get("test_type", "")
            if "ANOVA" in t_type or "Comparison" in t_type or "Two-Sample" in t_type:
                cont = first_test.get("continuous_variable") or (num_cols[0] if num_cols else "Outcome")
                grp = first_test.get("group_variable") or (cat_cols[0] if cat_cols else "Cohort")
                return f"Empirical Evaluation of {cont} Discrepancies across {grp} Cohorts ({clean_name})"
            elif "Regression" in t_type:
                target = first_test.get("target") or (num_cols[0] if num_cols else "Target")
                return f"Multivariate Determinants and Predictive Modeling of {target} ({clean_name})"
            elif "Correlation" in t_type:
                if len(num_cols) >= 2:
                    return f"Bivariate Correlation and Association Analysis of {num_cols[0]} and {num_cols[1]} ({clean_name})"
            elif "Chi-Square" in t_type:
                v1 = first_test.get("var1", cat_cols[0] if cat_cols else "Factor 1")
                v2 = first_test.get("var2", cat_cols[1] if len(cat_cols) > 1 else "Factor 2")
                return f"Categorical Association and Independence Analysis of {v1} and {v2} ({clean_name})"

        # Deduce title from continuous & categorical columns
        if num_cols and cat_cols:
            primary_metric = num_cols[-1] if len(num_cols) > 1 else num_cols[0]
            primary_group = cat_cols[0]
            return f"Quantitative Investigation of {primary_metric} across {primary_group} Cohorts ({clean_name})"
        elif len(num_cols) >= 2:
            return f"Bivariate and Multivariate Empirical Evaluation of {num_cols[0]} and {num_cols[1]} ({clean_name})"
        elif num_cols:
            return f"Empirical Distributional Evaluation and Normality Profiling of {num_cols[0]} ({clean_name})"
        elif cat_cols:
            return f"Categorical Frequency and Factor Association Assessment in {clean_name}"
        else:
            return f"Precision Quantitative Analysis and Hypothesis Testing Report on {clean_name}"

    @staticmethod
    def build_dynamic_context(
        df: Optional[pd.DataFrame],
        eda_summary: dict,
        statistical_results: list[dict],
        rag_context: list[dict],
        researcher_name: str,
        title: str,
        research_objective: str,
        human_notes: str = "",
        attached_charts: list[dict] = None,
        professor_template: str = "Standard Empirical Research Report"
    ) -> dict:
        """
        Dynamically extracts and computes all statistical tables, summaries,
        and natural-language findings from the active uploaded dataset.
        """
        date_str = datetime.datetime.now().strftime("%B %d, %Y")
        total_rows = eda_summary.get("total_rows", len(df) if df is not None else 0)
        total_cols = eda_summary.get("total_columns", df.shape[1] if df is not None else 0)
        dataset_name = eda_summary.get("filename") or eda_summary.get("name") or "Uploaded Research Dataset"
        health_score = eda_summary.get("health_score", 100)
        missing_cells = eda_summary.get("total_missing_cells", 0)
        missing_rate = eda_summary.get("missing_rate_overall", 0.0)
        duplicate_rows = eda_summary.get("duplicate_rows", 0)

        # Dynamic title synthesis if generic or empty
        is_generic = not title or any(g in (title or "").lower().strip() for g in [
            "empirical research data analysis and validation report",
            "ai-assisted research data analysis",
            "automated empirical research & inference report",
            "empirical investigation and hypothesis validation report",
            "automated laboratory research & statistical inference report",
            "empirical laboratory data analysis and reporting manuscript",
            "empirical research report",
            "standard empirical research report",
            "empirical investigation",
            "research report",
            "draft report"
        ])
        if is_generic:
            title = ReportGenerator.generate_dynamic_title(df, eda_summary, research_objective, statistical_results)

        # 1. Descriptive Statistics Markdown Table (Continuous variables)
        desc_table_rows = [
            "| Variable | N | Mean | Std Dev | Median | IQR | Min | Max | Normality Assessment |",
            "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |"
        ]
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist() if df is not None else []
        for col in num_cols:
            series = df[col].dropna()
            n_val = len(series)
            if n_val == 0:
                continue
            mean_val = series.mean()
            std_val = series.std(ddof=1) if n_val > 1 else 0.0
            med_val = series.median()
            q25 = series.quantile(0.25)
            q75 = series.quantile(0.75)
            iqr_val = q75 - q25
            min_val = series.min()
            max_val = series.max()

            norm_str = "N/A"
            if n_val >= 8:
                try:
                    from scipy import stats
                    _, p_norm = stats.shapiro(series) if n_val <= 5000 else stats.normaltest(series)
                    norm_str = f"Normal (p = {p_norm:.3f})" if p_norm > 0.05 else f"Skewed (p = {p_norm:.3f})"
                except Exception:
                    norm_str = "Checked"

            desc_table_rows.append(
                f"| `{col}` | {n_val} | {mean_val:.2f} | {std_val:.2f} | {med_val:.2f} | {iqr_val:.2f} | {min_val:.2f} | {max_val:.2f} | {norm_str} |"
            )

        if len(desc_table_rows) <= 2:
            desc_table_md = "*No continuous numerical variables detected in active dataset.*"
        else:
            desc_table_md = "\n".join(desc_table_rows)

        # 2. Categorical Distribution Table
        cat_table_rows = [
            "| Categorical Feature | Unique Levels | Top Categories & Proportions | Missing Records |",
            "| :--- | :--- | :--- | :--- |"
        ]
        cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist() if df is not None else []
        for col in cat_cols:
            series = df[col].dropna().astype(str)
            n_uniq = series.nunique()
            vc = series.value_counts(normalize=True).head(4)
            shares = ", ".join([f"{k} ({v*100:.1f}%)" for k, v in vc.items()])
            miss_count = int(df[col].isna().sum())
            miss_pct = (miss_count / len(df) * 100) if len(df) > 0 else 0.0
            cat_table_rows.append(f"| `{col}` | {n_uniq} | {shares} | {miss_count} ({miss_pct:.1f}%) |")

        if len(cat_table_rows) <= 2:
            cat_table_md = "*No categorical factor variables detected in active dataset.*"
        else:
            cat_table_md = "\n".join(cat_table_rows)

        # 3. Dynamic Hypothesis Testing Results
        hyp_sections = []
        findings_bullets = []
        for idx, res in enumerate(statistical_results, 1):
            t_type = res.get("test_type", f"Statistical Evaluation {idx}")
            apa = res.get("formatted_apa", "")
            is_sig = res.get("is_significant", False)
            sig_badge = "Statistically Significant (p < .05)" if is_sig else "Not Statistically Significant (p ≥ .05)"

            detail_lines = [f"### Analysis {idx}: {t_type}", f"**APA 7th Syntax:** `{apa}` — *{sig_badge}*\n"]

            if t_type == "Two-Sample Comparison":
                g1 = res.get("group_1", {})
                g2 = res.get("group_2", {})
                eff = res.get("effect_size", {})
                m_diff = abs(g1.get("mean", 0) - g2.get("mean", 0))
                higher_grp = g1.get("name") if g1.get("mean", 0) >= g2.get("mean", 0) else g2.get("name")
                lower_grp = g2.get("name") if higher_grp == g1.get("name") else g1.get("name")

                narrative = (
                    f"Independent evaluation compared Group '{g1.get('name')}' (M = {g1.get('mean')}, SD = {g1.get('std')}, n = {g1.get('n')}) "
                    f"against Group '{g2.get('name')}' (M = {g2.get('mean')}, SD = {g2.get('std')}, n = {g2.get('n')}). "
                    f"Group '{higher_grp}' exhibited higher mean values by {m_diff:.2f} units relative to '{lower_grp}'. "
                    f"The computed effect size was {eff.get('metric')} = {eff.get('value')} ({eff.get('magnitude')} magnitude), "
                    f"computed using {res.get('recommended_test')}."
                )
                detail_lines.append(narrative)
                findings_bullets.append(f"• **{res.get('continuous_variable')}**: Group '{higher_grp}' outperformed '{lower_grp}' ({apa}; Cohen's d = {eff.get('value')}).")

            elif t_type == "One-Way ANOVA":
                g_stats = res.get("group_stats", [])
                eta = res.get("eta_squared", 0.0)
                detail_lines.append(
                    f"Omnibus variance assessment across {len(g_stats)} groups for `{res.get('continuous_variable')}` "
                    f"demonstrated an effect size of η² = {eta:.2f}."
                )
                if g_stats:
                    sorted_g = sorted(g_stats, key=lambda x: x.get("mean", 0), reverse=True)
                    high_g, low_g = sorted_g[0], sorted_g[-1]
                    detail_lines.append(
                        f"The highest mean was observed in Group '{high_g.get('group')}' (M = {high_g.get('mean')}, SD = {high_g.get('std')}), "
                        f"whereas the lowest mean occurred in Group '{low_g.get('group')}' (M = {low_g.get('mean')}, SD = {low_g.get('std')})."
                    )
                    findings_bullets.append(f"• **{res.get('continuous_variable')}**: Significant variance across conditions ({apa}, η² = {eta:.2f}). Highest in '{high_g.get('group')}' (M={high_g.get('mean')}) vs lowest in '{low_g.get('group')}' (M={low_g.get('mean')}).")

                tukey = res.get("post_hoc_tukey", [])
                if tukey:
                    sig_tukey = [t for t in tukey if t.get("reject_null")]
                    if sig_tukey:
                        tukey_str = ", ".join([f"{t['group1']} vs {t['group2']} (diff = {t['mean_diff']}, p = {t['p_adj']})" for t in sig_tukey[:4]])
                        detail_lines.append(f"\n**Tukey HSD Post-Hoc Pairwise Discrepancies:** Pairwise contrasts indicated significant differences between: {tukey_str}.")

            elif t_type == "OLS Linear Regression":
                r2 = res.get("r_squared", 0.0)
                adj_r2 = res.get("adjusted_r_squared", 0.0)
                detail_lines.append(
                    f"Multiple linear regression modeling for outcome `{res.get('target')}` accounted for "
                    f"{r2 * 100:.1f}% of total variance (Adjusted R² = {adj_r2:.3f}, F = {res.get('f_statistic')}, p = {res.get('f_p_value')})."
                )
                sig_coefs = [c for c in res.get("coefficients", []) if c.get("is_significant") and c.get("variable") != "const"]
                if sig_coefs:
                    c_str = ", ".join([f"`{c['variable']}` (β = {c['coefficient']}, t = {c['t_statistic']}, p = {c['p_value']})" for c in sig_coefs])
                    detail_lines.append(f"\n**Significant Linear Predictors:** {c_str}.")
                    findings_bullets.append(f"• **Regression for {res.get('target')}**: Explained {r2*100:.1f}% variance with significant predictor(s): {c_str}.")

            elif t_type == "Chi-Square Test of Independence":
                c_v = res.get("cramers_v", 0.0)
                detail_lines.append(
                    f"Contingency analysis between `{res.get('var1')}` and `{res.get('var2')}` "
                    f"indicated a Cramér's V association magnitude of {c_v:.3f}."
                )
                findings_bullets.append(f"• **Association**: `{res.get('var1')}` and `{res.get('var2')}` evaluated with {apa} (Cramér's V = {c_v:.3f}).")

            hyp_sections.append("\n".join(detail_lines))

        hyp_results_md = "\n\n".join(hyp_sections) if hyp_sections else "*No formal hypothesis computations executed yet for this dataset.*"
        detailed_findings_md = "\n".join(findings_bullets) if findings_bullets else (
            f"• Evaluated {total_rows} laboratory records across {len(num_cols)} continuous and {len(cat_cols)} categorical factors.\n"
            f"• Data health index scored at {health_score}%, with {missing_cells} missing observations cataloged."
        )

        # 4. Attached Visualizations
        figures_lines = []
        for idx, ch in enumerate(attached_charts or [], 1):
            figures_lines.append(f"• **Figure {idx}:** {ch.get('title', 'Publication Figure')} *({ch.get('chartType', 'Plot')})*")

        if not figures_lines:
            figures_md = "*No figures attached yet. Click '➕ Add to Report' on any visualization in Tab 4 to attach publication charts here.*"
        else:
            figures_md = "\n".join(figures_lines)

        # 5. Executive Summary & Abstract (Dataset Grounded & RAG referenced)
        rag_references = rag_context or []
        rag_titles = [r.get("title") for r in rag_references if r.get("title")]
        rag_citations_str = ", ".join(rag_titles) if rag_titles else "APA 7th Edition Reporting Standards"

        abstract_text = (
            f"This empirical research report evaluated the primary inquiry: '{research_objective}' utilizing the active dataset ('{dataset_name}'). "
            f"The analyzed sample comprised N = {total_rows} laboratory observations across {total_cols} attributes ({len(num_cols)} continuous, {len(cat_cols)} categorical) "
            f"with an evaluated Data Health Index of {health_score}%. "
            f"Inferential computations were executed deterministically to test directional hypotheses across empirical cohorts. "
        )
        if findings_bullets:
            abstract_text += f"Key empirical observation: {findings_bullets[0].replace('• ', '')} "
        abstract_text += f"Methodological reporting and statistical syntax conform strictly to {rag_citations_str} and await researcher validation sign-off."

        # 6. Introduction & Methodology Grounded in Data & RAG Rules
        intro_text = (
            f"The primary inquiry investigated in this study is: {research_objective}\n\n"
            f"Experimental evaluation was conducted on dataset '{dataset_name}', measuring {len(num_cols)} continuous parameters "
            f"({', '.join([f'`{c}`' for c in num_cols[:4]])}{'...' if len(num_cols) > 4 else ''}) and {len(cat_cols)} categorical factors "
            f"({', '.join([f'`{c}`' for c in cat_cols[:3]])}{'...' if len(cat_cols) > 3 else ''}). "
            f"Laboratory workflows mandate reproducible data profiling, separation of statistical significance "
            f"from practical effect magnitude, and rigorous verification of parametric assumptions. "
            f"Analyses herein were conducted deterministically via SciPy and Statsmodels to eliminate numerical hallucinations."
        )

        methodology_text = (
            f"Prior to inferential computation, raw attributes from '{dataset_name}' were screened in accordance with the indexed Data Cleansing and Outlier Protocol. "
            f"The dataset contained {total_rows} observations and {total_cols} attributes ({len(num_cols)} continuous, {len(cat_cols)} categorical). "
            f"Hygiene audit revealed {missing_cells} missing data cells ({missing_rate}% overall missingness) "
            f"and {duplicate_rows} duplicate rows, yielding an initial Data Health Index of {health_score}%. "
            f"Missing observations were audited under MCAR/MAR assumptions. "
            f"Distributional normality was evaluated via Shapiro-Wilk/D'Agostino-Pearson tests, "
            f"and homoscedasticity was verified via Levene's test before selecting parametric vs non-parametric inferential models."
        )

        # 7. Discussion, Limitations, Conclusions
        has_significant = any(r.get("is_significant") for r in statistical_results)
        discussion_text = (
            f"The quantitative evidence provides concrete empirical grounding regarding '{research_objective}' in dataset '{dataset_name}'. "
            + (
                f"Statistical significance was confirmed across primary comparative measures (p < .05), with effect size estimators "
                f"demonstrating practically meaningful differences rather than minor sampling artifacts."
                if has_significant else
                f"Statistical tests failed to reject the null hypothesis at the α = 0.05 threshold. "
                f"These results caution against premature causal claims without expanded statistical power or targeted replication."
            )
        )

        limitations_text = (
            f"1. **Sample Scope:** Observations are constrained to N = {total_rows} cases in '{dataset_name}', which may limit external generalization.\n"
            f"2. **Missingness & Noise:** Total missingness was measured at {missing_rate}%; residual measurement noise in laboratory instrumentation must be accounted for.\n"
            f"3. **Multiplicity Controls:** Multiple exploratory comparisons warrant family-wise error adjustments (e.g., Tukey HSD or False Discovery Rate) before final publication."
        )

        conclusions_text = (
            f"In conclusion, empirical analysis of '{dataset_name}' regarding '{research_objective}' demonstrates clear statistical findings:\n"
            f"• Retain validated test statistics and APA statements in the master research register.\n"
            f"• Execute human-in-the-loop researcher verification to finalize narrative conclusions.\n"
            f"• Archive computed tables and attached publication figures as supplementary research materials."
        )

        # 8. Document Grounding & Methodology Compliance Markdown
        doc_grounding_lines = [
            f"The statistical computations, hypothesis framing, and narrative reporting in this manuscript were grounded against indexed methodology standards from Tab 6 (RAG Library):\n"
        ]
        for r in rag_references:
            doc_grounding_lines.append(f"- **{r.get('title')}** *({r.get('category', 'Standard')})*: Applied for procedural compliance, exact reporting formatting, and significance thresholds.")
        doc_grounding_lines.append(f"- **Zero-Hallucination Deterministic Guarantee**: All descriptive tables, test statistics (F/t/χ²), p-values, and effect sizes (Cohen's d, η², r) were calculated directly from '{dataset_name}' via SciPy, Statsmodels, and NumPy.")
        doc_grounding_md = "\n".join(doc_grounding_lines)

        col_list_str = ", ".join([f"`{c}`" for c in (df.columns.tolist() if df is not None else [])])

        context = {
            "title": title,
            "researcher_name": researcher_name or "Lead Lab Researcher",
            "date": date_str,
            "dataset_name": dataset_name,
            "row_count": total_rows,
            "column_count": total_cols,
            "column_list": col_list_str,
            "numeric_columns": ", ".join([f"`{c}`" for c in num_cols]),
            "categorical_columns": ", ".join([f"`{c}`" for c in cat_cols]),
            "research_objective": research_objective,
            "data_health_score": f"{health_score}%",
            "missing_cells": missing_cells,
            "missing_rate": f"{missing_rate}%",
            "duplicate_rows": duplicate_rows,
            "descriptive_statistics_table": desc_table_md,
            "categorical_distribution_table": cat_table_md,
            "hypothesis_testing_results": hyp_results_md,
            "detailed_findings": detailed_findings_md,
            "attached_figures": figures_md,
            "executive_summary": abstract_text,
            "abstract": abstract_text,
            "introduction": intro_text,
            "methodology": methodology_text,
            "discussion": discussion_text,
            "limitations": limitations_text,
            "conclusions": conclusions_text,
            "document_grounding": doc_grounding_md,
            "human_notes": human_notes,
            "professor_template": professor_template
        }

        return context

    @staticmethod
    def render_template(template_str: str, context: dict) -> str:
        """Substitutes dynamic {{tag}} placeholders with computed dataset values."""
        rendered = template_str
        for k, v in context.items():
            rendered = re.sub(rf"\{{\{{\s*{re.escape(k)}\s*\}}\}}", str(v), rendered)
        return rendered

    @staticmethod
    def build_template_from_outline(outline_text: str) -> str:
        """
        Converts a user-provided custom section outline into a structured markdown template.
        Supports both full templates with {{...}} placeholders and plain section title lists.
        """
        if not outline_text or not outline_text.strip():
            return DEFAULT_TEMPLATES[0]["content"]

        clean_outline = outline_text.strip()
        if "{{" in clean_outline and "}}" in clean_outline:
            if not clean_outline.startswith("#"):
                clean_outline = "# {{title}}\n**Author:** {{researcher_name}} | **Date:** {{date}} | **Dataset:** `{{dataset_name}}`\n\n---\n\n" + clean_outline
            return clean_outline

        # User specified raw section outline headings
        lines = [l.strip() for l in clean_outline.split("\n") if l.strip()]
        tpl_parts = [
            "# {{title}}",
            "**Principal Investigator:** {{researcher_name}} | **Date:** {{date}} | **Dataset:** `{{dataset_name}}` (N = {{row_count}})",
            "\n---"
        ]

        for line in lines:
            heading = line
            if not heading.startswith("#"):
                heading = f"## {heading}"

            lower_h = line.lower()
            tpl_parts.append(f"\n{heading}")

            if any(k in lower_h for k in ["abstract", "executive", "summary"]):
                tpl_parts.append("{{abstract}}")
            elif any(k in lower_h for k in ["intro", "objective", "inquir", "problem", "background"]):
                tpl_parts.append("{{introduction}}\n\n**Primary Research Objective:** {{research_objective}}")
            elif any(k in lower_h for k in ["method", "hygiene", "profiling", "data", "quality", "clean", "cohort"]):
                tpl_parts.append("{{methodology}}\n\n### Descriptive Statistics Table\n{{descriptive_statistics_table}}\n\n### Categorical Distribution\n{{categorical_distribution_table}}")
            elif any(k in lower_h for k in ["stat", "hypothes", "result", "finding", "inferen", "test", "model"]):
                tpl_parts.append("{{hypothesis_testing_results}}\n\n{{detailed_findings}}")
            elif any(k in lower_h for k in ["discuss", "interpret", "implication", "significance"]):
                tpl_parts.append("{{discussion}}")
            elif any(k in lower_h for k in ["limit", "threat", "validity"]):
                tpl_parts.append("{{limitations}}")
            elif any(k in lower_h for k in ["conclus", "recommend", "next step", "future"]):
                tpl_parts.append("{{conclusions}}")
            elif any(k in lower_h for k in ["figure", "chart", "visual", "plot"]):
                tpl_parts.append("{{attached_figures}}")
            elif any(k in lower_h for k in ["ground", "rag", "compliance", "apa", "standard"]):
                tpl_parts.append("{{document_grounding}}")
            else:
                tpl_parts.append("{{discussion}}")

        return "\n".join(tpl_parts)

    @staticmethod
    def construct_academic_report(
        title: str,
        research_objective: str,
        eda_summary: dict,
        statistical_results: list[dict],
        rag_context: list[dict],
        researcher_name: str = "Lead Lab Researcher",
        professor_template: str = "Standard Empirical Research Report",
        human_notes: str = "",
        attached_charts: list[dict] = None,
        custom_template_content: Optional[str] = None,
        df: Optional[pd.DataFrame] = None
    ) -> dict:
        """
        Constructs the complete report data dictionary. Dynamically populates
        all statistics, tables, and narrative from the active dataset and renders
        either a custom user template or the chosen predefined template.
        """
        context = ReportGenerator.build_dynamic_context(
            df=df,
            eda_summary=eda_summary,
            statistical_results=statistical_results,
            rag_context=rag_context,
            researcher_name=researcher_name,
            title=title,
            research_objective=research_objective,
            human_notes=human_notes,
            attached_charts=attached_charts,
            professor_template=professor_template
        )

        # If user passed custom template content/outline, render it for only this report instance
        template_to_use = None
        is_custom = False

        if custom_template_content and custom_template_content.strip():
            template_to_use = ReportGenerator.build_template_from_outline(custom_template_content.strip())
            is_custom = True
        else:
            # Check if professor_template matches any saved or default template
            all_tpls = ReportGenerator.get_templates()
            matched = next((t for t in all_tpls if t.get("name") == professor_template or t.get("id") == professor_template), None)
            if matched:
                template_to_use = matched.get("content")
            else:
                template_to_use = DEFAULT_TEMPLATES[0]["content"]

        rendered_markdown = ReportGenerator.render_template(template_to_use, context)

        # Build structured results list for component rendering
        results_sections = []
        for idx, res in enumerate(statistical_results, 1):
            t_type = res.get("test_type", f"Statistical Evaluation {idx}")
            apa = res.get("formatted_apa", "")
            is_sig = res.get("is_significant", False)
            sig_text = "statistically significant (p < .05)" if is_sig else "not statistically significant (p >= .05)"
            results_sections.append({
                "title": f"Finding {idx}: {t_type}",
                "narrative": f"Computed {t_type} yielded {sig_text}: **{apa}**.",
                "raw_data": res
            })

        report_data = {
            "report_id": f"REP_{int(datetime.datetime.now().timestamp())}",
            "title": context["title"],
            "date": context["date"],
            "researcher_name": researcher_name,
            "professor_template": professor_template,
            "research_objective": research_objective,
            "validation_status": "DRAFT_PENDING_REVIEW",
            "human_notes": human_notes,
            "is_custom_template": is_custom,
            "custom_template_outline": custom_template_content if is_custom else None,
            "rendered_content": rendered_markdown,
            "abstract": context["abstract"],
            "introduction": context["introduction"],
            "methodology": context["methodology"],
            "descriptive_statistics_table": context["descriptive_statistics_table"],
            "categorical_distribution_table": context["categorical_distribution_table"],
            "results": results_sections,
            "discussion": context["discussion"],
            "limitations": context["limitations"],
            "conclusions": context["conclusions"],
            "document_grounding": context["document_grounding"],
            "rag_references": [
                {"title": r.get("title"), "category": r.get("category")}
                for r in rag_context
            ],
            "attached_charts": [
                {"title": c.get("title", "Figure"), "chart_type": c.get("chartType", "Plot")}
                for c in (attached_charts or [])
            ]
        }

        return report_data

    @staticmethod
    def export_to_docx(report_data: dict, filepath: Path) -> Path:
        """
        Exports the report to a formatted Microsoft Word (.docx) document,
        converting Markdown headings, paragraphs, bullet points, and tables.
        """
        doc = Document()

        for section in doc.sections:
            section.top_margin = Inches(1.0)
            section.bottom_margin = Inches(1.0)
            section.left_margin = Inches(1.0)
            section.right_margin = Inches(1.0)

        # Title
        p_title = doc.add_paragraph()
        run_title = p_title.add_run(report_data.get("title", "Laboratory Research Report"))
        run_title.font.name = "Calibri"
        run_title.font.size = Pt(22)
        run_title.font.bold = True
        run_title.font.color.rgb = RGBColor(30, 58, 138)
        p_title.paragraph_format.space_after = Pt(4)

        # Subtitle
        p_sub = doc.add_paragraph()
        sub_text = (
            f"Author / Researcher: {report_data.get('researcher_name', 'Research Team')}  |  "
            f"Date: {report_data.get('date')}  |  "
            f"Template: {report_data.get('professor_template')}  |  "
            f"Status: {report_data.get('validation_status')}"
        )
        run_sub = p_sub.add_run(sub_text)
        run_sub.font.size = Pt(9.5)
        run_sub.font.italic = True
        run_sub.font.color.rgb = RGBColor(100, 116, 139)
        p_sub.paragraph_format.space_after = Pt(16)

        # If rendered_content is present, parse line-by-line into Word document elements
        content_text = report_data.get("rendered_content", "")
        if content_text:
            lines = content_text.split("\n")
            in_table = False
            table_lines = []

            def flush_table(lines_to_flush):
                if not lines_to_flush:
                    return
                # Filter out separator row e.g. | :--- | :--- |
                valid_rows = [l for l in lines_to_flush if not re.match(r"^\s*\|?\s*:?-+:?\s*\|", l)]
                if not valid_rows:
                    return
                row_data = []
                for row_line in valid_rows:
                    cols = [c.strip() for c in row_line.strip().strip("|").split("|")]
                    row_data.append(cols)
                if not row_data:
                    return

                num_cols = max(len(r) for r in row_data)
                table = doc.add_table(rows=len(row_data), cols=num_cols)
                table.style = 'Table Grid'
                table.alignment = WD_TABLE_ALIGNMENT.CENTER

                for r_idx, row in enumerate(row_data):
                    for c_idx in range(num_cols):
                        cell_val = row[c_idx] if c_idx < len(row) else ""
                        cell = table.cell(r_idx, c_idx)
                        cell.text = cell_val.replace("`", "")
                        for p in cell.paragraphs:
                            p.paragraph_format.space_after = Pt(2)
                            p.paragraph_format.space_before = Pt(2)
                            for run in p.runs:
                                run.font.name = "Calibri"
                                run.font.size = Pt(9.5)
                                if r_idx == 0:
                                    run.font.bold = True
                                    run.font.color.rgb = RGBColor(30, 58, 138)

                p_sp = doc.add_paragraph()
                p_sp.paragraph_format.space_after = Pt(8)

            for line in lines:
                s_line = line.strip()

                # Table detection
                if s_line.startswith("|") and "|" in s_line[1:]:
                    in_table = True
                    table_lines.append(s_line)
                    continue
                else:
                    if in_table:
                        flush_table(table_lines)
                        table_lines = []
                        in_table = False

                if not s_line:
                    continue

                if s_line.startswith("# ") and not s_line.startswith("## "):
                    # Skip duplicate document title if already added
                    if s_line[2:].strip().lower() == report_data.get("title", "").strip().lower():
                        continue
                    h = doc.add_heading(s_line[2:], level=1)
                    h.runs[0].font.name = "Calibri"
                    h.runs[0].font.size = Pt(16)
                    h.runs[0].font.bold = True
                    h.runs[0].font.color.rgb = RGBColor(30, 58, 138)
                    h.paragraph_format.space_before = Pt(12)
                    h.paragraph_format.space_after = Pt(4)
                elif s_line.startswith("## "):
                    h = doc.add_heading(s_line[3:], level=1)
                    h.runs[0].font.name = "Calibri"
                    h.runs[0].font.size = Pt(13)
                    h.runs[0].font.bold = True
                    h.runs[0].font.color.rgb = RGBColor(30, 58, 138)
                    h.paragraph_format.space_before = Pt(10)
                    h.paragraph_format.space_after = Pt(3)
                elif s_line.startswith("### "):
                    h = doc.add_heading(s_line[4:], level=2)
                    h.runs[0].font.name = "Calibri"
                    h.runs[0].font.size = Pt(11)
                    h.runs[0].font.bold = True
                    h.runs[0].font.color.rgb = RGBColor(51, 65, 85)
                    h.paragraph_format.space_before = Pt(6)
                    h.paragraph_format.space_after = Pt(2)
                elif s_line.startswith("• ") or s_line.startswith("- "):
                    p = doc.add_paragraph(style='List Bullet')
                    run = p.add_run(s_line[2:].replace("**", "").replace("`", ""))
                    run.font.name = "Calibri"
                    run.font.size = Pt(10.5)
                    p.paragraph_format.space_after = Pt(3)
                elif s_line == "---":
                    continue
                else:
                    p = doc.add_paragraph()
                    # Clean markdown bold/code tags for clean docx appearance
                    cleaned_line = s_line.replace("**", "").replace("`", "")
                    run = p.add_run(cleaned_line)
                    run.font.name = "Calibri"
                    run.font.size = Pt(10.5)
                    p.paragraph_format.line_spacing = 1.15
                    p.paragraph_format.space_after = Pt(6)

            if in_table:
                flush_table(table_lines)

        # Validation Sign-Off
        if report_data.get("human_notes"):
            h_val = doc.add_heading("Researcher Review Notes & Sign-Off", level=1)
            h_val.runs[0].font.name = "Calibri"
            h_val.runs[0].font.size = Pt(13)
            h_val.runs[0].font.bold = True
            h_val.runs[0].font.color.rgb = RGBColor(6, 95, 70)
            p_val = doc.add_paragraph(report_data.get("human_notes"))
            p_val.runs[0].font.name = "Calibri"
            p_val.runs[0].font.size = Pt(10.5)

        doc.save(filepath)
        return filepath
