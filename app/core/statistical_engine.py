import math
import warnings
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm
from statsmodels.stats.multicomp import pairwise_tukeyhsd

warnings.filterwarnings("ignore")


def sanitize_for_json(val):
    """Recursively sanitize data structures for JSON compliance (handles NaN, inf, numpy types)."""
    if val is None:
        return None
    if isinstance(val, (float, np.floating)):
        if math.isnan(val) or math.isinf(val):
            return 0.0
        return float(val)
    if isinstance(val, (bool, np.bool_)):
        return bool(val)
    if isinstance(val, (int, np.integer)):
        return int(val)
    if isinstance(val, np.ndarray):
        return [sanitize_for_json(x) for x in val.tolist()]
    if isinstance(val, dict):
        return {str(k): sanitize_for_json(v) for k, v in val.items()}
    if isinstance(val, (list, tuple, set)):
        return [sanitize_for_json(item) for item in val]
    return val


class StatisticalEngine:
    """
    Precision Scientific Computation Engine.
    Executes verifiable, exact statistical tests via SciPy, Statsmodels, and NumPy.
    Prevents LLM math hallucinations by computing all values programmatically.
    """

    @staticmethod
    def get_summary_statistics(df: pd.DataFrame) -> dict:
        """Compute exhaustive descriptive statistics for numerical and categorical features."""
        summary = {
            "total_rows": int(len(df)),
            "total_columns": int(df.shape[1]),
            "numerical_summary": {},
            "categorical_summary": {}
        }

        # Numeric columns
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        for col in num_cols:
            series = df[col].dropna()
            if len(series) == 0:
                continue
            
            mean_val = float(series.mean())
            std_val = float(series.std(ddof=1)) if len(series) > 1 else 0.0
            sem_val = float(series.sem()) if len(series) > 1 else 0.0
            ci95 = [float(mean_val - 1.96 * sem_val), float(mean_val + 1.96 * sem_val)]
            
            # Normality check (Shapiro if n <= 5000, else D'Agostino)
            normality_p = None
            if len(series) >= 8:
                try:
                    if len(series) <= 5000:
                        _, norm_p = stats.shapiro(series)
                    else:
                        _, norm_p = stats.normaltest(series)
                    normality_p = float(norm_p)
                except Exception:
                    normality_p = None

            q25 = float(series.quantile(0.25))
            q75 = float(series.quantile(0.75))
            iqr_val = float(q75 - q25)

            # Outlier bounds (1.5 * IQR)
            lower_bound = q25 - 1.5 * iqr_val
            upper_bound = q75 + 1.5 * iqr_val
            outlier_count = int(((series < lower_bound) | (series > upper_bound)).sum())

            summary["numerical_summary"][col] = {
                "count": int(len(series)),
                "missing": int(df[col].isna().sum()),
                "mean": round(mean_val, 4),
                "std": round(std_val, 4),
                "sem": round(sem_val, 4),
                "ci95": [round(ci95[0], 4), round(ci95[1], 4)],
                "median": round(float(series.median()), 4),
                "iqr": round(iqr_val, 4),
                "min": round(float(series.min()), 4),
                "max": round(float(series.max()), 4),
                "q25": round(q25, 4),
                "q75": round(q75, 4),
                "skewness": round(float(series.skew()), 4) if len(series) > 2 else 0.0,
                "kurtosis": round(float(series.kurtosis()), 4) if len(series) > 3 else 0.0,
                "outliers_count": outlier_count,
                "is_normally_distributed": bool(normality_p is not None and normality_p > 0.05),
                "normality_p_value": round(normality_p, 5) if normality_p is not None else None
            }

        # Categorical columns
        cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
        for col in cat_cols:
            series = df[col].dropna().astype(str)
            val_counts = series.value_counts()
            top_freq = val_counts.head(8).to_dict()
            total_valid = len(series)
            
            top_percentages = {
                k: round(float((v / total_valid) * 100), 2)
                for k, v in top_freq.items()
            } if total_valid > 0 else {}

            summary["categorical_summary"][col] = {
                "count": total_valid,
                "missing": int(df[col].isna().sum()),
                "unique_values": int(series.nunique()),
                "mode": str(series.mode().iloc[0]) if not series.empty else "N/A",
                "frequencies": {str(k): int(v) for k, v in top_freq.items()},
                "percentages": top_percentages
            }

        return sanitize_for_json(summary)

    @staticmethod
    def calculate_correlations(df: pd.DataFrame, method: str = "pearson") -> dict:
        """Calculate correlation matrix with corresponding exact p-values."""
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if len(num_cols) < 2:
            return {"error": "Need at least 2 numerical columns for correlation analysis."}

        clean_df = df[num_cols].dropna()
        if len(clean_df) < 3:
            return {"error": "Insufficient complete rows for correlation calculation."}

        n = len(num_cols)
        corr_matrix = {}
        pval_matrix = {}
        significant_pairs = []

        for i in range(n):
            col1 = num_cols[i]
            corr_matrix[col1] = {}
            pval_matrix[col1] = {}
            for j in range(n):
                col2 = num_cols[j]
                if col1 == col2:
                    corr_matrix[col1][col2] = 1.0
                    pval_matrix[col1][col2] = 0.0
                else:
                    if method == "spearman":
                        r, p = stats.spearmanr(clean_df[col1], clean_df[col2])
                    else:
                        r, p = stats.pearsonr(clean_df[col1], clean_df[col2])
                    
                    r_val = 0.0 if np.isnan(r) else round(float(r), 4)
                    p_val = 1.0 if np.isnan(p) else round(float(p), 5)
                    corr_matrix[col1][col2] = r_val
                    pval_matrix[col1][col2] = p_val

                    if i < j:
                        # Characterize strength
                        abs_r = abs(r_val)
                        if abs_r >= 0.7:
                            strength = "Strong"
                        elif abs_r >= 0.4:
                            strength = "Moderate"
                        elif abs_r >= 0.2:
                            strength = "Weak"
                        else:
                            strength = "Negligible"

                        significant_pairs.append({
                            "var1": col1,
                            "var2": col2,
                            "correlation": r_val,
                            "p_value": p_val,
                            "is_significant": bool(p_val < 0.05),
                            "strength": strength,
                            "direction": "Positive" if r_val > 0 else "Negative",
                            "formatted_apa": f"r({len(clean_df)-2}) = {r_val:.2f}, p {'< .001' if p_val < 0.001 else f'= {p_val:.3f}'}"
                        })

        significant_pairs.sort(key=lambda x: abs(x["correlation"]), reverse=True)

        return sanitize_for_json({
            "columns": num_cols,
            "correlation_matrix": corr_matrix,
            "p_value_matrix": pval_matrix,
            "pair_rankings": significant_pairs,
            "sample_size": len(clean_df),
            "method": method
        })

    @staticmethod
    def two_sample_test(df: pd.DataFrame, continuous_col: str, group_col: str) -> dict:
        """
        Independent samples comparison (t-test / Welch's t-test / Mann-Whitney U).
        Includes Levene's variance homogeneity check and Cohen's d effect size.
        """
        clean = df[[continuous_col, group_col]].dropna()
        groups = clean[group_col].unique()

        if len(groups) != 2:
            return {"error": f"Group column '{group_col}' must have exactly 2 distinct levels, found {len(groups)}: {list(groups)[:5]}"}

        g1_name, g2_name = str(groups[0]), str(groups[1])
        s1 = clean[clean[group_col] == groups[0]][continuous_col]
        s2 = clean[clean[group_col] == groups[1]][continuous_col]

        if len(s1) < 3 or len(s2) < 3:
            return {"error": "Each group must have at least 3 valid observations."}

        # Normality tests
        _, norm_p1 = stats.shapiro(s1) if len(s1) <= 5000 else stats.normaltest(s1)
        _, norm_p2 = stats.shapiro(s2) if len(s2) <= 5000 else stats.normaltest(s2)
        both_normal = (norm_p1 > 0.05 and norm_p2 > 0.05)

        # Variance homogeneity (Levene's test)
        levene_stat, levene_p = stats.levene(s1, s2)
        equal_var = (levene_p > 0.05)

        # Standard Student's or Welch's t-test
        t_stat, t_pval = stats.ttest_ind(s1, s2, equal_var=equal_var)
        df_deg = (len(s1) + len(s2) - 2) if equal_var else round(
            ((s1.var(ddof=1)/len(s1) + s2.var(ddof=1)/len(s2))**2) /
            (((s1.var(ddof=1)/len(s1))**2)/(len(s1)-1) + ((s2.var(ddof=1)/len(s2))**2)/(len(s2)-1)), 1
        )

        # Non-parametric Mann-Whitney U test
        u_stat, u_pval = stats.mannwhitneyu(s1, s2, alternative="two-sided")

        # Cohen's d effect size
        n1, n2 = len(s1), len(s2)
        s1_var, s2_var = s1.var(ddof=1), s2.var(ddof=1)
        pooled_sd = np.sqrt(((n1 - 1) * s1_var + (n2 - 1) * s2_var) / (n1 + n2 - 2)) if (n1 + n2 - 2) > 0 else 1.0
        cohens_d = (s1.mean() - s2.mean()) / pooled_sd if (pooled_sd and not math.isnan(pooled_sd) and pooled_sd > 0) else 0.0
        if math.isnan(cohens_d) or math.isinf(cohens_d):
            cohens_d = 0.0

        # Effect magnitude interpretation
        abs_d = abs(cohens_d)
        if abs_d >= 0.8:
            effect_magnitude = "Large"
        elif abs_d >= 0.5:
            effect_magnitude = "Medium"
        elif abs_d >= 0.2:
            effect_magnitude = "Small"
        else:
            effect_magnitude = "Negligible"

        chosen_test = "Welch's t-test" if not equal_var else ("Student's t-test" if both_normal else "Mann-Whitney U Test (Non-parametric)")
        final_pval = float(t_pval) if (both_normal or len(s1) >= 30) else float(u_pval)
        if math.isnan(final_pval) or math.isinf(final_pval):
            final_pval = 1.0

        safe_t = float(t_stat) if not (math.isnan(t_stat) or math.isinf(t_stat)) else 0.0
        safe_p = float(t_pval) if not (math.isnan(t_pval) or math.isinf(t_pval)) else 1.0
        p_str = '< .001' if safe_p < 0.001 else f'= {safe_p:.3f}'

        return sanitize_for_json({
            "test_type": "Two-Sample Comparison",
            "continuous_variable": continuous_col,
            "group_variable": group_col,
            "group_1": {
                "name": g1_name,
                "n": int(len(s1)),
                "mean": round(float(s1.mean()), 4) if not math.isnan(s1.mean()) else 0.0,
                "std": round(float(s1.std(ddof=1)), 4) if len(s1) > 1 and not math.isnan(s1.std(ddof=1)) else 0.0,
                "median": round(float(s1.median()), 4) if not math.isnan(s1.median()) else 0.0,
                "normality_p": round(float(norm_p1), 5) if not math.isnan(norm_p1) else 0.0
            },
            "group_2": {
                "name": g2_name,
                "n": int(len(s2)),
                "mean": round(float(s2.mean()), 4) if not math.isnan(s2.mean()) else 0.0,
                "std": round(float(s2.std(ddof=1)), 4) if len(s2) > 1 and not math.isnan(s2.std(ddof=1)) else 0.0,
                "median": round(float(s2.median()), 4) if not math.isnan(s2.median()) else 0.0,
                "normality_p": round(float(norm_p2), 5) if not math.isnan(norm_p2) else 0.0
            },
            "levene_test": {
                "statistic": round(float(levene_stat), 4) if not math.isnan(levene_stat) else 0.0,
                "p_value": round(float(levene_p), 5) if not math.isnan(levene_p) else 1.0,
                "equal_variances_assumed": bool(equal_var)
            },
            "t_test": {
                "t_statistic": round(safe_t, 4),
                "degrees_of_freedom": df_deg,
                "p_value": round(safe_p, 5),
                "test_variant": "Welch's (Unequal variance)" if not equal_var else "Student's (Equal variance)"
            },
            "mann_whitney_u": {
                "u_statistic": round(float(u_stat), 4) if not math.isnan(u_stat) else 0.0,
                "p_value": round(float(u_pval), 5) if not math.isnan(u_pval) else 1.0
            },
            "effect_size": {
                "metric": "Cohen's d",
                "value": round(float(cohens_d), 4),
                "magnitude": effect_magnitude
            },
            "recommended_test": chosen_test,
            "is_significant": bool(final_pval < 0.05),
            "formatted_apa": f"t({df_deg}) = {safe_t:.2f}, p {p_str}, d = {cohens_d:.2f}"
        })

    @staticmethod
    def anova_test(df: pd.DataFrame, continuous_col: str, group_col: str) -> dict:
        """One-Way Analysis of Variance (ANOVA), Kruskal-Wallis, and Tukey HSD post-hoc."""
        clean = df[[continuous_col, group_col]].dropna()
        groups = clean[group_col].unique()

        if len(groups) < 3:
            return {"error": f"ANOVA requires 3 or more groups. Found {len(groups)}."}

        group_series = [clean[clean[group_col] == g][continuous_col].values for g in groups]
        group_stats = []

        total_variance_sum = 0
        total_n = len(clean)

        for g in groups:
            sub = clean[clean[group_col] == g][continuous_col]
            s_mean = float(sub.mean()) if len(sub) > 0 else 0.0
            s_std = float(sub.std(ddof=1)) if len(sub) > 1 else 0.0
            s_med = float(sub.median()) if len(sub) > 0 else 0.0
            if math.isnan(s_mean) or math.isinf(s_mean): s_mean = 0.0
            if math.isnan(s_std) or math.isinf(s_std): s_std = 0.0
            if math.isnan(s_med) or math.isinf(s_med): s_med = 0.0
            group_stats.append({
                "group": str(g),
                "n": int(len(sub)),
                "mean": round(s_mean, 4),
                "std": round(s_std, 4),
                "median": round(s_med, 4)
            })

        # One-way ANOVA
        try:
            f_stat, p_val = stats.f_oneway(*group_series)
            f_stat = float(f_stat) if not (math.isnan(f_stat) or math.isinf(f_stat)) else 0.0
            p_val = float(p_val) if not (math.isnan(p_val) or math.isinf(p_val)) else 1.0
        except Exception:
            f_stat, p_val = 0.0, 1.0

        df_between = len(groups) - 1
        df_within = max(1, total_n - len(groups))

        # Eta-squared calculation (SS_between / SS_total)
        grand_mean = clean[continuous_col].mean()
        ss_between = sum(len(sub) * (sub.mean() - grand_mean)**2 for sub in [clean[clean[group_col] == g][continuous_col] for g in groups])
        ss_total = sum((clean[continuous_col] - grand_mean)**2)
        eta_squared = (ss_between / ss_total) if ss_total > 0 else 0.0
        if math.isnan(eta_squared) or math.isinf(eta_squared):
            eta_squared = 0.0

        # Non-parametric Kruskal-Wallis H test
        try:
            h_stat, kw_p = stats.kruskal(*group_series)
            h_stat = float(h_stat) if not (math.isnan(h_stat) or math.isinf(h_stat)) else 0.0
            kw_p = float(kw_p) if not (math.isnan(kw_p) or math.isinf(kw_p)) else 1.0
        except Exception:
            h_stat, kw_p = 0.0, 1.0

        # Post-hoc Tukey HSD
        tukey_results = []
        try:
            tukey = pairwise_tukeyhsd(endog=clean[continuous_col], groups=clean[group_col], alpha=0.05)
            for row in tukey.summary()[1:]:
                md = float(row[2]) if not math.isnan(float(row[2])) else 0.0
                padj = float(row[3]) if not math.isnan(float(row[3])) else 1.0
                cl = float(row[4]) if not math.isnan(float(row[4])) else 0.0
                cu = float(row[5]) if not math.isnan(float(row[5])) else 0.0
                tukey_results.append({
                    "group1": str(row[0]),
                    "group2": str(row[1]),
                    "mean_diff": round(md, 4),
                    "p_adj": round(padj, 5),
                    "ci_lower": round(cl, 4),
                    "ci_upper": round(cu, 4),
                    "reject_null": bool(str(row[6]).strip().lower() == "true")
                })
        except Exception:
            tukey_results = []

        p_str = '< .001' if p_val < 0.001 else f'= {p_val:.3f}'
        return sanitize_for_json({
            "test_type": "One-Way ANOVA",
            "continuous_variable": continuous_col,
            "group_variable": group_col,
            "group_stats": group_stats,
            "f_statistic": round(f_stat, 4),
            "degrees_of_freedom": f"F({df_between}, {df_within})",
            "p_value": round(p_val, 5),
            "eta_squared": round(eta_squared, 4),
            "is_significant": bool(p_val < 0.05),
            "kruskal_wallis": {
                "h_statistic": round(h_stat, 4),
                "p_value": round(kw_p, 5)
            },
            "post_hoc_tukey": tukey_results,
            "formatted_apa": f"F({df_between}, {df_within}) = {f_stat:.2f}, p {p_str}, η² = {eta_squared:.2f}"
        })


    @staticmethod
    def chi_square_test(df: pd.DataFrame, var1: str, var2: str) -> dict:
        """Chi-Square Test of Independence for categorical variables with Cramér's V."""
        clean = df[[var1, var2]].dropna()
        contingency_table = pd.crosstab(clean[var1], clean[var2])

        if contingency_table.shape[0] < 2 or contingency_table.shape[1] < 2:
            return {"error": "Both variables must have at least 2 distinct levels."}

        chi2, p_val, dof, expected = stats.chi2_contingency(contingency_table)
        n = contingency_table.sum().sum()

        # Cramér's V
        min_dim = min(contingency_table.shape[0] - 1, contingency_table.shape[1] - 1)
        cramers_v = np.sqrt(chi2 / (n * min_dim)) if (n * min_dim) > 0 else 0.0

        safe_chi2 = float(chi2) if not (math.isnan(chi2) or math.isinf(chi2)) else 0.0
        safe_p = float(p_val) if not (math.isnan(p_val) or math.isinf(p_val)) else 1.0
        safe_v = float(cramers_v) if not (math.isnan(cramers_v) or math.isinf(cramers_v)) else 0.0
        p_str = '< .001' if safe_p < 0.001 else f'= {safe_p:.3f}'

        return sanitize_for_json({
            "test_type": "Chi-Square Test of Independence",
            "var1": var1,
            "var2": var2,
            "chi2_statistic": round(safe_chi2, 4),
            "degrees_of_freedom": int(dof),
            "p_value": round(safe_p, 5),
            "cramers_v": round(safe_v, 4),
            "sample_size": int(n),
            "is_significant": bool(safe_p < 0.05),
            "contingency_table": contingency_table.to_dict(),
            "formatted_apa": f"χ²({dof}, N = {n}) = {safe_chi2:.2f}, p {p_str}, V = {safe_v:.2f}"
        })

    @staticmethod
    def linear_regression(df: pd.DataFrame, target_col: str, feature_cols: list[str]) -> dict:
        """OLS Multiple Linear Regression with parameter significance, R2, and diagnostics."""
        clean = df[[target_col] + feature_cols].dropna()
        if len(clean) < len(feature_cols) + 2:
            return {"error": "Insufficient observations relative to number of predictors."}

        y = clean[target_col]
        X = clean[feature_cols]
        X_with_const = sm.add_constant(X)

        model = sm.OLS(y, X_with_const).fit()

        coef_table = []
        for param_name in model.params.index:
            coef_table.append({
                "variable": param_name,
                "coefficient": round(float(model.params[param_name]), 4) if not math.isnan(model.params[param_name]) else 0.0,
                "std_err": round(float(model.bse[param_name]), 4) if not math.isnan(model.bse[param_name]) else 0.0,
                "t_statistic": round(float(model.tvalues[param_name]), 4) if not math.isnan(model.tvalues[param_name]) else 0.0,
                "p_value": round(float(model.pvalues[param_name]), 5) if not math.isnan(model.pvalues[param_name]) else 1.0,
                "ci_lower": round(float(model.conf_int().loc[param_name][0]), 4) if not math.isnan(model.conf_int().loc[param_name][0]) else 0.0,
                "ci_upper": round(float(model.conf_int().loc[param_name][1]), 4) if not math.isnan(model.conf_int().loc[param_name][1]) else 0.0,
                "is_significant": bool(model.pvalues[param_name] < 0.05) if not math.isnan(model.pvalues[param_name]) else False
            })

        # Residual diagnostics
        residuals = model.resid
        jb_stat, jb_pval, _, _ = stats.jarque_bera(residuals) if len(residuals) >= 8 else (0, 1, 0, 0)

        safe_r2 = float(model.rsquared) if not (math.isnan(model.rsquared) or math.isinf(model.rsquared)) else 0.0
        safe_f = float(model.fvalue) if model.fvalue is not None and not (math.isnan(model.fvalue) or math.isinf(model.fvalue)) else 0.0
        safe_fp = float(model.f_pvalue) if model.f_pvalue is not None and not (math.isnan(model.f_pvalue) or math.isinf(model.f_pvalue)) else 1.0
        p_str = '< .001' if safe_fp < 0.001 else f'= {safe_fp:.3f}'

        return sanitize_for_json({
            "test_type": "OLS Linear Regression",
            "target": target_col,
            "predictors": feature_cols,
            "sample_size": int(model.nobs),
            "r_squared": round(safe_r2, 4),
            "adjusted_r_squared": round(float(model.rsquared_adj), 4) if not (math.isnan(model.rsquared_adj) or math.isinf(model.rsquared_adj)) else 0.0,
            "f_statistic": round(safe_f, 4),
            "f_p_value": round(safe_fp, 5),
            "aic": round(float(model.aic), 2) if not (math.isnan(model.aic) or math.isinf(model.aic)) else 0.0,
            "bic": round(float(model.bic), 2) if not (math.isnan(model.bic) or math.isinf(model.bic)) else 0.0,
            "coefficients": coef_table,
            "residual_normality_p": round(float(jb_pval), 5) if not math.isnan(jb_pval) else 1.0,
            "formatted_apa": f"R² = {safe_r2:.2f}, F({len(feature_cols)}, {int(model.df_resid)}) = {safe_f:.2f}, p {p_str}"
        })

    @staticmethod
    def auto_recommend_analysis(df: pd.DataFrame, research_objective: str = "") -> list[dict]:
        """
        AI heuristic recommender: parses data structure and research objective
        to recommend suitable tests with zero guesswork.
        """
        recommendations = []
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

        obj_lower = research_objective.lower()

        # 1. Two-sample comparisons if any binary category exists
        for cat in cat_cols:
            if df[cat].nunique() == 2:
                for num in num_cols:
                    recommendations.append({
                        "test": "two_sample_test",
                        "name": f"Two-Sample Test: {num} across {cat}",
                        "params": {"continuous_col": num, "group_col": cat},
                        "reason": f"Compare continuous metric '{num}' across binary categories of '{cat}'."
                    })

        # 2. ANOVA if any categorical column has 3-8 categories
        for cat in cat_cols:
            if 3 <= df[cat].nunique() <= 8:
                for num in num_cols[:3]:
                    recommendations.append({
                        "test": "anova_test",
                        "name": f"One-Way ANOVA: {num} by {cat}",
                        "params": {"continuous_col": num, "group_col": cat},
                        "reason": f"Compare variance in '{num}' across {df[cat].nunique()} levels of '{cat}'."
                    })

        # 3. Correlation if multiple numeric columns
        if len(num_cols) >= 2:
            recommendations.append({
                "test": "correlation_analysis",
                "name": "Bivariate Correlation Matrix",
                "params": {"method": "pearson"},
                "reason": f"Assess pairwise linear relationships among {len(num_cols)} continuous variables."
            })

        # 4. Chi-Square if multiple categorical columns
        if len(cat_cols) >= 2:
            for i in range(min(len(cat_cols), 3)):
                for j in range(i+1, min(len(cat_cols), 3)):
                    c1, c2 = cat_cols[i], cat_cols[j]
                    if df[c1].nunique() <= 10 and df[c2].nunique() <= 10:
                        recommendations.append({
                            "test": "chi_square_test",
                            "name": f"Chi-Square Association: {c1} & {c2}",
                            "params": {"var1": c1, "var2": c2},
                            "reason": f"Test statistical independence between categorical factors '{c1}' and '{c2}'."
                        })

        # 5. Regression if potential target and predictors exist
        if len(num_cols) >= 2:
            target = num_cols[-1]
            predictors = num_cols[:-1][:5]
            recommendations.append({
                "test": "linear_regression",
                "name": f"OLS Linear Regression for {target}",
                "params": {"target_col": target, "feature_cols": predictors},
                "reason": f"Model effects of {len(predictors)} predictor(s) on dependent outcome '{target}'."
            })

        # Prioritize based on keywords in research objective
        if research_objective:
            for rec in recommendations:
                score = 0
                for word in obj_lower.split():
                    if word in rec["name"].lower() or word in rec["reason"].lower():
                        score += 2
                rec["priority"] = score
            recommendations.sort(key=lambda x: x.get("priority", 0), reverse=True)

        return recommendations[:8]
