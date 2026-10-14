import io
import base64
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import plotly.figure_factory as ff
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns


class Visualizer:
    """
    Publication-Grade Chart Generator.
    Produces both interactive Plotly JSON configurations for modern UI rendering
    and high-resolution base64 PNGs for exportable research manuscripts.
    """

    @staticmethod
    def correlation_heatmap(df: pd.DataFrame) -> dict:
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if len(num_cols) < 2:
            return {"error": "Need at least 2 numerical columns."}

        corr = df[num_cols].corr()

        fig = px.imshow(
            corr,
            text_auto=".2f",
            aspect="auto",
            color_continuous_scale="RdBu_r",
            zmin=-1,
            zmax=1,
            title="Bivariate Correlation Heatmap"
        )
        fig.update_layout(
            template="plotly_white",
            margin=dict(l=40, r=40, t=50, b=40),
            coloraxis_colorbar=dict(title="Pearson r")
        )

        return {
            "chart_type": "correlation_heatmap",
            "plotly_json": fig.to_json(),
            "columns": num_cols
        }

    @staticmethod
    def distribution_plot(df: pd.DataFrame, column: str, group_by: str = None) -> dict:
        clean = df.dropna(subset=[column])
        if group_by and group_by in df.columns:
            fig = px.histogram(
                clean,
                x=column,
                color=group_by,
                marginal="box",
                barmode="overlay",
                opacity=0.7,
                title=f"Distribution of {column} by {group_by}"
            )
        else:
            fig = px.histogram(
                clean,
                x=column,
                marginal="box",
                opacity=0.75,
                color_discrete_sequence=["#2563eb"],
                title=f"Distribution & Outlier Profile of {column}"
            )

        fig.update_layout(template="plotly_white", margin=dict(l=40, r=40, t=50, b=40))
        return {
            "chart_type": "distribution",
            "column": column,
            "plotly_json": fig.to_json()
        }

    @staticmethod
    def box_violin_plot(df: pd.DataFrame, continuous_col: str, group_col: str) -> dict:
        clean = df[[continuous_col, group_col]].dropna()
        fig = px.violin(
            clean,
            y=continuous_col,
            x=group_col,
            color=group_col,
            box=True,
            points="all",
            hover_data=clean.columns,
            title=f"Group Comparison: {continuous_col} by {group_col}"
        )
        fig.update_layout(template="plotly_white", margin=dict(l=40, r=40, t=50, b=40), showlegend=False)
        return {
            "chart_type": "box_violin",
            "continuous_col": continuous_col,
            "group_col": group_col,
            "plotly_json": fig.to_json()
        }

    @staticmethod
    def scatter_regression_plot(df: pd.DataFrame, x_col: str, y_col: str, color_col: str = None) -> dict:
        subset = [x_col, y_col]
        if color_col and color_col in df.columns:
            subset.append(color_col)
        clean = df[subset].dropna()

        fig = px.scatter(
            clean,
            x=x_col,
            y=y_col,
            color=color_col if color_col in df.columns else None,
            trendline="ols",
            title=f"Bivariate Scatter Plot with OLS Fit: {y_col} vs {x_col}"
        )
        fig.update_layout(template="plotly_white", margin=dict(l=40, r=40, t=50, b=40))
        return {
            "chart_type": "scatter_regression",
            "x_col": x_col,
            "y_col": y_col,
            "plotly_json": fig.to_json()
        }

    @staticmethod
    def categorical_bar_plot(df: pd.DataFrame, cat_col: str, sub_group: str = None) -> dict:
        clean = df.dropna(subset=[cat_col])
        if sub_group and sub_group in df.columns:
            counts = clean.groupby([cat_col, sub_group]).size().reset_index(name="Count")
            fig = px.bar(
                counts,
                x=cat_col,
                y="Count",
                color=sub_group,
                barmode="group",
                title=f"Categorical Frequency Breakdown: {cat_col} by {sub_group}"
            )
        else:
            counts = clean[cat_col].value_counts().reset_index()
            counts.columns = [cat_col, "Count"]
            fig = px.bar(
                counts,
                x=cat_col,
                y="Count",
                color_discrete_sequence=["#059669"],
                title=f"Categorical Frequency: {cat_col}"
            )

        fig.update_layout(template="plotly_white", margin=dict(l=40, r=40, t=50, b=40))
        return {
            "chart_type": "categorical_bar",
            "cat_col": cat_col,
            "plotly_json": fig.to_json()
        }

    @staticmethod
    def pie_chart(df: pd.DataFrame, cat_col: str, hole: float = 0.38, title: str = None) -> dict:
        """Publication-grade Pie & Donut chart for sample composition & demographic shares."""
        if not cat_col or cat_col not in df.columns:
            cat_cols = df.select_dtypes(include=["object", "category"]).columns
            cat_col = cat_cols[0] if len(cat_cols) > 0 else df.columns[0]

        clean = df.dropna(subset=[cat_col])
        counts = clean[cat_col].value_counts().reset_index()
        counts.columns = [cat_col, "Count"]

        fig = px.pie(
            counts,
            names=cat_col,
            values="Count",
            hole=hole,
            title=title or f"Proportional Distribution: {cat_col}",
            color_discrete_sequence=px.colors.qualitative.Safe
        )
        fig.update_traces(
            textposition="inside",
            textinfo="percent+label",
            marker=dict(line=dict(color="#ffffff", width=2))
        )
        fig.update_layout(
            template="plotly_white",
            margin=dict(l=40, r=40, t=50, b=40),
            legend=dict(orientation="h", yanchor="bottom", y=-0.2, xanchor="center", x=0.5)
        )
        return {
            "chart_type": "pie",
            "cat_col": cat_col,
            "plotly_json": fig.to_json()
        }

    @staticmethod
    def research_bar_chart(df: pd.DataFrame, x_col: str, y_col: str = None, group_col: str = None) -> dict:
        """
        Research Bar Chart.
        If continuous y_col is provided: computes group Means ± Standard Error of Mean (SEM) error bars.
        If y_col is not provided: computes frequency distribution with optional subgroup stratification.
        """
        if not x_col or x_col not in df.columns:
            cat_cols = df.select_dtypes(include=["object", "category"]).columns
            x_col = cat_cols[0] if len(cat_cols) > 0 else df.columns[0]

        if y_col and y_col in df.columns:
            # Aggregate Mean + Standard Error (SEM)
            cols = [x_col, y_col] + ([group_col] if group_col and group_col in df.columns else [])
            clean = df[cols].dropna()

            group_by_cols = [x_col] + ([group_col] if group_col and group_col in df.columns else [])
            agg = clean.groupby(group_by_cols)[y_col].agg(["mean", "std", "count"]).reset_index()
            agg["sem"] = agg["std"] / np.sqrt(agg["count"])

            fig = px.bar(
                agg,
                x=x_col,
                y="mean",
                error_y="sem",
                color=group_col if group_col and group_col in df.columns else x_col,
                barmode="group",
                title=f"Empirical Means (± 1 SEM): {y_col} across {x_col}",
                labels={"mean": f"Mean {y_col}"}
            )
            fig.update_layout(template="plotly_white", margin=dict(l=40, r=40, t=50, b=40))
            return {
                "chart_type": "research_bar_means",
                "x_col": x_col,
                "y_col": y_col,
                "plotly_json": fig.to_json()
            }
        else:
            return Visualizer.categorical_bar_plot(df, cat_col=x_col, sub_group=group_col)

    @staticmethod
    def line_trend_chart(df: pd.DataFrame, x_col: str, y_col: str, group_col: str = None) -> dict:
        """Profiles & Longitudinal Trendlines across conditions or experimental rounds."""
        num_cols = df.select_dtypes(include=[np.number]).columns
        if not x_col or x_col not in df.columns:
            x_col = num_cols[0] if len(num_cols) > 0 else df.columns[0]
        if not y_col or y_col not in df.columns:
            y_col = num_cols[1] if len(num_cols) > 1 else df.columns[0]

        cols = [x_col, y_col] + ([group_col] if group_col and group_col in df.columns else [])
        clean = df[cols].dropna()

        # Sort by x_col if numerical
        if pd.api.types.is_numeric_dtype(clean[x_col]):
            clean = clean.sort_values(by=x_col)

        fig = px.line(
            clean,
            x=x_col,
            y=y_col,
            color=group_col if group_col and group_col in df.columns else None,
            markers=True,
            title=f"Experimental Trajectory: {y_col} vs {x_col}"
        )
        fig.update_layout(template="plotly_white", margin=dict(l=40, r=40, t=50, b=40))
        return {
            "chart_type": "line_trend",
            "x_col": x_col,
            "y_col": y_col,
            "plotly_json": fig.to_json()
        }

    @staticmethod
    def crosstab_heatmap(df: pd.DataFrame, row_cat: str, col_cat: str) -> dict:
        """Contingency Table Frequency Heatmap for 2-factor categorical associations."""
        clean = df[[row_cat, col_cat]].dropna()
        ct = pd.crosstab(clean[row_cat], clean[col_cat])

        fig = px.imshow(
            ct,
            text_auto=True,
            aspect="auto",
            color_continuous_scale="Viridis",
            title=f"Cross-Tabulation Frequency Matrix: {row_cat} × {col_cat}"
        )
        fig.update_layout(template="plotly_white", margin=dict(l=40, r=40, t=50, b=40))
        return {
            "chart_type": "crosstab_heatmap",
            "row_cat": row_cat,
            "col_cat": col_cat,
            "plotly_json": fig.to_json()
        }

    @staticmethod
    def generate_static_figure_base64(df: pd.DataFrame, chart_type: str, **kwargs) -> str:
        """Render static publication figure using Seaborn/Matplotlib for report embedding."""
        plt.figure(figsize=(7, 4.5), dpi=150)
        sns.set_theme(style="whitegrid", font_scale=0.9)

        try:
            if chart_type == "correlation":
                num_cols = df.select_dtypes(include=[np.number]).columns
                sns.heatmap(df[num_cols].corr(), annot=True, fmt=".2f", cmap="coolwarm", center=0, cbar=True)
                plt.title("Pearson Correlation Matrix", fontsize=12, fontweight="bold")
            elif chart_type == "boxplot":
                cont = kwargs.get("continuous_col")
                grp = kwargs.get("group_col")
                sns.boxplot(data=df, x=grp, y=cont, palette="Blues_d")
                sns.stripplot(data=df, x=grp, y=cont, color="black", alpha=0.3, jitter=0.2)
                plt.title(f"Comparison: {cont} by {grp}", fontsize=12, fontweight="bold")
            elif chart_type == "scatter":
                x = kwargs.get("x_col")
                y = kwargs.get("y_col")
                sns.regplot(data=df, x=x, y=y, color="#2563eb", scatter_kws={"alpha": 0.6})
                plt.title(f"{y} vs {x} with 95% Confidence Band", fontsize=12, fontweight="bold")
            else:
                col = kwargs.get("column", df.select_dtypes(include=[np.number]).columns[0])
                sns.histplot(df[col], kde=True, color="#3b82f6")
                plt.title(f"Empirical Distribution of {col}", fontsize=12, fontweight="bold")

            plt.tight_layout()
            buf = io.BytesIO()
            plt.savefig(buf, format="png")
            plt.close()
            buf.seek(0)
            return base64.b64encode(buf.read()).decode("utf-8")
        except Exception:
            plt.close()
            return ""
