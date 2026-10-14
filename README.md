# ResAI: Client-Side Research Data Analysis & Reporting Platform
> **analysis made easy** &bull; 100% Client-Side Web Application &bull; Deployable Free on GitHub Pages

ResAI is an enterprise-grade, precision laboratory research automation platform designed to assist researchers across quantitative and qualitative workflows. It runs **entirely inside the user's browser** with **zero server dependencies, zero Python runtime requirements, and zero API keys needed**.

Users can visit the public URL, upload arbitrary datasets (`.csv`, `.xlsx`, `.xls`), audit data hygiene, run exact hypothesis tests, render publication charts, ask dataset-grounded questions, synthesize structured academic manuscripts, and download reports locally.

---

## 🚀 Instant GitHub Pages Deployment Guide

Deploy ResAI to GitHub Pages for free in 4 simple steps:

### Step 1: Push Repository to GitHub
Ensure the codebase (including `index.html` at root and the `static/` directory) is pushed to your GitHub repository:
```bash
git add .
git commit -m "Convert ResAI to 100% client-side GitHub Pages web application"
git push origin main
```

### Step 2: Open GitHub Repository Settings
1. Navigate to your repository on [GitHub](https://github.com/).
2. Click on the **Settings** tab (the gear icon at the top of the repository).

### Step 3: Enable GitHub Pages
1. In the left-hand sidebar under **Code and automation**, click **Pages**.
2. Under **Build and deployment**:
   - **Source**: Select **Deploy from a branch**.
   - **Branch**: Select `main` (or `master`), and leave the folder set to `/ (root)`.
3. Click **Save**.

### Step 4: Access Your Live Web App
GitHub Pages will automatically build and publish your site in about 1–2 minutes. Your live application will be accessible at:
```
https://<your-username>.github.io/<your-repository-name>/
```
> **Note on Asset Paths**: All stylesheets, scripts, and vendor assets use relative paths (`./static/...`), ensuring complete portability whether deployed at a custom domain, GitHub Pages sub-path, or opened directly from your local filesystem.

---

## 💻 Local Testing & Offline Use

You can also run ResAI locally without an internet connection:

### Option A: Open Directly in Any Modern Web Browser
Simply double-click `index.html` in your file explorer, or right-click `index.html` &rarr; *Open With* &rarr; *Google Chrome / Microsoft Edge / Firefox / Safari*.

### Option B: Local Static Server
```bash
# Using Python built-in static server (port 8000 or 8088):
python -m http.server 8088

# Or using Node.js npx serve:
npx serve .
```
Open `http://localhost:8088` in your browser.

---

## 🔒 100% Client-Side Privacy & Security Guarantee

- **Zero Server Uploads**: When you upload a dataset, the file is read directly into your browser's local memory via standard HTML5 File APIs (`FileReader`, `ArrayBuffer`).
- **Data Privacy**: No data rows, metadata, research notes, or questions are ever sent to an external server or third-party cloud service.
- **Zero Hallucination / Zero Fake Math**: All statistical calculations are deterministic, verified mathematical algorithms (Lanczos Log-Gamma, Regularized Incomplete Beta & Gamma distributions) yielding exact $p$-values and test statistics equivalent to SciPy.
- **No API Keys Required**: No OpenAI, Anthropic, or external API keys are needed to use the platform.

---

## 🔄 Client-Side Porting: Replaced Features & Technology Architecture

To transition from a Python/FastAPI backend to an autonomous browser-compatible web application, runtime dependencies were replaced with high-performance client-side implementations:

| Feature Area | Original Server Architecture | Browser Client-Side Replacement | Engine Implementation Details |
|---|---|---|---|
| **Web Server / Routing** | FastAPI + Uvicorn | Pure Static Single-Page App (`index.html`) | Relative pathing (`./static/...`) compatible with GitHub Pages subpaths. |
| **CSV Parsing** | Pandas `pd.read_csv` | **PapaParse** (`papaparse.min.js`) | Multi-threaded client-side CSV parsing with automatic delimiter and type inference. |
| **Excel Parsing** | Pandas `pd.read_excel` (openpyxl) | **SheetJS** (`xlsx.full.min.js`) | In-browser binary spreadsheet parsing supporting `.xlsx` and `.xls`. |
| **Data Profiling & EDA** | Custom Pandas hygiene pipeline | `resai-eda.js` (`EDAProfiler`) | Real-time calculation of Health Score (0-100%), missing cells, skewness, and Tukey $1.5 \times \text{IQR}$ fences. |
| **1-Click Data Cleaning** | Pandas imputation routines | `resai-eda.js` (`cleanDataset`) | In-memory median/mode imputation, row deduplication, and zero-variance cleanup. |
| **Inferential Statistics** | SciPy `stats` & Statsmodels `OLS` | `resai-stats.js` (`StatisticalEngine`) | Pure JS math engine implementing Lanczos approximation, Incomplete Beta $I_x(a,b)$, and Upper Incomplete Gamma $Q(a,x)$ for exact Student/Welch t-tests, One-Way ANOVA, Tukey HSD, OLS Regression, Pearson/Spearman correlation matrices, and Chi-Square tests. |
| **Publication Visualizations** | Plotly Python / Matplotlib | **Plotly.js** CDN & Vendor Fallback | Interactive charts: SEM error-bar bar graphs, donut/pie charts, box/violin distributions, bivariate correlation heatmaps, and scatter plots with OLS trendlines. |
| **RAG Knowledge Base** | Scikit-learn `TfidfVectorizer` | `resai-rag.js` (`RAGEngine`) | In-memory TF-IDF vectorizer and cosine similarity search. Supports custom guideline indexing with browser `localStorage` persistence. |
| **Dataset Q&A Tool** | Server endpoint cross-checking | `resai-qa.js` (`DatasetQAEngine`) | Grounded dataframe cross-checking with strict out-of-scope guardrail: *"Knowledge is limited regarding this inquiry based on the active dataset and methodology library."* |
| **Academic Manuscript Studio** | Jinja2 templates + `python-docx` | `resai-report.js` (`ReportGenerator`) | Dynamic grounded title synthesis, automated empirical manuscript generation, manual builder custom outline support, and in-browser Word (`.doc` XML MIME), Markdown (`.md`), HTML, and PDF print exports. |

---

## 🌟 Step-by-Step Workflow & Feature Tour

### Tab 1: Ingest & Dataset Q&A
- **Dataset Ingestion**: Drag-and-drop or browse arbitrary `.csv`, `.xlsx`, or `.xls` files. File parsing occurs entirely within browser memory in milliseconds.
- **Natural Language Dataset Q&A**: Ask ad-hoc questions grounded in the active dataset. Click suggested inquiry pills (*Dataset Summary*, *Research Objective*, *Missing & Outliers*, *Recommended Tests*, *APA 7th Standard*) or type custom questions.
- **Strict Guardrail**: If an inquiry falls outside the active dataset scope, the engine responds: *"Knowledge is limited regarding this inquiry based on the active dataset and methodology library."*
- **Research Objective Synthesis**: Automatically derives an empirical research objective and manuscript title based on variable types and sample structure.
- **Dataset Presence Guard**: Attempting to switch tabs or run reports without an uploaded file displays a user-friendly toast warning: *"Dataset not uploaded. Please upload a dataset in Tab 1 first."*

### Tab 2: Data Health & Automated Profiling
- **Health Metrics Overview**: Displays 4 responsive summary cards: Data Health Index (0-100%), Total Observations ($N$), Variables/Features count, and Missing Cell Rate (%).
- **Hygiene & Preprocessing Notices**: Automatic flagging of missingness patterns, severe outliers, and distribution skewness.
- **1-Click Auto Impute & Clean**: Automatically imputes missing values (median for continuous, mode for categorical) and purges duplicate rows directly in client memory.
- **Variable Profiling Audit**: Detailed audit table with inferred data types, unique counts, skewness, and IQR outlier boundaries.
- **Empirical Dataset Preview**: Inspect the first 10 raw records loaded in laboratory memory.

### Tab 3: Hypothesis Testing & Statistical Modeling
- **🤖 AI Recommended Procedures**: Recommends appropriate statistical tests based on sample size, variable scale, and research goals.
- **Descriptive Statistics**: Calculates Mean $\pm$ SD, 95% Confidence Intervals, Median (IQR), Range (Min – Max), Skewness, and Normality p-values.
- **Two-Sample Comparison**: Student's t-test and Welch's t-test with Cohen's $d$ effect sizes.
- **One-Way ANOVA & Post-hoc Tukey HSD**: Omnibus $F$-test, degrees of freedom, $\eta^2$ effect magnitude, and pairwise Tukey contrasts.
- **OLS Multiple Linear Regression**: Ordinary Least Squares fit with $R^2$, Adjusted $R^2$, $F$-test, coefficient estimates, standard errors, $t$-values, and $p$-values.
- **Bivariate Correlation**: Pearson $r$ or Spearman $\rho$ pairwise correlation matrices with exact $p$-values.
- **Chi-Square Test**: Contingency tables with Pearson's $\chi^2$, degrees of freedom, and Cramér's $V$.
- **APA 7th Edition Output**: Generates verifiable statistical statements:
  $$F(2, 117) = 137.54, p < .001, \eta^2 = 0.70$$
  $$t(118) = 4.21, p < .001, d = 0.85$$

### Tab 4: Publication Visualizations
- **Bivariate Correlation Heatmap**: Interactive diverging heatmap with numerical Pearson coefficients.
- **Publication Chart Studio**:
  - *Bar Charts*: Group means with $\pm 1 \text{ SEM}$ error bars or categorical frequency counts.
  - *Pie & Donut Charts*: Modern donut or full pie distributions for demographic shares.
  - *Box & Violin Plots*: Group variance with jittered observation points and median markers.
  - *Scatter Plots with OLS Trendline*: Bivariate scatter overlaid with linear fit lines.
  - *Distribution Histograms*: Continuous distribution bins with density curves.
  - *Experimental Trajectories*: Longitudinal trendlines over ordered stages or time points.
- **Attach to Manuscript**: 1-click button to attach any generated figure into the academic report stream.

### Tab 5: Academic Report & Human-in-the-Loop Validation
- **Academic Manuscript Studio Modes**:
  - **⚡ Automatic Template**: 1-click compilation of a complete empirical research manuscript incorporating research objectives, data profiling, hypothesis testing results, and attached figures.
  - **🛠️ Manual Custom Builder**: Tailor manuscript title, author, style preset, and provide a **custom template outline** (e.g. *Academic Standard*, *Executive Brief*, *Clinical Cohort*) with markdown placeholders (`{{abstract}}`, `{{descriptive_statistics_table}}`, `{{hypothesis_testing_results}}`, `{{discussion}}`, `{{conclusions}}`). Reflected specifically for that report compilation.
- **Human-in-the-Loop Sign-Off**:
  - Review status dropdown (`DRAFT_PENDING_REVIEW`, `VERIFIED_BY_RESEARCHER`, `APPROVED_FOR_PUBLICATION`).
  - Peer review and laboratory sign-off notes area.
- **Multi-Format Local Export**:
  - 📄 **Word (`.docx`)**: Formatted document compatible with Microsoft Word, LibreOffice, and Google Docs with full CSS table styling.
  - 📝 **Markdown (`.md`)**: Raw formatted markdown text.
  - 🌐 **HTML (`.html`)**: Standalone, portable HTML page.
  - 🖨️ **Print / Save as PDF**: Print preview formatted using clean `@media print` academic typography.

### Tab 6: RAG & Methodology Library
- **Indexed Methodology Store**: Grounding rules for APA 7th statistical reporting, Null Hypothesis Significance Testing (NHST), research data cleansing, and manuscript structure.
- **Real-Time Search**: Search guidelines with instant TF-IDF cosine relevance ranking.
- **Custom Protocol Indexing**: Upload laboratory protocols or professor grading rubrics; persisted across sessions in browser `localStorage`.

---

## 📁 Repository Structure

```
Project4-1/
├── index.html                   # Static entry point for GitHub Pages deployment
├── README.md                    # Documentation & GitHub Pages deployment instructions
├── static/                      # Static client-side assets
│   ├── css/
│   │   └── styles.css           # Modern design tokens, glassmorphism, responsive styles
│   └── js/
│       ├── app.js               # Application coordinator & UI tab event controller
│       ├── resai-eda.js         # Client-side data profiling & 1-click hygiene engine
│       ├── resai-qa.js          # Grounded dataset Q&A tool with strict guardrails
│       ├── resai-rag.js         # TF-IDF methodology indexing & retrieval engine
│       ├── resai-report.js      # Dynamic report synthesizer & document exporters
│       ├── resai-stats.js       # SciPy-equivalent client-side statistical engine
│       └── vendor/
│           ├── papaparse.min.js # In-browser CSV parsing library
│           └── xlsx.full.min.js # In-browser Excel (.xlsx/.xls) parsing library
├── data/
│   └── uploads/                 # Sample research datasets for local testing
└── docs/                        # Documentation and architecture assets
```

---

## 📄 License & Attribution

ResAI Platform is designed for academic, clinical, and scientific research. Built for reliable, deterministic, and verifiable empirical research data analysis.
*analysis made easy* &bull; Zero Server &bull; Zero API Keys &bull; 100% Free Hosting on GitHub Pages.
