# ResAI: AI-Assisted Research Data Analysis and Reporting Platform
> Report-First Workflow - Dual Edition: Local Python Backend (FastAPI and Ollama) and Client-Side Web Application (GitHub Pages)

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com)
[![Privacy Guarantee](https://img.shields.io/badge/Data%20Privacy-100%25%20Local%20%26%20Private-success.svg)](#zero-hallucination-and-privacy-guarantee)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

ResAI is an academic research automation platform designed to assist laboratory investigators, clinical scientists, and quantitative analysts across data profiling, hypothesis testing, and reporting workflows.

ResAI adopts a Report-First architecture: users upload an experimental dataset, optionally provide an existing report template, and immediately receive a publication-grade academic manuscript complete with APA 7th statistics, structured tables, publication figures, and grounded narrative interpretations.

---

## Dual-Edition Deployment Model

ResAI runs in two complementary modes:

| Capability | Local Python Edition (`main.py` / FastAPI) | Static Web Edition (GitHub Pages / Standalone HTML) |
|---|---|---|
| Runtime Environment | Local Python runtime (`uvicorn`, Python 3.10+) | Any modern browser (Chrome, Edge, Firefox, Safari) |
| Server Dependencies | Zero external cloud servers; runs on `localhost:8000` | Zero server dependencies; 100% client-side |
| Statistical Computation | SciPy, Statsmodels, NumPy | Browser-native Lanczos Log-Gamma, Incomplete Beta and Gamma |
| AI Narrative Engine | Local Ollama LLM (`llama3`, `mistral`, `qwen2.5`) + Deterministic | Browser-native Deterministic Academic Engine |
| Document Export | Native Microsoft Word (`.docx`), Markdown, HTML, PDF | Word MIME (`.doc`), Markdown, HTML, Print/PDF |
| Mathematical Validation | Python `ClaimValidator` and `StatisticalSchema` | Browser-native `ReportGenerator.auditReportClaims` |
| Cost and Cloud Privacy | Free and Open Source - 100% Private (No data leaves machine) | Free and Open Source - 100% Private (No data leaves browser) |

---

## Six-Tab Report-First User Interface

Navigation across tabs 2 to 6 is locked until a research dataset is uploaded. If a user attempts to navigate prior to uploading, a toast notification prompts: *"Upload file first"*.

Once loaded, the dataset is locked into the active session to prevent accidental replacement until the user explicitly clicks *"Start New Report / Upload New Dataset"*.

```
+---------------------------------------------------------------------------------------------------------+
| [1. Generate Report] [2. EDA & Feature Eng] [3. Stats] [4. Visuals] [5. Report & Validation] [6. History]|
+---------------------------------------------------------------------------------------------------------+
```

### 1. Tab 1 - Generate Report (Default Landing Tab)
- **Dataset Ingestion**: Drag-and-drop or browse `.csv`, `.xlsx`, or `.xls` research data.
- **Session Locking**: Once uploaded, the dataset is locked into memory with record counts displayed. Users click *"Start New Report"* to reset the session.
- **Existing Report / Template Upload**: Upload an existing Word (`.docx`), Markdown (`.md`), or Text (`.txt`) report. ResAI extracts the required sections (Abstract, Introduction, Methodology, Results, Discussion, Limitations, Conclusion) and renders extracted section badges.
- **Direct Report Generation**: Click *"Generate Research Report"* to run the automated pipeline. If an existing template is uploaded, the report is compiled based on the uploaded template's outline and structure; otherwise, the standard APA 7th academic template is used.
- **5-Step Automated Execution Pipeline**:
  1. Dataset Ingestion and Schema Validation
  2. Data Health Profiling and Imputation
  3. Inferential Hypothesis Testing
  4. Grounded Narrative Synthesis
  5. Claim Validation Audit
- **Instant Report Outcome Card**:
  - Highlights: Health index, sample size N, significant findings count (p < .05), and claim grounding percentage.
  - Executive Abstract and verified inferential findings preview.
  - Direct downloads: Download Word (`.docx`), Markdown (`.md`), or Print / PDF directly from Tab 1.

### 2. Tab 2 - Exploratory Data Analysis & Feature Engineering
- **Dataset Attributes and Schema Inspection**: Sheet selector for Excel workbooks, total observations (N), total variables (P), continuous measures count, and categorical factors count.
- **Data Quality and Hygiene Profiling**: Health score (0-100%), missing cell rate, outlier counts, duplicate row analysis, and hygiene notices.
- **Feature Engineering and Preprocessing Studio**:
  - *Missing Value Imputation*: Impute by Mean, Median, Mode, or drop rows with missing values.
  - *Outlier Treatment*: IQR boundary clipping (1.5x IQR), percentile Winsorization (5th - 95th percentile), or outlier row removal.
  - *Scaling and Transformations*: Log transformation ln(x + 1), Z-score standardization, and Min-Max normalization (0 to 1).
  - *Categorical Encoding*: One-hot dummy variable generation with automatic schema updates.
  - *1-Click Auto Clean*: Auto-impute and clean dataset with duplicate removal.
- **Variable Profiling Audit Table**: Column types, missing percentages, uniqueness ratios, skewness metrics, and outlier counts.
- **Raw Observations Inspector**: Paginated inspection of the first 15 records in memory.

### 3. Tab 3 - Hypothesis Testing & Statistics
- **Recommended Statistical Procedures**: Heuristically mapped to variable types, distributions, and sample size.
- **Descriptive Statistics Table**: Mean +- SD, 95% Confidence Intervals, Median (IQR), Range (Min - Max), Skewness, and Shapiro-Wilk normality p-values.
- **Interactive Statistical Calculators**:
  - *Two-Sample Comparison*: Student's t-test, Welch's t-test, Mann-Whitney U, and Cohen's d effect sizes.
  - *One-Way ANOVA & Post-Hoc Tukey HSD*: Omnibus F-test, eta-squared variance explained, and pairwise contrasts.
  - *OLS Multiple Linear Regression*: Dependent outcome modeling with R-squared, adjusted R-squared, F-test, predictor coefficients, standard errors, and p-values.
  - *Bivariate Correlations*: Pearson linear correlation matrix and Spearman rank non-parametric correlation.
  - *Chi-Square Test of Independence*: Contingency tables, Chi-Square statistic, degrees of freedom, and Cramer's V.

### 4. Tab 4 - Publication Visualizations
- **Bivariate Correlation Heatmap**: Interactive matrix with Pearson correlation coefficients.
- **Publication Chart Studio**:
  - *Research Bar Chart*: Group means with Standard Error of the Mean (SEM) error bars or observation counts.
  - *Donut and Pie Proportions*: Category distribution slices.
  - *Box and Violin Plots*: Median, quartiles, and distribution spreads across experimental cohorts.
  - *Scatter and OLS Fit*: Bivariate scatter plots with linear regression trendlines.
  - *Distribution Histograms*: Continuous metric frequency distributions.
  - *Experimental Trajectory Plots*: Time-series and ordered observation trendlines.

### 5. Tab 5 - Academic Report & Validation
- **Template Adaptation**: If an existing report template was uploaded, the report is structured and rendered according to the uploaded template's sections; otherwise, the standard APA 7th academic template is used.
- **Human-in-the-Loop Sign-Off Bar**: Researcher review status (*Draft Pending Review*, *Verified by Researcher*, *Approved for Publication*) with notes persistence.
- **Claim Validation Audit**:
  - Mathematical verification of all numbers, sample sizes, and p-values against computed dataset outputs.
  - Grounding Score percentage (e.g. 100% Grounded) and highlighted verified ground truth vs warning flags.
  - Re-Audit Claims button to re-verify after manuscript revisions.
- **Academic Manuscript Section Editor**: In-place editable sections for Abstract, Introduction, Data Methodology, Results, Discussion, Limitations, and Conclusions.
- **Exporters**: Word (`.docx`), Markdown (`.md`), HTML (`.html`), and Print / PDF.

### 6. Tab 6 - Report History
- **Research Tracking**: Persists generated reports over time across sessions using browser storage.
- **History Table**: Displays Date and Time, Report Title, Dataset Name, Sample Size (N), Health Score, and Primary Test Finding.
- **Quick Actions**: View in Report Tab, Download Word (`.docx`), Download Markdown (`.md`), and Delete Report.
- **Clear History**: Wipe stored report history with a single click.

---

## Quickstart: Running the Local Python Backend

### 1. Prerequisites
- Python 3.10, 3.11, 3.12, or 3.13
- (Optional) [Ollama](https://ollama.com/) installed for local LLM narrative generation

### 2. Installation
```bash
git clone https://github.com/AmoghaNaik24/ResAI.git
cd ResAI
pip install -r requirements.txt
```

### 3. Launching the Application
```bash
python main.py
```
Or start via uvicorn directly:
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Navigate to **`http://127.0.0.1:8000`** in your browser.

### 4. (Optional) Enabling Local Ollama LLMs
ResAI works 100% offline out-of-the-box using its deterministic academic engine. To enable local LLM narrative generation:
```bash
# 1. Install and start Ollama (https://ollama.com)
# 2. Pull your preferred model:
ollama pull llama3
```

---

## Quickstart: Deploying to GitHub Pages (Static Web Edition)

The static web edition runs completely inside the user's browser with zero backend servers:

1. Ensure the root contains `index.html` and the `static/` directory.
2. Push your changes to GitHub:
   ```bash
   git add .
   git commit -m "Update ResAI to Report-First Architecture"
   git push origin main
   ```
3. In your GitHub repository, navigate to **Settings** -> **Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**, choose branch **`main`**, and folder **`/ (root)`**. Click **Save**.

---

## Zero-Hallucination and Privacy Guarantee

1. **Deterministic Calculations Only**: All summary tables, t-tests, ANOVAs, regression models, and correlations are computed via mathematical code (SciPy/Statsmodels in Python; Lanczos approximation in JS). LLMs are never permitted to calculate numbers independently.
2. **Schema-Grounded Prompting**: When generating natural language, models are provided with a strictly typed `ValidatedStatisticalSchema` containing only computed facts, with explicit negative constraints against number alteration.
3. **Automated Claim Validation Engine**: Every generated sentence is scanned for numbers and verified against the computed registry. Unsupported figures are flagged with a caveat warning.
4. **100% Local Privacy**: No data rows, patient records, or experimental measurements are sent to third-party cloud servers.

---

## Running the Test Suite

```bash
python -m pytest tests -v
```

Output:
```text
tests/test_pipeline.py::test_health_check PASSED
tests/test_pipeline.py::test_full_pipeline_clinical PASSED
==================== 2 passed in 10.71s ====================
```

---

## Project Structure

```
Project4-1/
├── app/
│   ├── api/
│   │   ├── eda.py
│   │   ├── hypothesis.py
│   │   ├── rag.py
│   │   └── report.py
│   ├── core/
│   │   ├── claim_validator.py
│   │   ├── docx_template_engine.py
│   │   ├── eda_profiler.py
│   │   ├── llm_service.py
│   │   ├── report_generator.py
│   │   ├── statistical_engine.py
│   │   └── statistical_schema.py
│   ├── static/
│   │   ├── css/styles.css
│   │   └── js/
│   │       ├── app.js
│   │       ├── resai-eda.js
│   │       ├── resai-report.js
│   │       └── resai-stats.js
│   └── templates/
│       └── index.html
├── data/
│   ├── reports/
│   └── uploads/
├── static/
│   ├── css/styles.css
│   └── js/
│       ├── app.js
│       ├── resai-eda.js
│       ├── resai-report.js
│       └── resai-stats.js
├── tests/
│   └── test_pipeline.py
├── index.html
├── main.py
├── requirements.txt
└── README.md
```
