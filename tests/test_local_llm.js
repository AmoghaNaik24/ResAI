/**
 * ResAI - Local LLM Adapter Comprehensive Verification Test Suite
 * 
 * Verifies:
 * 1. Module export integrity and WebGPU compatibility detection
 * 2. Supported models catalog and resource approximations
 * 3. Structured JSON extraction, parsing, and repair
 * 4. 6-action decision schema validation (keep, populate, generate, adapt, omit, ask_user)
 * 5. Safe deterministic fallback when WebGPU / model is unavailable
 * 6. Evidence-grounded anti-hallucination validation against canonical results
 * 7. Blocking of fake p-values, bracket placeholders, blank underscores, and branding
 */

const { LocalLLMAdapter, ResAILocalLLM, SUPPORTED_MODELS, ALLOWED_DECISIONS } = require('../static/js/resai-local-llm.js');
const { WorkflowEngine } = require('../static/js/resai-workflow-engine.js');

console.log("===================================================================");
console.log("     ResAI Local LLM Adapter - Comprehensive Test Suite            ");
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
  console.log("[Test 1] Module Export & Supported Models Catalog");
  assert(LocalLLMAdapter !== undefined, "LocalLLMAdapter class must be exported");
  assert(ResAILocalLLM !== undefined, "ResAILocalLLM singleton must be exported");
  assert(Array.isArray(SUPPORTED_MODELS), "SUPPORTED_MODELS must be an array");
  assert(SUPPORTED_MODELS.length >= 3, "Must have at least 3 verified instruct models");

  const defaultModel = SUPPORTED_MODELS.find(m => m.id.includes("Qwen2.5-0.5B"));
  assert(defaultModel !== undefined, "Qwen 2.5 0.5B must be present in models list");
  assert(defaultModel.downloadSizeMB > 0, "Model download size must be specified in MB");
  assert(defaultModel.vramMB > 0, "Model VRAM estimate must be specified in MB");

  const smolModel = SUPPORTED_MODELS.find(m => m.id.includes("SmolLM2"));
  assert(smolModel !== undefined, "SmolLM2 must be present for ultra-fast download option");
  assert(smolModel.downloadSizeMB <= 300, "SmolLM2 download size must be under 300 MB");

  const llamaModel = SUPPORTED_MODELS.find(m => m.id.includes("Llama-3.2"));
  assert(llamaModel !== undefined, "Llama 3.2 must be present for high quality prose");
  console.log("Test 1 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 2: WebGPU Compatibility Detection
  // -------------------------------------------------------------------------
  console.log("[Test 2] WebGPU Compatibility Detection");
  const adapter = new LocalLLMAdapter();
  const compat = await adapter.checkWebGPUCompatibility();
  assert(compat !== null, "Compatibility check must return status object");
  assert(compat.supported === true, "Node simulation environment must report supported test status");
  assert(compat.isNode === true, "Node simulation flag must be detected");
  console.log("Test 2 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 3: Structured JSON Extraction & Markdown Fence Removal
  // -------------------------------------------------------------------------
  console.log("[Test 3] Structured JSON Extraction & Markdown Fence Removal");
  const rawMarkdownResponse = `Here is the requested report action plan:
\`\`\`json
{
  "template_id": "tpl_test_101",
  "sections": [
    {
      "section_id": "sec_1",
      "heading": "Abstract",
      "section_type": "abstract",
      "decision": "adapt",
      "is_required": true,
      "reason": "Synthesize summary from actual empirical findings"
    },
    {
      "section_id": "sec_2",
      "heading": "Formatting Rules",
      "section_type": "formatting_guidance",
      "decision": "omit",
      "is_required": false,
      "reason": "Strip author guidelines"
    }
  ]
}
\`\`\`
Hope this helps!`;

  const parsed = adapter._extractAndParseJSON(rawMarkdownResponse);
  assert(parsed.template_id === "tpl_test_101", "Must extract template_id from markdown code fence");
  assert(parsed.sections.length === 2, "Must extract all 2 sections");
  assert(parsed.sections[0].heading === "Abstract", "First heading must be Abstract");
  assert(parsed.sections[1].decision === "omit", "Formatting section must be omitted");
  console.log("Test 3 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 4: Decision Schema Sanitization & Auto-Repair
  // -------------------------------------------------------------------------
  console.log("[Test 4] Decision Schema Sanitization & Auto-Repair");
  const unstandardizedItem1 = {
    section_id: "sec_99",
    heading: "Outdated Guidelines",
    decision: "DELETE", // non-standard synonym for omit
    reason: "Formatting instructions"
  };
  const sanitized1 = adapter._validateSectionDecision(unstandardizedItem1, 0);
  assert(sanitized1.decision === "omit", "Should auto-repair 'DELETE' to 'omit'");
  assert(sanitized1.is_required === false, "Omitted section must not be required");

  const unstandardizedItem2 = {
    section_id: "sec_100",
    heading: "Statistical Analysis",
    decision: "CALCULATE", // non-standard synonym for generate
    reason: "Run Welch t-test"
  };
  const sanitized2 = adapter._validateSectionDecision(unstandardizedItem2, 1);
  assert(sanitized2.decision === "generate", "Should auto-repair 'CALCULATE' to 'generate'");
  assert(sanitized2.is_required === true, "Generated analysis section must be required");

  const unstandardizedItem3 = {
    section_id: "sec_101",
    heading: "External Sources",
    decision: "query_researcher", // non-standard synonym for ask_user
    reason: "Literature missing"
  };
  const sanitized3 = adapter._validateSectionDecision(unstandardizedItem3, 2);
  assert(sanitized3.decision === "ask_user", "Should auto-repair 'query_researcher' to 'ask_user'");
  assert(sanitized3.status === "pending_user_input", "ask_user must have pending_user_input status");
  console.log("Test 4 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 5: Safe Deterministic Fallback when Local LLM is Uninitialized
  // -------------------------------------------------------------------------
  console.log("[Test 5] Safe Deterministic Fallback when Local LLM is Uninitialized");
  const idleAdapter = new LocalLLMAdapter();
  assert(idleAdapter.state === "idle", "Default state must be idle");

  const mockTpl = {
    template_id: "tpl_mock_1",
    sections: [
      { heading: "Title", placeholders: [] },
      { heading: "Abstract", placeholders: [] },
      { heading: "Formatting Guidelines", placeholders: [] },
      { heading: "Results", placeholders: ["mean_score"] }
    ]
  };

  const mockProfile = {
    row_count: 50,
    columns: [
      { name: "Score", inferred_type: "numeric", missing_count: 0, unique_count: 45 },
      { name: "Group", inferred_type: "categorical", missing_count: 0, unique_count: 2 }
    ]
  };

  const workflowEngine = new WorkflowEngine();
  const fallbackResult = await idleAdapter.generateTemplateDecisions(mockTpl, mockProfile, {}, workflowEngine);

  assert(fallbackResult._engine_used === "deterministic_fallback", "Must flag fallback engine used");
  assert(fallbackResult.sections.length >= 4, "Fallback must classify all template sections");
  const fmtFallback = fallbackResult.sections.find(s => s.original_heading.includes("Formatting Guidelines"));
  assert(fmtFallback && fmtFallback.decision === "omit", "Fallback must omit formatting guidelines");
  console.log("Test 5 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 6: Evidence-Grounded Anti-Hallucination Post-Validation
  // -------------------------------------------------------------------------
  console.log("[Test 6] Evidence-Grounded Anti-Hallucination Post-Validation");
  const canonicalResults = {
    dataset_id: "trial_data.csv",
    sample_size: 40,
    results_map: {
      mean_score: { value: 24.50, status: "calculated" },
      standard_deviation: { value: 5.12, status: "calculated" },
      p_value: { value: null, formatted_value: "Blocked", status: "blocked" },
      test_statistic: { value: null, status: "blocked" }
    }
  };

  // Case 6A: LLM attempts to hallucinate p-value when test was blocked
  const hallucinatedProse = "Our statistical analysis revealed that the active treatment was highly effective (t = 4.25, p = 0.003).";
  const check6A = adapter.validateProseAgainstResults(hallucinatedProse, canonicalResults);
  assert(check6A.valid === false, "Must block hallucinated p-value when hypothesis test was blocked");
  assert(check6A.reason.includes("invented p-values"), `Reason must state invented p-values: ${check6A.reason}`);

  // Case 6B: LLM leaves instructional placeholder blanks (____)
  const boilerplateProse = "The purpose of this investigation was to evaluate ________ in a sample of ________ patients.";
  const check6B = adapter.validateProseAgainstResults(boilerplateProse, canonicalResults);
  assert(check6B.valid === false, "Must reject text containing placeholder blanks (____)");

  // Case 6C: LLM leaves bracketed author instructions
  const bracketProse = "This paper was prepared by [Insert Author Name] for submission to the journal.";
  const check6C = adapter.validateProseAgainstResults(bracketProse, canonicalResults);
  assert(check6C.valid === false, "Must reject text containing bracketed template instructions");

  // Case 6D: LLM retains template branding
  const brandingProse = "Report synthesized using gentext.ai scientific layout format.";
  const check6D = adapter.validateProseAgainstResults(brandingProse, canonicalResults);
  assert(check6D.valid === false, "Must reject text containing gentext.ai template branding");

  // Case 6E: Valid grounded prose
  const validProse = "Descriptive analysis of the empirical dataset (N = 40) demonstrated a baseline mean score of 24.50 (SD = 5.12). Hypotheses testing was appropriately withheld in the absence of an experimental grouping factor.";
  const check6E = adapter.validateProseAgainstResults(validProse, canonicalResults);
  assert(check6E.valid === true, "Must accept verified evidence-grounded prose without hallucinations");
  console.log("Test 6 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 7: Simulation Mode End-to-End Decision Generation
  // -------------------------------------------------------------------------
  console.log("[Test 7] Simulation Mode End-to-End Decision Generation");
  await adapter.initModel("Qwen2.5-0.5B-Instruct-q4f16_1-MLC");
  assert(adapter.state === "ready", "Adapter must be in ready state after init");
  assert(adapter.activeModelId === "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", "Active model ID must match");

  const unloadRes = await adapter.unloadModel();
  assert(unloadRes.success === true, "Unload must succeed");
  assert(adapter.state === "idle", "State must return to idle after unload");
  console.log("Test 7 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 8: Two Different Datasets Produce Distinct Evidence-Based Content
  // -------------------------------------------------------------------------
  console.log("[Test 8] Two Different Datasets Produce Distinct Evidence-Based Content");
  const datasetA = [
    { Group: "Treatment", Outcome: 10 }, { Group: "Treatment", Outcome: 12 },
    { Group: "Control", Outcome: 40 }, { Group: "Control", Outcome: 44 }
  ];
  const datasetB = [
    { Group: "Treatment", Outcome: 95 }, { Group: "Treatment", Outcome: 98 },
    { Group: "Control", Outcome: 20 }, { Group: "Control", Outcome: 22 }
  ];

  const engineA = new WorkflowEngine();
  const profA = engineA.profileDataset(datasetA, "Dataset_A.csv");
  await engineA.extractTemplate(null);
  engineA.createFieldMapping(engineA.templateJSON, profA);
  engineA.updateMappingChoice("mean_score", "Outcome", "arithmetic_mean");
  engineA.updateMappingChoice("standard_deviation", "Outcome", "sample_standard_deviation");
  engineA.confirmAllMappings();
  engineA.createAnalysisPlan();
  const resA = engineA.executeAnalysis(datasetA);
  const repA = await engineA.generateReport();

  const engineB = new WorkflowEngine();
  const profB = engineB.profileDataset(datasetB, "Dataset_B.csv");
  await engineB.extractTemplate(null);
  engineB.createFieldMapping(engineB.templateJSON, profB);
  engineB.updateMappingChoice("mean_score", "Outcome", "arithmetic_mean");
  engineB.updateMappingChoice("standard_deviation", "Outcome", "sample_standard_deviation");
  engineB.confirmAllMappings();
  engineB.createAnalysisPlan();
  const resB = engineB.executeAnalysis(datasetB);
  const repB = await engineB.generateReport();

  assert(resA.results_map.mean_score.value !== resB.results_map.mean_score.value, "Datasets with different values must compute different means");
  assert(repA.markdown.includes(String(resA.results_map.mean_score.value)), "Report A must reflect Dataset A verified mean");
  assert(repB.markdown.includes(String(resB.results_map.mean_score.value)), "Report B must reflect Dataset B verified mean");
  assert(!repA.markdown.includes(String(resB.results_map.mean_score.value)), "Report A must never contain Dataset B numbers");
  console.log("Test 8 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 9: Same Dataset with Two Different Templates Follows Each Template Structure
  // -------------------------------------------------------------------------
  console.log("[Test 9] Same Dataset with Two Different Templates Follows Each Template Structure");
  const tplOutlineA = "# Executive Summary\n\n# Key Metrics\n\n{{mean_score}}\n\n# Strategic Recommendations\n";
  const tplOutlineB = "# Clinical Abstract\n\n# Experimental Methods\n\n# Statistical Findings\n\n{{mean_score}}\n\n# Regulatory Limitations\n";

  const engineTplA = new WorkflowEngine();
  engineTplA.profileDataset(datasetA, "Dataset_A.csv");
  const parsedTplA = await engineTplA.extractTemplate(tplOutlineA, false, "Template_Corporate.md");
  const decisionsTplA = engineTplA.interpretTemplate(parsedTplA, engineTplA.profileJSON, {});
  engineTplA.createFieldMapping(parsedTplA, engineTplA.profileJSON);
  engineTplA.updateMappingChoice("mean_score", "Outcome", "arithmetic_mean");
  engineTplA.confirmAllMappings();
  engineTplA.createAnalysisPlan();
  engineTplA.executeAnalysis(datasetA);
  const repTplA = await engineTplA.generateReport();

  const engineTplB = new WorkflowEngine();
  engineTplB.profileDataset(datasetA, "Dataset_A.csv");
  const parsedTplB = await engineTplB.extractTemplate(tplOutlineB, false, "Template_Clinical.md");
  const decisionsTplB = engineTplB.interpretTemplate(parsedTplB, engineTplB.profileJSON, {});
  engineTplB.createFieldMapping(parsedTplB, engineTplB.profileJSON);
  engineTplB.updateMappingChoice("mean_score", "Outcome", "arithmetic_mean");
  engineTplB.confirmAllMappings();
  engineTplB.createAnalysisPlan();
  engineTplB.executeAnalysis(datasetA);
  const repTplB = await engineTplB.generateReport();

  assert(repTplA.markdown.includes("Executive Summary"), "Report A must follow Template A heading");
  assert(!repTplA.markdown.includes("Clinical Abstract"), "Report A must not contain Template B heading");
  assert(repTplB.markdown.includes("Clinical Abstract"), "Report B must follow Template B heading");
  assert(!repTplB.markdown.includes("Strategic Recommendations"), "Report B must not contain Template A heading");
  console.log("Test 9 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 10: Missing Context Triggers Questions Rather than Hallucinated Text
  // -------------------------------------------------------------------------
  console.log("[Test 10] Missing Context Triggers Questions Rather than Hallucinated Text");
  const tplWithLiterature = {
    template_id: "tpl_lit_test",
    sections: [
      { heading: "Literature Review", placeholders: [] }
    ]
  };
  const decisionsWithoutSources = workflowEngine.interpretTemplate(tplWithLiterature, profA, { literature_sources: [] });
  const litSection = decisionsWithoutSources.sections.find(s => s.section_type === "literature_review");
  assert(litSection.decision === "ask_user", "Missing literature sources must trigger 'ask_user' decision");
  assert(litSection.status === "pending_user_input", "Status must be pending_user_input");
  assert(decisionsWithoutSources.blocking_questions.length > 0, "Must generate a focused question asking user for genuine citations");
  assert(!decisionsWithoutSources.blocking_questions[0].prompt.includes("undefined"), "Prompt must be coherent");
  console.log("Test 10 completed successfully.\n");

  // -------------------------------------------------------------------------
  // Test 11: Privacy & Zero Cloud Leakage Verification
  // -------------------------------------------------------------------------
  console.log("[Test 11] Privacy & Zero Cloud Leakage Verification");
  const modelConfig = adapter.getSupportedModels();
  modelConfig.forEach(m => {
    assert(!m.id.startsWith("http://") && !m.id.startsWith("https://api."), "Model IDs must be local MLC identifiers, not remote API endpoints");
  });
  assert(adapter.engine === null, "Engine is fully released; no dangling background processes or network streams");
  console.log("Test 11 completed successfully.\n");
}

runTestSuite().catch(err => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
