/**
 * ResAI - Front-End Controller
 * Precision Research Data Analysis, Statistical Computation & Reporting
 */

// Global State
const state = {
  currentDataset: null,
  profile: null,
  objective: "",
  activeTab: "upload",
  currentReport: null,
  executedTests: [],
  reportCharts: [],
  columns: { numeric: [], categorical: [] }
};

// DOM Content Loaded
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initUploadListeners();
  initQAListeners();
  initMethodologyListeners();
  initValidationListeners();
});

// Tab Switching
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
  if (!state.currentDataset) {
    showNotification("Dataset not uploaded. Please upload a dataset in Tab 1 first.", "warning");
    switchTab("upload");
    return false;
  }
  return true;
}

function switchTab(tabId) {
  // Guard: if user attempts to navigate to data-dependent tabs without an uploaded dataset
  if (tabId !== "upload" && tabId !== "rag" && !state.currentDataset) {
    showNotification("Dataset not uploaded. Please upload a dataset in Tab 1 first.", "warning");
    tabId = "upload";
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
    if (tabId === "analysis") {
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

// Upload & Sample Dataset Management
function initUploadListeners() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) uploadFile(e.target.files[0]);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) uploadFile(e.dataTransfer.files[0]);
  });

  // Sample dataset buttons
  document.querySelectorAll("[data-sample]").forEach(btn => {
    btn.addEventListener("click", () => {
      const sampleType = btn.getAttribute("data-sample");
      loadSampleDataset(sampleType);
    });
  });

  // Automated Full Pipeline Buttons
  const autoBtn = document.getElementById("btn-run-full-pipeline");
  if (autoBtn) autoBtn.addEventListener("click", runFullAutomatedPipeline);

  // Wire up all page-level automatic report generation triggers
  document.querySelectorAll(".btn-trigger-auto-report").forEach(btn => {
    btn.addEventListener("click", runFullAutomatedPipeline);
  });
}

async function uploadFile(file) {
  const objInput = document.getElementById("input-objective");
  let objective = objInput ? objInput.value.trim() : "";
  // If the objective text is from the previous clinical sample, let backend auto-synthesize
  if (objective.includes("Evaluate recovery days and biomarker reduction") || objective.includes("Placebo vs Drug A vs Drug B")) {
    objective = "";
  }

  const formData = new FormData();
  formData.append("file", file);
  if (objective) {
    formData.append("objective", objective);
  }

  showNotification(`Uploading ${file.name}...`, "info");
  try {
    const res = await fetch("/api/eda/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (res.ok) {
      applyLoadedDataset(data);
      showNotification(`Dataset '${file.name}' loaded successfully!`, "success");
      showUploadSuccessBanner(data.filename, data.profile.total_rows, data.profile.total_columns);
    } else {
      showNotification(data.detail || "Error loading dataset", "danger");
    }
  } catch (err) {
    showNotification("Upload failed: " + err.message, "danger");
  }
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
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <button class="btn btn-primary btn-sm btn-banner-report" style="font-weight: 600;">⚡ Generate Automatic Report</button>
        <button class="btn btn-secondary btn-sm" onclick="switchTab('eda')">Data Health ➔</button>
      </div>
    </div>
  `;
  const reportBtn = banner.querySelector(".btn-banner-report");
  if (reportBtn) reportBtn.addEventListener("click", runFullAutomatedPipeline);
}

async function loadSampleDataset(sampleType) {
  showNotification(`Loading pre-configured ${sampleType} dataset...`, "info");
  const formData = new FormData();
  formData.append("sample_type", sampleType);

  try {
    const res = await fetch("/api/eda/load-sample", { method: "POST", body: formData });
    const data = await res.json();
    if (res.ok) {
      applyLoadedDataset(data);
      showNotification(`Pre-loaded ${data.filename} ready for analysis!`, "success");
    }
  } catch (err) {
    showNotification("Failed to load sample dataset: " + err.message, "danger");
  }
}

function applyLoadedDataset(data) {
  state.currentDataset = data.filename;
  state.objective = data.objective;
  state.profile = data.profile;
  state.columns.numeric = data.profile.numerical_columns || [];
  state.columns.categorical = data.profile.categorical_columns || [];

  // Update Header & UI
  document.getElementById("header-dataset-name").textContent = data.filename;
  document.getElementById("input-objective").value = data.objective;

  // Render EDA Profile & Suggested Questions
  renderEDAProfile(data.profile);
  populateTestSelectors();
  updateSuggestedQuestions(data.profile);
}

// Render Data Quality Assessment & Profiling
function renderEDAProfile(profile) {
  document.getElementById("stat-health-score").textContent = `${profile.health_score}%`;
  document.getElementById("stat-total-rows").textContent = profile.total_rows.toLocaleString();
  document.getElementById("stat-total-cols").textContent = profile.total_columns;
  document.getElementById("stat-missing-rate").textContent = `${profile.missing_rate_overall}%`;

  // Color health badge
  const scoreElem = document.getElementById("stat-health-score");
  if (profile.health_score >= 85) scoreElem.style.color = "var(--success)";
  else if (profile.health_score >= 70) scoreElem.style.color = "var(--warning)";
  else scoreElem.style.color = "var(--danger)";

  // Issues list
  const issuesContainer = document.getElementById("eda-issues-container");
  issuesContainer.innerHTML = "";
  if (profile.issues && profile.issues.length > 0) {
    profile.issues.forEach(issue => {
      const div = document.createElement("div");
      div.className = "recommendation-card";
      div.style.borderLeft = "4px solid var(--warning)";
      div.innerHTML = `<span><strong>Data Hygiene Notice:</strong> ${escapeHtml(issue)}</span>`;
      issuesContainer.appendChild(div);
    });
  } else {
    issuesContainer.innerHTML = `<p style="color: var(--success); font-weight: 600;">✓ Excellent Data Hygiene: No critical missingness, severe outliers, or constant column defects detected.</p>`;
  }

  // Column Profiling Table
  const tbody = document.getElementById("eda-columns-tbody");
  tbody.innerHTML = "";
  Object.values(profile.columns).forEach(col => {
    const tr = document.createElement("tr");
    const isNum = col.type === "numeric";
    tr.innerHTML = `
      <td><strong>${escapeHtml(col.name)}</strong></td>
      <td><span class="badge ${isNum ? 'badge-info' : 'badge-warning'}">${col.type}</span></td>
      <td>${col.missing_percentage}% (${col.missing_count})</td>
      <td>${col.unique_values}</td>
      <td>${isNum ? (col.skewness ?? '0.00') : 'N/A'}</td>
      <td>${isNum ? (col.outliers_count ?? 0) : 'N/A'}</td>
      <td>${col.issues.length > 0 ? `<span class="badge badge-danger">${col.issues.length} Note(s)</span>` : '<span class="badge badge-success">Clean</span>'}</td>
    `;
    tbody.appendChild(tr);
  });

  // Sample Records Preview Table
  renderSamplePreviewTable(profile.sample_records);
}

function renderSamplePreviewTable(records) {
  if (!records || records.length === 0) return;
  const thead = document.getElementById("preview-thead");
  const tbody = document.getElementById("preview-tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  const headers = Object.keys(records[0]);
  const trHead = document.createElement("tr");
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  records.forEach(r => {
    const tr = document.createElement("tr");
    headers.forEach(h => {
      const td = document.createElement("td");
      td.textContent = r[h] !== null ? r[h] : "null";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// 1-Click Data Cleaning
document.getElementById("btn-clean-data").addEventListener("click", async () => {
  showNotification("Executing automated dataset cleaning and imputation...", "info");
  const formData = new FormData();
  formData.append("drop_duplicates", "true");
  formData.append("impute_numeric", "median");
  formData.append("impute_categorical", "mode");

  try {
    const res = await fetch("/api/eda/clean", { method: "POST", body: formData });
    const data = await res.json();
    if (res.ok) {
      state.profile = data.profile;
      renderEDAProfile(data.profile);
      showNotification("Data cleansed! Missing values imputed and duplicates eliminated.", "success");
    }
  } catch (err) {
    showNotification("Cleansing error: " + err.message, "danger");
  }
});

// Statistical Analysis & Testing
async function loadSummaryStats() {
  try {
    const res = await fetch("/api/analysis/summary-stats");
    const data = await res.json();
    if (!res.ok) return;

    const tbody = document.getElementById("summary-stats-tbody");
    tbody.innerHTML = "";

    Object.entries(data.numerical_summary || {}).forEach(([col, s]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(col)}</strong></td>
        <td>${s.mean} ± ${s.std}</td>
        <td>[${s.ci95[0]}, ${s.ci95[1]}]</td>
        <td>${s.median} (IQR: ${s.iqr})</td>
        <td>${s.min} – ${s.max}</td>
        <td>${s.skewness}</td>
        <td>${s.is_normally_distributed ? '<span class="badge badge-success">Normal (p > .05)</span>' : '<span class="badge badge-warning">Non-normal</span>'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {}
}

async function loadRecommendations() {
  const container = document.getElementById("recommendations-list");
  container.innerHTML = `<div class="spinner"></div> Evaluating dataset variables & research questions...`;

  try {
    const res = await fetch("/api/analysis/recommendations");
    const recs = await res.json();
    const list = Array.isArray(recs) ? recs : (recs.recommended_tests || []);
    container.innerHTML = "";

    if (!list || list.length === 0) {
      container.innerHTML = `<p class="text-muted">No specific tests recommended for current columns.</p>`;
      return;
    }

    list.forEach(rec => {
      const div = document.createElement("div");
      div.className = "recommendation-card";
      div.innerHTML = `
        <div>
          <div style="font-weight: 700; color: #1e3a8a;">${escapeHtml(rec.name)}</div>
          <div style="font-size: 0.82rem; color: #475569; margin-top: 2px;">${escapeHtml(rec.reason)}</div>
        </div>
        <button class="btn btn-primary btn-sm btn-run-rec">Compute Test</button>
      `;

      div.querySelector(".btn-run-rec").addEventListener("click", () => {
        executeSpecificTest(rec.test, rec.params);
      });

      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = `<p class="text-danger">Failed to generate recommendations.</p>`;
  }
}

function populateTestSelectors() {
  const populateOptions = (elemId, list) => {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.innerHTML = "";
    list.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      el.appendChild(opt);
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

// Execute Tests
document.getElementById("btn-calc-two-sample").addEventListener("click", () => {
  const cont = document.getElementById("ts-continuous").value;
  const grp = document.getElementById("ts-group").value;
  executeSpecificTest("two_sample_test", { continuous_col: cont, group_col: grp });
});

document.getElementById("btn-calc-anova").addEventListener("click", () => {
  const cont = document.getElementById("anova-continuous").value;
  const grp = document.getElementById("anova-group").value;
  executeSpecificTest("anova_test", { continuous_col: cont, group_col: grp });
});

document.getElementById("btn-calc-correlation").addEventListener("click", () => {
  const method = document.getElementById("corr-method").value;
  executeSpecificTest("correlation_analysis", { method: method });
});

document.getElementById("btn-calc-chi").addEventListener("click", () => {
  const v1 = document.getElementById("chi-var1").value;
  const v2 = document.getElementById("chi-var2").value;
  executeSpecificTest("chi_square_test", { var1: v1, var2: v2 });
});

document.getElementById("btn-calc-reg").addEventListener("click", () => {
  const target = document.getElementById("reg-target").value;
  const checkboxes = document.querySelectorAll(".reg-pred-chk:checked");
  const preds = Array.from(checkboxes).map(c => c.value).filter(c => c !== target);
  if (preds.length === 0) {
    showNotification("Select at least one predictor distinct from the target.", "warning");
    return;
  }
  executeSpecificTest("linear_regression", { target_col: target, feature_cols: preds });
});

async function executeSpecificTest(testType, params) {
  showNotification(`Computing rigorous mathematical test via Python...`, "info");
  let url = "";
  let body = params || {};

  if (testType === "two_sample_test" || testType === "two_sample") {
    url = "/api/analysis/two-sample";
  } else if (testType === "anova_test" || testType === "anova") {
    url = "/api/analysis/anova";
  } else if (testType === "correlation_analysis" || testType === "correlation") {
    url = "/api/analysis/correlation";
  } else if (testType === "chi_square_test" || testType === "chi_square") {
    url = "/api/analysis/chi-square";
  } else if (testType === "linear_regression" || testType === "regression") {
    url = "/api/analysis/regression";
  } else {
    url = "/api/analysis/run-test";
    body = { test_type: testType, ...params };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await res.json();
    if (!res.ok) {
      showNotification(result.detail || "Calculation error", "danger");
      return;
    }

    state.executedTests.push({ test: testType, params: params, result: result });
    renderTestResultCard(result, testType, params);
    showNotification("Statistical test computed with exact mathematical verification!", "success");
  } catch (err) {
    showNotification("Computation failed: " + err.message, "danger");
  }
}

function renderTestResultCard(res) {
  const container = document.getElementById("test-results-log");
  const card = document.createElement("div");
  card.className = "card";
  card.style.borderLeft = "5px solid var(--primary)";
  card.style.animation = "fadeIn 0.3s ease";

  const isSig = res.is_significant;
  const apa = res.formatted_apa || "Computed";

  let detailHtml = "";
  if (res.test_type === "Two-Sample Comparison") {
    detailHtml = `
      <div class="grid-2" style="margin-top: 1rem;">
        <div class="stat-box">
          <div style="font-weight: 700; color: #1e3a8a;">${res.group_1.name} (n=${res.group_1.n})</div>
          <div>Mean: ${res.group_1.mean} (SD: ${res.group_1.std})</div>
          <div style="font-size: 0.8rem; color: #64748b;">Median: ${res.group_1.median}</div>
        </div>
        <div class="stat-box">
          <div style="font-weight: 700; color: #1e3a8a;">${res.group_2.name} (n=${res.group_2.n})</div>
          <div>Mean: ${res.group_2.mean} (SD: ${res.group_2.std})</div>
          <div style="font-size: 0.8rem; color: #64748b;">Median: ${res.group_2.median}</div>
        </div>
      </div>
      <div style="margin-top: 0.8rem; font-size: 0.9rem;">
        <strong>Effect Size:</strong> ${res.effect_size.metric} = ${res.effect_size.value} (${res.effect_size.magnitude}) | 
        <strong>Procedure:</strong> ${res.recommended_test} (Levene p = ${res.levene_test.p_value})
      </div>
    `;
  } else if (res.test_type === "One-Way ANOVA") {
    detailHtml = `
      <div style="margin-top: 0.8rem; font-size: 0.9rem;">
        <strong>Omnibus Effect:</strong> η² = ${res.eta_squared} | <strong>Non-parametric Kruskal-Wallis:</strong> H = ${res.kruskal_wallis.h_statistic} (p = ${res.kruskal_wallis.p_value})
      </div>
      ${res.post_hoc_tukey && res.post_hoc_tukey.length > 0 ? `
        <div style="margin-top: 0.5rem; font-size: 0.85rem;">
          <strong>Post-hoc Pairwise Comparisons (Tukey HSD):</strong>
          <ul style="margin-left: 1.5rem; margin-top: 0.3rem;">
            ${res.post_hoc_tukey.map(t => `<li>${t.group1} vs ${t.group2}: Diff = ${t.mean_diff}, p = ${t.p_adj} (${t.reject_null ? '<strong style="color:var(--success)">Significant</strong>' : 'Not Sig'})</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  } else if (res.test_type === "OLS Linear Regression") {
    detailHtml = `
      <div style="margin-top: 0.8rem; font-size: 0.9rem;">
        <strong>Model Fit:</strong> R² = ${res.r_squared} (Adj R² = ${res.adjusted_r_squared}) | F = ${res.f_statistic} (p = ${res.f_p_value})
      </div>
      <div class="table-container" style="margin-top: 0.75rem;">
        <table class="data-table">
          <thead><tr><th>Predictor</th><th>Coefficient (β)</th><th>Std Err</th><th>t-stat</th><th>p-value</th><th>Sig</th></tr></thead>
          <tbody>
            ${res.coefficients.map(c => `
              <tr>
                <td><strong>${c.variable}</strong></td>
                <td>${c.coefficient}</td>
                <td>${c.std_err}</td>
                <td>${c.t_statistic}</td>
                <td>${c.p_value}</td>
                <td>${c.is_significant ? '<span class="badge badge-success">p < .05</span>' : '<span class="badge badge-warning">n.s.</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (res.test_type === "Chi-Square Test of Independence") {
    detailHtml = `
      <div style="margin-top: 0.8rem; font-size: 0.9rem;">
        <strong>Independence Evaluation:</strong> χ² = ${res.chi2_statistic} (df = ${res.degrees_of_freedom}, N = ${res.sample_size}) | <strong>Cramér's V:</strong> ${res.cramers_v}
      </div>
    `;
  }

  card.innerHTML = `
    <div class="card-header-flex">
      <div>
        <div class="card-title">${res.test_type}</div>
        <div class="card-subtitle">APA Reporting Syntax: <strong style="color: #1e3a8a;">${apa}</strong></div>
      </div>
      <span class="badge ${isSig ? 'badge-success' : 'badge-warning'}">
        ${isSig ? 'Statistically Significant (p < .05)' : 'Null Hypothesis Retained (p ≥ .05)'}
      </span>
    </div>
    ${detailHtml}
    <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color); font-size: 0.85rem; color: #475569;">
      💡 <em>Researcher Summary:</em> ${isSig ? 'Empirical evidence rejects the null hypothesis at the α = 0.05 threshold. The observed effect demonstrates mathematical significance.' : 'No statistically significant divergence detected from the null expectation at α = 0.05. Sample size or effect magnitude may warrant further replication.'}
    </div>
  `;

  container.prepend(card);
}

// Visualizations
function populateVisualControls() {
  const populate = (elemId, list) => {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.innerHTML = "";
    list.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      el.appendChild(opt);
    });
  };

  populate("vis-dist-col", state.columns.numeric);
  populate("vis-dist-group", ["None", ...state.columns.categorical]);
  populate("vis-box-cont", state.columns.numeric);
  populate("vis-box-grp", state.columns.categorical);
  populate("vis-scat-x", state.columns.numeric);
  populate("vis-scat-y", state.columns.numeric);

  // Bar chart options (Category + Optional Continuous Metric + Subgroup)
  const catList = state.columns.categorical.length > 0 ? state.columns.categorical : state.columns.numeric;
  populate("vis-bar-cat", catList);
  populate("vis-bar-num", ["None", ...state.columns.numeric]);
  populate("vis-bar-sub", ["None", ...state.columns.categorical]);

  // Pie & Donut options
  populate("vis-pie-cat", catList);

  // Line & Trend options
  populate("vis-line-x", state.columns.numeric);
  populate("vis-line-y", state.columns.numeric);
}

async function loadHeatmap() {
  try {
    const res = await fetch("/api/analysis/visualize/heatmap");
    const data = await res.json();
    if (data.plotly_json) {
      const fig = JSON.parse(data.plotly_json);
      Plotly.newPlot("plot-heatmap-container", fig.data, fig.layout, { responsive: true });
    }
  } catch (e) {}
}

const btnDist = document.getElementById("btn-render-dist");
if (btnDist) {
  btnDist.addEventListener("click", async () => {
    const col = document.getElementById("vis-dist-col")?.value;
    const grp = document.getElementById("vis-dist-group")?.value;
    const url = grp && grp !== "None" 
      ? `/api/analysis/visualize/distribution?col1=${col}&group_by=${grp}`
      : `/api/analysis/visualize/distribution?col1=${col}`;
    renderPlotlyChart(url, "plot-custom-container");
  });
}

const btnBox = document.getElementById("btn-render-box");
if (btnBox) {
  btnBox.addEventListener("click", async () => {
    const cont = document.getElementById("vis-box-cont")?.value;
    const grp = document.getElementById("vis-box-grp")?.value;
    renderPlotlyChart(`/api/analysis/visualize/box_violin?col1=${cont}&col2=${grp}`, "plot-custom-container");
  });
}

const btnScatter = document.getElementById("btn-render-scatter");
if (btnScatter) {
  btnScatter.addEventListener("click", async () => {
    const x = document.getElementById("vis-scat-x")?.value;
    const y = document.getElementById("vis-scat-y")?.value;
    renderPlotlyChart(`/api/analysis/visualize/scatter?col1=${x}&col2=${y}`, "plot-custom-container");
  });
}

const btnBar = document.getElementById("btn-render-bar");
if (btnBar) {
  btnBar.addEventListener("click", async () => {
    const cat = document.getElementById("vis-bar-cat")?.value;
    const num = document.getElementById("vis-bar-num")?.value;
    const sub = document.getElementById("vis-bar-sub")?.value;
    let url = `/api/analysis/visualize/bar?col1=${encodeURIComponent(cat)}`;
    if (num && num !== "None") url += `&col2=${encodeURIComponent(num)}`;
    if (sub && sub !== "None") url += `&group_by=${encodeURIComponent(sub)}`;
    renderPlotlyChart(url, "plot-custom-container");
  });
}

const btnPie = document.getElementById("btn-render-pie");
if (btnPie) {
  btnPie.addEventListener("click", async () => {
    const cat = document.getElementById("vis-pie-cat")?.value;
    const style = document.getElementById("vis-pie-style")?.value || "donut";
    renderPlotlyChart(`/api/analysis/visualize/${style}?col1=${encodeURIComponent(cat)}`, "plot-custom-container");
  });
}

const btnLine = document.getElementById("btn-render-line");
if (btnLine) {
  btnLine.addEventListener("click", async () => {
    const x = document.getElementById("vis-line-x")?.value;
    const y = document.getElementById("vis-line-y")?.value;
    renderPlotlyChart(`/api/analysis/visualize/line?col1=${encodeURIComponent(x)}&col2=${encodeURIComponent(y)}`, "plot-custom-container");
  });
}

let chartStreamCounter = 0;

async function renderPlotlyChart(apiUrl, containerId, chartLabel) {
  try {
    showNotification("Rendering publication-grade visualization...", "info");
    const res = await fetch(apiUrl);
    const data = await res.json();
    if (!res.ok || data.error) {
      showNotification(data.detail || data.error || "Visualization failed", "danger");
      return;
    }

    if (data.plotly_json) {
      const fig = JSON.parse(data.plotly_json);
      const streamContainer = document.getElementById(containerId);
      if (!streamContainer) return;

      chartStreamCounter++;
      const chartId = `plotly-stream-item-${chartStreamCounter}`;
      const title = chartLabel || fig.layout?.title?.text || `Scientific Figure #${chartStreamCounter}`;

      const card = document.createElement("div");
      card.className = "card chart-stream-card";
      card.style.marginBottom = "1.5rem";
      card.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.06)";
      card.style.border = "1px solid var(--border-color)";
      card.style.animation = "fadeIn 0.3s ease";

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 700; color: #1e3a8a; margin: 0;">${escapeHtml(title)}</h3>
            <span style="font-size: 0.75rem; color: #64748b;">Figure Type: <strong>${escapeHtml(data.chart_type || 'Plot')}</strong> &bull; Generated: ${new Date().toLocaleTimeString()}</span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn btn-secondary btn-sm btn-add-chart-report" data-chart-id="${chartId}">
              ➕ Add to Report
            </button>
            <button class="btn btn-sm btn-remove-chart" title="Remove chart" style="background: #fee2e2; color: #b91c1c; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer;">
              🗑️
            </button>
          </div>
        </div>
        <div id="${chartId}" style="min-height: 420px;"></div>
      `;

      // Prepend so previous charts go down!
      streamContainer.prepend(card);

      // Render Plotly chart in this card's specific div
      Plotly.newPlot(chartId, fig.data, fig.layout, { responsive: true });

      // Add to Report listener
      const addBtn = card.querySelector(".btn-add-chart-report");
      addBtn.addEventListener("click", () => {
        const isAdded = state.reportCharts.some(c => c.chartId === chartId);
        if (!isAdded) {
          state.reportCharts.push({
            chartId: chartId,
            title: title,
            chartType: data.chart_type || "Visualization",
            plotly_json: data.plotly_json
          });
          addBtn.innerHTML = "✓ Added to Report";
          addBtn.classList.remove("btn-secondary");
          addBtn.classList.add("btn-success");
          showNotification(`Added "${title}" to your draft report!`, "success");
        } else {
          state.reportCharts = state.reportCharts.filter(c => c.chartId !== chartId);
          addBtn.innerHTML = "➕ Add to Report";
          addBtn.classList.remove("btn-success");
          addBtn.classList.add("btn-secondary");
          showNotification(`Removed "${title}" from draft report.`, "info");
        }
      });

      // Remove chart listener
      card.querySelector(".btn-remove-chart").addEventListener("click", () => {
        state.reportCharts = state.reportCharts.filter(c => c.chartId !== chartId);
        card.remove();
      });

      showNotification(`Generated: ${title}`, "success");
    }
  } catch (err) {
    showNotification("Chart render error: " + err.message, "danger");
  }
}

// 1-Click Automated Pipeline
async function runFullAutomatedPipeline() {
  showNotification("Executing End-to-End Automated Research Pipeline...", "info");
  try {
    // 1. Ensure cleaned
    await fetch("/api/eda/clean", { method: "POST", body: new FormData() });
    
    // 2. Generate Report with dynamic title grounded in active dataset
    const repRes = await fetch("/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "",
        researcher_name: "Lead Lab Investigator",
        professor_template: "Standard Empirical Laboratory Report",
        selected_tests: state.executedTests
      })
    });
    const reportData = await repRes.json();
    if (repRes.ok) {
      state.currentReport = reportData;
      renderAcademicManuscript(reportData);
      showNotification("Pipeline complete! Full draft report synthesized.", "success");
      switchTab("report");
    }
  } catch (e) {
    showNotification("Pipeline error: " + e.message, "danger");
  }
}

// Academic Report & Human Validation Controller
function renderAcademicManuscript(rep) {
  state.currentReport = rep;
  document.getElementById("rep-title").textContent = rep.title;
  document.getElementById("rep-meta").textContent = `Author: ${rep.researcher_name} | Date: ${rep.date} | Status: ${rep.validation_status}`;
  document.getElementById("rep-status-badge").textContent = rep.validation_status.replace(/_/g, " ");

  // Sections
  document.getElementById("rep-abstract-text").value = rep.abstract;
  document.getElementById("rep-intro").textContent = rep.introduction;
  document.getElementById("rep-methodology").textContent = rep.methodology;

  // Results
  const resContainer = document.getElementById("rep-results-container");
  resContainer.innerHTML = "";
  rep.results.forEach(r => {
    const div = document.createElement("div");
    div.style.marginBottom = "1.5rem";
    div.innerHTML = `
      <h3>${escapeHtml(r.title)}</h3>
      <p>${r.narrative.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>
    `;
    resContainer.appendChild(div);
  });

  document.getElementById("rep-discussion-text").value = rep.discussion;
  document.getElementById("rep-limitations").textContent = rep.limitations;
  document.getElementById("rep-conclusions-text").value = rep.conclusions;
  
  // Document Grounding Section
  const docGroundingElem = document.getElementById("rep-doc-grounding");
  if (docGroundingElem) {
    docGroundingElem.textContent = rep.document_grounding || "All statistical procedures grounded against APA 7th Edition Reporting Standards.";
  }
  
  document.getElementById("human-notes-input").value = rep.human_notes || "";
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

  // 1. Generate Automatic Report
  const btnGenAuto = document.getElementById("btn-generate-report-auto");
  if (btnGenAuto) {
    btnGenAuto.addEventListener("click", async () => {
      showNotification("Synthesizing dynamic academic report grounded in active dataset...", "info");
      const repRes = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "",
          researcher_name: "Lead Lab Investigator",
          professor_template: "Standard Empirical Research Report",
          selected_tests: state.executedTests,
          attached_charts: state.reportCharts
        })
      });
      const data = await repRes.json();
      if (repRes.ok) {
        renderAcademicManuscript(data);
        showNotification("Automatic research report synthesized successfully!", "success");
      } else {
        showNotification(data.detail || "Report synthesis failed", "danger");
      }
    });
  }

  // 2. Generate Custom Manual Report
  const btnGenManual = document.getElementById("btn-generate-report-manual");
  if (btnGenManual) {
    btnGenManual.addEventListener("click", async () => {
      const title = document.getElementById("manual-rep-title")?.value.trim() || "Empirical Research Report";
      const author = document.getElementById("manual-rep-author")?.value.trim() || "Laboratory Researcher";
      const template = document.getElementById("manual-rep-template")?.value || "Standard Empirical Research Report";
      const notes = document.getElementById("manual-rep-notes")?.value.trim() || "";

      showNotification("Compiling custom manual report...", "info");
      const repRes = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title,
          researcher_name: author,
          professor_template: template,
          selected_tests: state.executedTests,
          custom_notes: notes,
          attached_charts: state.reportCharts
        })
      });
      const data = await repRes.json();
      if (repRes.ok) {
        renderAcademicManuscript(data);
        showNotification("Custom manual report compiled successfully!", "success");
      } else {
        showNotification(data.detail || "Manual report compilation failed", "danger");
      }
    });
  }

  // Legacy button fallback
  const btnGenLegacy = document.getElementById("btn-generate-report");
  if (btnGenLegacy) {
    btnGenLegacy.addEventListener("click", () => {
      if (btnGenAuto) btnGenAuto.click();
    });
  }

  // Human Sign-Off / Status update
  const btnSaveVal = document.getElementById("btn-save-validation");
  if (btnSaveVal) {
    btnSaveVal.addEventListener("click", async () => {
      const status = document.getElementById("select-validation-status")?.value || "VERIFIED_BY_RESEARCHER";
      const notes = document.getElementById("human-notes-input")?.value || "";
      const editedAbs = document.getElementById("rep-abstract-text")?.value;
      const editedDisc = document.getElementById("rep-discussion-text")?.value;
      const editedConc = document.getElementById("rep-conclusions-text")?.value;

      showNotification("Saving researcher validation sign-off...", "info");
      const res = await fetch("/api/report/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validation_status: status,
          human_notes: notes,
          edited_abstract: editedAbs,
          edited_discussion: editedDisc,
          edited_conclusions: editedConc
        })
      });
      const data = await res.json();
      if (res.ok) {
        state.currentReport = data.report;
        renderAcademicManuscript(data.report);
        showNotification(`Human validation confirmed: ${status.replace(/_/g, " ")}`, "success");
      }
    });
  }

  // Save / Export to Local Device Handlers
  const btnDocx = document.getElementById("btn-export-docx");
  if (btnDocx) {
    btnDocx.addEventListener("click", () => {
      showNotification("Downloading Word document (.docx) to your computer...", "info");
      window.location.href = "/api/report/export-docx";
    });
  }

  const btnMd = document.getElementById("btn-export-markdown");
  if (btnMd) {
    btnMd.addEventListener("click", () => {
      showNotification("Downloading Markdown manuscript (.md) to your computer...", "info");
      window.location.href = "/api/report/export-markdown";
    });
  }

  const btnHtml = document.getElementById("btn-export-html");
  if (btnHtml) {
    btnHtml.addEventListener("click", () => {
      showNotification("Downloading standalone HTML report to your computer...", "info");
      window.location.href = "/api/report/export-html";
    });
  }

  const btnPdf = document.getElementById("btn-export-pdf");
  if (btnPdf) {
    btnPdf.addEventListener("click", () => {
      window.print();
    });
  }
}

// RAG Knowledge Base Controller
function initMethodologyListeners() {
  document.getElementById("btn-search-rag").addEventListener("click", async () => {
    const q = document.getElementById("input-rag-search").value.trim();
    if (!q) return;
    const res = await fetch(`/api/rag/query?q=${encodeURIComponent(q)}`);
    const docs = await res.json();
    renderRAGResults(docs);
  });

  document.getElementById("btn-add-protocol").addEventListener("click", async () => {
    const title = document.getElementById("new-proto-title").value.trim();
    const cat = document.getElementById("new-proto-cat").value.trim() || "Lab Protocol";
    const content = document.getElementById("new-proto-content").value.trim();

    if (!title || !content) {
      showNotification("Provide both title and content for the protocol.", "warning");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("category", cat);
    formData.append("content", content);

    const res = await fetch("/api/rag/upload-guideline", { method: "POST", body: formData });
    if (res.ok) {
      showNotification("Methodology guideline indexed into knowledge base!", "success");
      loadRAGDocuments();
      document.getElementById("new-proto-title").value = "";
      document.getElementById("new-proto-content").value = "";
    }
  });
}

async function loadRAGDocuments() {
  try {
    const res = await fetch("/api/rag/documents");
    const docs = await res.json();
    renderRAGResults(docs);
  } catch (e) {}
}

function renderRAGResults(docs) {
  const container = document.getElementById("rag-docs-container");
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

// ==========================================
// Dataset Q&A & Research Objective Controller
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
    btnUpdateObj.addEventListener("click", async () => {
      const obj = document.getElementById("input-objective").value.trim();
      if (!obj) return;
      try {
        const res = await fetch("/api/eda/update-objective", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objective: obj })
        });
        if (res.ok) {
          state.objective = obj;
          showNotification("Research objective updated successfully!", "success");
        }
      } catch (err) {
        showNotification("Failed to save objective: " + err.message, "danger");
      }
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

async function handleAskDataset() {
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

  try {
    const res = await fetch("/api/eda/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q })
    });
    const data = await res.json();
    if (res.ok) {
      ansText.innerHTML = formatMarkdownAnswer(data.answer);
      srcBadge.textContent = data.source || "Dataset Computation";
      if (data.grounded) {
        srcBadge.style.background = "#dbeafe";
        srcBadge.style.color = "#1e40af";
      } else {
        srcBadge.style.background = "#fef3c7";
        srcBadge.style.color = "#92400e";
      }
    } else {
      ansText.textContent = data.detail || "Error querying dataset.";
      srcBadge.textContent = "Error";
      srcBadge.style.background = "#fee2e2";
      srcBadge.style.color = "#991b1b";
    }
  } catch (err) {
    ansText.textContent = "Error communicating with research assistant: " + err.message;
    srcBadge.textContent = "Failed";
  }
}

function formatMarkdownAnswer(txt) {
  if (!txt) return "";
  let html = escapeHtml(txt);
  // bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // italics *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // code `text`
  html = html.replace(/`([^`]+)`/g, '<code style="background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 0.85em; color: #0f172a;">$1</code>');
  // bullet points
  html = html.replace(/^[•\-\*]\s+(.*)$/gm, '<li style="margin-bottom: 3px;">$1</li>');
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

  // 1. Overall Summary & Objective
  pills.push({ label: "📊 Dataset Summary", q: "Summarize this dataset and list key attributes" });
  pills.push({ label: "🎯 Research Objective", q: "What is the primary research objective of this study?" });

  // 2. Numeric and Group Queries
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

  // 3. Hygiene & Guidelines
  pills.push({ label: "Missing & Outliers", q: "Are there missing values or outliers in this dataset?" });
  pills.push({ label: "⚡ Recommended Tests", q: "What statistical tests should I run for this dataset?" });
  pills.push({ label: "APA Guidelines", q: "What does APA 7th require for reporting statistical results?" });

  pillsContainer.innerHTML = pills.map(p => 
    `<button class="btn btn-secondary btn-sm pill-btn" data-q="${escapeHtml(p.q)}">${escapeHtml(p.label)}</button>`
  ).join(" ");
}

