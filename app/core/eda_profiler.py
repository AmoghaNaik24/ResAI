import numpy as np
import pandas as pd


class EDAProfiler:
    """
    Automated Data Quality Assessment & Profiling Engine.
    Evaluates dataset readiness, detects anomalies/outliers, and computes health scores.
    """

    @staticmethod
    def profile_dataset(df: pd.DataFrame) -> dict:
        total_rows = len(df)
        total_cols = df.shape[1]
        if total_rows == 0:
            return {"error": "Empty dataset."}

        duplicate_rows = int(df.duplicated().sum())
        total_cells = total_rows * total_cols
        total_missing_cells = int(df.isna().sum().sum())
        missing_rate = (total_missing_cells / total_cells) if total_cells > 0 else 0.0

        columns_profile = {}
        issues_detected = []

        for col in df.columns:
            series = df[col]
            missing_count = int(series.isna().sum())
            missing_pct = round((missing_count / total_rows) * 100, 2)
            unique_count = int(series.nunique())
            
            is_numeric = pd.api.types.is_numeric_dtype(series)
            inferred_type = "numeric" if is_numeric else "categorical"

            col_info = {
                "name": str(col),
                "type": inferred_type,
                "missing_count": missing_count,
                "missing_percentage": missing_pct,
                "unique_values": unique_count,
                "unique_ratio": round(unique_count / total_rows, 4),
                "issues": []
            }

            # Hygiene checks
            if missing_pct > 20.0:
                issue = f"High missing rate ({missing_pct}%). Consider imputation or evaluation of missing mechanism."
                col_info["issues"].append(issue)
                issues_detected.append(f"Column '{col}': {issue}")

            if unique_count == 1:
                issue = "Zero variance (constant value). Uninformative for statistical modeling."
                col_info["issues"].append(issue)
                issues_detected.append(f"Column '{col}': {issue}")

            if not is_numeric and unique_count == total_rows and total_rows > 10:
                issue = "Distinct identifier (100% unique strings). Exclude from group testing."
                col_info["issues"].append(issue)

            # Numerical diagnostics
            if is_numeric:
                clean_s = series.dropna()
                if len(clean_s) > 0:
                    q25, q75 = clean_s.quantile(0.25), clean_s.quantile(0.75)
                    iqr = q75 - q25
                    lower_bound = q25 - 1.5 * iqr
                    upper_bound = q75 + 1.5 * iqr
                    outliers_count = int(((clean_s < lower_bound) | (clean_s > upper_bound)).sum())
                    col_info["outliers_count"] = outliers_count
                    col_info["outliers_pct"] = round((outliers_count / len(clean_s)) * 100, 2)

                    skew = float(clean_s.skew()) if len(clean_s) > 2 else 0.0
                    col_info["skewness"] = round(skew, 2)
                    if abs(skew) > 1.5:
                        issue = f"Substantial skewness ({skew:.2f}). Non-parametric test or log transform may be required."
                        col_info["issues"].append(issue)
                        issues_detected.append(f"Column '{col}': {issue}")
                else:
                    col_info["outliers_count"] = 0
                    col_info["skewness"] = 0.0

            columns_profile[col] = col_info

        # Overall Health Score (0 - 100)
        health_score = 100.0
        health_score -= (missing_rate * 50)  # Max 50 pts off for missing data
        if duplicate_rows > 0:
            health_score -= min(15, (duplicate_rows / total_rows) * 100)
        health_score -= min(20, len(issues_detected) * 3)
        health_score = max(10.0, round(health_score, 1))

        # Sample preview
        preview_head = df.head(10).replace({np.nan: None}).to_dict(orient="records")

        return {
            "total_rows": total_rows,
            "total_columns": total_cols,
            "duplicate_rows": duplicate_rows,
            "total_missing_cells": total_missing_cells,
            "missing_rate_overall": round(missing_rate * 100, 2),
            "health_score": health_score,
            "issues": issues_detected,
            "columns": columns_profile,
            "sample_records": preview_head,
            "numerical_columns": df.select_dtypes(include=[np.number]).columns.tolist(),
            "categorical_columns": df.select_dtypes(exclude=[np.number]).columns.tolist()
        }

    @staticmethod
    def clean_dataset(df: pd.DataFrame, drop_duplicates: bool = True, impute_numeric: str = "median", impute_categorical: str = "mode") -> pd.DataFrame:
        """Standard research preprocessing tool for missing values and duplicates."""
        cleaned = df.copy()

        if drop_duplicates:
            cleaned = cleaned.drop_duplicates()

        # Numeric imputation
        num_cols = cleaned.select_dtypes(include=[np.number]).columns
        for col in num_cols:
            if cleaned[col].isna().sum() > 0:
                if impute_numeric == "median":
                    fill_val = cleaned[col].median()
                elif impute_numeric == "mean":
                    fill_val = cleaned[col].mean()
                else:
                    fill_val = 0
                cleaned[col] = cleaned[col].fillna(fill_val)

        # Categorical imputation
        cat_cols = cleaned.select_dtypes(exclude=[np.number]).columns
        for col in cat_cols:
            if cleaned[col].isna().sum() > 0:
                if impute_categorical == "mode" and not cleaned[col].mode().empty:
                    fill_val = cleaned[col].mode().iloc[0]
                else:
                    fill_val = "Unknown"
                cleaned[col] = cleaned[col].fillna(fill_val)

        return cleaned
