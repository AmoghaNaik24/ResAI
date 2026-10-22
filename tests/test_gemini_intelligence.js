/**
 * ResAI - Gemini Intelligence Layer & Adaptation Test Suite
 * 
 * Verifies:
 * 1. Module export integrity and Gemini adapter configuration
 * 2. Supported models catalog (gemini-1.5-flash, gemini-2.0-flash, gemini-1.5-pro)
 * 3. 6-action decision schema validation (keep, populate, generate, adapt, omit, ask_user)
 * 4. Zero-hallucination evidence grounding on canonical numerical calculations
 * 5. Strict rejection of fabricated p-values, bracket placeholders, and instructional boilerplate
 * 6. Dynamic adaptation of reports to real datasets and custom templates
 */

const { GeminiLLMAdapter, ResAILocalLLM, SUPPORTED_MODELS, ALLOWED_DECISIONS } = require('../static/js/resai-local-llm.js');
const { WorkflowEngine } = require('../static/js/resai-workflow-engine.js');

console.log("===================================================================");
console.log("    ResAI Gemini Intelligence Layer - Test Suite                  ");
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
  // Test 1: Module Export & Supported Models Catalog
  // -------------------------------------------------------------------------
  console.log("[Test 1] Module Export & Gemini Models Catalog");
  assert(GeminiLLMAdapter !== undefined, "GeminiLLMAdapter class must be exported");
  assert(ResAILocalLLM !== undefined, "ResAILocalLLM singleton must be exported");
  assert(Array.isArray(SUPPORTED_MODELS), "SUPPORTED_MODELS must be an array");
  assert(SUPPORTED_MODELS.length >= 3, "Must have at least 3 Gemini models");

  const flashModel = SUPPORTED_MODELS.find(m => m.id === "gemini-1.5-flash");
  assert(flashModel !== undefined, "gemini-1.5-flash must be present in models list");
  assert(flashModel.badge === "Recommended", "gemini-1.5-flash must be marked as Recommended");

  const nextGenModel = SUPPORTED_MODELS.find(m => m.id === "gemini-2.0-flash");
  assert(nextGenModel !== undefined, "gemini-2.0-flash must be present for next-gen speed");

  const proModel = SUPPORTED_MODELS.find(m => m.id === "gemini-1.5-pro");
  assert(proModel !== undefined, "gemini-1.5-pro must be present for deep research synthesis");
  console.log("Test 1 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 2: Gemini Adapter Status & Key Management
  // -------------------------------------------------------------------------
  console.log("[Test 2] Gemini Adapter Status & Key Management");
  const adapter = new GeminiLLMAdapter();
  assert(adapter.state === "idle", "Initial adapter state must be idle");
  assert(adapter.activeModelId === "gemini-1.5-flash", "Default model must be gemini-1.5-flash");

  // Client Key Setter / Getter
  adapter.setStoredClientKey("AIzaSyFakeKeyForUnitTestingOnly12345");
  assert(adapter.apiKey === "AIzaSyFakeKeyForUnitTestingOnly12345", "API Key must be stored");
  assert(adapter.state === "ready", "State must transition to ready when key is provided");
  adapter.setStoredClientKey("");
  assert(adapter.apiKey === "", "Key must be clearable");
  console.log("Test 2 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 3: Decision Schema Validation & Template Adaptation
  // -------------------------------------------------------------------------
  console.log("[Test 3] Decision Schema Validation & Boilerplate Omission");
  const validSec = adapter._validateSectionDecision({
    section_id: "sec_1",
    heading: "Abstract",
    section_type: "abstract",
    decision: "generate",
    reason: "Dataset is profiled"
  }, 0);
  assert(validSec.decision === "generate", "Valid decision 'generate' must be preserved");

  const omitSec = adapter._validateSectionDecision({
    section_id: "sec_instr",
    heading: "Formatting Guidelines & Instructions",
    section_type: "formatting_guidance",
    decision: "omit",
    reason: "Instructional boilerplate"
  }, 1);
  assert(omitSec.decision === "omit", "Boilerplate section must be marked 'omit'");

  const invalidDecisionSec = adapter._validateSectionDecision({
    section_id: "sec_bad",
    heading: "Unknown",
    decision: "hallucinate_fake_data"
  }, 2);
  assert(invalidDecisionSec.decision === "adapt", "Invalid decision strings must safely fallback to 'adapt'");
  console.log("Test 3 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 4: Anti-Hallucination Post-Validation
  // -------------------------------------------------------------------------
  console.log("[Test 4] Anti-Hallucination & Numerical Provenance Guards");
  const mockCanonicalResults = {
    dataset_id: "test_data",
    results_map: {
      mean_score: { value: 8.99, formatted_value: "8.99 LPA" },
      standard_deviation: { value: 5.60, formatted_value: "5.60 LPA" },
      sample_size: { value: 85, formatted_value: "85" },
      p_value: { value: 0.001, formatted_value: "< .001", status: "completed" }
    }
  };

  // 4.1 Valid prose with verified numbers
  const validProse = "Analysis of N = 85 students demonstrated a mean package of 8.99 LPA (SD = 5.60 LPA, p < .001).";
  const val1 = adapter.validateProseAgainstResults(validProse, mockCanonicalResults);
  assert(val1.valid === true, "Accurate prose adhering to canonical numbers must pass validation");

  // 4.2 Leftover instructional boilerplate
  const boilerplateProse = "Write a concise abstract of approximately 150 to 250 words describing the findings.";
  const val2 = adapter.validateProseAgainstResults(boilerplateProse, mockCanonicalResults);
  assert(val2.valid === false, "Instructional boilerplate must be flagged and rejected");

  // 4.3 Invented p-value when test is blocked
  const blockedResults = {
    dataset_id: "test_data_no_group",
    results_map: {
      mean_score: { value: 25.0 },
      p_value: { value: null, status: "blocked" }
    }
  };
  const inventedPProse = "The intervention was highly effective with p < 0.05.";
  const val3 = adapter.validateProseAgainstResults(inventedPProse, blockedResults);
  assert(val3.valid === false, "Invented p-values when tests are blocked must be caught and rejected");
  console.log("Test 4 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 5: Dynamic Report Adaptation with Real Placement Dataset
  // -------------------------------------------------------------------------
  console.log("[Test 5] Dynamic Report Adaptation with Real Placement Dataset");
  const engine = new WorkflowEngine();
  const placementRows = [
    { student_id: 1, cgpa: 8.5, package_in_lakhs: "12 LPA", placed: "Yes" },
    { student_id: 2, cgpa: 7.2, package_in_lakhs: "6 LPA", placed: "Yes" },
    { student_id: 3, cgpa: 9.1, package_in_lakhs: "18 LPA", placed: "Yes" },
    { student_id: 4, cgpa: 6.8, package_in_lakhs: "4.5 LPA", placed: "No" },
    { student_id: 5, cgpa: 8.0, package_in_lakhs: "10 LPA", placed: "Yes" }
  ];

  const profile = engine.profileDataset(placementRows, "Student_placementCSE.xlsx");
  assert(profile.row_count === 5, "Profile must count exactly 5 students");
  assert(profile.data_quality.health_score === 100, "Clean placement data must have 100% health score");

  const builtInTpl = await engine.extractTemplate(null);
  assert(builtInTpl.sections.length > 0, "Built-in template must contain sections");

  const decisions = engine.interpretTemplate(builtInTpl, profile, {
    document_title: "Campus Placement Evaluation",
    research_objective: "Evaluate student compensation packages"
  });
  assert(decisions.sections.length > 0, "Decisions plan must be generated");

  engine.createFieldMapping(builtInTpl, profile);
  engine.confirmAllMappings();
  engine.createAnalysisPlan();
  const results = engine.executeAnalysis(placementRows);

  assert(results.results_map.mean_score !== undefined, "Mean package must be computed");
  assert(results.results_map.mean_score.value > 0, "Mean package must be a positive number");

  const report = await engine.generateReport();
  assert(report.markdown.length > 200, "Generated report manuscript must contain comprehensive text");
  assert(report.markdown.includes(String(results.results_map.mean_score.value)), "Report must include exact computed mean");
  console.log("Test 5 completed successfully.\n");

  console.log("===================================================================");
  console.log(`SUMMARY: ALL ${passed} / ${total} TESTS PASSED (100% SUCCESS)`);
  console.log("===================================================================");
}

runTestSuite().catch(err => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
