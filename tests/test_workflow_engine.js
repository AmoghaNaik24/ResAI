/**
 * ResAI - Deterministic Workflow Engine Comprehensive Verification Test Suite
 * 
 * Exercises all 10 stages with strict assertions:
 * 1. Valid dataset & Built-in template workflow
 * 2. True Word XML direct editing with multiple placeholders per paragraph and in table cells
 * 3. Missing grouping variable blocks hypothesis tests & blocks validation status
 * 4. Missing values handling and independently verified statistical values (Mean, Bessel N-1 SD, Welch t-test, Cohen's d)
 * 5. Protected citations (e.g., "(Smith & Jones, 2021)") and years
 * 6. Corrupted/unsupported DOCX template handling
 * 7. Re-opening and validating exported DOCX zip container
 */

const fs = require('fs');
const path = require('path');

// 1. Setup mock environment for Node.js
const mockWindow = {
  location: { href: "http://localhost" }
};
global.window = mockWindow;

// Load JSZip
const jszipCode = fs.readFileSync(path.join(__dirname, '../static/js/vendor/jszip.min.js'), 'utf8');
const jszipModule = { exports: {} };
new Function('module', 'exports', 'window', jszipCode)(jszipModule, jszipModule.exports, mockWindow);
const JSZip = jszipModule.exports;
global.JSZip = JSZip;
mockWindow.JSZip = JSZip;

// Load ResAI Workflow Engine
const engineCode = fs.readFileSync(path.join(__dirname, '../static/js/resai-workflow-engine.js'), 'utf8');
const runEngine = new Function('window', engineCode);
runEngine(mockWindow);

const { WorkflowEngine } = require('../static/js/resai-workflow-engine.js');

console.log("===================================================================");
console.log("   ResAI Scientific Workflow Engine - Comprehensive Test Suite    ");
console.log("===================================================================\n");

async function runTestSuite() {
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(`FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      passed++;
      console.log(`  ✓ PASS: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Test 1: Valid Dataset & Built-in Template Workflow
  // -------------------------------------------------------------------------
  console.log("[Test 1] Valid Dataset & Built-in Template Workflow");
  const engine1 = new WorkflowEngine();

  const dataset1 = [
    { PatientID: "PT01", Cohort: "Drug", RecoveryDays: 12.5, BaselineScore: 45 },
    { PatientID: "PT02", Cohort: "Placebo", RecoveryDays: 22.0, BaselineScore: 48 },
    { PatientID: "PT03", Cohort: "Drug", RecoveryDays: 14.2, BaselineScore: 42 },
    { PatientID: "PT04", Cohort: "Placebo", RecoveryDays: 26.8, BaselineScore: 50 },
    { PatientID: "PT05", Cohort: "Drug", RecoveryDays: 11.0, BaselineScore: 46 },
    { PatientID: "PT06", Cohort: "Placebo", RecoveryDays: 24.5, BaselineScore: 52 },
    { PatientID: "PT07", Cohort: "Drug", RecoveryDays: 13.8, BaselineScore: 44 },
    { PatientID: "PT08", Cohort: "Placebo", RecoveryDays: 28.1, BaselineScore: 51 }
  ];

  const profile1 = engine1.profileDataset(dataset1, "Phase2_Trial.csv");
  assert(profile1.row_count === 8, "Profile row count must be 8");
  assert(profile1.column_count === 4, "Profile column count must be 4");
  assert(profile1.data_quality.health_score === 100, "Clean dataset must have 100% health score");

  const tpl1 = await engine1.extractTemplate(null);
  assert(tpl1.is_builtin === true, "Must load built-in APA-7 template");

  const map1 = engine1.createFieldMapping(tpl1, profile1);
  assert(map1.mappings.length >= 10, "Field mappings must be generated for all placeholders");

  // Map mean_score and standard_deviation specifically to RecoveryDays
  engine1.updateMappingChoice("mean_score", "RecoveryDays", "arithmetic_mean");
  engine1.updateMappingChoice("standard_deviation", "RecoveryDays", "sample_standard_deviation");
  engine1.confirmAllMappings();

  const plan1 = engine1.createAnalysisPlan();
  assert(plan1.blocked_operations.length === 0, "No operations should be blocked for valid dataset");

  const results1 = engine1.executeAnalysis(dataset1);
  const rMap1 = results1.results_map;

  // Independent ground truth calculation for RecoveryDays across all 8 rows:
  // Values: [12.5, 22.0, 14.2, 26.8, 11.0, 24.5, 13.8, 28.1]
  // Sum = 152.9
  // Mean = 152.9 / 8 = 19.1125 -> 19.11
  assert(rMap1["mean_score"].value === 19.11, `Expected Mean = 19.11, got ${rMap1["mean_score"].value}`);

  // Sample SD with Bessel's correction (N-1 = 7):
  // Variance = 48.447
  // SD = sqrt(48.447) = 6.96
  assert(rMap1["standard_deviation"].value === 6.96, `Expected Sample SD = 6.96, got ${rMap1["standard_deviation"].value}`);

  // Welch's t-test for Drug vs Placebo on RecoveryDays:
  // Drug (n=4): [12.5, 14.2, 11.0, 13.8] -> M1 = 12.875, v1 = 2.089167
  // Placebo (n=4): [22.0, 26.8, 24.5, 28.1] -> M2 = 25.35, v2 = 7.203333
  // SE = sqrt(2.089167/4 + 7.203333/4) = sqrt(2.323125) = 1.52418
  // t = (12.875 - 25.35) / 1.52418 = -8.1847 -> -8.18
  // Welch df: (2.323125)^2 / [ (0.52229)^2/3 + (1.80083)^2/3 ] = 5.3969 / [0.09093 + 1.0810] = 5.3969 / 1.1719 = 4.605 -> 4.6
  // Exact p-value < .001 (approx 0.0003)
  assert(Math.abs(rMap1["test_statistic"].value - (-8.18)) <= 0.05, `t-statistic must be approximately -8.18, got ${rMap1["test_statistic"].value}`);
  assert(rMap1["p_value"].formatted_value === "< .001", `p-value must be < .001, got ${rMap1["p_value"].formatted_value}`);
  assert(rMap1["p_value"].value < 0.001, "Exact p-value must be mathematically < 0.001");
  assert(rMap1["effect_size"].formatted_value.includes("Cohen's d"), "Effect size must compute Cohen's d");

  const rep1 = await engine1.generateReport();
  assert(rep1.markdown.includes("19.11"), "Report markdown must contain verified mean 19.11");
  assert(rep1.markdown.includes("6.96"), "Report markdown must contain verified SD 6.96");
  assert(rep1.docx_buffer !== null, "DOCX buffer must be generated");

  const val1 = engine1.validateReport();
  assert(val1.status === "passed", "Validation status must be passed");
  assert(val1.overall_grounding_score >= 80, `Grounding score must be high, got ${val1.overall_grounding_score}%`);
  console.log("Test 1 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 2: Real DOCX Template with Multiple Placeholders per Paragraph & Table Cells
  // -------------------------------------------------------------------------
  console.log("[Test 2] Real DOCX Word XML Direct Editing (Split Runs, Multiple Placeholders & Tables)");
  const engine2 = new WorkflowEngine();

  // Create a genuine DOCX zip package with split runs and multiple placeholders
  const templateZip = new global.JSZip();
  const testDocXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
    '  <w:body>\n' +
    '    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Clinical Trial Outcomes</w:t></w:r></w:p>\n' +
    '    <!-- Split runs across multiple <w:r> tags -->\n' +
    '    <w:p><w:r><w:t>Study evaluated total sample N = {{</w:t></w:r><w:r><w:t>sample_</w:t></w:r><w:r><w:t>size}} observations.</w:t></w:r></w:p>\n' +
    '    <!-- Multiple placeholders in a single paragraph -->\n' +
    '    <w:p><w:r><w:t>Primary continuous measure yielded Mean = {{mean_score}} and SD = {{standard_deviation}}.</w:t></w:r></w:p>\n' +
    '    <!-- Table cell with placeholder -->\n' +
    '    <w:tbl>\n' +
    '      <w:tr>\n' +
    '        <w:tc><w:p><w:r><w:t>Significance Alpha</w:t></w:r></w:p></w:tc>\n' +
    '        <w:tc><w:p><w:r><w:t>{{p_value}}</w:t></w:r></w:p></w:tc>\n' +
    '      </w:tr>\n' +
    '    </w:tbl>\n' +
    '  </w:body>\n' +
    '</w:document>';

  templateZip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  templateZip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  templateZip.file('word/document.xml', testDocXml);

  const templateBuffer = await templateZip.generateAsync({ type: "nodebuffer" });

  const tpl2 = await engine2.extractTemplate(templateBuffer, true, "Custom_Trial_Template.docx");
  assert(tpl2.format === "docx", "Template format must be docx");
  assert(tpl2.placeholders_found.includes("sample_size"), "Must extract sample_size placeholder across split runs");
  assert(tpl2.placeholders_found.includes("mean_score"), "Must extract mean_score placeholder");
  assert(tpl2.placeholders_found.includes("standard_deviation"), "Must extract standard_deviation placeholder");
  assert(tpl2.placeholders_found.includes("p_value"), "Must extract p_value from table cell");

  engine2.profileDataset(dataset1, "Phase2_Trial.csv");
  engine2.createFieldMapping(tpl2, engine2.profileJSON);
  engine2.updateMappingChoice("mean_score", "RecoveryDays", "arithmetic_mean");
  engine2.updateMappingChoice("standard_deviation", "RecoveryDays", "sample_standard_deviation");
  engine2.confirmAllMappings();
  engine2.createAnalysisPlan();
  engine2.executeAnalysis(dataset1);

  const rep2 = await engine2.generateReport();
  assert(rep2.docx_buffer !== null, "DOCX buffer must be generated from direct OpenXML template editing");

  // Re-open exported DOCX with JSZip and inspect word/document.xml directly
  const reloadedZip = await global.JSZip.loadAsync(rep2.docx_buffer);
  const reloadedDocXml = await reloadedZip.file("word/document.xml").async("string");

  assert(reloadedDocXml.includes("total sample N = 8 observations"), "Split run placeholder {{sample_size}} must be replaced with 8");
  assert(reloadedDocXml.includes("Mean = 19.11 and SD = 6.96"), "Multiple placeholders in one paragraph must both be replaced cleanly");
  assert(reloadedDocXml.includes("< .001"), "Table cell placeholder {{p_value}} must be replaced with < .001");
  assert(!reloadedDocXml.includes("{{sample_size}}"), "No raw {{sample_size}} placeholders should remain in document XML");
  assert(!reloadedDocXml.includes("{{mean_score}}"), "No raw {{mean_score}} placeholders should remain in document XML");
  console.log("Test 2 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 3: Missing Grouping Variable Blocks Hypothesis Test & Validation
  // -------------------------------------------------------------------------
  console.log("[Test 3] Missing Grouping Variable Blocks Hypothesis Test & Blocks Validation");
  const engine3 = new WorkflowEngine();

  // Dataset with ONLY continuous numeric variables (no categorical grouping factor)
  const singleCohortData = [
    { MeasurementID: 1, ReadingA: 10.5, ReadingB: 15.2 },
    { MeasurementID: 2, ReadingA: 12.0, ReadingB: 18.0 },
    { MeasurementID: 3, ReadingA: 11.5, ReadingB: 16.5 },
    { MeasurementID: 4, ReadingA: 13.0, ReadingB: 19.1 }
  ];

  const profile3 = engine3.profileDataset(singleCohortData, "Single_Cohort.csv");
  const tpl3 = await engine3.extractTemplate(null);
  const map3 = engine3.createFieldMapping(tpl3, profile3);

  // Mappings for p_value and test_statistic should be unresolved
  const pMap = map3.mappings.find(m => m.target_field === "p_value");
  assert(pMap.status === "unresolved", "p_value mapping must be marked unresolved when grouping factor is absent");

  const plan3 = engine3.createAnalysisPlan();
  assert(plan3.blocked_operations.length > 0, "Analysis plan must flag blocked operations");

  const results3 = engine3.executeAnalysis(singleCohortData);
  const rMap3 = results3.results_map;

  assert(rMap3["p_value"].status === "blocked", "p_value status must be 'blocked'");
  assert(rMap3["p_value"].value === null, "p_value value must be null (NEVER a fabricated number)");
  assert(rMap3["p_value"].formatted_value.includes("Blocked"), "p_value formatted value must state Blocked");
  assert(rMap3["test_statistic"].status === "blocked", "test_statistic status must be 'blocked'");

  await engine3.generateReport();
  const val3 = engine3.validateReport();

  assert(val3.status === "blocked", "Validation status MUST be blocked when critical tests cannot be justified");
  assert(val3.blocking_issues.length > 0, "Validation report must list blocking issues");
  console.log("Test 3 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 4: Missing Values & Independently Verified Statistical Calculations
  // -------------------------------------------------------------------------
  console.log("[Test 4] Missing-Value Handling & Independent Ground-Truth Verification");
  const engine4 = new WorkflowEngine();

  // Dataset with deliberate missing values, strings, nulls, and NaNs:
  // Non-null scores: 10, 20, 30, 40 (N = 4)
  const missingData = [
    { Subject: "S1", Score: 10 },
    { Subject: "S2", Score: null },
    { Subject: "S3", Score: 20 },
    { Subject: "S4", Score: "" },
    { Subject: "S5", Score: 30 },
    { Subject: "S6", Score: NaN },
    { Subject: "S7", Score: 40 }
  ];

  const profile4 = engine4.profileDataset(missingData, "Missing_Demo.csv");
  assert(profile4.data_quality.total_missing_cells === 3, "Profile must count exactly 3 missing cells");

  const tpl4 = await engine4.extractTemplate(null);
  engine4.createFieldMapping(tpl4, profile4);
  engine4.updateMappingChoice("mean_score", "Score", "arithmetic_mean");
  engine4.updateMappingChoice("standard_deviation", "Score", "sample_standard_deviation");
  engine4.confirmAllMappings();
  engine4.createAnalysisPlan();

  const results4 = engine4.executeAnalysis(missingData);
  const rMap4 = results4.results_map;

  // Expected calculations on valid values [10, 20, 30, 40]:
  // Mean = (10+20+30+40)/4 = 25.0
  // Variance (N-1=3) = ((10-25)^2 + (20-25)^2 + (30-25)^2 + (40-25)^2) / 3 = (225 + 25 + 25 + 225) / 3 = 500 / 3 = 166.6667
  // Sample SD = sqrt(166.6667) = 12.9099 -> 12.91
  assert(rMap4["mean_score"].value === 25.0, `Expected Mean = 25.0, got ${rMap4["mean_score"].value}`);
  assert(rMap4["mean_score"].valid_sample_size === 4, "Mean valid sample size must be 4");
  assert(rMap4["standard_deviation"].value === 12.91, `Expected Sample SD = 12.91, got ${rMap4["standard_deviation"].value}`);
  assert(rMap4["standard_deviation"].valid_sample_size === 4, "SD valid sample size must be 4");
  console.log("Test 4 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 5: Protected Citations, Years, and Outline Numbers
  // -------------------------------------------------------------------------
  console.log("[Test 5] Protected Content Audit (Citations, Years, and Outline Numbers)");
  const engine5 = new WorkflowEngine();

  const citationMarkdown = "# Academic Study Outline\n\n" +
    "## 1. Introduction\n\n" +
    "Prior empirical literature (Smith & Jones, 2021) and Johnson (2024) established baseline methodologies across N = {{sample_size}} participants in {{dataset_name}}.\n\n" +
    "## 2. Statistical Results\n\n" +
    "Observed continuous mean was {{mean_score}} (SD = {{standard_deviation}}).";

  const tpl5 = await engine5.extractTemplate(citationMarkdown, false, "Outline.md");
  engine5.profileDataset(dataset1, "Trial.csv");
  engine5.createFieldMapping(tpl5, engine5.profileJSON);
  engine5.updateMappingChoice("mean_score", "RecoveryDays", "arithmetic_mean");
  engine5.updateMappingChoice("standard_deviation", "RecoveryDays", "sample_standard_deviation");
  engine5.confirmAllMappings();
  engine5.createAnalysisPlan();
  engine5.executeAnalysis(dataset1);

  const rep5 = await engine5.generateReport();
  assert(rep5.markdown.includes("Smith & Jones, 2021"), "Citation (Smith & Jones, 2021) must be preserved intact");
  assert(rep5.markdown.includes("Johnson (2024)"), "Citation Johnson (2024) must be preserved intact");

  const val5 = engine5.validateReport();
  assert(val5.overall_grounding_score >= 80, `Years 2021 and 2024 must not penalize grounding score, got ${val5.overall_grounding_score}%`);
  console.log("Test 5 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 6: Corrupted or Unsupported DOCX Template Handling
  // -------------------------------------------------------------------------
  console.log("[Test 6] Corrupted DOCX Handling (Safe Warning & Non-Destructive Fallback)");
  const engine6 = new WorkflowEngine();

  // Corrupted non-zip binary buffer
  const corruptedBuffer = Buffer.from([0x00, 0xFF, 0xFE, 0x12, 0x34, 0x56, 0x78]);

  const tpl6 = await engine6.extractTemplate(corruptedBuffer, true, "Corrupted_File.docx");
  assert(tpl6 !== null, "Engine must not crash on corrupted template");
  assert(tpl6.warnings.length > 0, "Engine must record a clear warning for corrupted template");
  assert(tpl6.warnings[0].includes("could not be parsed safely"), "Warning must explain safe fallback");
  console.log("Test 6 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 7: Exported DOCX Re-opening & OpenXML Validation
  // -------------------------------------------------------------------------
  console.log("[Test 7] Exported DOCX Re-opening and OpenXML Structure Verification");
  const engine7 = new WorkflowEngine();
  engine7.profileDataset(dataset1, "Trial.csv");
  await engine7.extractTemplate(null);
  engine7.createFieldMapping(engine7.templateJSON, engine7.profileJSON);
  engine7.confirmAllMappings();
  engine7.createAnalysisPlan();
  engine7.executeAnalysis(dataset1);
  const rep7 = await engine7.generateReport();

  assert(rep7.docx_buffer !== null, "DOCX buffer must be returned in Node environment");
  const loadedPkg = await global.JSZip.loadAsync(rep7.docx_buffer);

  assert(loadedPkg.file("[Content_Types].xml") !== null, "[Content_Types].xml must exist");
  assert(loadedPkg.file("_rels/.rels") !== null, "_rels/.rels must exist");
  assert(loadedPkg.file("word/document.xml") !== null, "word/document.xml must exist");
  assert(loadedPkg.file("word/styles.xml") !== null, "word/styles.xml must exist");

  const docXml = await loadedPkg.file("word/document.xml").async("string");
  assert(docXml.startsWith("<?xml"), "document.xml must be valid XML declaration");
  assert(docXml.includes("<w:document"), "Must contain <w:document> root element");
  assert(docXml.includes("<w:tbl>"), "Must contain formatted academic summary table <w:tbl>");
  assert(docXml.includes("Table 1: Verified Quantitative Findings"), "Table title must exist");
  console.log("Test 7 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 8: Intelligent Template Interpretation & Adaptive Report Generation
  // -------------------------------------------------------------------------
  console.log("[Test 8] Intelligent Template Interpretation & Adaptive Report Generation Acceptance Test");
  const engine8 = new WorkflowEngine();

  // Create an authentic DOCX template containing instructions, blanks, branding, formatting advice
  const tpl8Zip = new global.JSZip();
  const rawAcademicXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
    '  <w:body>\n' +
    '    <w:p><w:r><w:t>Generated by GenText Group — gentext.ai</w:t></w:r></w:p>\n' +
    '    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Research Paper Title</w:t></w:r></w:p>\n' +
    '    <w:p><w:r><w:t>[Insert Author Name] [Insert University Name] [Insert Course Name]</w:t></w:r></w:p>\n' +
    '    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Abstract</w:t></w:r></w:p>\n' +
    '    <w:p><w:r><w:t>Write a concise abstract of approximately 150 to 250 words.</w:t></w:r></w:p>\n' +
    '    <w:p><w:r><w:t>The purpose of this study was to examine ________ in a sample of ________.</w:t></w:r></w:p>\n' +
    '    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>1. Introduction</w:t></w:r></w:p>\n' +
    '    <w:p><w:r><w:t>Begin the introduction by establishing the research problem.</w:t></w:r></w:p>\n' +
    '    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>2. Literature Review</w:t></w:r></w:p>\n' +
    '    <w:p><w:r><w:t>Summarize the most relevant scholarly sources.</w:t></w:r></w:p>\n' +
    '    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>3. Methodology</w:t></w:r></w:p>\n' +
    '    <w:p><w:r><w:t>Describe the experimental design and data collection procedures.</w:t></w:r></w:p>\n' +
    '    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>4. Results</w:t></w:r></w:p>\n' +
    '    <w:p><w:r><w:t>Descriptive summaries revealed a mean of {{mean_score}} (SD = {{standard_deviation}}).</w:t></w:r></w:p>\n' +
    '    <w:tbl>\n' +
    '      <w:tr>\n' +
    '        <w:tc><w:p><w:r><w:t>Recovery Mean</w:t></w:r></w:p></w:tc>\n' +
    '        <w:tc><w:p><w:r><w:t>{{mean_score}}</w:t></w:r></w:p></w:tc>\n' +
    '      </w:tr>\n' +
    '    </w:tbl>\n' +
    '    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>5. Discussion</w:t></w:r></w:p>\n' +
    '    <w:p><w:r><w:t>Discuss the scientific implications of your findings.</w:t></w:r></w:p>\n' +
    '    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>6. Conclusion</w:t></w:r></w:p>\n' +
    '    <w:p><w:r><w:t>State the primary conclusions.</w:t></w:r></w:p>\n' +
    '    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>7. References</w:t></w:r></w:p>\n' +
    '    <w:p><w:r><w:t>Cite at least 3-5 peer-reviewed sources in APA 7th format.</w:t></w:r></w:p>\n' +
    '    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Formatting Guidelines</w:t></w:r></w:p>\n' +
    '    <w:p><w:r><w:t>Use double-spaced lines with 1-inch margins and Times New Roman font.</w:t></w:r></w:p>\n' +
    '  </w:body>\n' +
    '</w:document>';

  tpl8Zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  tpl8Zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
  tpl8Zip.file("word/document.xml", rawAcademicXml);
  const tpl8Buffer = await tpl8Zip.generateAsync({ type: "nodebuffer" });

  // Execute 11-step adaptive pipeline
  const prof8 = engine8.profileDataset(dataset1, "Phase2_Trial.csv");
  const tpl8 = await engine8.extractTemplate(tpl8Buffer, true, "Academic_Report_Template.docx");

  const decisions8 = engine8.interpretTemplate(tpl8, prof8, {
    document_title: "Empirical Clinical Trial Manuscript",
    research_objective: "evaluate patient recovery days across experimental cohorts",
    researcher_name: "Lead Lab Investigator"
  });

  // Verify Decision JSON structure and classifications
  assert(decisions8.template_id !== null, "Decisions JSON must have template_id");
  assert(decisions8.sections.length >= 7, "Decisions JSON must classify all sections");
  
  const fmtDec = decisions8.sections.find(s => s.original_heading.includes("Formatting Guidelines"));
  assert(fmtDec && fmtDec.decision === "omit", "Formatting Guidelines section must be omitted");
  
  const absDec = decisions8.sections.find(s => s.original_heading.includes("Abstract"));
  assert(absDec && absDec.decision === "adapt", "Abstract must be marked for adaptation");

  const resDec = decisions8.sections.find(s => s.original_heading.includes("Results"));
  assert(resDec && resDec.decision === "generate", "Results must be marked for generation");

  const refDec = decisions8.sections.find(s => s.original_heading.includes("References"));
  assert(refDec && (refDec.decision === "ask_user" || refDec.decision === "populate"), "References must be handled appropriately");

  engine8.createFieldMapping(tpl8, prof8);
  engine8.updateMappingChoice("mean_score", "RecoveryDays", "arithmetic_mean");
  engine8.updateMappingChoice("standard_deviation", "RecoveryDays", "sample_standard_deviation");
  engine8.confirmAllMappings();
  engine8.createAnalysisPlan();
  engine8.executeAnalysis(dataset1);

  const rep8 = await engine8.generateReport();
  assert(rep8.docx_buffer !== null, "DOCX buffer must be generated");

  // Re-open exported DOCX with JSZip and inspect word/document.xml directly
  const reloadedPkg8 = await global.JSZip.loadAsync(rep8.docx_buffer);
  const reloadedXml8 = await reloadedPkg8.file("word/document.xml").async("string");

  // Verification 1: Formatting guidelines omitted
  assert(!reloadedXml8.includes("Formatting Guidelines"), "Must omit Formatting Guidelines heading from Word XML");
  assert(!reloadedXml8.includes("Use double-spaced lines with 1-inch margins"), "Must omit formatting instructions prose");
  assert(!rep8.markdown.includes("Formatting Guidelines"), "Must omit Formatting Guidelines from Markdown");

  // Verification 2: Branding removed
  assert(!reloadedXml8.includes("gentext.ai"), "Must omit gentext.ai branding from Word XML");
  assert(!rep8.markdown.includes("gentext.ai"), "Must omit gentext.ai branding from Markdown");

  // Verification 3: Instructional writing prompts removed
  assert(!reloadedXml8.includes("Write a concise abstract"), "Must omit abstract writing instructions");
  assert(!reloadedXml8.includes("Begin the introduction by establishing"), "Must omit introduction instructions");
  assert(!reloadedXml8.includes("The purpose of this study was to examine ________"), "Must omit example sentence");

  // Verification 4: Zero placeholder blanks (___) remaining
  assert(!reloadedXml8.includes("________"), "Zero blank underscores in Word XML");
  assert(!rep8.markdown.includes("________"), "Zero blank underscores in Markdown");

  // Verification 5: Valid required headings preserved
  assert(reloadedXml8.includes("Abstract"), "Abstract heading must be preserved");
  assert(reloadedXml8.includes("1. Introduction"), "Introduction heading must be preserved");
  assert(reloadedXml8.includes("3. Methodology"), "Methodology heading must be preserved");
  assert(reloadedXml8.includes("4. Results"), "Results heading must be preserved");
  assert(reloadedXml8.includes("5. Discussion"), "Discussion heading must be preserved");
  assert(reloadedXml8.includes("6. Conclusion"), "Conclusion heading must be preserved");
  assert(reloadedXml8.includes("7. References"), "References heading must be preserved");

  // Verification 6: Real results generated from actual dataset
  assert(reloadedXml8.includes("19.11"), "Verified mean 19.11 must be present in Word XML");
  assert(reloadedXml8.includes("6.96"), "Verified SD 6.96 must be present in Word XML");
  assert(rep8.markdown.includes("19.11"), "Verified mean 19.11 must be present in Markdown");
  assert(rep8.markdown.includes("6.96"), "Verified SD 6.96 must be present in Markdown");

  // Verification 7: Decision-aware validation
  const val8 = engine8.validateReport();
  assert(val8.template_compliance.instructional_prose_removed === true, "Validation must confirm instructional prose removed");
  assert(val8.template_compliance.blank_placeholders_removed === true, "Validation must confirm blank placeholders removed");
  assert(val8.template_compliance.branding_removed === true, "Validation must confirm branding removed");
  assert(val8.overall_grounding_score >= 80, `Grounding score must be high, got ${val8.overall_grounding_score}%`);
  console.log("Test 8 completed successfully.\n");

  console.log("===================================================================");
  console.log(`ALL ${total} VERIFICATION ASSERTIONS PASSED (${passed}/${total})`);
  console.log("===================================================================");
}

runTestSuite().catch(err => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
