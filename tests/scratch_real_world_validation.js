/**
 * ResAI - Real-World Validation of Actual Dataset & Custom DOCX Template
 * 
 * Verifies with real files:
 * Dataset: data/uploads/Student_placementCSE.xlsx
 * Template: data/reports/tpl_1792321817_data-analysis-report-template.docx
 */

const fs = require('fs');
const path = require('path');

// 1. Mock window and browser globals
const mockWindow = {
  location: { href: "http://localhost" }
};
global.window = mockWindow;

// 2. Load JSZip
const jszipCode = fs.readFileSync(path.join(__dirname, '../static/js/vendor/jszip.min.js'), 'utf8');
const jszipModule = { exports: {} };
new Function('module', 'exports', 'window', jszipCode)(jszipModule, jszipModule.exports, mockWindow);
const JSZip = jszipModule.exports;
global.JSZip = JSZip;
mockWindow.JSZip = JSZip;

// 3. Load SheetJS (xlsx.full.min.js)
const xlsxCode = fs.readFileSync(path.join(__dirname, '../static/js/vendor/xlsx.full.min.js'), 'utf8');
const xlsxModule = { exports: {} };
new Function('module', 'exports', 'window', xlsxCode)(xlsxModule, xlsxModule.exports, mockWindow);
const XLSX = xlsxModule.exports || mockWindow.XLSX;
global.XLSX = XLSX;
mockWindow.XLSX = XLSX;

// 4. Load Workflow Engine & Local LLM
const engineCode = fs.readFileSync(path.join(__dirname, '../static/js/resai-workflow-engine.js'), 'utf8');
new Function('window', engineCode)(mockWindow);
const { WorkflowEngine } = require('../static/js/resai-workflow-engine.js');
const { ResAILocalLLM, LocalLLMAdapter } = require('../static/js/resai-local-llm.js');
mockWindow.ResAILocalLLM = ResAILocalLLM;

console.log("===================================================================");
console.log("   ResAI Real-World Validation: Real Dataset & Custom DOCX        ");
console.log("===================================================================\n");

async function runRealWorldValidation() {
  const datasetPath = path.join(__dirname, '../data/uploads/Student_placementCSE.xlsx');
  const templatePath = path.join(__dirname, '../data/reports/tpl_1792321817_data-analysis-report-template.docx');

  console.log(`[Step 1] Loading real dataset: ${path.basename(datasetPath)}`);
  const datasetBuf = fs.readFileSync(datasetPath);
  const workbook = XLSX.read(datasetBuf, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
  console.log(`  -> Parsed ${rows.length} records across ${Object.keys(rows[0] || {}).length} columns from sheet '${sheetName}'.`);
  console.log("  Sample row:", rows[0]);
  console.log("  Sample package values:", rows.slice(0, 10).map(r => r["package_in_lakhs"] || r["Package"] || Object.values(r)[3]));

  console.log(`\n[Step 2] Loading custom DOCX template: ${path.basename(templatePath)}`);
  const templateBuf = fs.readFileSync(templatePath);

  // Initialize engine
  const engine = new WorkflowEngine();

  // Profile dataset
  console.log("\n[Step 3] Computing deterministic dataset profile...");
  const profile = engine.profileDataset(rows, "Student_placementCSE.xlsx");
  console.log(`  -> Health Score: ${profile.data_quality.health_score}%`);
  console.log(`  -> Columns Inferred: ${profile.columns.map(c => `${c.name} (${c.inferred_type})`).join(", ")}`);

  // Extract template
  console.log("\n[Step 4] Extracting custom DOCX template structure...");
  const tpl = await engine.extractTemplate(templateBuf, true, "data-analysis-report-template.docx");
  console.log(`  -> Extracted ${tpl.sections.length} sections from template.`);

  // Template Intelligence & Decision Plan
  console.log("\n[Step 5] Interpreting template and executing section decisions...");
  const userContext = {
    document_title: "Empirical Analysis of Student Placement Factors",
    researcher_name: "Department of Computer Science & Engineering",
    research_objective: "Evaluate student performance measures and identify key factors influencing placement success",
    literature_sources: [
      "Field, A. (2018). Discovering statistics using IBM SPSS Statistics (5th ed.). SAGE Publications."
    ]
  };

  const decisions = engine.interpretTemplate(tpl, profile, userContext);
  console.log(`  -> Classifications:`);
  decisions.sections.forEach(s => {
    console.log(`     * ${s.original_heading.padEnd(25)} -> Decision: [${s.decision.toUpperCase().padEnd(8)}] (${s.reason})`);
  });

  // Variable Mapping & Execution
  console.log("\n[Step 6] Mapping variables and computing deterministic calculations...");
  engine.createFieldMapping(tpl, profile);
  engine.confirmAllMappings();
  engine.createAnalysisPlan();
  const results = engine.executeAnalysis(rows);
  console.log(`  -> Primary continuous outcome: ${results.results_map.mean_score?.input_columns?.[0] || 'Computed'}`);
  console.log(`  -> Mean Score = ${results.results_map.mean_score?.value}`);
  console.log(`  -> Standard Deviation = ${results.results_map.standard_deviation?.value}`);

  // Report Generation & Direct OpenXML DOCX Assembly
  console.log("\n[Step 7] Generating manuscript and assembling final OpenXML DOCX...");
  const report = await engine.generateReport();
  const outDocxPath = path.join(__dirname, '../data/reports/real_world_validated_report.docx');
  fs.writeFileSync(outDocxPath, report.docx_buffer);
  console.log(`  -> Saved generated DOCX to: ${outDocxPath}`);

  // Deep Structural Audit of Output DOCX Word XML
  console.log("\n[Step 8] Auditing exported Word XML (word/document.xml)...");
  const zipPkg = await JSZip.loadAsync(report.docx_buffer);
  const docXml = await zipPkg.file("word/document.xml").async("string");

  let passes = 0;
  let fails = 0;
  function check(condition, desc) {
    if (condition) {
      passes++;
      console.log(`  ✓ PASS: ${desc}`);
    } else {
      fails++;
      console.error(`  ✗ FAIL: ${desc}`);
    }
  }

  // 1. Instructions removed
  check(!docXml.includes("Write a concise abstract of approximately 150 to 250 words"), "Abstract writing instructions removed from Word XML");
  check(!report.markdown.includes("Write a concise abstract of approximately 150 to 250 words"), "Abstract writing instructions removed from Markdown");
  check(!docXml.includes("Begin the introduction by establishing the research problem"), "Introduction writing instructions removed from Word XML");
  check(!docXml.includes("Replace every blank line marked with"), "Formatting notes instructions removed from Word XML");

  // 2. Placeholder blanks removed
  check(!docXml.includes("____________________"), "Blank underscores (____) completely removed from Word XML");
  check(!report.markdown.includes("____________________"), "Blank underscores (____) completely removed from Markdown");

  // 3. Generator branding removed
  check(!docXml.includes("gentext.ai"), "Generator branding 'gentext.ai' removed from Word XML");
  check(!report.markdown.includes("gentext.ai"), "Generator branding 'gentext.ai' removed from Markdown");

  // 4. Headings preserved
  check(docXml.includes("Abstract"), "Abstract heading preserved");
  check(docXml.includes("Introduction"), "Introduction heading preserved");
  check(docXml.includes("Methods"), "Methods heading preserved");
  check(docXml.includes("Results"), "Results heading preserved");
  check(docXml.includes("Discussion"), "Discussion heading preserved");
  check(docXml.includes("Conclusion"), "Conclusion heading preserved");

  // 5. Real dataset numbers present
  const meanVal = String(results.results_map.mean_score.value);
  check(docXml.includes(meanVal), `Verified dataset mean (${meanVal}) present in Word XML`);
  check(report.markdown.includes(meanVal), `Verified dataset mean (${meanVal}) present in Markdown`);

  // 6. Validation compliance
  const validation = engine.validateReport();
  check(validation.template_compliance.instructional_prose_removed === true, "Validation confirms instructional prose removed");
  check(validation.template_compliance.blank_placeholders_removed === true, "Validation confirms blank placeholders removed");
  check(validation.template_compliance.branding_removed === true, "Validation confirms branding removed");
  check(validation.overall_grounding_score >= 80, `Grounding score high (${validation.overall_grounding_score}%)`);

  console.log("\n===================================================================");
  console.log(`REAL-WORLD VALIDATION SUMMARY: ${passes} PASSED, ${fails} FAILED`);
  console.log("===================================================================");

  if (fails > 0) process.exit(1);
}

runRealWorldValidation().catch(err => {
  console.error("Validation error:", err);
  process.exit(1);
});
