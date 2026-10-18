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
  activeTab: "generate",     // Default landing tab: Tab 1 (Generate Report)
  currentReport: null,       // Compiled manuscript
  executedTests: [],         // Statistical results register
  reportCharts: [],          // Charts attached to report
  columns: { numeric: [], categorical: [], all: [] },
  uploadedTemplate: null,    // { name: string, content: string, sections: string[] }
  customTemplateContent: null,
  isDatasetLocked: false
};

// DOM Content Loaded
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initLandingTabListeners();
  initUploadListeners();
  initFeatureEngineeringListeners();
  initValidationListeners();
  initAnalysisListeners();
  initVisualizationListeners();
  initHistoryListeners();
  renderHistoryTable();
  updateTabDisabledStates();
});

// ==========================================
// Toast Notification System
// ==========================================
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// Fallback alias
function showNotification(msg, type = "info") {
  showToast(msg, type);
}

// ==========================================
// Tab Switching & Navigation Guards
// ==========================================
function initTabs() {
  const tabBtns = document.querySelectorAll(".nav-tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      // Block navigation to other tabs until upload is done
      if (tabId !== "generate" && (!state.currentDataset || !state.cleanedRows || state.cleanedRows.length === 0)) {
        showToast("Upload file first", "warning");
        return;
      }
      switchTab(tabId);
    });
  });

  // Collapsible Navigation Drawer Open/Close Listeners
  const menuToggleBtn = document.getElementById("btn-nav-menu-toggle");
  const openDrawerBarBtn = document.getElementById("btn-open-drawer-bar");
  const drawerCloseBtn = document.getElementById("btn-nav-drawer-close");
  const drawerBackdrop = document.getElementById("nav-drawer-backdrop");
  const drawerQuickReturn = document.getElementById("btn-drawer-quick-return");

  const openDrawer = () => {
    document.getElementById("nav-drawer")?.classList.add("open");
    document.getElementById("nav-drawer-backdrop")?.classList.add("open");
  };

  const closeDrawer = () => {
    document.getElementById("nav-drawer")?.classList.remove("open");
    document.getElementById("nav-drawer-backdrop")?.classList.remove("open");
  };

  menuToggleBtn?.addEventListener("click", openDrawer);
  openDrawerBarBtn?.addEventListener("click", openDrawer);
  drawerCloseBtn?.addEventListener("click", closeDrawer);
  drawerBackdrop?.addEventListener("click", closeDrawer);
  drawerQuickReturn?.addEventListener("click", () => {
    closeDrawer();
    switchTab("generate");
  });

  // Secondary Tab Return buttons
  document.querySelectorAll(".btn-back-to-generate").forEach(btn => {
    btn.addEventListener("click", () => switchTab("generate"));
  });

  // Drawer navigation items
  document.querySelectorAll(".nav-drawer-item").forEach(item => {
    item.addEventListener("click", () => {
      const tabId = item.getAttribute("data-tab");
      if (tabId !== "generate" && (!state.currentDataset || !state.cleanedRows || state.cleanedRows.length === 0)) {
        showToast("Upload file first", "warning");
        return;
      }
      closeDrawer();
      switchTab(tabId);
    });
  });
}

function updateTabDisabledStates() {
  const isLoaded = Boolean(state.currentDataset && state.cleanedRows && state.cleanedRows.length > 0);
  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    const tabId = btn.getAttribute("data-tab");
    if (tabId !== "generate") {
      btn.classList.toggle("disabled-tab", !isLoaded);
    }
  });

  document.querySelectorAll(".nav-drawer-item").forEach(item => {
    const tabId = item.getAttribute("data-tab");
    if (tabId !== "generate") {
      item.classList.toggle("disabled-tab", !isLoaded);
      item.style.opacity = isLoaded ? "1" : "0.55";
    }
  });
}

function switchTab(tabId) {
  // Normalize legacy tab names
  if (tabId === "upload") tabId = "generate";
  if (tabId === "explorer") tabId = "eda";
  if (tabId === "report") tabId = "review";
  if (tabId === "rag") tabId = "history";

  // Guard: block navigation if no dataset
  if (tabId !== "generate" && (!state.currentDataset || !state.cleanedRows || state.cleanedRows.length === 0)) {
    showToast("Upload file first", "warning");
    tabId = "generate";
  }

  state.activeTab = tabId;
  document.querySelectorAll(".nav-tab-btn").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-tab") === tabId);
  });
  document.querySelectorAll(".nav-drawer-item").forEach(b => {
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
    } else if (tabId === "review") {
      renderReviewTab();
    } else if (tabId === "history") {
      renderHistoryTable();
    }
  } else if (tabId === "history") {
    renderHistoryTable();
  }
}

// ==========================================
// In-Browser File Ingestion (PapaParse & SheetJS)
// ==========================================
function initUploadListeners() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  if (dropZone && fileInput) {
    dropZone.addEventListener("click", () => {
      if (state.isDatasetLocked) {
        showToast("A dataset is already active. Click 'Start New Report' to upload a different dataset.", "warning");
        return;
      }
      fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        if (state.isDatasetLocked) {
          showToast("A dataset is already active. Click 'Start New Report' to upload a different dataset.", "warning");
          return;
        }
        processLocalFile(e.target.files[0]);
      }
    });

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!state.isDatasetLocked) dropZone.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      if (state.isDatasetLocked) {
        showToast("A dataset is already active. Click 'Start New Report' to upload a different dataset.", "warning");
        return;
      }
      if (e.dataTransfer.files.length > 0) processLocalFile(e.dataTransfer.files[0]);
    });
  }

  // Header automatic report generation trigger
  const autoBtn = document.getElementById("btn-run-full-pipeline");
  if (autoBtn) autoBtn.addEventListener("click", runFullAutomatedPipeline);
}

function processLocalFile(file) {
  if (!file) return;
  const fileName = file.name;
  const ext = fileName.split('.').pop().toLowerCase();

  showToast(`Reading '${fileName}' locally in browser...`, "info");

  if (ext === 'csv') {
    if (typeof Papa === 'undefined') {
      showToast("CSV parser is loading. Please wait a moment.", "warning");
      return;
    }
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: function(results) {
        if (!results.data || results.data.length === 0) {
          showToast("CSV file appears to be empty.", "danger");
          return;
        }
        applyLoadedDataset(results.data, fileName);
      },
      error: function(err) {
        showToast("Failed to parse CSV: " + err.message, "danger");
      }
    });
  } else if (ext === 'xlsx' || ext === 'xls') {
    if (typeof XLSX === 'undefined') {
      showToast("Excel parser is loading. Please wait a moment.", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
        if (!json || json.length === 0) {
          showToast("Excel worksheet is empty.", "danger");
          return;
        }
        setupExcelSheetSelector(workbook, fileName);
        applyLoadedDataset(json, `${fileName} [${sheetName}]`);
      } catch (err) {
        showToast("Failed to parse Excel file: " + err.message, "danger");
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    showToast("Unsupported file format. Please upload .CSV, .XLSX, or .XLS", "warning");
  }
}

function setupExcelSheetSelector(workbook, fileName) {
  const select = document.getElementById("select-excel-sheet");
  if (!select) return;
  select.innerHTML = "";
  workbook.SheetNames.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = `Sheet: ${name}`;
    select.appendChild(opt);
  });
  select.style.display = workbook.SheetNames.length > 1 ? "block" : "none";
  select.onchange = (e) => {
    const sheet = workbook.Sheets[e.target.value];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
    applyLoadedDataset(json, `${fileName} [${e.target.value}]`);
  };
}

function applyLoadedDataset(rows, fileName) {
  state.currentDataset = fileName;
  state.rawRows = rows;
  state.cleanedRows = JSON.parse(JSON.stringify(rows));
  state.executedTests = [];
  state.reportCharts = [];
  state.isDatasetLocked = true;

  // Run legacy profiling for EDA tab
  state.profile = window.EDAProfiler.profileDataset(state.cleanedRows);

  // Compute column schemas
  const firstRow = rows[0] || {};
  state.columns.all = Object.keys(firstRow);
  state.columns.numeric = state.profile.numerical_columns || [];
  state.columns.categorical = state.profile.categorical_columns || [];

  // Update Header
  const headerElem = document.getElementById("header-dataset-name");
  if (headerElem) headerElem.textContent = fileName;

  // Update Landing Tab Status Badge
  const landingBadge = document.getElementById("landing-dataset-status-badge");
  if (landingBadge) {
    landingBadge.textContent = "Dataset Ingested and Profiled";
    landingBadge.style.background = "#ecfdf5";
    landingBadge.style.color = "#065f46";
  }

  // Update Dataset Dropzone to Locked Card
  const dropZone = document.getElementById("drop-zone");
  const lockedCard = document.getElementById("dataset-locked-card");
  const lockedName = document.getElementById("locked-dataset-name");
  const lockedMeta = document.getElementById("locked-dataset-meta");

  if (dropZone) dropZone.style.display = "none";
  if (lockedCard) {
    lockedCard.style.display = "block";
    if (lockedName) lockedName.textContent = fileName;
    if (lockedMeta) lockedMeta.textContent = `${state.profile.total_rows.toLocaleString()} observations, ${state.profile.total_columns} variables`;
  }

  // Unlock other tabs
  updateTabDisabledStates();

  // Populate feature engineering selectors and overview
  populateFeatureEngineeringSelectors();
  renderEDATab();

  // Populate analysis & visualization controls
  populateTestSelectors();
  populateVisualControls();

  // Ingest dataset into ResAI Deterministic Workflow Engine
  if (window.ResAIWorkflowEngine) {
    window.ResAIWorkflowEngine.profileDataset(state.cleanedRows, fileName);
    if (!window.ResAIWorkflowEngine.templateJSON) {
      window.ResAIWorkflowEngine.extractTemplate(null); // Load built-in APA 7th template
    }
    window.ResAIWorkflowEngine.createFieldMapping(
      window.ResAIWorkflowEngine.templateJSON,
      window.ResAIWorkflowEngine.profileJSON
    );
    renderFieldMappingUI();
  }

  showToast(`Dataset '${fileName}' loaded successfully with ${state.profile.total_rows} records.`, "success");
}

// Reset session to allow new dataset upload
function resetDatasetSession() {
  state.currentDataset = null;
  state.rawRows = [];
  state.cleanedRows = [];
  state.profile = null;
  state.currentReport = null;
  state.executedTests = [];
  state.isDatasetLocked = false;

  if (window.ResAIWorkflowEngine) {
    window.ResAIWorkflowEngine.reset();
  }

  // Reset file inputs
  const fileInput = document.getElementById("file-input");
  if (fileInput) fileInput.value = "";

  // Reset UI elements
  const dropZone = document.getElementById("drop-zone");
  const lockedCard = document.getElementById("dataset-locked-card");
  if (dropZone) dropZone.style.display = "block";
  if (lockedCard) lockedCard.style.display = "none";

  const headerElem = document.getElementById("header-dataset-name");
  if (headerElem) headerElem.textContent = "No dataset loaded";

  const landingBadge = document.getElementById("landing-dataset-status-badge");
  if (landingBadge) {
    landingBadge.textContent = "Awaiting Dataset";
    landingBadge.style.background = "#eff6ff";
    landingBadge.style.color = "#1e40af";
  }

  // Hide mapping panel and outcomes
  const mappingPanel = document.getElementById("landing-mapping-panel");
  const initialCard = document.getElementById("landing-initial-generate-card");
  const outcomeCard = document.getElementById("landing-report-outcome");
  const progressElem = document.getElementById("landing-pipeline-progress");
  if (mappingPanel) mappingPanel.style.display = "none";
  if (initialCard) initialCard.style.display = "block";
  if (outcomeCard) outcomeCard.style.display = "none";
  if (progressElem) progressElem.style.display = "none";

  // Lock tabs
  updateTabDisabledStates();
  switchTab("generate");

  showToast("Session reset. You can now upload a new dataset.", "info");
}

// ==========================================
// Tab 1: Generate Report Landing Page Controller
// ==========================================
function initLandingTabListeners() {
  // Reset dataset button
  document.getElementById("btn-reset-dataset")?.addEventListener("click", resetDatasetSession);

  // Template upload handling
  const templateDropZone = document.getElementById("template-drop-zone");
  const templateFileInput = document.getElementById("template-file-input");
  const btnRemoveTemplate = document.getElementById("btn-remove-template");

  if (templateDropZone && templateFileInput) {
    templateDropZone.addEventListener("click", () => templateFileInput.click());

    templateFileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleCustomTemplateUpload(e.target.files[0]);
      }
    });

    templateDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      templateDropZone.classList.add("dragover");
    });
    templateDropZone.addEventListener("dragleave", () => templateDropZone.classList.remove("dragover"));
    templateDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      templateDropZone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        handleCustomTemplateUpload(e.dataTransfer.files[0]);
      }
    });
  }

  btnRemoveTemplate?.addEventListener("click", removeCustomTemplate);

  // Action Button: Direct Adaptive Report Generation
  document.getElementById("btn-generate-landing-report")?.addEventListener("click", () => {
    if (!state.currentDataset) {
      showToast("Upload file first", "warning");
      return;
    }
    executeVerifiedReportWorkflow();
  });

  document.getElementById("btn-confirm-mappings-generate")?.addEventListener("click", executeVerifiedReportWorkflow);

  // Header quick trigger
  document.getElementById("btn-run-full-pipeline")?.addEventListener("click", () => {
    if (!state.currentDataset) {
      showToast("Upload file first", "warning");
      return;
    }
    executeVerifiedReportWorkflow();
  });

  // Outcome direct download buttons
  document.getElementById("btn-landing-dl-docx")?.addEventListener("click", () => {
    if (window.ResAIWorkflowEngine && window.ResAIWorkflowEngine.assembledReport) {
      window.ResAIWorkflowEngine.exportDocxBlob(window.ResAIWorkflowEngine.assembledReport);
    } else if (state.currentReport && window.ReportGenerator) {
      window.ReportGenerator.exportDocx(state.currentReport);
    }
  });

  document.getElementById("btn-landing-dl-md")?.addEventListener("click", () => {
    if (window.ResAIWorkflowEngine && window.ResAIWorkflowEngine.assembledReport) {
      window.ResAIWorkflowEngine.exportMarkdown(window.ResAIWorkflowEngine.assembledReport);
    } else if (state.currentReport && window.ReportGenerator) {
      window.ReportGenerator.exportMarkdown(state.currentReport);
    }
  });

  document.getElementById("btn-landing-dl-pdf")?.addEventListener("click", () => {
    window.print();
  });

  document.getElementById("btn-landing-copy")?.addEventListener("click", () => {
    const rep = window.ResAIWorkflowEngine?.assembledReport || state.currentReport;
    const text = rep?.markdown || "";
    if (text && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast("Full manuscript copied to clipboard.", "success");
      }).catch(() => {
        showToast("Unable to copy to clipboard.", "warning");
      });
    } else {
      showToast("No manuscript text available to copy.", "info");
    }
  });

  document.getElementById("btn-landing-goto-review")?.addEventListener("click", () => {
    switchTab("review");
  });

  // Initialize In-Browser Local AI (WebGPU) Controller
  initLocalAIListeners();
}

// ==========================================
// Local In-Browser AI (WebGPU) Controller
// ==========================================
async function initLocalAIListeners() {
  const statusBadge = document.getElementById("local-ai-status-badge");
  const initBtn = document.getElementById("btn-init-local-ai");
  const unloadBtn = document.getElementById("btn-unload-local-ai");
  const modelSelect = document.getElementById("select-local-model");
  const progressContainer = document.getElementById("local-ai-progress-container");
  const progressBar = document.getElementById("local-ai-progress-bar");
  const progressText = document.getElementById("local-ai-progress-text");
  const progressPercent = document.getElementById("local-ai-progress-percent");
  const incompatibleBox = document.getElementById("local-ai-incompatible-box");
  const incompatibleReason = document.getElementById("local-ai-incompatible-reason");

  if (!window.ResAILocalLLM) return;

  // 1. Initial WebGPU hardware compatibility check
  try {
    const compat = await window.ResAILocalLLM.checkWebGPUCompatibility();
    if (compat.supported) {
      if (statusBadge) {
        statusBadge.textContent = "WebGPU Available (Local AI Supported)";
        statusBadge.style.background = "#eff6ff";
        statusBadge.style.color = "#1e40af";
        statusBadge.style.border = "1px solid #bfdbfe";
      }
      if (initBtn) initBtn.disabled = false;
    } else {
      if (statusBadge) {
        statusBadge.textContent = "WebGPU Incompatible (Deterministic Mode Active)";
        statusBadge.style.background = "#fffbeb";
        statusBadge.style.color = "#92400e";
        statusBadge.style.border = "1px solid #fde68a";
      }
      if (incompatibleBox) incompatibleBox.style.display = "block";
      if (incompatibleReason) incompatibleReason.textContent = compat.reason;
      if (initBtn) {
        initBtn.disabled = true;
        initBtn.title = "WebGPU not supported in this browser. Deterministic engine active.";
      }
    }
  } catch (err) {
    console.warn("WebGPU compatibility check error:", err);
  }

  // 2. Initialize button click
  initBtn?.addEventListener("click", async () => {
    const chosenModel = modelSelect ? modelSelect.value : "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
    const modelMeta = window.ResAILocalLLM.getSupportedModels().find(m => m.id === chosenModel);
    const sizeMb = modelMeta ? modelMeta.downloadSizeMB : 350;

    initBtn.disabled = true;
    if (modelSelect) modelSelect.disabled = true;
    if (progressContainer) progressContainer.style.display = "block";
    if (statusBadge) {
      statusBadge.textContent = `Downloading ${chosenModel.split("-")[0]} (~${sizeMb} MB)...`;
      statusBadge.style.background = "#eff6ff";
      statusBadge.style.color = "#1d4ed8";
    }

    try {
      showToast(`Initializing ${modelMeta?.name || 'Local AI'} (~${sizeMb} MB download on first run)...`, "info");

      await window.ResAILocalLLM.initModel(chosenModel, (progress) => {
        if (progressBar) progressBar.style.width = `${progress.percent}%`;
        if (progressPercent) progressPercent.textContent = `${progress.percent}%`;
        if (progressText) progressText.textContent = progress.text;
      });

      if (statusBadge) {
        statusBadge.textContent = `Local AI Ready: ${modelMeta?.name || 'Active'}`;
        statusBadge.style.background = "#ecfdf5";
        statusBadge.style.color = "#065f46";
        statusBadge.style.border = "1px solid #a7f3d0";
      }

      initBtn.style.display = "none";
      if (unloadBtn) unloadBtn.style.display = "inline-block";
      if (progressContainer) {
        setTimeout(() => {
          progressContainer.style.display = "none";
        }, 1500);
      }

      showToast(`Local LLM (${modelMeta?.name}) is ready. Inference runs 100% locally on your GPU.`, "success");

      // If dataset & template are already loaded, re-run template interpretation with local LLM
      if (window.ResAIWorkflowEngine && window.ResAIWorkflowEngine.templateJSON && window.ResAIWorkflowEngine.profileJSON) {
        const userContext = {
          document_title: document.getElementById("study-context-title")?.value?.trim() || null,
          researcher_name: document.getElementById("study-context-author")?.value?.trim() || "Lead Researcher",
          research_objective: document.getElementById("study-context-objective")?.value?.trim() || state.objective || null,
          literature_sources: document.getElementById("study-context-literature")?.value?.trim()
            ? document.getElementById("study-context-literature").value.split("\n").map(s => s.trim()).filter(Boolean)
            : null
        };
        const llmDecisions = await window.ResAILocalLLM.generateTemplateDecisions(
          window.ResAIWorkflowEngine.templateJSON,
          window.ResAIWorkflowEngine.profileJSON,
          userContext,
          window.ResAIWorkflowEngine
        );
        window.ResAIWorkflowEngine.templateDecisionsJSON = llmDecisions;
        renderFieldMappingUI();
      }
    } catch (err) {
      console.error("Local LLM load failure:", err);
      showToast(`Failed to initialize local LLM: ${err.message}. Reverting to deterministic mode.`, "danger");
      if (statusBadge) {
        statusBadge.textContent = "Initialization Failed (Deterministic Fallback)";
        statusBadge.style.background = "#fef2f2";
        statusBadge.style.color = "#b91c1c";
        statusBadge.style.border = "1px solid #fecaca";
      }
      initBtn.disabled = false;
      if (modelSelect) modelSelect.disabled = false;
      if (progressContainer) progressContainer.style.display = "none";
    }
  });

  // 3. Unload button click
  unloadBtn?.addEventListener("click", async () => {
    try {
      await window.ResAILocalLLM.unloadModel();
      if (statusBadge) {
        statusBadge.textContent = "WebGPU Available (Local AI Supported)";
        statusBadge.style.background = "#eff6ff";
        statusBadge.style.color = "#1e40af";
        statusBadge.style.border = "1px solid #bfdbfe";
      }
      if (initBtn) {
        initBtn.disabled = false;
        initBtn.style.display = "inline-block";
      }
      if (modelSelect) modelSelect.disabled = false;
      if (unloadBtn) unloadBtn.style.display = "none";
      showToast("Local LLM unloaded from GPU memory.", "info");
    } catch (err) {
      showToast(`Error unloading model: ${err.message}`, "warning");
    }
  });
}

async function handleCustomTemplateUpload(file) {
  if (!file) return;
  const fileName = file.name;
  const ext = fileName.split('.').pop().toLowerCase();

  showToast(`Extracting template structure from '${fileName}'...`, "info");

  if (window.ResAIWorkflowEngine) {
    try {
      const templateJSON = await window.ResAIWorkflowEngine.extractTemplate(file, ext === 'docx', fileName);
      applyLoadedTemplate(fileName, templateJSON);
    } catch (err) {
      console.error("Template extraction error:", err);
      showToast("Template extraction warning: " + err.message, "warning");
      extractClientTemplateSections(file, fileName);
    }
  } else {
    extractClientTemplateSections(file, fileName);
  }
}

function extractClientTemplateSections(file, fileName) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = typeof e.target.result === "string" ? e.target.result : "Standard Custom Template";
    applyLoadedTemplate(fileName, text);
  };
  reader.readAsText(file);
}

function applyLoadedTemplate(fileName, templateData) {
  let sections = [];
  let content = "";
  if (templateData && templateData.sections) {
    sections = templateData.sections.map(s => s.heading);
    content = JSON.stringify(templateData);
  } else if (typeof templateData === "string") {
    sections = extractSectionsFromContent(templateData);
    content = templateData;
  }

  state.uploadedTemplate = {
    name: fileName,
    content: content,
    sections: sections
  };
  state.customTemplateContent = content;

  // Update UI Elements
  const dropZone = document.getElementById("template-drop-zone");
  const infoBox = document.getElementById("template-info-box");
  const nameLabel = document.getElementById("template-filename-label");
  const sectionsContainer = document.getElementById("template-extracted-sections");
  const statusBadge = document.getElementById("template-status-badge");
  const reviewBadge = document.getElementById("review-template-badge");

  if (dropZone) dropZone.style.display = "none";
  if (infoBox) infoBox.style.display = "block";
  if (nameLabel) nameLabel.textContent = `Template: ${fileName}`;
  if (statusBadge) {
    statusBadge.textContent = "Custom Template Active";
    statusBadge.style.background = "#ecfdf5";
    statusBadge.style.color = "#065f46";
  }
  if (reviewBadge) {
    reviewBadge.textContent = `Template: Uploaded Template (${fileName})`;
  }

  if (sectionsContainer) {
    sectionsContainer.innerHTML = sections.map(s => 
      `<span class="extracted-section-badge" style="display: inline-block; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 4px; padding: 2px 7px; font-size: 0.75rem; margin: 2px;">${escapeHtml(s)}</span>`
    ).join(' ');
  }

  // If dataset is already loaded, re-generate field mappings with new template
  if (state.cleanedRows && state.cleanedRows.length > 0 && window.ResAIWorkflowEngine && window.ResAIWorkflowEngine.profileJSON) {
    window.ResAIWorkflowEngine.createFieldMapping(
      window.ResAIWorkflowEngine.templateJSON,
      window.ResAIWorkflowEngine.profileJSON
    );
    renderFieldMappingUI();
  }

  showToast(`Template '${fileName}' loaded with ${sections.length} extracted sections.`, "success");
}

function extractSectionsFromContent(text) {
  if (!text || typeof text !== "string") {
    return ["Abstract", "Introduction", "Methodology", "Results", "Discussion", "Conclusion"];
  }

  const detected = [];
  const lines = text.split("\n");
  const headingKeywords = [
    "Abstract", "Executive Summary", "Introduction", "Objectives", "Background",
    "Methodology", "Data Quality", "Preprocessing", "Statistical Analysis", "Results",
    "Hypothesis Testing", "Findings", "Discussion", "Interpretation", "Limitations",
    "Threats to Validity", "Conclusion", "Recommendations", "References"
  ];

  lines.forEach(line => {
    const trimmed = line.trim().replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "").trim();
    headingKeywords.forEach(kw => {
      if (trimmed.toLowerCase().includes(kw.toLowerCase()) && !detected.includes(kw)) {
        detected.push(kw);
      }
    });
  });

  if (detected.length === 0) {
    return ["Abstract", "Introduction", "Methodology", "Results", "Discussion", "Conclusion"];
  }
  return detected;
}

function removeCustomTemplate() {
  state.uploadedTemplate = null;
  state.customTemplateContent = null;

  if (window.ResAIWorkflowEngine) {
    window.ResAIWorkflowEngine.extractTemplate(null);
  }

  const dropZone = document.getElementById("template-drop-zone");
  const infoBox = document.getElementById("template-info-box");
  const fileInput = document.getElementById("template-file-input");
  const statusBadge = document.getElementById("template-status-badge");
  const reviewBadge = document.getElementById("review-template-badge");

  if (dropZone) dropZone.style.display = "block";
  if (infoBox) infoBox.style.display = "none";
  if (fileInput) fileInput.value = "";
  if (statusBadge) {
    statusBadge.textContent = "Using Built-in Template";
    statusBadge.style.background = "#f1f5f9";
    statusBadge.style.color = "#475569";
  }
  if (reviewBadge) {
    reviewBadge.textContent = "Template: Built-in Academic Template (APA 7th)";
  }

  // Refresh field mapping for built-in template
  if (state.cleanedRows && state.cleanedRows.length > 0 && window.ResAIWorkflowEngine && window.ResAIWorkflowEngine.profileJSON) {
    window.ResAIWorkflowEngine.createFieldMapping(
      window.ResAIWorkflowEngine.templateJSON,
      window.ResAIWorkflowEngine.profileJSON
    );
    renderFieldMappingUI();
  }

  showToast("Custom template removed. Default academic template will be used.", "info");
}

// ==========================================
// Stage 4: Render Interactive Field Mapping UI
// ==========================================
function renderFieldMappingUI() {
  const mappingPanel = document.getElementById("landing-mapping-panel");
  const tbody = document.getElementById("mapping-table-body");
  const initialCard = document.getElementById("landing-initial-generate-card");
  if (!mappingPanel || !tbody || !window.ResAIWorkflowEngine || !window.ResAIWorkflowEngine.mappingJSON) return;

  const mappingData = window.ResAIWorkflowEngine.mappingJSON;
  const columns = window.ResAIWorkflowEngine.profileJSON?.columns || [];
  const numCols = columns.filter(c => c.inferred_type === "numeric");

  tbody.innerHTML = "";

  mappingData.mappings.forEach(m => {
    const tr = document.createElement("tr");

    // Target Field
    const tdTarget = document.createElement("td");
    tdTarget.innerHTML = `
      <strong style="color: var(--secondary);">${escapeHtml(m.display_name || m.target_field)}</strong>
      <div style="font-size: 0.75rem; color: #64748b; font-family: var(--font-mono);">${escapeHtml(m.target_field)}</div>
    `;

    // Source Type
    const tdType = document.createElement("td");
    const isCol = m.source_type === "dataset_column";
    tdType.innerHTML = `
      <span class="badge" style="font-size: 0.72rem; ${isCol ? 'background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;' : 'background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe;'}">
        ${isCol ? 'Dataset Column' : 'Computed Metric'}
      </span>
    `;

    // Assigned Variable & Reason
    const tdAssigned = document.createElement("td");
    tdAssigned.innerHTML = `
      <div style="font-weight: 600; color: #334155;">${escapeHtml(m.source_column || m.transformation || 'Automated')}</div>
      <div style="font-size: 0.75rem; color: #64748b;">${escapeHtml(m.reason || '')}</div>
    `;

    // Status Badge
    const tdStatus = document.createElement("td");
    let badgeClass = "mapping-badge-confirmed";
    let badgeText = "Confirmed";
    if (m.status === "suggested") {
      badgeClass = "mapping-badge-suggested";
      badgeText = `Suggested (${Math.round((m.confidence || 0.9) * 100)}%)`;
    } else if (m.status === "unresolved") {
      badgeClass = "mapping-badge-unresolved";
      badgeText = "Unresolved";
    }
    tdStatus.innerHTML = `<span class="mapping-badge ${badgeClass}">${badgeText}</span>`;

    // Review & Modify
    const tdAction = document.createElement("td");
    if (isCol && numCols.length > 0) {
      const select = document.createElement("select");
      select.className = "mapping-select";
      select.innerHTML = `<option value="">-- Choose Column --</option>` + 
        numCols.map(c => `<option value="${escapeHtml(c.name)}" ${c.name === m.source_column ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join("");
      select.onchange = (e) => {
        const chosen = e.target.value;
        if (chosen) {
          window.ResAIWorkflowEngine.updateMappingChoice(m.target_field, chosen);
          renderFieldMappingUI();
        }
      };
      tdAction.appendChild(select);
    } else {
      tdAction.innerHTML = `<span style="font-size: 0.78rem; color: #64748b;">Grounded to calculation</span>`;
    }

    tr.appendChild(tdTarget);
    tr.appendChild(tdType);
    tr.appendChild(tdAssigned);
    tr.appendChild(tdStatus);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });

  // Render Section Intelligence Decision Plan
  const secList = document.getElementById("section-decisions-list");
  if (secList && window.ResAIWorkflowEngine.templateDecisionsJSON) {
    const tDec = window.ResAIWorkflowEngine.templateDecisionsJSON;
    const isLLM = tDec._engine_used === "local_llm";
    const modeBadge = document.getElementById("section-plan-mode-badge");
    if (modeBadge) {
      modeBadge.textContent = isLLM ? `Local AI (${tDec._model_id ? tDec._model_id.split("-")[0] : "WebGPU"})` : "Automated Deterministic";
      modeBadge.style.background = isLLM ? "#eff6ff" : "#f1f5f9";
      modeBadge.style.color = isLLM ? "#1e40af" : "#475569";
    }
    const decisions = tDec.sections || [];
    let html = "";

    if (tDec.warnings && tDec.warnings.length > 0) {
      html += `<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.5rem; color: #92400e; font-size: 0.78rem;">
        <strong>Notice:</strong> ${tDec.warnings.map(w => escapeHtml(w)).join("<br>")}
      </div>`;
    }

    if (tDec.blocking_questions && tDec.blocking_questions.length > 0) {
      html += `<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.5rem; color: #1e40af; font-size: 0.78rem;">
        <strong>Researcher Context:</strong> ${tDec.blocking_questions.map(q => escapeHtml(q.prompt)).join("<br>")}
      </div>`;
    }

    html += decisions.map(d => {
      let badgeStyle = "background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;";
      if (d.decision === "generate") badgeStyle = "background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;";
      else if (d.decision === "adapt") badgeStyle = "background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;";
      else if (d.decision === "populate") badgeStyle = "background: #faf5ff; color: #6b21a8; border: 1px solid #e9d5ff;";
      else if (d.decision === "ask_user") badgeStyle = "background: #fffbeb; color: #92400e; border: 1px solid #fde68a;";
      else if (d.decision === "omit") badgeStyle = "background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; text-decoration: line-through;";

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0.6rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
          <div>
            <strong style="color: #1e3a8a;">${escapeHtml(d.original_heading)}</strong>
            <span style="font-size: 0.72rem; color: #64748b; margin-left: 0.4rem;">(${escapeHtml(d.section_type)})</span>
            <div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">${escapeHtml(d.reason)}</div>
          </div>
          <span class="badge" style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; ${badgeStyle}">
            ${escapeHtml(d.decision)}
          </span>
        </div>
      `;
    }).join("");

    secList.innerHTML = html;
  }

  // Keep mapping panel hidden from user view (runs seamlessly in background)
  mappingPanel.style.display = "none";
  if (initialCard) initialCard.style.display = "block";
}

// ==========================================
// Stages 5 - 10: Automated Full Report Pipeline
// ==========================================
function executeVerifiedReportWorkflow() {
  if (!state.currentDataset || !state.cleanedRows || state.cleanedRows.length === 0) {
    showToast("Upload file first", "warning");
    return;
  }

  const progressElem = document.getElementById("landing-pipeline-progress");
  const outcomeCard = document.getElementById("landing-report-outcome");
  const mappingPanel = document.getElementById("landing-mapping-panel");
  const genBtn = document.getElementById("btn-generate-landing-report");
  const originalBtnHtml = genBtn ? genBtn.innerHTML : "";
  const statusText = document.getElementById("pipeline-status-text");
  const counterText = document.getElementById("pipeline-step-counter");

  // Keep intermediate panels hidden from user
  if (mappingPanel) mappingPanel.style.display = "none";
  if (progressElem) progressElem.style.display = "none";
  if (outcomeCard) outcomeCard.style.display = "none";

  if (genBtn) {
    genBtn.disabled = true;
    genBtn.innerHTML = `<span class="spinner" style="width: 16px; height: 16px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 0.5rem;"></span> Generating Adaptive Report...`;
  }

  const setStep = (stepNum, text) => {
    if (statusText) statusText.textContent = text;
    if (counterText) counterText.textContent = `Step ${stepNum} of 5`;
    for (let s = 1; s <= 5; s++) {
      const el = document.getElementById(`p-step-${s}`);
      if (!el) continue;
      el.classList.remove("active", "completed");
      if (s < stepNum) el.classList.add("completed");
      else if (s === stepNum) el.classList.add("active");
    }
  };

  setStep(1, "1. Validating dataset integrity, variable types, and schema...");

  setTimeout(() => {
    try {
      // Step 1: Clean duplicate rows
      window.EDAProfiler.cleanData(state.cleanedRows, { drop_duplicates: true });
      setStep(2, "2. Computing automated health index, missingness rates, and outliers...");

      setTimeout(async () => {
        // Step 3: Run Deterministic Workflow Engine Analysis
        setStep(3, "3. Executing deterministic statistical operations and hypothesis testing...");

        // Extract optional study context from UI inputs
        const userContext = {
          document_title: document.getElementById("study-context-title")?.value?.trim() || null,
          researcher_name: document.getElementById("study-context-author")?.value?.trim() || "Lead Researcher",
          research_objective: document.getElementById("study-context-objective")?.value?.trim() || state.objective || null,
          literature_sources: document.getElementById("study-context-literature")?.value?.trim()
            ? document.getElementById("study-context-literature").value.split("\n").map(s => s.trim()).filter(Boolean)
            : null
        };

        // Stage 3 & 4: Template Interpretation (Local LLM if ready, else deterministic)
        if (window.ResAILocalLLM && window.ResAILocalLLM.state === "ready") {
          try {
            setStep(3, "3. Local LLM interpreting unfamiliar template & running deterministic computations...");
            const llmDecisions = await window.ResAILocalLLM.generateTemplateDecisions(
              window.ResAIWorkflowEngine.templateJSON,
              window.ResAIWorkflowEngine.profileJSON,
              userContext,
              window.ResAIWorkflowEngine
            );
            window.ResAIWorkflowEngine.templateDecisionsJSON = llmDecisions;
          } catch (llmErr) {
            console.warn("Local LLM interpretation error, safely falling back to deterministic engine:", llmErr);
            window.ResAIWorkflowEngine.interpretTemplate(
              window.ResAIWorkflowEngine.templateJSON,
              window.ResAIWorkflowEngine.profileJSON,
              userContext
            );
          }
        } else {
          window.ResAIWorkflowEngine.interpretTemplate(
            window.ResAIWorkflowEngine.templateJSON,
            window.ResAIWorkflowEngine.profileJSON,
            userContext
          );
        }

        window.ResAIWorkflowEngine.confirmAllMappings();
        window.ResAIWorkflowEngine.createAnalysisPlan();
        const results = window.ResAIWorkflowEngine.executeAnalysis(state.cleanedRows);

        // Keep state.executedTests in sync
        if (results.primary_test && (!state.executedTests || state.executedTests.length === 0)) {
          state.executedTests = [results.primary_test];
        }

        setStep(4, "4. Generating and assembling verified academic report...");
        const assembled = await window.ResAIWorkflowEngine.generateReport();

        // Also assemble compatibility object for Tab 5 and ReportGenerator
        const templateName = state.uploadedTemplate ? state.uploadedTemplate.name : "Standard Empirical Research Report";
        const customContent = state.uploadedTemplate ? state.uploadedTemplate.content : null;

        const reportData = window.ReportGenerator.constructAcademicReport({
          title: assembled.document_title || "Empirical Research Manuscript",
          researcherName: "Lead Researcher",
          professorTemplate: templateName,
          customTemplateContent: customContent,
          rows: state.cleanedRows,
          columns: state.columns,
          profile: state.profile,
          statisticalResults: state.executedTests,
          attachedCharts: state.reportCharts,
          researchObjective: state.objective,
          filename: state.currentDataset
        });

        // Store canonical results into reportData
        reportData.canonical_results = results;
        reportData.workflow_report = assembled;
        state.currentReport = reportData;

        setStep(5, "5. Running independent report validation against dataset canonical truth...");
        const validation = window.ResAIWorkflowEngine.validateReport();
        state.currentReport.validation = validation;

        setTimeout(() => {
          for (let s = 1; s <= 5; s++) {
            document.getElementById(`p-step-${s}`)?.classList.add("completed");
          }
          if (statusText) statusText.textContent = "Pipeline execution complete. Manuscript synthesized.";

          if (genBtn) {
            genBtn.disabled = false;
            genBtn.innerHTML = originalBtnHtml;
          }

          // Save report to History
          saveReportToHistory(reportData);

          // Populate Tab 1 Outcome Card
          renderWorkflowOutcome(assembled, results, validation, reportData);

          showToast("Academic report successfully generated and verified against dataset.", "success");
        }, 300);
      }, 300);
    } catch (err) {
      if (genBtn) {
        genBtn.disabled = false;
        genBtn.innerHTML = originalBtnHtml;
      }
      console.error("Workflow execution failed:", err);
      showToast("Error generating report: " + err.message, "danger");
      if (statusText) statusText.textContent = "Error: " + err.message;
    }
  }, 300);
}

// Fallback alias
function runFullAutomatedPipeline() {
  executeVerifiedReportWorkflow();
}

// ==========================================
// Stage 10: Render Outcome & Validation Panel on Tab 1
// ==========================================
function renderWorkflowOutcome(assembled, results, validation, reportData) {
  const outcomeCard = document.getElementById("landing-report-outcome");
  if (!outcomeCard) return;

  outcomeCard.style.display = "block";

  // Document Title & Meta
  const titleElem = document.getElementById("outcome-title");
  const metaElem = document.getElementById("outcome-meta");
  if (titleElem) titleElem.textContent = assembled.title || reportData.title;
  if (metaElem) {
    metaElem.textContent = `Principal Investigator: Lead Researcher | Session: ${results.analysis_session_id} | Dataset: ${results.dataset_id}`;
  }

  // Claim Grounding Badge
  const claimBadge = document.getElementById("outcome-claim-badge");
  if (claimBadge) {
    if (validation.status === "blocked") {
      claimBadge.textContent = "Analysis Notice (Blocked Checks)";
      claimBadge.style.background = "#fef2f2";
      claimBadge.style.color = "#991b1b";
      claimBadge.style.border = "1px solid #fecaca";
    } else {
      claimBadge.textContent = `${validation.grounding_score_percent}% Verified Grounded`;
      claimBadge.style.background = "#ecfdf5";
      claimBadge.style.color = "#065f46";
      claimBadge.style.border = "1px solid #a7f3d0";
    }
  }

  // Caveats & Warnings
  const warningsContainer = document.getElementById("outcome-warnings-container");
  const warningsList = document.getElementById("outcome-warnings-list");
  if (warningsContainer && warningsList) {
    const allWarnings = [
      ...(validation.blocking_issues || []),
      ...(validation.warnings || [])
    ];
    if (allWarnings.length > 0) {
      warningsContainer.style.display = "block";
      warningsList.innerHTML = allWarnings.map(w => `<li>${escapeHtml(w)}</li>`).join("");
    } else {
      warningsContainer.style.display = "none";
    }
  }

  // Render actual industry-grade generated report directly on Tab 1
  const manuscriptViewer = document.getElementById("landing-manuscript-viewer");
  if (manuscriptViewer) {
    manuscriptViewer.innerHTML = formatManuscriptMarkdown(assembled.markdown);
  }

  // Synchronize Tab 5 (Academic Report & Validation tab)
  renderAcademicManuscript(reportData);
  if (reportData.claim_audit) renderClaimAudit(reportData.claim_audit);

  outcomeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ==========================================
// Tab 2: Exploratory Data Analysis & Feature Engineering
// ==========================================
function renderEDATab() {
  if (!state.profile) return;
  const p = state.profile;

  // Schema Stat Boxes
  const expRows = document.getElementById("exp-total-rows");
  const expCols = document.getElementById("exp-total-cols");
  const expNum = document.getElementById("exp-num-cols");
  const expCat = document.getElementById("exp-cat-cols");
  const recBadge = document.getElementById("explorer-records-badge");

  if (expRows) expRows.textContent = p.total_rows.toLocaleString();
  if (expCols) expCols.textContent = p.total_columns;
  if (expNum) expNum.textContent = (p.numerical_columns || []).length;
  if (expCat) expCat.textContent = (p.categorical_columns || []).length;
  if (recBadge) recBadge.textContent = `${p.total_rows.toLocaleString()} Rows Loaded`;

  // Health Stat Boxes
  const hScore = document.getElementById("stat-health-score");
  const hRows = document.getElementById("stat-total-rows");
  const hCols = document.getElementById("stat-total-cols");
  const hMissing = document.getElementById("stat-missing-rate");

  if (hScore) hScore.textContent = `${p.health_score}%`;
  if (hRows) hRows.textContent = p.total_rows.toLocaleString();
  if (hCols) hCols.textContent = p.total_columns;
  if (hMissing) hMissing.textContent = `${p.missing_rate_overall}%`;

  // Preprocessing / Hygiene Notices
  const issuesContainer = document.getElementById("eda-issues-container");
  if (issuesContainer) {
    if (p.hygiene_notices && p.hygiene_notices.length > 0) {
      issuesContainer.innerHTML = `
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 0.75rem 1rem;">
          <div style="font-weight: 700; color: #92400e; font-size: 0.85rem; margin-bottom: 0.25rem;">Quality Observations:</div>
          <ul style="margin-left: 1.25rem; font-size: 0.82rem; color: #78350f;">
            ${p.hygiene_notices.map(n => `<li>${escapeHtml(n)}</li>`).join('')}
          </ul>
        </div>
      `;
    } else {
      issuesContainer.innerHTML = `
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 0.65rem 1rem; font-size: 0.82rem; color: #065f46; font-weight: 600;">
          All variables meet standard hygiene thresholds. No severe outliers or missingness detected.
        </div>
      `;
    }
  }

  // Variable Profiling Table
  const columnsTbody = document.getElementById("eda-columns-tbody");
  if (columnsTbody) {
    columnsTbody.innerHTML = "";
    Object.keys(p.columns || {}).forEach(col => {
      const c = p.columns[col];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td><span class="badge ${c.type === 'numeric' ? 'badge-info' : 'badge-secondary'}">${c.type}</span></td>
        <td>${c.missing_count} (${c.missing_percentage}%)</td>
        <td>${c.unique_values}</td>
        <td>${c.skewness !== undefined ? c.skewness : '--'}</td>
        <td>${c.outliers_count !== undefined ? c.outliers_count : '--'}</td>
        <td>${c.issues.length > 0 ? `<span class="badge badge-warning">${escapeHtml(c.issues[0])}</span>` : '<span class="badge badge-success">Optimal</span>'}</td>
      `;
      columnsTbody.appendChild(tr);
    });
  }

  // Raw Observation Records Table (First 15 observations)
  const thead = document.getElementById("preview-thead");
  const tbody = document.getElementById("preview-tbody");
  if (thead && tbody && state.cleanedRows && state.cleanedRows.length > 0) {
    const cols = Object.keys(state.cleanedRows[0] || {});
    thead.innerHTML = `<tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
    const sampleRows = state.cleanedRows.slice(0, 15);
    tbody.innerHTML = sampleRows.map(row => {
      return `<tr>${cols.map(c => `<td>${row[c] !== null && row[c] !== undefined ? escapeHtml(String(row[c])) : '<em style="color:#94a3b8">null</em>'}</td>`).join('')}</tr>`;
    }).join('');
  }
}

function populateFeatureEngineeringSelectors() {
  const imputeSelect = document.getElementById("fe-impute-col");
  const outlierSelect = document.getElementById("fe-outlier-col");
  const transformSelect = document.getElementById("fe-transform-col");
  const encodeSelect = document.getElementById("fe-encode-col");

  if (!state.columns.all || state.columns.all.length === 0) return;

  if (imputeSelect) {
    imputeSelect.innerHTML = `<option value="__all_numeric__">All Numerical Features</option>` +
      state.columns.all.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  if (outlierSelect) {
    outlierSelect.innerHTML = state.columns.numeric.map(c => 
      `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
    ).join('');
  }

  if (transformSelect) {
    transformSelect.innerHTML = state.columns.numeric.map(c => 
      `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
    ).join('');
  }

  if (encodeSelect) {
    encodeSelect.innerHTML = state.columns.categorical.map(c => 
      `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
    ).join('');
  }
}

function initFeatureEngineeringListeners() {
  // 1. 1-Click Clean Data
  document.getElementById("btn-clean-data")?.addEventListener("click", () => {
    if (!state.currentDataset) return;
    const res = window.EDAProfiler.cleanData(state.cleanedRows, {
      missing_numeric_strategy: "median",
      missing_categorical_strategy: "mode",
      drop_duplicates: true
    });
    state.cleanedRows = res.cleanedRows;
    state.profile = window.EDAProfiler.profileDataset(state.cleanedRows);
    renderEDATab();
    showToast(`Dataset cleaned. Duplicates removed and missing cells imputed.`, "success");
  });

  // 2. Missing Value Imputation
  document.getElementById("btn-apply-impute")?.addEventListener("click", () => {
    if (!state.cleanedRows || state.cleanedRows.length === 0) return;
    const col = document.getElementById("fe-impute-col")?.value;
    const strategy = document.getElementById("fe-impute-strategy")?.value;
    if (!col) return;

    let targetCols = col === "__all_numeric__" ? state.columns.numeric : [col];
    let imputedCount = 0;

    targetCols.forEach(c => {
      if (strategy === "mean" || strategy === "median") {
        const vals = state.cleanedRows.map(r => r[c]).filter(v => typeof v === "number" && !isNaN(v));
        if (vals.length === 0) return;
        const repVal = strategy === "mean" 
          ? (vals.reduce((a, b) => a + b, 0) / vals.length)
          : vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)];
        state.cleanedRows.forEach(r => {
          if (r[c] === null || r[c] === undefined || isNaN(r[c])) {
            r[c] = Math.round(repVal * 100) / 100;
            imputedCount++;
          }
        });
      } else if (strategy === "mode") {
        const counts = {};
        state.cleanedRows.forEach(r => {
          if (r[c] !== null && r[c] !== undefined) counts[r[c]] = (counts[r[c]] || 0) + 1;
        });
        const modeVal = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, "");
        state.cleanedRows.forEach(r => {
          if (r[c] === null || r[c] === undefined) {
            r[c] = modeVal;
            imputedCount++;
          }
        });
      } else if (strategy === "drop_rows") {
        const before = state.cleanedRows.length;
        state.cleanedRows = state.cleanedRows.filter(r => r[c] !== null && r[c] !== undefined);
        imputedCount += (before - state.cleanedRows.length);
      }
    });

    state.profile = window.EDAProfiler.profileDataset(state.cleanedRows);
    renderEDATab();
    showToast(`Imputation applied (${imputedCount} cells/rows affected).`, "success");
  });

  // 3. Outlier Treatment
  document.getElementById("btn-apply-outlier")?.addEventListener("click", () => {
    if (!state.cleanedRows || state.cleanedRows.length === 0) return;
    const col = document.getElementById("fe-outlier-col")?.value;
    const method = document.getElementById("fe-outlier-method")?.value;
    if (!col) return;

    const vals = state.cleanedRows.map(r => r[col]).filter(v => typeof v === "number" && !isNaN(v)).sort((a, b) => a - b);
    if (vals.length < 4) return;

    const q1 = vals[Math.floor(vals.length * 0.25)];
    const q3 = vals[Math.floor(vals.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;

    let adjustedCount = 0;
    if (method === "clip_iqr") {
      state.cleanedRows.forEach(r => {
        if (typeof r[col] === "number") {
          if (r[col] < lower) { r[col] = Math.round(lower * 100) / 100; adjustedCount++; }
          else if (r[col] > upper) { r[col] = Math.round(upper * 100) / 100; adjustedCount++; }
        }
      });
    } else if (method === "winsorize") {
      const p5 = vals[Math.floor(vals.length * 0.05)];
      const p95 = vals[Math.floor(vals.length * 0.95)];
      state.cleanedRows.forEach(r => {
        if (typeof r[col] === "number") {
          if (r[col] < p5) { r[col] = p5; adjustedCount++; }
          else if (r[col] > p95) { r[col] = p95; adjustedCount++; }
        }
      });
    } else if (method === "drop_outliers") {
      const before = state.cleanedRows.length;
      state.cleanedRows = state.cleanedRows.filter(r => typeof r[col] !== "number" || (r[col] >= lower && r[col] <= upper));
      adjustedCount = before - state.cleanedRows.length;
    }

    state.profile = window.EDAProfiler.profileDataset(state.cleanedRows);
    renderEDATab();
    showToast(`Outlier treatment applied to '${col}' (${adjustedCount} values treated).`, "success");
  });

  // 4. Feature Scaling & Transformations
  document.getElementById("btn-apply-transform")?.addEventListener("click", () => {
    if (!state.cleanedRows || state.cleanedRows.length === 0) return;
    const col = document.getElementById("fe-transform-col")?.value;
    const type = document.getElementById("fe-transform-type")?.value;
    if (!col) return;

    const newColName = `${col}_${type}`;
    const vals = state.cleanedRows.map(r => r[col]).filter(v => typeof v === "number" && !isNaN(v));
    if (vals.length === 0) return;

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / vals.length) || 1;

    state.cleanedRows.forEach(r => {
      const v = r[col];
      if (typeof v === "number" && !isNaN(v)) {
        if (type === "log") {
          r[newColName] = Math.round(Math.log(Math.max(0, v) + 1) * 1000) / 1000;
        } else if (type === "zscore") {
          r[newColName] = Math.round(((v - mean) / std) * 1000) / 1000;
        } else if (type === "minmax") {
          r[newColName] = Math.round(((v - min) / ((max - min) || 1)) * 1000) / 1000;
        }
      } else {
        r[newColName] = null;
      }
    });

    if (!state.columns.numeric.includes(newColName)) state.columns.numeric.push(newColName);
    if (!state.columns.all.includes(newColName)) state.columns.all.push(newColName);

    state.profile = window.EDAProfiler.profileDataset(state.cleanedRows);
    populateFeatureEngineeringSelectors();
    renderEDATab();
    populateTestSelectors();
    populateVisualControls();
    showToast(`Transformed feature '${newColName}' added to dataset.`, "success");
  });

  // 5. Categorical Encoding (One-Hot)
  document.getElementById("btn-apply-encode")?.addEventListener("click", () => {
    if (!state.cleanedRows || state.cleanedRows.length === 0) return;
    const col = document.getElementById("fe-encode-col")?.value;
    if (!col) return;

    const categories = Array.from(new Set(state.cleanedRows.map(r => r[col]).filter(Boolean)));
    if (categories.length === 0 || categories.length > 15) {
      showToast("Categorical encoding requires between 2 and 15 distinct categories.", "warning");
      return;
    }

    categories.forEach(cat => {
      const dummyCol = `${col}_${String(cat).replace(/\s+/g, '_')}`;
      state.cleanedRows.forEach(r => {
        r[dummyCol] = (r[col] === cat) ? 1 : 0;
      });
      if (!state.columns.numeric.includes(dummyCol)) state.columns.numeric.push(dummyCol);
      if (!state.columns.all.includes(dummyCol)) state.columns.all.push(dummyCol);
    });

    state.profile = window.EDAProfiler.profileDataset(state.cleanedRows);
    populateFeatureEngineeringSelectors();
    renderEDATab();
    populateTestSelectors();
    populateVisualControls();
    showToast(`One-hot dummy features generated for '${col}'.`, "success");
  });
}

// ==========================================
// Tab 5: Academic Report & Validation Controller
// ==========================================
function renderReviewTab() {
  if (state.currentReport) {
    renderAcademicManuscript(state.currentReport);
    renderClaimAudit(state.currentReport.claim_audit);
  }
}

function renderClaimAudit(audit) {
  if (!audit) return;
  const scoreBadge = document.getElementById("claim-audit-score-badge");
  const statChecked = document.getElementById("audit-stat-checked");
  const statVerified = document.getElementById("audit-stat-verified");
  const statWarnings = document.getElementById("audit-stat-warnings");
  const container = document.getElementById("claim-audit-items-container");

  if (scoreBadge) {
    scoreBadge.textContent = `${audit.grounding_score_percent}% Grounded`;
    scoreBadge.className = audit.unsupported_claims_count > 0 ? "badge-unsupported" : "badge-verified";
  }
  if (statChecked) statChecked.textContent = audit.total_claims_checked;
  if (statVerified) statVerified.textContent = audit.verified_claims_count;
  if (statWarnings) statWarnings.textContent = audit.unsupported_claims_count;

  if (container) {
    container.innerHTML = "";
    if (!audit.claims || audit.claims.length === 0) {
      container.innerHTML = `<div style="font-size: 0.85rem; color: #64748b; font-style: italic; padding: 0.5rem;">All statistical statements deterministically verified against active data.</div>`;
      return;
    }
    audit.claims.forEach(c => {
      const item = document.createElement("div");
      item.className = `claim-audit-item ${c.is_verified ? '' : 'unsupported'}`;
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 2px;">
          <span style="font-weight: 600; color: #1e293b;">${escapeHtml(c.claim_text)}</span>
          <span class="${c.is_verified ? 'badge-verified' : 'badge-unsupported'}">${c.is_verified ? 'Verified Grounded' : 'Unsupported Warning'}</span>
        </div>
        <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
          ${c.is_verified ? `Ground Truth: <strong>${escapeHtml(c.source_reference || '')}</strong> (Extracted: ${c.extracted_number})` : `Warning: ${escapeHtml(c.warning || 'Claim value not found in active dataset')}`}
        </div>
      `;
      container.appendChild(item);
    });
  }
}

function renderAcademicManuscript(rep) {
  state.currentReport = rep;
  document.getElementById("rep-title").textContent = rep.title;
  document.getElementById("rep-meta").textContent = `Author: ${rep.researcher_name} | Date: ${rep.date} | Status: ${rep.validation_status}`;
  document.getElementById("rep-status-badge").textContent = rep.validation_status.replace(/_/g, " ");

  const standardView = document.getElementById("manuscript-standard-view");
  const customView = document.getElementById("manuscript-custom-outline-view");
  const customContent = document.getElementById("rep-custom-rendered-content");

  if (rep.is_custom_template && rep.rendered_content) {
    if (standardView) standardView.style.display = "none";
    if (customView) {
      customView.style.display = "block";
      customContent.innerHTML = formatManuscriptMarkdown(rep.rendered_content);
    }
  } else {
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
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const itemText = trimmed.replace(/^[-*]\s+/, "");
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
  document.getElementById("btn-save-validation")?.addEventListener("click", () => {
    if (!state.currentReport) {
      showToast("No report generated yet.", "warning");
      return;
    }
    const status = document.getElementById("select-validation-status")?.value || "VERIFIED_BY_RESEARCHER";
    const notes = document.getElementById("human-notes-input")?.value || "";
    state.currentReport.validation_status = status;
    state.currentReport.human_notes = notes;
    renderAcademicManuscript(state.currentReport);
    showToast(`Validation status updated to: ${status.replace(/_/g, " ")}`, "success");
  });

  document.getElementById("btn-export-docx")?.addEventListener("click", () => {
    if (!state.currentReport) {
      showToast("No report generated yet.", "warning");
      return;
    }
    window.ReportGenerator.exportDocx(state.currentReport);
  });

  document.getElementById("btn-export-markdown")?.addEventListener("click", () => {
    if (!state.currentReport) {
      showToast("No report generated yet.", "warning");
      return;
    }
    window.ReportGenerator.exportMarkdown(state.currentReport);
  });

  document.getElementById("btn-export-html")?.addEventListener("click", () => {
    if (!state.currentReport) {
      showToast("No report generated yet.", "warning");
      return;
    }
    window.ReportGenerator.exportHTML(state.currentReport);
  });

  document.getElementById("btn-export-pdf")?.addEventListener("click", () => {
    window.print();
  });
}

// ==========================================
// Tab 6: Report History Controller
// ==========================================
function initHistoryListeners() {
  document.getElementById("btn-clear-history")?.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear your report history?")) {
      localStorage.removeItem("resai_report_history");
      renderHistoryTable();
      showToast("Report history cleared.", "info");
    }
  });
}

function saveReportToHistory(report) {
  try {
    const raw = localStorage.getItem("resai_report_history");
    const history = raw ? JSON.parse(raw) : [];

    const entry = {
      id: report.report_id || `rep_${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      title: report.title,
      dataset: state.currentDataset || "Dataset",
      rows: state.cleanedRows ? state.cleanedRows.length : 0,
      healthScore: state.profile ? state.profile.health_score : 100,
      primaryFinding: (report.results && report.results[0] && report.results[0].title) || "Statistical Analysis",
      reportData: report
    };

    history.unshift(entry);
    localStorage.setItem("resai_report_history", JSON.stringify(history.slice(0, 50)));
    renderHistoryTable();
  } catch (e) {
    console.error("Failed to save report history to localStorage:", e);
  }
}

function renderHistoryTable() {
  const tbody = document.getElementById("history-tbody");
  const emptyMsg = document.getElementById("history-empty-message");
  const table = document.getElementById("history-table");

  if (!tbody) return;

  let history = [];
  try {
    const raw = localStorage.getItem("resai_report_history");
    if (raw) history = JSON.parse(raw);
  } catch (e) {
    history = [];
  }

  if (!history || history.length === 0) {
    if (emptyMsg) emptyMsg.style.display = "block";
    if (table) table.style.display = "none";
    return;
  }

  if (emptyMsg) emptyMsg.style.display = "none";
  if (table) table.style.display = "table";

  tbody.innerHTML = history.map((item, index) => `
    <tr>
      <td style="font-size: 0.82rem; color: #64748b; white-space: nowrap;">${escapeHtml(item.timestamp)}</td>
      <td><strong>${escapeHtml(item.title)}</strong></td>
      <td><code>${escapeHtml(item.dataset)}</code></td>
      <td>${item.rows.toLocaleString()}</td>
      <td><span class="badge badge-success">${item.healthScore}%</span></td>
      <td style="font-size: 0.85rem; color: #475569;">${escapeHtml(item.primaryFinding)}</td>
      <td style="white-space: nowrap;">
        <button class="btn btn-primary btn-sm btn-hist-view" data-index="${index}" style="padding: 2px 8px; font-size: 0.75rem;">View</button>
        <button class="btn btn-secondary btn-sm btn-hist-docx" data-index="${index}" style="padding: 2px 8px; font-size: 0.75rem;">Word</button>
        <button class="btn btn-secondary btn-sm btn-hist-md" data-index="${index}" style="padding: 2px 8px; font-size: 0.75rem;">Markdown</button>
        <button class="btn btn-secondary btn-sm btn-hist-del" data-index="${index}" style="padding: 2px 8px; font-size: 0.75rem; color: #b91c1c;">Delete</button>
      </td>
    </tr>
  `).join('');

  // Wire action buttons
  tbody.querySelectorAll(".btn-hist-view").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const item = history[idx];
      if (item && item.reportData) {
        state.currentReport = item.reportData;
        renderAcademicManuscript(item.reportData);
        if (item.reportData.claim_audit) renderClaimAudit(item.reportData.claim_audit);
        switchTab("review");
      }
    });
  });

  tbody.querySelectorAll(".btn-hist-docx").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const item = history[idx];
      if (item && item.reportData && window.ReportGenerator) {
        window.ReportGenerator.exportDocx(item.reportData);
      }
    });
  });

  tbody.querySelectorAll(".btn-hist-md").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const item = history[idx];
      if (item && item.reportData && window.ReportGenerator) {
        window.ReportGenerator.exportMarkdown(item.reportData);
      }
    });
  });

  tbody.querySelectorAll(".btn-hist-del").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      history.splice(idx, 1);
      localStorage.setItem("resai_report_history", JSON.stringify(history));
      renderHistoryTable();
      showToast("Report removed from history.", "info");
    });
  });
}

// ==========================================
// Tab 3: Hypothesis Testing & Statistical Modeling
// ==========================================
function initAnalysisListeners() {
  document.getElementById("btn-calc-two-sample")?.addEventListener("click", () => {
    if (!state.currentDataset) { showToast("Upload file first", "warning"); return; }
    const cont = document.getElementById("ts-continuous").value;
    const grp = document.getElementById("ts-group").value;
    executeTest("two_sample_test", { continuous_col: cont, group_col: grp });
  });

  document.getElementById("btn-calc-anova")?.addEventListener("click", () => {
    if (!state.currentDataset) { showToast("Upload file first", "warning"); return; }
    const cont = document.getElementById("anova-continuous").value;
    const grp = document.getElementById("anova-group").value;
    executeTest("anova_test", { continuous_col: cont, group_col: grp });
  });

  document.getElementById("btn-calc-correlation")?.addEventListener("click", () => {
    if (!state.currentDataset) { showToast("Upload file first", "warning"); return; }
    const method = document.getElementById("corr-method").value;
    const numCols = state.columns.numeric;
    if (numCols.length < 2) {
      showToast("Correlation requires at least 2 numerical columns.", "warning");
      return;
    }
    executeTest("correlation_analysis", { col1: numCols[0], col2: numCols[1], method: method });
  });

  document.getElementById("btn-calc-chi")?.addEventListener("click", () => {
    if (!state.currentDataset) { showToast("Upload file first", "warning"); return; }
    const v1 = document.getElementById("chi-var1").value;
    const v2 = document.getElementById("chi-var2").value;
    if (v1 === v2) {
      showToast("Select two distinct categorical variables for Chi-Square test.", "warning");
      return;
    }
    executeTest("chi_square_test", { var1: v1, var2: v2 });
  });

  document.getElementById("btn-calc-reg")?.addEventListener("click", () => {
    if (!state.currentDataset) { showToast("Upload file first", "warning"); return; }
    const target = document.getElementById("reg-target").value;
    const selectedCheckboxes = document.querySelectorAll("#reg-predictors-container input[type='checkbox']:checked");
    const features = Array.from(selectedCheckboxes).map(cb => cb.value);

    if (features.length === 0) {
      showToast("Select at least one predictor feature.", "warning");
      return;
    }
    executeTest("linear_regression", { target_col: target, feature_cols: features });
  });
}

function executeTest(testType, params) {
  showToast(`Computing ${testType.replace(/_/g, " ")}...`, "info");
  setTimeout(() => {
    let res;
    if (testType === "two_sample_test") res = window.StatisticalEngine.twoSampleTest(state.cleanedRows, params.continuous_col, params.group_col);
    else if (testType === "anova_test") res = window.StatisticalEngine.anovaTest(state.cleanedRows, params.continuous_col, params.group_col);
    else if (testType === "correlation_analysis") res = window.StatisticalEngine.correlationAnalysis(state.cleanedRows, params.col1, params.col2, params.method);
    else if (testType === "chi_square_test") res = window.StatisticalEngine.chiSquareTest(state.cleanedRows, params.var1, params.var2);
    else if (testType === "linear_regression") res = window.StatisticalEngine.linearRegression(state.cleanedRows, params.target_col, params.feature_cols);

    if (res && res.error) {
      showToast("Test execution error: " + res.error, "danger");
      return;
    }

    state.executedTests.push(res);
    renderTestResultCard(res);
    showToast(`${res.title} computed successfully!`, "success");
  }, 100);
}

function renderTestResultCard(res) {
  const container = document.getElementById("test-results-log");
  if (!container) return;

  const card = document.createElement("div");
  card.className = "card";
  card.style.marginBottom = "1rem";
  card.style.borderLeft = `4px solid ${res.is_significant ? '#10b981' : '#f59e0b'}`;

  let statPills = "";
  if (res.statistic !== undefined && res.p_value !== undefined) {
    statPills = `
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
        <span class="badge ${res.is_significant ? 'badge-success' : 'badge-secondary'}">
          ${res.is_significant ? 'Statistically Significant (p < .05)' : 'Not Significant (p >= .05)'}
        </span>
        <span class="badge badge-info">p = ${res.p_value}</span>
        ${res.degrees_of_freedom !== undefined ? `<span class="badge badge-info">df = ${res.degrees_of_freedom}</span>` : ''}
        ${res.effect_size ? `<span class="badge badge-info">${res.effect_size.type} = ${res.effect_size.value} (${res.effect_size.magnitude})</span>` : ''}
      </div>
    `;
  }

  card.innerHTML = `
    <div class="card-header-flex">
      <div>
        <h4 style="color: #1e3a8a; margin: 0; font-size: 1.05rem;">${escapeHtml(res.title)}</h4>
        <div style="font-size: 0.8rem; color: #64748b;">${escapeHtml(res.test_type)}</div>
      </div>
      <span class="badge badge-secondary">${new Date().toLocaleTimeString()}</span>
    </div>
    <div style="margin-top: 0.75rem; font-size: 0.92rem; line-height: 1.6; color: #1e293b;">
      ${(res.narrative || "").replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
    </div>
    ${statPills}
  `;

  container.prepend(card);
}

function populateTestSelectors() {
  const numCols = state.columns.numeric || [];
  const catCols = state.columns.categorical || [];

  const tsCont = document.getElementById("ts-continuous");
  const tsGrp = document.getElementById("ts-group");
  const anovaCont = document.getElementById("anova-continuous");
  const anovaGrp = document.getElementById("anova-group");
  const regTarget = document.getElementById("reg-target");
  const regPreds = document.getElementById("reg-predictors-container");
  const chi1 = document.getElementById("chi-var1");
  const chi2 = document.getElementById("chi-var2");

  if (tsCont) tsCont.innerHTML = numCols.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (tsGrp) tsGrp.innerHTML = catCols.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (anovaCont) anovaCont.innerHTML = numCols.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (anovaGrp) anovaGrp.innerHTML = catCols.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (regTarget) regTarget.innerHTML = numCols.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  if (regPreds) {
    regPreds.innerHTML = numCols.map(c => `
      <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; margin-bottom: 2px;">
        <input type="checkbox" value="${escapeHtml(c)}">
        <span>${escapeHtml(c)}</span>
      </label>
    `).join('');
  }

  if (chi1) chi1.innerHTML = catCols.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (chi2) chi2.innerHTML = catCols.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

function loadRecommendations() {
  const container = document.getElementById("recommendations-list");
  if (!container || !window.StatisticalEngine) return;
  const recs = window.StatisticalEngine.autoRecommendAnalysis(state.cleanedRows, state.columns, state.objective);

  if (!recs || recs.length === 0) {
    container.innerHTML = `<p class="text-muted">No specific test recommendations for active columns.</p>`;
    return;
  }

  container.innerHTML = recs.map(r => `
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
      <div>
        <div style="font-weight: 700; color: #1e40af; font-size: 0.92rem;">${escapeHtml(r.test.replace(/_/g, " ").toUpperCase())}</div>
        <div style="font-size: 0.82rem; color: #1e3a8a;">${escapeHtml(r.reason)}</div>
      </div>
      <button class="btn btn-primary btn-sm btn-run-rec" data-test="${r.test}" data-params='${JSON.stringify(r.params)}'>Run Test</button>
    </div>
  `).join('');

  container.querySelectorAll(".btn-run-rec").forEach(btn => {
    btn.addEventListener("click", () => {
      const test = btn.getAttribute("data-test");
      const params = JSON.parse(btn.getAttribute("data-params"));
      executeTest(test, params);
    });
  });
}

function loadSummaryStats() {
  const tbody = document.getElementById("summary-stats-tbody");
  if (!tbody || !window.StatisticalEngine) return;
  const s = window.StatisticalEngine.getSummaryStatistics(state.cleanedRows, state.columns);
  if (!s || !s.numerical_summary) return;

  tbody.innerHTML = "";
  Object.keys(s.numerical_summary).forEach(col => {
    const c = s.numerical_summary[col];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(col)}</strong></td>
      <td>${c.mean} ± ${c.std}</td>
      <td>[${c.ci95[0]}, ${c.ci95[1]}]</td>
      <td>${c.median} (${c.iqr})</td>
      <td>${c.min} – ${c.max}</td>
      <td>${c.skewness}</td>
      <td>${c.is_normally_distributed ? '<span class="badge badge-success">Normal (p > .05)</span>' : '<span class="badge badge-warning">Non-Normal</span>'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// Tab 4: Publication Visualizations Controller
// ==========================================
function initVisualizationListeners() {
  document.getElementById("btn-render-bar")?.addEventListener("click", () => {
    const cat = document.getElementById("vis-bar-cat").value;
    const num = document.getElementById("vis-bar-num").value;
    const sub = document.getElementById("vis-bar-sub").value;
    renderCustomPlot("bar", { cat, num, sub });
  });

  document.getElementById("btn-render-pie")?.addEventListener("click", () => {
    const cat = document.getElementById("vis-pie-cat").value;
    const style = document.getElementById("vis-pie-style").value;
    renderCustomPlot("pie", { cat, style });
  });

  document.getElementById("btn-render-box")?.addEventListener("click", () => {
    const cont = document.getElementById("vis-box-cont").value;
    const grp = document.getElementById("vis-box-grp").value;
    renderCustomPlot("box", { cont, grp });
  });

  document.getElementById("btn-render-scatter")?.addEventListener("click", () => {
    const x = document.getElementById("vis-scat-x").value;
    const y = document.getElementById("vis-scat-y").value;
    renderCustomPlot("scatter", { x, y });
  });

  document.getElementById("btn-render-dist")?.addEventListener("click", () => {
    const col = document.getElementById("vis-dist-col").value;
    const grp = document.getElementById("vis-dist-group").value;
    renderCustomPlot("dist", { col, grp });
  });

  document.getElementById("btn-render-line")?.addEventListener("click", () => {
    const x = document.getElementById("vis-line-x").value;
    const y = document.getElementById("vis-line-y").value;
    renderCustomPlot("line", { x, y });
  });
}

function populateVisualControls() {
  const numCols = state.columns.numeric || [];
  const catCols = state.columns.categorical || [];

  const populate = (id, list, addEmpty = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    let html = addEmpty ? `<option value="">(None)</option>` : "";
    html += list.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    el.innerHTML = html;
  };

  populate("vis-bar-cat", catCols);
  populate("vis-bar-num", numCols, true);
  populate("vis-bar-sub", catCols, true);

  populate("vis-pie-cat", catCols);

  populate("vis-box-cont", numCols);
  populate("vis-box-grp", catCols);

  populate("vis-scat-x", numCols);
  populate("vis-scat-y", numCols);

  populate("vis-dist-col", numCols);
  populate("vis-dist-group", catCols, true);

  populate("vis-line-x", state.columns.all);
  populate("vis-line-y", numCols);
}

function loadHeatmap() {
  const container = document.getElementById("plot-heatmap-container");
  if (!container || !window.Plotly || state.columns.numeric.length < 2) return;

  const numCols = state.columns.numeric;
  const z = [];

  for (let i = 0; i < numCols.length; i++) {
    const row = [];
    for (let j = 0; j < numCols.length; j++) {
      if (i === j) {
        row.push(1.0);
      } else {
        const res = window.StatisticalEngine.correlationAnalysis(state.cleanedRows, numCols[i], numCols[j]);
        row.push(res.r || 0);
      }
    }
    z.push(row);
  }

  const data = [{
    z: z,
    x: numCols,
    y: numCols,
    type: 'heatmap',
    colorscale: 'Blues',
    zmin: -1,
    zmax: 1
  }];

  const layout = {
    title: 'Bivariate Correlation Matrix (Pearson r)',
    margin: { t: 50, r: 20, b: 60, l: 80 },
    xaxis: { tickangle: -45 },
    yaxis: { autorange: 'reversed' }
  };

  Plotly.newPlot(container, data, layout, { responsive: true });
}

function renderCustomPlot(type, params) {
  const container = document.getElementById("plot-custom-container");
  if (!container || !window.Plotly) return;

  let data = [];
  let layout = { margin: { t: 50, r: 30, b: 50, l: 60 } };

  if (type === "bar") {
    const cat = params.cat;
    const num = params.num;
    if (!cat) return;

    if (num) {
      const means = {};
      const counts = {};
      state.cleanedRows.forEach(r => {
        const cVal = r[cat];
        const nVal = r[num];
        if (cVal !== null && typeof nVal === "number") {
          means[cVal] = (means[cVal] || 0) + nVal;
          counts[cVal] = (counts[cVal] || 0) + 1;
        }
      });
      const x = Object.keys(means);
      const y = x.map(k => Math.round((means[k] / counts[k]) * 100) / 100);
      data.push({ x, y, type: 'bar', marker: { color: '#2563eb' } });
      layout.title = `Mean ${num} across ${cat}`;
    } else {
      const counts = {};
      state.cleanedRows.forEach(r => {
        const cVal = r[cat];
        if (cVal !== null) counts[cVal] = (counts[cVal] || 0) + 1;
      });
      data.push({ x: Object.keys(counts), y: Object.values(counts), type: 'bar', marker: { color: '#3b82f6' } });
      layout.title = `Observation Frequency of ${cat}`;
    }
  } else if (type === "pie") {
    const cat = params.cat;
    if (!cat) return;
    const counts = {};
    state.cleanedRows.forEach(r => {
      const cVal = r[cat];
      if (cVal !== null) counts[cVal] = (counts[cVal] || 0) + 1;
    });
    data.push({
      labels: Object.keys(counts),
      values: Object.values(counts),
      type: 'pie',
      hole: params.style === "donut" ? 0.45 : 0
    });
    layout.title = `Proportion Analysis: ${cat}`;
  } else if (type === "box") {
    const cont = params.cont;
    const grp = params.grp;
    if (!cont || !grp) return;

    const groups = Array.from(new Set(state.cleanedRows.map(r => r[grp]).filter(Boolean)));
    groups.forEach(g => {
      const yVals = state.cleanedRows.filter(r => r[grp] === g).map(r => r[cont]).filter(v => typeof v === "number");
      data.push({ y: yVals, type: 'box', name: String(g), boxpoints: 'all', jitter: 0.3 });
    });
    layout.title = `Group Distribution: ${cont} by ${grp}`;
  } else if (type === "scatter") {
    const x = params.x;
    const y = params.y;
    if (!x || !y) return;

    const xVals = [];
    const yVals = [];
    state.cleanedRows.forEach(r => {
      if (typeof r[x] === "number" && typeof r[y] === "number") {
        xVals.push(r[x]);
        yVals.push(r[y]);
      }
    });

    data.push({ x: xVals, y: yVals, mode: 'markers', type: 'scatter', marker: { color: '#2563eb', size: 7 } });
    layout.title = `Scatter Plot & Association: ${x} vs ${y}`;
    layout.xaxis = { title: x };
    layout.yaxis = { title: y };
  } else if (type === "dist") {
    const col = params.col;
    if (!col) return;
    const vals = state.cleanedRows.map(r => r[col]).filter(v => typeof v === "number");
    data.push({ x: vals, type: 'histogram', marker: { color: '#60a5fa' } });
    layout.title = `Frequency Distribution: ${col}`;
  } else if (type === "line") {
    const x = params.x;
    const y = params.y;
    if (!x || !y) return;
    const xVals = state.cleanedRows.map(r => r[x]);
    const yVals = state.cleanedRows.map(r => r[y]);
    data.push({ x: xVals, y: yVals, mode: 'lines+markers', type: 'scatter', line: { color: '#2563eb' } });
    layout.title = `Experimental Trajectory: ${y} over ${x}`;
  }

  Plotly.newPlot(container, data, layout, { responsive: true });
}

function escapeHtml(text) {
  if (typeof text !== "string") return text;
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}