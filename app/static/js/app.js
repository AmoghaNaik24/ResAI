/**
 * ResAI - Front-End Client-Side Application Controller
 * 100% In-Browser Precision Research Data Analysis, Hypothesis Testing & Reporting.
 * Zero external servers, zero backend dependencies, ready for free GitHub Pages deployment.
 */

// Global Application State
const state = {
  currentDataset: null,      // Filename string
  rawRows: [],               // Original parsed data
  cleanedRows: [],           // Active working data
  profile: null,             // Active EDA profile
  objective: "",             // Research inquiry
  activeTab: "upload",
  currentReport: null,       // Compiled manuscript
  executedTests: [],         // Statistical results register
  reportCharts: [],          // Charts attached to report
  columns: { numeric: [], categorical: [], all: [] }
};

// DOM Content Loaded
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initUploadListeners();
  initQAListeners();
  initMethodologyListeners();
  initValidationListeners();
  initAnalysisListeners();
  initVisualizationListeners();
});

// ==========================================
// Tab Switching & Navigation Guards
// ==========================================
function initTabs() {
  const tabBtns = document.querySelectorAll(".nav-tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      switchTab(tabId);
    });
  });
}

function requireActiveDataset(actionName = "") {
  if (!state.currentDataset || !state.cleanedRows || state.cleanedRows.length === 0) {
    showNotification("Dataset not uploaded. Please upload a dataset in Tab 1 first.", "warning");
    switchTab("upload");
    return false;
  }
  return true;
}

function switchTab(tabId) {
  // Guard: if user attempts to navigate to data-dependent tabs without an uploaded dataset
  if (tabId !== "upload" && (!state.currentDataset || !state.cleanedRows || state.cleanedRows.length === 0)) {
    showNotification("Dataset not uploaded. Please upload a dataset in Tab 1 first.", "warning");
    tabId = "upload";
    document.querySelectorAll(".nav-tab-btn").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-tab") === "upload");
    });
    document.querySelectorAll(".tab-pane").forEach(pane => {
      pane.classList.toggle("active", pane.id === "tab-upload");
    });
    return;
  }

  state.activeTab = tabId;
  document.querySelectorAll(".nav-tab-btn").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-tab") === tabId);
  });
  document.querySelectorAll(".tab-pane").forEach(pane => {
    pane.classList.toggle("active", pane.id === `tab-${tabId}`);
  });

  // Dynamic refresh based on tab when dataset is loaded
  if (state.currentDataset) {
    if (tabId === "eda") {
      renderEDATab();
    } else if (tabId === "analysis") {
      populateTestSelectors();
      loadRecommendations();
      loadSummaryStats();
    } else if (tabId === "visuals") {
      populateVisualControls();
      loadHeatmap();
    }
  }
  if (tabId === "rag") {
    loadRAGDocuments();
  }
}

// ==========================================
// In-Browser File Ingestion (PapaParse & SheetJS)
// ==========================================
function initUploadListeners() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  if (dropZone && fileInput) {
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) processLocalFile(e.target.files[0]);
    });

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) processLocalFile(e.dataTransfer.files[0]);
    });
  }

  // Header & page-level automatic report generation triggers
  const autoBtn = document.getElementById("btn-run-full-pipeline");
  if (autoBtn) autoBtn.addEventListener("click", runFullAutomatedPipeline);

  document.querySelectorAll(".btn-trigger-auto-report").forEach(btn => {
    btn.addEventListener("click", runFullAutomatedPipeline);
  });
}

function processLocalFile(file) {
  if (!file) return;
  const fileName = file.name;
  const ext = fileName.split('.').pop().toLowerCase();

  showNotification(`Reading '${fileName}' locally in browser...`, "info");

  if (ext === 'csv') {
    // Client-side PapaParse
    if (typeof Papa === 'undefined') {
      showNotification("CSV Parser loading... please wait a moment.", "warning");
      return;
    }
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: function(results) {
        if (!results.data || results.data.length === 0) {
          showNotification("CSV file appears to be empty.", "danger");
          return;
        }
        applyLoadedDataset(results.data, fileName);
      },
      error: function(err) {
        showNotification("CSV parsing error: " + err.message, "danger");
      }
    });
  } else if (ext === 'xlsx' || ext === 'xls') {
    // Client-side SheetJS (XLSX)
    if (typeof XLSX === 'undefined') {
      showNotification("Excel Parser loading... please wait a moment.", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        if (!jsonRows || jsonRows.length === 0) {
          showNotification("Excel sheet is empty.", "danger");
          return;
        }
        applyLoadedDataset(jsonRows, fileName);
      } catch (err) {
        showNotification("Excel read error: " + err.message, "danger");
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    showNotification("Unsupported file format. Please upload a .CSV or .XLSX file.", "warning");
  }
}

function applyLoadedDataset(rows, fileName) {
  state.currentDataset = fileName;
  state.rawRows = rows.map(r => ({ ...r }));
  state.cleanedRows = rows.map(r => ({ ...r }));

  // Profile data
  state.profile = window.EDAProfiler.profileDataset(state.cleanedRows);
  state.columns = {
    numeric: state.profile.numerical_columns || [],
    categorical: state.profile.categorical_columns || [],
    all: Object.keys(state.profile.columns || {})
  };

  // Derive research objective if not specified
  const objInput = document.getElementById("input-objective");
  if (!objInput || !objInput.value.trim() || objInput.value.includes("Evaluate recovery days and biomarker reduction")) {
    const cleanName = fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
    const num = state.columns.numeric;
    const cat = state.columns.categorical;
    let autoObj = `Evaluate empirical relationships in ${cleanName}.`;
    if (num.length >= 1 && cat.length >= 1) {
      autoObj = `Investigate variations in ${num[0]} across ${cat[0]} cohorts in ${cleanName}.`;
    } else if (num.length >= 2) {
      autoObj = `Assess bivariate associations between ${num[0]} and ${num[1]} in ${cleanName}.`;
    }
    state.objective = autoObj;
    if (objInput) objInput.value = autoObj;
  } else {
    state.objective = objInput.value.trim();
  }

  // Update header status pill
  const headerDataset = document.getElementById("header-dataset-name");
  if (headerDataset) headerDataset.textContent = `${fileName} (${state.profile.total_rows.toLocaleString()} rows)`;

  // Show upload success banner
  showUploadSuccessBanner(fileName, state.profile.total_rows, state.profile.total_columns);

  // Update suggested question pills
  updateSuggestedQuestions(state.profile);

  // Re-populate dropdowns
  populateTestSelectors();
  populateVisualControls();

  showNotification(`Dataset '${fileName}' loaded successfully! (${state.profile.total_rows} records)`, "success");
}

function showUploadSuccessBanner(filename, rows, cols) {
  const banner = document.getElementById("upload-status-area");
  if (!banner) return;
  banner.style.display = "block";
  banner.innerHTML = `
    <div style="padding: 1rem 1.25rem; background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 4px rgba(0,0,0,0.04); flex-wrap: wrap; gap: 0.75rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span style="font-size: 1.6rem;">✅</span>
        <div>
          <div style="font-weight: 700; color: #065f46; font-size: 0.95rem;">File Uploaded Successfully!</div>
          <div style="font-size: 0.85rem; color: #047857; margin-top: 2px;">
            <strong>${escapeHtml(filename)}</strong> &bull; ${rows.toLocaleString()} records &bull; ${cols} variables
          </div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm btn-trigger-auto-report" style="box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
        ⚡ Generate Automatic Report
      </button>
    </div>
  `;
  banner.querySelector(".btn-trigger-auto-report").addEventListener("click", runFullAutomatedPipeline);
}

// ==========================================
// Tab 2: Data Health & Profiling
// ==========================================
function renderEDATab() {
  if (!state.profile) return;
  const p = state.profile;

  document.getElementById("stat-health-score").textContent = `${p.health_score}%`;
  document.getElementById("stat-total-rows").textContent = p.total_rows.toLocaleString();
  document.getElementById("stat-total-cols").textContent = p.total_columns;
  document.getElementById("stat-missing-cells").textContent = p.total_missing_cells.toLocaleString();

  // Missing table
  const missingTbody = document.getElementById("missing-table-body");
  if (missingTbody) {
    missingTbody.innerHTML = "";
    Object.keys(p.columns || {}).forEach(col => {
      const c = p.columns[col];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td><span class="badge ${c.type === 'numeric' ? 'badge-info' : 'badge-secondary'}">${c.type}</span></td>
        <td>${c.missing_count}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="progress-bar-container" style="flex: 1;">
              <div class="progress-bar-fill ${c.missing_percentage > 10 ? 'danger' : ''}" style="width: ${c.missing_percentage}%"></div>
            </div>
            <span style="font-size: 0.75rem; width: 35px;">${c.missing_percentage}%</span>
          </div>
        </td>
        <td>${c.unique_values}</td>
        <td>${c.issues.length > 0 ? `<span class="badge badge-warning">${escapeHtml(c.issues[0])}</span>` : '<span class="badge badge-success">Optimal</span>'}</td>
      `;
      missingTbody.appendChild(tr);
    });
  }

  // Distribution summary
  const distContainer = document.getElementById("eda-dist-summary");
  if (distContainer) {
    distContainer.innerHTML = `
      <div style="font-size: 0.9rem; line-height: 1.6; color: #334155;">
        <p><strong>Continuous Numerical Measures (${p.numerical_columns.length}):</strong> ${p.numerical_columns.map(c => `<code>${escapeHtml(c)}</code>`).join(', ') || 'None'}</p>
        <p style="margin-top: 0.5rem;"><strong>Categorical Classification Factors (${p.categorical_columns.length}):</strong> ${p.categorical_columns.map(c => `<code>${escapeHtml(c)}</code>`).join(', ') || 'None'}</p>
        <p style="margin-top: 0.5rem;"><strong>Duplicate Records:</strong> ${p.duplicate_rows} duplicate rows detected.</p>
      </div>
    `;
  }

  // Outlier detection table
  const outlierTbody = document.getElementById("outlier-table-body");
  if (outlierTbody) {
    outlierTbody.innerHTML = "";
    (p.numerical_columns || []).forEach(col => {
      const c = p.columns[col];
      if (c && c.outliers_count !== undefined) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td>${c.outliers_count}</td>
          <td>${c.outliers_pct}%</td>
          <td>${c.bounds ? `[${c.bounds[0]}, ${c.bounds[1]}]` : '--'}</td>
          <td>${c.skewness}</td>
          <td>${c.outliers_count > 0 ? '<span class="badge badge-warning">Outliers Present</span>' : '<span class="badge badge-success">Clean Bounds</span>'}</td>
        `;
        outlierTbody.appendChild(tr);
      }
    });
  }

  // Preview table
  renderPreviewTable(p.preview_data || state.cleanedRows.slice(0, 8));
}

function renderPreviewTable(rows) {
  const container = document.getElementById("dataset-preview-table-container");
  if (!container || !rows || rows.length === 0) return;
  const cols = Object.keys(rows[0]);

  let html = `<div style="overflow-x: auto;"><table class="styled-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;"><thead><tr>`;
  cols.forEach(c => html += `<th>${escapeHtml(c)}</th>`);
  html += `</tr></thead><tbody>`;

  rows.forEach(r => {
    html += `<tr>`;
    cols.forEach(c => html += `<td>${escapeHtml(String(r[c] !== null && r[c] !== undefined ? r[c] : ''))}</td>`);
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// 1-Click Clean Data Listener
const btnClean = document.getElementById("btn-clean-data");
if (btnClean) {
  btnClean.addEventListener("click", () => {
    if (!requireActiveDataset("clean data")) return;
    const numStrategy = document.getElementById("impute-numeric-strategy")?.value || "median";
    const catStrategy = document.getElementById("impute-cat-strategy")?.value || "mode";

    const res = window.EDAProfiler.cleanData(state.cleanedRows, {
      missing_numeric_strategy: numStrategy,
      missing_categorical_strategy: catStrategy,
      drop_duplicates: true
    });

    state.cleanedRows = res.cleanedRows;
    state.profile = window.EDAProfiler.profileDataset(state.cleanedRows);

    renderEDATab();
    showNotification(`Data cleaned! ${res.actions.join(' ')}`, "success");
  });
}

// ==========================================
// Tab 3: Hypothesis Testing & Statistical Modeling
// ==========================================
function initAnalysisListeners() {
  document.getElementById("btn-calc-two-sample")?.addEventListener("click", () => {
    if (!requireActiveDataset("run statistical tests")) return;
    const cont = document.getElementById("ts-continuous").value;
    const grp = document.getElementById("ts-group").value;
    executeTest("two_sample_test", { continuous_col: cont, group_col: grp });
  });

  document.getElementById("btn-calc-anova")?.addEventListener("click", () => {
    if (!requireActiveDataset("run statistical tests")) return;
    const cont = document.getElementById("anova-continuous").value;
    const grp = document.getElementById("anova-group").value;
    executeTest("anova_test", { continuous_col: cont, group_col: grp });
  });

  document.getElementById("btn-calc-correlation")?.addEventListener("click", () => {
    if (!requireActiveDataset("run statistical tests")) return;
    const method = document.getElementById("corr-method").value;
    const numCols = state.columns.numeric;
    if (numCols.length < 2) {
      showNotification("Correlation requires at least 2 numerical columns.", "warning");
      return;
    }
    executeTest("correlation_analysis", { col1: numCols[0], col2: numCols[1], method: method });
  });

  document.getElementById("btn-calc-chi")?.addEventListener("click", () => {
    if (!requireActiveDataset("run statistical tests")) return;
    const v1 = document.getElementById("chi-var1").value;
    const v2 = document.getElementById("chi-var2").value;
    executeTest("chi_square_test", { var1: v1, var2: v2 });
  });

  document.getElementById("btn-calc-reg")?.addEventListener("click", () => {
    if (!requireActiveDataset("run statistical tests")) return;
    const target = document.getElementById("reg-target").value;
    const checkboxes = document.querySelectorAll(".reg-pred-chk:checked");
    const preds = Array.from(checkboxes).map(c => c.value).filter(c => c !== target);
    if (preds.length === 0) {
      showNotification("Select at least one predictor distinct from the target.", "warning");
      return;
    }
    executeTest("linear_regression", { target_col: target, feature_cols: preds });
  });
}

function executeTest(testType, params) {
  if (!window.StatisticalEngine) return;
  showNotification("Computing exact statistical verification in browser...", "info");

  let result;
  if (testType === "two_sample_test") {
    result = window.StatisticalEngine.twoSampleTest(state.cleanedRows, params.continuous_col, params.group_col);
  } else if (testType === "anova_test") {
    result = window.StatisticalEngine.anovaTest(state.cleanedRows, params.continuous_col, params.group_col);
  } else if (testType === "correlation_analysis") {
    result = window.StatisticalEngine.correlationAnalysis(state.cleanedRows, params.col1, params.col2, params.method);
  } else if (testType === "chi_square_test") {
    result = window.StatisticalEngine.chiSquareTest(state.cleanedRows, params.var1, params.var2);
  } else if (testType === "linear_regression") {
    result = window.StatisticalEngine.linearRegression(state.cleanedRows, params.target_col, params.feature_cols);
  }

  if (!result || result.error) {
    showNotification(result?.error || "Calculation failed", "danger");
    return;
  }

  state.executedTests.push(result);
  renderTestResultCard(result, testType, params);
  showNotification("Statistical test computed with exact mathematical verification!", "success");
}

function renderTestResultCard(result, testType, params) {
  const container = document.getElementById("test-results-stream");
  if (!container) return;

  const card = document.createElement("div");
  card.className = "card";
  card.style.marginBottom = "1.5rem";
  card.style.borderLeft = result.is_significant ? "4px solid #10b981" : "4px solid #f59e0b";
  card.style.animation = "fadeIn 0.3s ease";

  const isSig = result.is_significant;
  const statusBadge = isSig ? '<span class="badge badge-success">p < .05 Significant</span>' : '<span class="badge badge-warning">p ≥ .05 Not Significant</span>';

  card.innerHTML = `
    <div class="card-header-flex">
      <div>
        <h3 style="font-size: 1.15rem; color: #1e3a8a; margin-bottom: 2px;">${escapeHtml(result.test_type || testType)}</h3>
        <div style="font-size: 0.8rem; color: #64748b;">Deterministic SciPy-Equivalent Mathematical Execution</div>
      </div>
      <div>${statusBadge}</div>
    </div>

    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.85rem; margin: 0.75rem 0;">
      <div style="font-size: 0.8rem; color: #475569; font-weight: 600; margin-bottom: 2px;">Official APA 7th Edition Statement:</div>
      <div style="font-family: var(--font-mono); font-size: 0.95rem; color: #1e3a8a; font-weight: 700;">${escapeHtml(result.formatted_apa || result.apa_statement || '')}</div>
    </div>

    <p style="font-size: 0.9rem; color: #334155; line-height: 1.6; margin-bottom: 0.75rem;">
      ${escapeHtml(result.interpretation || result.narrative || '')}
    </p>

    <div style="display: flex; gap: 0.5rem;">
      <button class="btn btn-secondary btn-sm btn-dismiss-test" style="font-size: 0.75rem;">Dismiss</button>
    </div>
  `;

  card.querySelector(".btn-dismiss-test").addEventListener("click", () => card.remove());
  container.prepend(card);
}

function populateTestSelectors() {
  const populateOptions = (selectId, colList) => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = "";
    colList.forEach(col => {
      const opt = document.createElement("option");
      opt.value = col;
      opt.textContent = col;
      sel.appendChild(opt);
    });
  };

  populateOptions("ts-continuous", state.columns.numeric);
  populateOptions("ts-group", state.columns.categorical);
  populateOptions("anova-continuous", state.columns.numeric);
  populateOptions("anova-group", state.columns.categorical);
  populateOptions("chi-var1", state.columns.categorical);
  populateOptions("chi-var2", state.columns.categorical);
  populateOptions("reg-target", state.columns.numeric);

  // Multi-select predictors
  const predContainer = document.getElementById("reg-predictors-container");
  if (predContainer) {
    predContainer.innerHTML = "";
    state.columns.numeric.forEach((col, idx) => {
      const label = document.createElement("label");
      label.style.display = "inline-flex";
      label.style.alignItems = "center";
      label.style.gap = "4px";
      label.style.marginRight = "10px";
      label.style.fontSize = "0.85rem";
      label.innerHTML = `<input type="checkbox" value="${col}" class="reg-pred-chk" ${idx < 3 ? 'checked' : ''}> ${col}`;
      predContainer.appendChild(label);
    });
  }
}

function loadRecommendations() {
  if (!window.StatisticalEngine) return;
  const container = document.getElementById("recs-container");
  if (!container) return;

  const recs = window.StatisticalEngine.autoRecommendAnalysis(state.cleanedRows, state.columns, state.objective);
  container.innerHTML = "";

  if (recs.length === 0) {
    container.innerHTML = `<p class="text-muted">No specific statistical tests recommended for current column structure.</p>`;
    return;
  }

  recs.forEach(r => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "0.75rem";
    card.style.padding = "0.85rem 1.1rem";
    card.innerHTML = `
      <div class="card-header-flex">
        <div>
          <div style="font-weight: 700; color: #1e3a8a;">${escapeHtml(r.name)}</div>
          <div style="font-size: 0.82rem; color: #64748b; margin-top: 2px;">${escapeHtml(r.reason)}</div>
        </div>
        <button class="btn btn-secondary btn-sm btn-run-rec">Run Test</button>
      </div>
    `;
    card.querySelector(".btn-run-rec").addEventListener("click", () => {
      executeTest(r.test, r.params);
    });
    container.appendChild(card);
  });
}

function loadSummaryStats() {
  if (!window.StatisticalEngine) return;
  const s = window.StatisticalEngine.getSummaryStatistics(state.cleanedRows, state.columns);
  const container = document.getElementById("summary-stats-container");
  if (!container) return;

  const numMap = s.numerical_summary || {};
  let html = `<div style="overflow-x:auto;"><table class="styled-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
    <thead><tr><th>Measure</th><th>N</th><th>Mean (SD)</th><th>95% CI</th><th>Median</th><th>IQR</th><th>Min - Max</th><th>Outliers</th></tr></thead><tbody>`;

  Object.keys(numMap).forEach(col => {
    const item = numMap[col];
    html += `<tr>
      <td><strong>${escapeHtml(col)}</strong></td>
      <td>${item.count}</td>
      <td>${item.mean} (${item.std})</td>
      <td>[${item.ci95[0]}, ${item.ci95[1]}]</td>
      <td>${item.median}</td>
      <td>${item.iqr}</td>
      <td>${item.min} - ${item.max}</td>
      <td>${item.outliers_count > 0 ? `<span class="badge badge-warning">${item.outliers_count}</span>` : '<span class="badge badge-success">0</span>'}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// ==========================================
// Tab 4: Publication Visualizations (Plotly.js)
// ==========================================
function initVisualizationListeners() {
  document.getElementById("btn-render-box")?.addEventListener("click", () => {
    if (!requireActiveDataset("render scientific visualizations")) return;
    const cat = document.getElementById("vis-box-group").value;
    const num = document.getElementById("vis-box-numeric").value;
    renderClientBoxPlot(cat, num);
  });

  document.getElementById("btn-render-hist")?.addEventListener("click", () => {
    if (!requireActiveDataset("render scientific visualizations")) return;
    const col = document.getElementById("vis-hist-col").value;
    const bins = parseInt(document.getElementById("vis-hist-bins").value) || 20;
    renderClientHistogram(col, bins);
  });

  document.getElementById("btn-render-bar")?.addEventListener("click", () => {
    if (!requireActiveDataset("render scientific visualizations")) return;
    const cat = document.getElementById("vis-bar-cat").value;
    const num = document.getElementById("vis-bar-num").value;
    renderClientBarChart(cat, num);
  });

  document.getElementById("btn-render-scatter")?.addEventListener("click", () => {
    if (!requireActiveDataset("render scientific visualizations")) return;
    const x = document.getElementById("vis-scat-x").value;
    const y = document.getElementById("vis-scat-y").value;
    renderClientScatter(x, y);
  });

  document.getElementById("btn-render-violin")?.addEventListener("click", () => {
    if (!requireActiveDataset("render scientific visualizations")) return;
    const cat = document.getElementById("vis-violin-group").value;
    const num = document.getElementById("vis-violin-numeric").value;
    renderClientViolin(cat, num);
  });

  document.getElementById("btn-render-pie")?.addEventListener("click", () => {
    if (!requireActiveDataset("render scientific visualizations")) return;
    const col = document.getElementById("vis-pie-cat").value;
    renderClientPie(col);
  });

  document.getElementById("btn-render-line")?.addEventListener("click", () => {
    if (!requireActiveDataset("render scientific visualizations")) return;
    const x = document.getElementById("vis-line-x").value;
    const y = document.getElementById("vis-line-y").value;
    renderClientLine(x, y);
  });
}

function populateVisualControls() {
  const populateOptions = (selectId, colList) => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = "";
    colList.forEach(col => {
      const opt = document.createElement("option");
      opt.value = col;
      opt.textContent = col;
      sel.appendChild(opt);
    });
  };

  populateOptions("vis-box-group", state.columns.categorical);
  populateOptions("vis-box-numeric", state.columns.numeric);
  populateOptions("vis-hist-col", state.columns.numeric);
  populateOptions("vis-bar-cat", state.columns.categorical);
  populateOptions("vis-bar-num", state.columns.numeric);
  populateOptions("vis-scat-x", state.columns.numeric);
  populateOptions("vis-scat-y", state.columns.numeric);
  populateOptions("vis-violin-group", state.columns.categorical);
  populateOptions("vis-violin-numeric", state.columns.numeric);
  populateOptions("vis-pie-cat", state.columns.categorical);
  populateOptions("vis-line-x", state.columns.all);
  populateOptions("vis-line-y", state.columns.numeric);
}

let chartStreamCounter = 0;

function createChartCard(title, chartType) {
  chartStreamCounter++;
  const container = document.getElementById("plot-custom-container");
  if (!container) return null;

  const chartId = `plotly-stream-${chartStreamCounter}`;
  const card = document.createElement("div");
  card.className = "card chart-stream-card";
  card.style.marginBottom = "1.5rem";
  card.style.border = "1px solid var(--border-color)";

  card.innerHTML = `
    <div class="card-header-flex">
      <div>
        <div style="font-weight: 700; color: #1e3a8a; font-size: 1.05rem;">${escapeHtml(title)}</div>
        <div style="font-size: 0.8rem; color: #64748b;">${escapeHtml(chartType)} &bull; Interactive Publication Figure</div>
      </div>
      <div style="display: flex; gap: 0.4rem;">
        <button class="btn btn-secondary btn-sm btn-add-chart-report">➕ Add to Report</button>
        <button class="btn btn-secondary btn-sm btn-remove-chart">✕</button>
      </div>
    </div>
    <div id="${chartId}" style="width: 100%; height: 420px; margin-top: 0.5rem;"></div>
  `;

  // Attach / Detach to report listener
  const addBtn = card.querySelector(".btn-add-chart-report");
  let isAdded = false;
  addBtn.addEventListener("click", () => {
    isAdded = !isAdded;
    if (isAdded) {
      state.reportCharts.push({ chartId, title, chartType });
      addBtn.innerHTML = "✓ Attached to Report";
      addBtn.classList.add("btn-success");
      addBtn.classList.remove("btn-secondary");
      showNotification(`Attached "${title}" to draft manuscript.`, "success");
    } else {
      state.reportCharts = state.reportCharts.filter(c => c.chartId !== chartId);
      addBtn.innerHTML = "➕ Add to Report";
      addBtn.classList.remove("btn-success");
      addBtn.classList.add("btn-secondary");
      showNotification(`Removed "${title}" from report.`, "info");
    }
  });

  card.querySelector(".btn-remove-chart").addEventListener("click", () => {
    state.reportCharts = state.reportCharts.filter(c => c.chartId !== chartId);
    card.remove();
  });

  container.prepend(card);
  return chartId;
}

function renderClientBoxPlot(catCol, numCol) {
  const chartId = createChartCard(`Box Plot of ${numCol} across ${catCol}`, "Comparative Distribution");
  if (!chartId || typeof Plotly === 'undefined') return;

  const groups = {};
  state.cleanedRows.forEach(r => {
    const g = String(r[catCol] || 'Other').trim();
    const v = Number(r[numCol]);
    if (!isNaN(v)) {
      if (!groups[g]) groups[g] = [];
      groups[g].push(v);
    }
  });

  const traces = Object.keys(groups).map(g => ({
    y: groups[g],
    type: 'box',
    name: g,
    boxpoints: 'all',
    jitter: 0.3,
    pointpos: -1.8,
    marker: { size: 4 }
  }));

  const layout = {
    title: { text: `Distribution of ${numCol} across ${catCol}`, font: { size: 14 } },
    yaxis: { title: numCol },
    xaxis: { title: catCol },
    margin: { t: 40, b: 40, l: 60, r: 20 }
  };

  Plotly.newPlot(chartId, traces, layout, { responsive: true });
}

function renderClientHistogram(col, bins = 20) {
  const chartId = createChartCard(`Histogram & Distribution of ${col}`, "Univariate Frequency");
  if (!chartId || typeof Plotly === 'undefined') return;

  const vals = state.cleanedRows.map(r => Number(r[col])).filter(v => !isNaN(v));
  const trace = {
    x: vals,
    type: 'histogram',
    nbinsx: bins,
    marker: { color: '#3b82f6', line: { color: '#1e3a8a', width: 1 } }
  };

  const layout = {
    title: { text: `Frequency Distribution of ${col}`, font: { size: 14 } },
    xaxis: { title: col },
    yaxis: { title: "Frequency (Count)" },
    margin: { t: 40, b: 40, l: 60, r: 20 }
  };

  Plotly.newPlot(chartId, [trace], layout, { responsive: true });
}

function renderClientBarChart(catCol, numCol) {
  const chartId = createChartCard(`Research Bar Chart: Mean ${numCol} by ${catCol}`, "Group Means & Error Bars");
  if (!chartId || typeof Plotly === 'undefined') return;

  const groups = {};
  state.cleanedRows.forEach(r => {
    const g = String(r[catCol] || 'Other').trim();
    const v = Number(r[numCol]);
    if (!isNaN(v)) {
      if (!groups[g]) groups[g] = [];
      groups[g].push(v);
    }
  });

  const categories = Object.keys(groups);
  const means = [];
  const errors = [];

  categories.forEach(g => {
    const arr = groups[g];
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.length > 1 ? arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1) : 0;
    const sem = arr.length > 1 ? Math.sqrt(variance) / Math.sqrt(arr.length) : 0;
    means.push(mean);
    errors.push(sem);
  });

  const trace = {
    x: categories,
    y: means,
    type: 'bar',
    marker: { color: '#2563eb' },
    error_y: { type: 'data', array: errors, visible: true, color: '#1e293b' }
  };

  const layout = {
    title: { text: `Mean ${numCol} across ${catCol} (±1 SEM)`, font: { size: 14 } },
    xaxis: { title: catCol },
    yaxis: { title: `Mean ${numCol}` },
    margin: { t: 40, b: 40, l: 60, r: 20 }
  };

  Plotly.newPlot(chartId, [trace], layout, { responsive: true });
}

function renderClientScatter(xCol, yCol) {
  const chartId = createChartCard(`Bivariate Scatter & OLS Trendline: ${xCol} vs ${yCol}`, "Regression Fit");
  if (!chartId || typeof Plotly === 'undefined') return;

  const pts = [];
  state.cleanedRows.forEach(r => {
    const x = Number(r[xCol]), y = Number(r[yCol]);
    if (!isNaN(x) && !isNaN(y)) pts.push({ x, y });
  });

  const tracePts = {
    x: pts.map(p => p.x),
    y: pts.map(p => p.y),
    mode: 'markers',
    type: 'scatter',
    name: 'Observations',
    marker: { color: '#0ea5e9', size: 7, opacity: 0.7 }
  };

  // Trendline slope
  const n = pts.length;
  const sumX = pts.reduce((a, b) => a + b.x, 0);
  const sumY = pts.reduce((a, b) => a + b.y, 0);
  const sumXY = pts.reduce((a, b) => a + b.x * b.y, 0);
  const sumX2 = pts.reduce((a, b) => a + b.x * b.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const minX = Math.min(...pts.map(p => p.x));
  const maxX = Math.max(...pts.map(p => p.x));

  const traceLine = {
    x: [minX, maxX],
    y: [slope * minX + intercept, slope * maxX + intercept],
    mode: 'lines',
    type: 'scatter',
    name: `OLS Trend (y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)})`,
    line: { color: '#dc2626', width: 2.5 }
  };

  const layout = {
    title: { text: `${yCol} vs ${xCol}`, font: { size: 14 } },
    xaxis: { title: xCol },
    yaxis: { title: yCol },
    margin: { t: 40, b: 40, l: 60, r: 20 }
  };

  Plotly.newPlot(chartId, [tracePts, traceLine], layout, { responsive: true });
}

function renderClientViolin(catCol, numCol) {
  const chartId = createChartCard(`Violin Density Distribution: ${numCol} by ${catCol}`, "Kernel Density");
  if (!chartId || typeof Plotly === 'undefined') return;

  const groups = {};
  state.cleanedRows.forEach(r => {
    const g = String(r[catCol] || 'Other').trim();
    const v = Number(r[numCol]);
    if (!isNaN(v)) {
      if (!groups[g]) groups[g] = [];
      groups[g].push(v);
    }
  });

  const traces = Object.keys(groups).map(g => ({
    type: 'violin',
    y: groups[g],
    name: g,
    box: { visible: true },
    meanline: { visible: true }
  }));

  const layout = {
    title: { text: `Violin Density of ${numCol} across ${catCol}`, font: { size: 14 } },
    yaxis: { title: numCol },
    xaxis: { title: catCol },
    margin: { t: 40, b: 40, l: 60, r: 20 }
  };

  Plotly.newPlot(chartId, traces, layout, { responsive: true });
}

function renderClientPie(col) {
  const chartId = createChartCard(`Donut / Proportion Chart of ${col}`, "Categorical Shares");
  if (!chartId || typeof Plotly === 'undefined') return;

  const counts = {};
  state.cleanedRows.forEach(r => {
    const k = String(r[col] || 'Missing').trim();
    counts[k] = (counts[k] || 0) + 1;
  });

  const trace = {
    labels: Object.keys(counts),
    values: Object.values(counts),
    type: 'pie',
    hole: 0.45,
    marker: { colors: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'] }
  };

  const layout = {
    title: { text: `Category Distribution of ${col}`, font: { size: 14 } },
    margin: { t: 40, b: 40, l: 40, r: 40 }
  };

  Plotly.newPlot(chartId, [trace], layout, { responsive: true });
}

function renderClientLine(xCol, yCol) {
  const chartId = createChartCard(`Line Trend Series: ${yCol} across ${xCol}`, "Sequential Tracking");
  if (!chartId || typeof Plotly === 'undefined') return;

  const pts = [];
  state.cleanedRows.forEach(r => {
    const x = r[xCol];
    const y = Number(r[yCol]);
    if (x !== null && x !== undefined && !isNaN(y)) pts.push({ x, y });
  });

  const trace = {
    x: pts.map(p => p.x),
    y: pts.map(p => p.y),
    type: 'scatter',
    mode: 'lines+markers',
    line: { color: '#2563eb', width: 2 }
  };

  const layout = {
    title: { text: `${yCol} across ${xCol}`, font: { size: 14 } },
    xaxis: { title: xCol },
    yaxis: { title: yCol },
    margin: { t: 40, b: 40, l: 60, r: 20 }
  };

  Plotly.newPlot(chartId, [trace], layout, { responsive: true });
}

function loadHeatmap() {
  const containerId = "plot-heatmap-container";
  const numCols = state.columns.numeric || [];
  if (numCols.length < 2 || !window.StatisticalEngine || typeof Plotly === 'undefined') return;

  const matData = window.StatisticalEngine.calculateCorrelationMatrix(state.cleanedRows, numCols);
  const z = [];
  numCols.forEach(r => {
    const rowVals = [];
    numCols.forEach(c => rowVals.push(matData.correlation_matrix[r][c]));
    z.push(rowVals);
  });

  const trace = {
    z: z,
    x: numCols,
    y: numCols,
    type: 'heatmap',
    colorscale: 'Blues',
    zmin: -1.0,
    zmax: 1.0
  };

  const layout = {
    title: { text: "Pearson Correlation Matrix", font: { size: 13 } },
    margin: { t: 40, b: 40, l: 80, r: 40 }
  };

  Plotly.newPlot(containerId, [trace], layout, { responsive: true });
}

// ==========================================
// 1-Click Automated Research Pipeline
// ==========================================
function runFullAutomatedPipeline() {
  if (!requireActiveDataset("generate an automatic report")) return;
  showNotification("Executing End-to-End Automated Research Pipeline in Browser...", "info");

  try {
    // 1. Auto-clean if not already cleaned
    window.EDAProfiler.cleanData(state.cleanedRows, { drop_duplicates: true });

    // 2. Compute automated tests if none executed yet
    if (state.executedTests.length === 0 && window.StatisticalEngine) {
      const recs = window.StatisticalEngine.autoRecommendAnalysis(state.cleanedRows, state.columns, state.objective);
      recs.slice(0, 3).forEach(r => {
        let res;
        if (r.test === "two_sample_test") res = window.StatisticalEngine.twoSampleTest(state.cleanedRows, r.params.continuous_col, r.params.group_col);
        else if (r.test === "anova_test") res = window.StatisticalEngine.anovaTest(state.cleanedRows, r.params.continuous_col, r.params.group_col);
        else if (r.test === "correlation_analysis") res = window.StatisticalEngine.correlationAnalysis(state.cleanedRows, r.params.col1, r.params.col2);
        else if (r.test === "chi_square_test") res = window.StatisticalEngine.chiSquareTest(state.cleanedRows, r.params.var1, r.params.var2);
        else if (r.test === "linear_regression") res = window.StatisticalEngine.linearRegression(state.cleanedRows, r.params.target_col, r.params.feature_cols);
        if (res && !res.error) state.executedTests.push(res);
      });
    }

    // 3. Construct academic manuscript report
    const reportData = window.ReportGenerator.constructAcademicReport({
      title: "",
      researcherName: "Lead Lab Investigator",
      professorTemplate: "Standard Empirical Research Report",
      rows: state.cleanedRows,
      columns: state.columns,
      profile: state.profile,
      statisticalResults: state.executedTests,
      attachedCharts: state.reportCharts,
      researchObjective: state.objective,
      filename: state.currentDataset
    });

    state.currentReport = reportData;
    renderAcademicManuscript(reportData);
    showNotification("Pipeline complete! Full draft report synthesized.", "success");
    switchTab("report");
  } catch (e) {
    showNotification("Pipeline execution error: " + e.message, "danger");
  }
}

// ==========================================
// Tab 5: Academic Report & Human Validation Controller
// ==========================================
function renderAcademicManuscript(rep) {
  state.currentReport = rep;
  document.getElementById("rep-title").textContent = rep.title;
  document.getElementById("rep-meta").textContent = `Author: ${rep.researcher_name} | Date: ${rep.date} | Status: ${rep.validation_status}`;
  document.getElementById("rep-status-badge").textContent = rep.validation_status.replace(/_/g, " ");

  const standardView = document.getElementById("manuscript-standard-view");
  const customView = document.getElementById("manuscript-custom-outline-view");
  const customContent = document.getElementById("rep-custom-rendered-content");

  if (rep.is_custom_template && rep.rendered_content) {
    // Show custom template outline view for only this report
    if (standardView) standardView.style.display = "none";
    if (customView) {
      customView.style.display = "block";
      customContent.innerHTML = formatManuscriptMarkdown(rep.rendered_content);
    }
  } else {
    // Show standard predefined template view
    if (standardView) standardView.style.display = "block";
    if (customView) customView.style.display = "none";

    document.getElementById("rep-abstract-text").value = rep.abstract || "";
    document.getElementById("rep-intro").textContent = rep.introduction || "";
    document.getElementById("rep-methodology").textContent = rep.methodology || "";

    const resContainer = document.getElementById("rep-results-container");
    if (resContainer) {
      resContainer.innerHTML = "";
      (rep.results || []).forEach(r => {
        const div = document.createElement("div");
        div.style.marginBottom = "1.5rem";
        div.innerHTML = `
          <h3>${escapeHtml(r.title)}</h3>
          <p>${(r.narrative || "").replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>
        `;
        resContainer.appendChild(div);
      });
    }

    document.getElementById("rep-discussion-text").value = rep.discussion || "";
    document.getElementById("rep-limitations").textContent = rep.limitations || "";
    document.getElementById("rep-conclusions-text").value = rep.conclusions || "";

    const docGroundingElem = document.getElementById("rep-doc-grounding");
    if (docGroundingElem) {
      docGroundingElem.textContent = rep.document_grounding || "All statistical procedures grounded against APA 7th Edition Reporting Standards.";
    }
  }

  document.getElementById("human-notes-input").value = rep.human_notes || "";
}

function formatManuscriptMarkdown(md) {
  if (!md) return "";
  const lines = md.split("\n");
  let html = "";
  let inTable = false;
  let tableRows = [];

  function flushTable() {
    if (tableRows.length === 0) return;
    const validRows = tableRows.filter(r => !/^\s*\|?\s*:?-+:?\s*\|/.test(r));
    if (validRows.length === 0) { tableRows = []; return; }
    let tHtml = '<div style="overflow-x:auto; margin: 1rem 0;"><table style="width:100%; border-collapse: collapse; font-size: 0.92rem; border: 1px solid #cbd5e1;">';
    validRows.forEach((r, idx) => {
      const cols = r.split("|").map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
      const isHeader = (idx === 0);
      const bg = isHeader ? '#1e3a8a' : (idx % 2 === 0 ? '#f8fafc' : '#ffffff');
      const color = isHeader ? '#ffffff' : '#1e293b';
      const weight = isHeader ? '700' : '400';
      tHtml += `<tr style="background: ${bg}; color: ${color}; font-weight: ${weight};">`;
      cols.forEach(c => {
        const cellTag = isHeader ? 'th' : 'td';
        tHtml += `<${cellTag} style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: left;">${escapeHtml(c)}</${cellTag}>`;
      });
      tHtml += '</tr>';
    });
    tHtml += '</table></div>';
    html += tHtml;
    tableRows = [];
  }

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      tableRows.push(trimmed);
      return;
    } else if (inTable) {
      flushTable();
      inTable = false;
    }

    if (!trimmed) return;

    if (trimmed.startsWith("### ")) {
      html += `<h3 style="color: #1e3a8a; margin-top: 1.25rem; margin-bottom: 0.5rem; font-size: 1.15rem;">${escapeHtml(trimmed.slice(4))}</h3>`;
    } else if (trimmed.startsWith("## ")) {
      html += `<h2 style="color: #1e3a8a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 0.35rem; margin-top: 1.75rem; margin-bottom: 0.75rem; font-size: 1.35rem;">${escapeHtml(trimmed.slice(3))}</h2>`;
    } else if (trimmed.startsWith("# ")) {
      html += `<h1 style="color: #0f172a; margin-top: 1rem; margin-bottom: 0.75rem; font-size: 1.75rem; text-align: center;">${escapeHtml(trimmed.slice(2))}</h1>`;
    } else if (trimmed === "---") {
      html += `<hr style="margin: 1.5rem 0; border: none; border-top: 1.5px solid #cbd5e1;">`;
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
      const itemText = trimmed.replace(/^[-•*]\s+/, "");
      html += `<li style="margin-left: 1.5rem; margin-bottom: 0.35rem;">${formatInlineMarkdown(itemText)}</li>`;
    } else {
      html += `<p style="margin-bottom: 0.85rem; line-height: 1.75;">${formatInlineMarkdown(trimmed)}</p>`;
    }
  });

  if (inTable) flushTable();
  return html;
}

function formatInlineMarkdown(text) {
  let res = escapeHtml(text);
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/`([^`]+)`/g, '<code style="background:#e2e8f0; padding:2px 4px; border-radius:4px; font-family:monospace; font-size:0.9em;">$1</code>');
  return res;
}

function initValidationListeners() {
  // Mode switcher tabs
  const btnModeAuto = document.getElementById("btn-mode-auto");
  const btnModeManual = document.getElementById("btn-mode-manual");
  const panelAuto = document.getElementById("panel-report-auto");
  const panelManual = document.getElementById("panel-report-manual");

  if (btnModeAuto && btnModeManual) {
    btnModeAuto.addEventListener("click", () => {
      btnModeAuto.classList.remove("btn-secondary");
      btnModeAuto.classList.add("btn-primary");
      btnModeManual.classList.remove("btn-primary");
      btnModeManual.classList.add("btn-secondary");
      panelAuto.style.display = "block";
      panelManual.style.display = "none";
    });

    btnModeManual.addEventListener("click", () => {
      btnModeManual.classList.remove("btn-secondary");
      btnModeManual.classList.add("btn-primary");
      btnModeAuto.classList.remove("btn-primary");
      btnModeAuto.classList.add("btn-secondary");
      panelManual.style.display = "block";
      panelAuto.style.display = "none";
    });
  }

  // Quick preset outline buttons
  const outlineArea = document.getElementById("manual-rep-outline");
  const btnPreStd = document.getElementById("btn-outline-preset-std");
  const btnPreExec = document.getElementById("btn-outline-preset-exec");
  const btnPreClin = document.getElementById("btn-outline-preset-clinical");

  if (outlineArea) {
    btnPreStd?.addEventListener("click", () => {
      outlineArea.value = 
`# {{title}}
**Principal Investigator:** {{researcher_name}} | **Date:** {{date}} | **Dataset:** \`{{dataset_name}}\`

---

## Abstract
{{abstract}}

## 1. Introduction & Research Objectives
{{introduction}}
**Primary Research Inquiry:** {{research_objective}}

## 2. Experimental Data Hygiene & Descriptive Profiling
{{methodology}}

### Table 1: Comprehensive Descriptive Statistics
{{descriptive_statistics_table}}

### Table 2: Categorical Attribute Distributions
{{categorical_distribution_table}}

## 3. Inferential Hypothesis Testing & APA 7th Statements
{{hypothesis_testing_results}}

## 4. Key Comparative Findings
{{detailed_findings}}

## 5. Scientific Discussion & Laboratory Interpretation
{{discussion}}

## 6. Methodological Limitations & Validity Threats
{{limitations}}

## 7. Conclusions & Research Recommendations
{{conclusions}}

## 8. Document Grounding & Methodology Compliance
{{document_grounding}}`;
      showNotification("Loaded Academic Standard outline into builder.", "info");
    });

    btnPreExec?.addEventListener("click", () => {
      outlineArea.value = 
`# {{title}}
**Author:** {{researcher_name}} | **Date:** {{date}}

---

## 1. Executive Summary & Objective
{{abstract}}

**Core Problem Under Study:** {{research_objective}}

## 2. Key Data Insights & Descriptive Summary
{{descriptive_statistics_table}}

## 3. Primary Empirical Findings & Hypothesis Tests
{{hypothesis_testing_results}}

## 4. Strategic Discussion & Practical Implications
{{discussion}}

## 5. Actionable Conclusions & Next Steps
{{conclusions}}`;
      showNotification("Loaded Executive Brief outline into builder.", "info");
    });

    btnPreClin?.addEventListener("click", () => {
      outlineArea.value = 
`# {{title}} (Clinical Evaluation)
**Lead Investigator:** {{researcher_name}} | **Protocol Date:** {{date}} | **Cohort:** \`{{dataset_name}}\` (N = {{row_count}})

---

## Executive Abstract
{{abstract}}

## 1. Trial Protocol & Clinical Objectives
{{introduction}}

**Primary Endpoint Target:** {{research_objective}}

## 2. Baseline Cohort Quality & Preprocessing
{{methodology}}
{{descriptive_statistics_table}}

## 3. Primary & Secondary Statistical Analysis
{{hypothesis_testing_results}}

## 4. Clinical Significance & Discussion
{{discussion}}

## 5. Safety, Limitations & Conclusions
{{limitations}}
{{conclusions}}`;
      showNotification("Loaded Clinical Cohort outline into builder.", "info");
    });
  }

  // Generate Automatic Report Button in Tab 5
  document.getElementById("btn-generate-report-auto")?.addEventListener("click", () => {
    runFullAutomatedPipeline();
  });

  // Generate Custom Manual Report with Outline
  document.getElementById("btn-generate-report-manual")?.addEventListener("click", () => {
    if (!requireActiveDataset("compile a manual report")) return;
    const title = document.getElementById("manual-rep-title")?.value.trim() || "Empirical Research Report";
    const author = document.getElementById("manual-rep-author")?.value.trim() || "Laboratory Researcher";
    const template = document.getElementById("manual-rep-template")?.value || "Standard Empirical Research Report";
    const notes = document.getElementById("manual-rep-notes")?.value.trim() || "";
    const customOutline = document.getElementById("manual-rep-outline")?.value.trim() || "";

    showNotification("Compiling custom manual report with template outline...", "info");

    const reportData = window.ReportGenerator.constructAcademicReport({
      title: title,
      researcherName: author,
      professorTemplate: template,
      customTemplateContent: customOutline,
      rows: state.cleanedRows,
      columns: state.columns,
      profile: state.profile,
      statisticalResults: state.executedTests,
      customNotes: notes,
      attachedCharts: state.reportCharts,
      researchObjective: state.objective,
      filename: state.currentDataset
    });

    renderAcademicManuscript(reportData);
    showNotification("Custom manual report compiled with your template outline!", "success");
  });

  // Human Sign-off Save
  document.getElementById("btn-save-validation")?.addEventListener("click", () => {
    if (!state.currentReport) {
      showNotification("No report generated yet.", "warning");
      return;
    }
    const status = document.getElementById("select-validation-status")?.value || "VERIFIED_BY_RESEARCHER";
    const notes = document.getElementById("human-notes-input")?.value || "";
    state.currentReport.validation_status = status;
    state.currentReport.human_notes = notes;
    renderAcademicManuscript(state.currentReport);
    showNotification(`Human validation confirmed: ${status.replace(/_/g, " ")}`, "success");
  });

  // Save / Export to Local Device Handlers
  document.getElementById("btn-export-docx")?.addEventListener("click", () => {
    if (!state.currentReport) {
      showNotification("No report generated yet. Upload dataset and generate report first.", "warning");
      return;
    }
    showNotification("Generating Word document (.doc) in browser...", "info");
    window.ReportGenerator.exportDocx(state.currentReport);
  });

  document.getElementById("btn-export-markdown")?.addEventListener("click", () => {
    if (!state.currentReport) {
      showNotification("No report generated yet. Upload dataset and generate report first.", "warning");
      return;
    }
    showNotification("Downloading Markdown manuscript (.md)...", "info");
    window.ReportGenerator.exportMarkdown(state.currentReport);
  });

  document.getElementById("btn-export-html")?.addEventListener("click", () => {
    if (!state.currentReport) {
      showNotification("No report generated yet. Upload dataset and generate report first.", "warning");
      return;
    }
    showNotification("Downloading standalone HTML report...", "info");
    window.ReportGenerator.exportHTML(state.currentReport);
  });

  document.getElementById("btn-export-pdf")?.addEventListener("click", () => {
    window.print();
  });
}

// ==========================================
// Tab 6: RAG & Methodology Library Controller
// ==========================================
function initMethodologyListeners() {
  document.getElementById("btn-search-rag")?.addEventListener("click", () => {
    const q = document.getElementById("input-rag-search").value.trim();
    if (!q) {
      loadRAGDocuments();
      return;
    }
    const results = window.ragEngine.retrieveRelevantContext(q, 10);
    renderRAGResults(results);
  });

  document.getElementById("btn-add-protocol")?.addEventListener("click", () => {
    const title = document.getElementById("new-proto-title").value.trim();
    const cat = document.getElementById("new-proto-cat").value.trim() || "Lab Protocol";
    const content = document.getElementById("new-proto-content").value.trim();

    if (!title || !content) {
      showNotification("Provide both title and content for the protocol.", "warning");
      return;
    }

    window.ragEngine.addDocument(title, cat, content);
    showNotification("Methodology guideline indexed into local browser library!", "success");
    loadRAGDocuments();

    document.getElementById("new-proto-title").value = "";
    document.getElementById("new-proto-content").value = "";
  });
}

function loadRAGDocuments() {
  if (!window.ragEngine) return;
  const docs = window.ragEngine.getAllDocuments();
  renderRAGResults(docs);
}

function renderRAGResults(docs) {
  const container = document.getElementById("rag-docs-container");
  if (!container) return;
  container.innerHTML = "";

  if (!docs || docs.length === 0) {
    container.innerHTML = `<p class="text-muted">No documents found.</p>`;
    return;
  }

  docs.forEach(d => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "1rem";
    card.innerHTML = `
      <div class="card-header-flex">
        <div style="font-weight: 700; color: #1e3a8a;">${escapeHtml(d.title)}</div>
        <span class="badge badge-info">${escapeHtml(d.category || 'Protocol')}</span>
      </div>
      <p style="font-size: 0.9rem; color: #334155; white-space: pre-line; margin-top: 0.5rem;">${escapeHtml(d.content || d.snippet)}</p>
    `;
    container.appendChild(card);
  });
}

// ==========================================
// Tab 1: Dataset Q&A & Research Objective Controller
// ==========================================
function initQAListeners() {
  const btnAsk = document.getElementById("btn-ask-dataset");
  const inputQ = document.getElementById("input-dataset-question");
  const btnUpdateObj = document.getElementById("btn-update-obj");

  if (btnAsk && inputQ) {
    btnAsk.addEventListener("click", () => handleAskDataset());
    inputQ.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleAskDataset();
    });
  }

  if (btnUpdateObj) {
    btnUpdateObj.addEventListener("click", () => {
      if (!requireActiveDataset("save research objective")) return;
      const obj = document.getElementById("input-objective").value.trim();
      if (!obj) return;
      state.objective = obj;
      showNotification("Research objective updated successfully!", "success");
    });
  }

  // Delegate pill clicks
  const pillsContainer = document.getElementById("qa-suggested-pills");
  if (pillsContainer) {
    pillsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".pill-btn");
      if (btn) {
        const qText = btn.getAttribute("data-q") || btn.textContent.trim();
        if (inputQ) {
          inputQ.value = qText;
          handleAskDataset();
        }
      }
    });
  }
}

function handleAskDataset() {
  if (!requireActiveDataset("ask questions regarding dataset")) return;
  const inputQ = document.getElementById("input-dataset-question");
  if (!inputQ) return;
  const q = inputQ.value.trim();
  if (!q) return;

  const respBox = document.getElementById("dataset-qa-response-box");
  const askedQ = document.getElementById("qa-asked-question");
  const ansText = document.getElementById("qa-answer-text");
  const srcBadge = document.getElementById("qa-source-badge");

  respBox.style.display = "block";
  askedQ.textContent = `Q: "${q}"`;
  ansText.textContent = "Analyzing active dataset and querying grounded methodology library...";
  srcBadge.textContent = "Computing...";
  srcBadge.style.background = "#e2e8f0";
  srcBadge.style.color = "#475569";

  setTimeout(() => {
    const data = window.DatasetQA.answerQuestion(
      q,
      state.cleanedRows,
      state.columns,
      state.profile,
      state.executedTests,
      state.objective,
      state.currentDataset
    );

    ansText.innerHTML = formatMarkdownAnswer(data.answer);
    srcBadge.textContent = data.source || "Dataset Computation";
    if (data.grounded) {
      srcBadge.style.background = "#dbeafe";
      srcBadge.style.color = "#1e40af";
    } else {
      srcBadge.style.background = "#fee2e2";
      srcBadge.style.color = "#b91c1c";
    }
  }, 100);
}

function formatMarkdownAnswer(text) {
  if (!text) return "";
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background: #e2e8f0; padding: 2px 4px; border-radius: 4px; font-family: monospace;">$1</code>');
  // Bullet lines
  html = html.replace(/^- (.*)$/gm, '<li style="margin-left: 1.25rem;">$1</li>');
  html = html.replace(/^• (.*)$/gm, '<li style="margin-left: 1.25rem;">$1</li>');
  if (html.includes('<li>')) {
    html = html.replace(/(<li[\s\S]*?<\/li>)/g, '<ul style="margin: 0.35rem 0 0.35rem 1.25rem; padding-left: 0.5rem;">$1</ul>');
  }
  return html.replace(/\n/g, '<br>');
}

function updateSuggestedQuestions(profile) {
  const pillsContainer = document.getElementById("qa-suggested-pills");
  if (!pillsContainer || !profile) return;

  const numCols = profile.numerical_columns || [];
  const catCols = profile.categorical_columns || [];
  const pills = [];

  // Summary & Objective
  pills.push({ label: "📊 Dataset Summary", q: "Summarize this dataset and list key attributes" });
  pills.push({ label: "🎯 Research Objective", q: "What is the primary research objective of this study?" });

  if (numCols.length > 0) {
    pills.push({ label: `Mean ${numCols[0]}`, q: `What is the average of ${numCols[0]}?` });
  }
  if (numCols.length > 0 && catCols.length > 0) {
    pills.push({ label: `${numCols[0]} by ${catCols[0]}`, q: `What is the average of ${numCols[0]} across ${catCols[0]}?` });
  }
  if (catCols.length > 0) {
    pills.push({ label: `Categories of ${catCols[0]}`, q: `What are the categories and distribution of ${catCols[0]}?` });
  }
  if (numCols.length >= 2) {
    pills.push({ label: `Correlations`, q: `What are the strongest correlations in this dataset?` });
  }

  pills.push({ label: "Missing & Outliers", q: "Are there missing values or outliers in this dataset?" });
  pills.push({ label: "⚡ Recommended Tests", q: "What statistical tests should I run for this dataset?" });
  pills.push({ label: "APA 7th Standard", q: "What does APA 7th require for reporting statistical results?" });

  pillsContainer.innerHTML = pills.map(p => 
    `<button class="btn btn-secondary btn-sm pill-btn" data-q="${escapeHtml(p.q)}">${escapeHtml(p.label)}</button>`
  ).join(" ");
}

// Helpers & Toasts
function showNotification(msg, type = "info") {
  const toast = document.createElement("div");
  toast.className = `badge badge-${type}`;
  toast.style.position = "fixed";
  toast.style.bottom = "24px";
  toast.style.right = "24px";
  toast.style.padding = "0.75rem 1.25rem";
  toast.style.fontSize = "0.9rem";
  toast.style.zIndex = "9999";
  toast.style.boxShadow = "var(--shadow-lg)";
  toast.style.animation = "fadeIn 0.2s ease";
  toast.textContent = msg;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(text) {
  if (typeof text !== "string") return text;
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
