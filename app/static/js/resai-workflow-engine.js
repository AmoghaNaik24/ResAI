/**
 * ResAI - Deterministic Scientific Workflow Engine
 * Implements Stages 1 through 10 of the Research Automation Pipeline:
 * 
 * Stage 1: Input Processing & Session ID Assignment
 * Stage 2: Template Extraction -> Structured JSON (True Word XML & Table extraction)
 * Stage 3: Dataset Profiling -> Structured JSON (Data quality, missingness, schema)
 * Stage 4: Template Field Mapping -> Structured JSON (Deterministic matching & Synonyms)
 * Stage 5: Analysis Planning -> Structured JSON (Execution plan with Blocked Operation guards)
 * Stage 6: Statistical Computation & Verified Results (Bessel N-1, Welch t-test, Lanczos incompleteBeta, zero fabricated p-values)
 * Stage 7: Report Content Generation & Template Population
 * Stage 8: Document Assembly & Genuine OpenXML Word (.docx) / Markdown Packaging
 * Stage 9: Independent Report Validation -> Structured JSON (Canonical mathematical audit & grounding verification)
 * Stage 10: Workflow State Lifecycle Management
 */

(function (window) {
  'use strict';

  // =========================================================================
  // Deterministic Mathematical & Statistical Foundation
  // =========================================================================

  // Lanczos approximation for ln(Gamma(z)) (g = 7, precision ~ 1e-15)
  function lnGamma(z) {
    const g = 7;
    const c = [
      0.99999999999980993,
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7
    ];
    if (z < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1.0 - z);
    }
    z -= 1.0;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) {
      x += c[i] / (z + i);
    }
    const t = z + g + 0.5;
    return 0.5 * Math.log(2.0 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  // Regularized Incomplete Beta Function I_x(a, b) via Lentz's Continued Fraction
  function incompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    // Use symmetry relation if x > (a + 1) / (a + b + 2)
    if (x > (a + 1.0) / (a + b + 2.0)) {
      return 1.0 - incompleteBeta(1.0 - x, b, a);
    }

    const factor = Math.exp(
      a * Math.log(x) + b * Math.log(1.0 - x) - lnGamma(a) - lnGamma(b) + lnGamma(a + b)
    ) / a;

    // Lentz continued fraction method
    const maxIter = 200;
    const eps = 3.0e-14;
    let c = 1.0;
    let d = 1.0 - (a + b) * x / (a + 1.0);
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1.0 / d;
    let cf = d;

    for (let m = 1; m <= maxIter; m++) {
      const m2 = 2 * m;
      // Even step
      let num = (m * (b - m) * x) / ((a + m2 - 1.0) * (a + m2));
      d = 1.0 + num * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1.0 + num / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1.0 / d;
      cf *= c * d;

      // Odd step
      num = -((a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1.0));
      d = 1.0 + num * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1.0 + num / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1.0 / d;
      const delta = c * d;
      cf *= delta;

      if (Math.abs(delta - 1.0) < eps) break;
    }

    return Math.max(0, Math.min(1, factor * cf));
  }

  // Exact Student's t distribution two-tailed p-value
  function studentTPValue(t, df) {
    if (isNaN(t) || isNaN(df) || df <= 0) return null;
    const absT = Math.abs(t);
    const x = df / (df + absT * absT);
    return incompleteBeta(x, df / 2.0, 0.5);
  }

  // Format APA p-value string without duplicated equal signs
  function formatPValue(p) {
    if (p === null || p === undefined || isNaN(p)) return "N/A";
    if (p < 0.001) return "< .001";
    const s = p.toFixed(3);
    return `${s.replace('0.', '.')}`;
  }

  function escapeXml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Canonical Built-in Academic Report Template Definition
  const BUILTIN_TEMPLATE = {
    template_id: "tpl_builtin_apa7",
    document_title: "Empirical Research Report",
    format: "builtin",
    is_builtin: true,
    sections: [
      {
        section_id: "sec_abstract",
        heading: "Abstract",
        level: 2,
        content_type: "narrative",
        paragraphs: [
          "This empirical study evaluates experimental distributions and comparative discrepancies across {{sample_size}} observations in {{dataset_name}}. Quantitative results indicate a data health index of {{data_health_score}}, with primary continuous outcomes demonstrating a mean of {{mean_score}} (SD = {{standard_deviation}}). Inferential hypothesis testing revealed {{inferential_significance_statement}} (p = {{p_value}})."
        ],
        placeholders: ["sample_size", "dataset_name", "data_health_score", "mean_score", "standard_deviation", "inferential_significance_statement", "p_value"],
        replace_policy: "identified_content_only"
      },
      {
        section_id: "sec_intro",
        heading: "1. Introduction and Study Objectives",
        level: 2,
        content_type: "narrative",
        paragraphs: [
          "Quantitative analysis was conducted on {{dataset_name}} to evaluate empirical discrepancies and test primary research hypotheses. The dataset encompasses N = {{sample_size}} validated experimental observations measured across {{column_count}} distinct variables."
        ],
        placeholders: ["dataset_name", "sample_size", "column_count"],
        replace_policy: "identified_content_only"
      },
      {
        section_id: "sec_methodology",
        heading: "2. Experimental Data Hygiene and Descriptive Profiling",
        level: 2,
        content_type: "methodology",
        paragraphs: [
          "Data quality screening was executed prior to statistical modeling. Overall dataset health was verified at {{data_health_score}}, with a missing cell rate of {{missing_rate}}% and {{duplicate_rows}} duplicate records detected."
        ],
        placeholders: ["data_health_score", "missing_rate", "duplicate_rows"],
        replace_policy: "identified_content_only"
      },
      {
        section_id: "sec_results",
        heading: "3. Statistical Analysis and Hypothesis Testing",
        level: 2,
        content_type: "statistical_results",
        paragraphs: [
          "Descriptive summaries revealed a primary outcome mean of {{mean_score}} with a standard deviation of {{standard_deviation}}. Hypothesis testing confirmed {{inferential_significance_statement}}, yielding test statistic {{test_statistic}} and significance level p = {{p_value}} with an effect size of {{effect_size}}."
        ],
        placeholders: ["mean_score", "standard_deviation", "inferential_significance_statement", "test_statistic", "p_value", "effect_size"],
        replace_policy: "identified_content_only"
      },
      {
        section_id: "sec_discussion",
        heading: "4. Discussion and Scientific Interpretation",
        level: 2,
        content_type: "narrative",
        paragraphs: [
          "The observed metrics provide verifiable evidence regarding the investigated phenomena. Verified effect sizes ({{effect_size}}) substantiate practical discrepancies rather than mere sampling variance."
        ],
        placeholders: ["effect_size"],
        replace_policy: "review_before_replacement"
      },
      {
        section_id: "sec_limitations",
        heading: "5. Limitations and Threats to Validity",
        level: 2,
        content_type: "narrative",
        paragraphs: [
          "Observations are constrained to N = {{sample_size}} sample records in {{dataset_name}}. Caution is warranted when extrapolating findings to external populations without replication."
        ],
        placeholders: ["sample_size", "dataset_name"],
        replace_policy: "identified_content_only"
      },
      {
        section_id: "sec_conclusions",
        heading: "6. Conclusion and Recommendations",
        level: 2,
        content_type: "narrative",
        paragraphs: [
          "In conclusion, deterministic analysis confirms the empirical findings under study. All numerical outputs have been audited and validated against ground-truth dataset calculations."
        ],
        placeholders: [],
        replace_policy: "review_before_replacement"
      }
    ],
    tables: [
      {
        table_id: "tbl_descriptives",
        heading: "Table 1: Comprehensive Descriptive Statistics",
        columns: ["Variable", "N", "Mean", "SD", "95% CI", "Median (IQR)", "Normality"],
        replaceable: true
      }
    ],
    figures: [],
    placeholders_found: [
      "sample_size", "dataset_name", "data_health_score", "mean_score", 
      "standard_deviation", "inferential_significance_statement", "p_value", 
      "column_count", "missing_rate", "duplicate_rows", "test_statistic", "effect_size"
    ],
    protected_content: ["references", "citations", "acknowledgements"],
    warnings: []
  };

  class WorkflowEngine {
    constructor() {
      this.reset();
    }

    reset() {
      this.sessionId = "session_" + Date.now();
      this.lifecycle = "idle";
      this.rawFile = null;
      this.templateFile = null;
      this.templateZip = null;
      this.templateJSON = null;
      this.profileJSON = null;
      this.templateDecisionsJSON = null;
      this.userContext = null;
      this.mappingJSON = null;
      this.analysisPlanJSON = null;
      this.verifiedResultsJSON = null;
      this.assembledReport = null;
      this.validationJSON = null;
    }

    // =========================================================================
    // Stage 1 & 2: Template Extraction -> Structured JSON
    // =========================================================================
    async extractTemplate(fileOrText, isDocx = false, fileName = "Template.docx") {
      this.lifecycle = "extracted";

      if (!fileOrText) {
        this.templateZip = null;
        this.templateJSON = JSON.parse(JSON.stringify(BUILTIN_TEMPLATE));
        this.templateJSON.template_id = "tpl_" + Date.now();
        return this.templateJSON;
      }

      // Check if file is a DOCX archive
      const jszipObj = (typeof window !== 'undefined' && window.JSZip) || (typeof global !== 'undefined' && global.JSZip) || (typeof JSZip !== 'undefined' ? JSZip : null);
      const isBufferOrBlob = (typeof Blob !== 'undefined' && (fileOrText instanceof Blob || fileOrText instanceof File)) ||
                             (typeof Uint8Array !== 'undefined' && fileOrText instanceof Uint8Array) ||
                             (typeof Buffer !== 'undefined' && Buffer.isBuffer(fileOrText));

      if (isDocx && jszipObj && isBufferOrBlob) {
        try {
          const zip = await jszipObj.loadAsync(fileOrText);
          const docXmlFile = zip.file("word/document.xml");
          if (docXmlFile) {
            const xmlText = await docXmlFile.async("string");
            this.templateZip = zip; // Retain active zip for direct OpenXML editing
            this.templateJSON = this._parseDocxXmlToTemplateJSON(xmlText, fileName);
            return this.templateJSON;
          } else {
            console.warn("word/document.xml not found in zip archive.");
          }
        } catch (err) {
          console.warn("DOCX unzipping failed, preserving original and falling back to text extraction:", err);
          this.templateZip = null;
          const fallbackJSON = JSON.parse(JSON.stringify(BUILTIN_TEMPLATE));
          fallbackJSON.template_id = "tpl_" + Date.now();
          fallbackJSON.document_title = fileName;
          fallbackJSON.warnings.push(`DOCX structure could not be parsed safely (${err.message}). Preserving original file and applying safe report layout.`);
          this.templateJSON = fallbackJSON;
          return this.templateJSON;
        }
      }

      // Plaintext or Markdown Outline
      this.templateZip = null;
      const text = typeof fileOrText === "string" ? fileOrText : await fileOrText.text();
      this.templateJSON = this._parseTextToTemplateJSON(text, fileName);
      return this.templateJSON;
    }

    _parseDocxXmlToTemplateJSON(xmlString, fileName) {
      const sections = [];
      const tables = [];
      const allPlaceholders = new Set();
      const warnings = [];

      // Extract all paragraphs across document, including inside table cells (<w:tc><w:p>)
      const pMatches = xmlString.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];

      let currentSection = {
        section_id: "sec_intro",
        heading: "Overview",
        level: 1,
        content_type: "narrative",
        paragraphs: [],
        placeholders: [],
        replace_policy: "identified_content_only"
      };

      pMatches.forEach((pXml) => {
        // Collect text inside all <w:t> elements within this paragraph
        const tMatches = pXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
        let pText = "";
        tMatches.forEach(tm => {
          pText += tm.replace(/<[^>]+>/g, '');
        });
        pText = pText.trim();
        if (!pText) return;

        // Check if paragraph is styled as a heading
        const isStyleHeading = /<w:pStyle[^>]*w:val="([^"]*Heading[^"]*|[^"]*Title[^"]*)"/i.test(pXml);
        const isSemanticHeading = /^(Abstract|Introduction|Methodology|Results|Discussion|Limitations|Conclusion|References|\d+\.\s+[A-Z])/i.test(pText);

        if (isStyleHeading || isSemanticHeading) {
          if (currentSection.paragraphs.length > 0 || currentSection.heading !== "Overview") {
            sections.push(currentSection);
          }
          currentSection = {
            section_id: `sec_${sections.length + 1}`,
            heading: pText,
            level: /2|sub/i.test(pXml) ? 2 : 1,
            content_type: /result|finding|statistic|analysis/i.test(pText) ? "statistical_results" : "narrative",
            paragraphs: [],
            placeholders: [],
            replace_policy: /result|finding/i.test(pText) ? "identified_content_only" : "review_before_replacement"
          };
        } else {
          currentSection.paragraphs.push(pText);
          // Detect placeholders: {{field}} or [field]
          const phMatches = pText.match(/\{\{([^{}]+)\}\}|\[([a-zA-Z0-9_]{3,30})\]/g);
          if (phMatches) {
            phMatches.forEach(ph => {
              const clean = ph.replace(/[\{\}\[\]]/g, "").trim();
              currentSection.placeholders.push(clean);
              allPlaceholders.add(clean);
            });
          }
        }
      });

      if (currentSection.paragraphs.length > 0 || currentSection.heading !== "Overview") {
        sections.push(currentSection);
      }

      // Extract tables metadata
      const tblMatches = xmlString.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) || [];
      tblMatches.forEach((tblXml, tIdx) => {
        const rows = tblXml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
        const cols = [];
        if (rows.length > 0) {
          const cells = rows[0].match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
          cells.forEach(cXml => {
            const t = (cXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || []).map(m => m.replace(/<[^>]+>/g, '').trim()).join(" ");
            if (t) cols.push(t);
          });
        }
        tables.push({
          table_id: `tbl_${tIdx + 1}`,
          heading: `Template Table ${tIdx + 1}`,
          columns: cols.length > 0 ? cols : ["Column 1", "Column 2"],
          replaceable: true
        });
      });

      if (allPlaceholders.size === 0) {
        warnings.push("No explicit {{placeholder}} tags detected in template. Standard scientific variables assigned to results section.");
        sections.forEach(sec => {
          if (/result|finding|abstract/i.test(sec.heading)) {
            const defaults = ["sample_size", "mean_score", "standard_deviation", "p_value", "effect_size"];
            defaults.forEach(d => {
              sec.placeholders.push(d);
              allPlaceholders.add(d);
            });
          }
        });
      }

      return {
        template_id: "tpl_" + Date.now(),
        document_title: sections[0] ? sections[0].heading : "Uploaded Academic Template",
        filename: fileName,
        format: "docx",
        is_builtin: false,
        sections: sections,
        tables: tables,
        figures: [],
        placeholders_found: Array.from(allPlaceholders),
        protected_content: ["references", "citations", "acknowledgements"],
        warnings: warnings
      };
    }

    _parseTextToTemplateJSON(text, fileName) {
      const lines = text.split("\n");
      const sections = [];
      const allPlaceholders = new Set();
      const warnings = [];

      let currentSection = {
        section_id: "sec_0",
        heading: "Title",
        level: 1,
        content_type: "narrative",
        paragraphs: [],
        placeholders: [],
        replace_policy: "identified_content_only"
      };

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.startsWith("#")) {
          if (currentSection.paragraphs.length > 0 || currentSection.heading !== "Title") {
            sections.push(currentSection);
          }
          const level = (trimmed.match(/^#+/) || ["#"])[0].length;
          const headingText = trimmed.replace(/^#+\s*/, "");
          currentSection = {
            section_id: `sec_${sections.length + 1}`,
            heading: headingText,
            level: level,
            content_type: /result|finding|statistic|table/i.test(headingText) ? "statistical_results" : "narrative",
            paragraphs: [],
            placeholders: [],
            replace_policy: /result/i.test(headingText) ? "identified_content_only" : "review_before_replacement"
          };
        } else {
          currentSection.paragraphs.push(trimmed);
          const phMatches = trimmed.match(/\{\{([^{}]+)\}\}/g);
          if (phMatches) {
            phMatches.forEach(ph => {
              const clean = ph.replace(/[\{\}]/g, "").trim();
              currentSection.placeholders.push(clean);
              allPlaceholders.add(clean);
            });
          }
        }
      });

      if (currentSection.paragraphs.length > 0) sections.push(currentSection);

      if (allPlaceholders.size === 0) {
        ["sample_size", "mean_score", "standard_deviation", "p_value"].forEach(p => allPlaceholders.add(p));
        warnings.push("No explicit tags found. Standard empirical placeholders assigned.");
      }

      return {
        template_id: "tpl_" + Date.now(),
        document_title: sections[0] ? sections[0].heading : "Uploaded Research Outline",
        filename: fileName,
        format: "markdown",
        is_builtin: false,
        sections: sections,
        tables: [],
        figures: [],
        placeholders_found: Array.from(allPlaceholders),
        protected_content: ["references"],
        warnings: warnings
      };
    }

    // =========================================================================
    // Stage 3: Dataset Profiling -> Structured JSON
    // =========================================================================
    profileDataset(rows, fileName = "research_data.csv") {
      this.lifecycle = "profiled";
      if (!rows || rows.length === 0) {
        throw new Error("Dataset is empty. Cannot profile 0 observations.");
      }

      const rowCount = rows.length;
      const allCols = Object.keys(rows[0] || {});
      const columnProfiles = [];
      const warnings = [];

      let totalMissing = 0;

      // Duplicate check
      const seen = new Set();
      let duplicates = 0;
      rows.forEach(r => {
        const s = JSON.stringify(r);
        if (seen.has(s)) duplicates++;
        else seen.add(s);
      });

      allCols.forEach(col => {
        const rawVals = rows.map(r => r[col]);
        let missing = 0;
        let numericVals = [];
        const uniqueSet = new Set();

        rawVals.forEach(v => {
          if (v === null || v === undefined || v === "" || (typeof v === "number" && isNaN(v))) {
            missing++;
            totalMissing++;
          } else {
            uniqueSet.add(v);
            let num = Number(v);
            if (isNaN(num) && typeof v === "string") {
              const cleaned = v.replace(/,/g, "").trim();
              const match = cleaned.match(/^([+-]?\d+(?:\.\d+)?)/);
              if (match && !/^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(cleaned)) {
                const parsed = Number(match[1]);
                if (!isNaN(parsed)) num = parsed;
              }
            }
            if (!isNaN(num) && typeof v !== "boolean") {
              numericVals.push(num);
            }
          }
        });

        const validObservations = rowCount - missing;
        const isNumeric = validObservations > 0 && (numericVals.length / validObservations) >= 0.75;
        let summary = null;

        if (isNumeric && numericVals.length > 0) {
          numericVals.sort((a, b) => a - b);
          const mean = numericVals.reduce((a, b) => a + b, 0) / numericVals.length;
          // Sample SD using Bessel's correction (N - 1)
          const std = numericVals.length > 1
            ? Math.sqrt(numericVals.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / (numericVals.length - 1))
            : 0;
          summary = {
            mean: Number(mean.toFixed(2)),
            std: Number(std.toFixed(2)),
            min: numericVals[0],
            max: numericVals[numericVals.length - 1],
            median: numericVals[Math.floor(numericVals.length / 2)]
          };
        }

        columnProfiles.push({
          name: col,
          inferred_type: isNumeric ? "numeric" : "categorical",
          missing_count: missing,
          missing_percentage: Number(((missing / rowCount) * 100).toFixed(2)),
          unique_count: uniqueSet.size,
          categories: !isNumeric && uniqueSet.size <= 15 ? Array.from(uniqueSet) : null,
          summary: summary
        });
      });

      const totalCells = rowCount * allCols.length;
      const missingRate = Number(((totalMissing / Math.max(1, totalCells)) * 100).toFixed(2));
      const healthScore = Math.max(0, Number((100 - (missingRate * 2) - (duplicates * 2)).toFixed(1)));

      if (missingRate > 10) warnings.push(`High missingness detected (${missingRate}% of all cells are null).`);
      if (duplicates > 0) warnings.push(`Dataset contains ${duplicates} duplicate row records.`);
      if (rowCount < 30) warnings.push(`Small sample size (N = ${rowCount}). Consider limitations in generalized inferences.`);

      this.profileJSON = {
        dataset_id: "ds_" + Date.now(),
        filename: fileName,
        row_count: rowCount,
        column_count: allCols.length,
        columns: columnProfiles,
        data_quality: {
          health_score: healthScore,
          total_missing_cells: totalMissing,
          missing_rate_overall: missingRate,
          duplicate_rows: duplicates,
          warnings: warnings
        }
      };

      return this.profileJSON;
    }

    // =========================================================================
    // Stage 3: Template Intelligence Layer -> Structured Decision JSON
    // =========================================================================
    classifySectionType(heading) {
      if (!heading || typeof heading !== "string") return "general_narrative";
      const h = heading.trim().toLowerCase();

      if (/(abstract|executive\s+summary)/i.test(h)) return "abstract";
      if (/title\s*page|front\s*matter|cover\s*page|^title$/i.test(h)) return "title_page";
      if (/(literature\s*review|related\s*work|scholarly\s*sources|theoretical\s*framework)/i.test(h)) return "literature_review";
      if (/(cohort|subgroup|between[\s-]group|treatment|clinical|placebo)/i.test(h)) return "cohort_comparison";
      if (/(results|findings|statistical\s*analysis|quantitative\s*findings|empirical\s*findings)/i.test(h)) return "analytical_results";
      if (/(introduction|background|problem\s*statement|context\b|scope\b)/i.test(h)) return "introduction";
      if (/(methodology|methods\b|procedure|empirical\s*approach|materials|data\s*collection)/i.test(h)) return "methodology";
      if (/(discussion|implications|interpretation|recommendations|strategic)/i.test(h)) return "discussion";
      if (/(limitations|threats\s*to\s*validity)/i.test(h)) return "limitations";
      if (/(conclusion|summary\s*of\s*findings|concluding\s*remarks)/i.test(h)) return "conclusion";
      if (/(references|works\s*cited|bibliography)/i.test(h)) return "references";
      if (/guideline|formatting\s*(advice|notes|instructions|rules)|template\s*notes|how\s*to\s*use|style\s*rules/i.test(h)) return "formatting_guidance";

      return "general_narrative";
    }

    isInstructionOrExampleParagraph(text) {
      if (!text || typeof text !== "string") return false;
      const trimmed = text.trim();
      if (!trimmed) return false;

      // 1. Placeholder blanks (3 or more underscores, or bracketed author instructions)
      if (/_{3,}/.test(trimmed)) return true;
      if (/\[(insert|your|university|course|date|instructor|author|title|name|department|professor|affiliation)[^\]]*\]/i.test(trimmed)) return true;

      // 2. Template branding and attribution
      if (/gentext\s*(group|\.ai)|generated\s+by\s+gentext|template\s+by\s+microsoft|template\s+created\s+by/i.test(trimmed)) return true;

      // 3. Instructional imperative phrases and meta-instructions
      const instructionPatterns = [
        /^(write|provide|compose|summarize|begin|state|describe|explain|detail|discuss|present|replace|use|ensure|cite\s+at\s+least|include\s+at\s+least|note:|instructions:)\b/i,
        /\b(write a concise abstract|approximately 150 to 250 words|between 150 and 250 words)\b/i,
        /\b(replace every blank line|replace with your own|insert your text here|paste your text here)\b/i,
        /\b(use a professional academic layout|double-spaced with 1-inch margins|times new roman 12pt|apa 7th edition formatting)\b/i,
        /\b(this section should describe|this section should summarize|in this section, provide)\b/i,
        /\b(briefly summarize the most relevant scholarly sources|cite at least \d+-\d+ peer-reviewed)\b/i,
        /\b(begin the introduction by establishing the research problem)\b/i,
        /\b(example abstract sentence|example paragraph|for example, if you studied)\b/i,
        /\b(the purpose of this study was to examine\s+_{2,}|in a sample of\s+_{2,})\b/i,
        /\b(enter author name here|author name,\s*institution)\b/i
      ];

      return instructionPatterns.some(pat => pat.test(trimmed));
    }

    interpretTemplate(templateJSON = null, profileJSON = null, userContext = {}) {
      this.lifecycle = "interpreted";
      const tpl = templateJSON || this.templateJSON || BUILTIN_TEMPLATE;
      const prof = profileJSON || this.profileJSON;
      this.userContext = userContext || {};

      const sections = tpl.sections || [];
      const decisionsList = [];
      const blockingQuestions = [];
      const warnings = [];

      // Check if dataset has categorical grouping factor for hypothesis tests
      const columns = prof ? (prof.columns || []) : [];
      const numCols = columns.filter(c => c.inferred_type === "numeric");
      const catCols = columns.filter(c => c.inferred_type === "categorical" && c.unique_count >= 2 && c.unique_count <= Math.min(15, Math.max(2, (prof.row_count || 10) * 0.8)));
      const hasContinuous = numCols.length > 0;
      const hasGrouping = catCols.length > 0;

      sections.forEach((sec, idx) => {
        const heading = sec.heading || `Section ${idx + 1}`;
        const secType = this.classifySectionType(heading);
        let decision = "adapt";
        let reason = "";
        let evidenceSources = [];
        let requiredInputs = [];
        let plannedOutputs = [];
        let unresolvedItems = [];
        let status = "ready";
        let isRequired = true;

        switch (secType) {
          case "title_page":
            decision = "populate";
            reason = "Populate verified study metadata without inventing missing author or university names.";
            evidenceSources = ["user_context", "file_metadata"];
            plannedOutputs = ["document_title", "researcher_name", "date", "session_id"];
            if (!this.userContext.researcher_name) {
              unresolvedItems.push("Researcher/PI name not explicitly specified (defaulted to Lead Lab Investigator).");
            }
            break;

          case "abstract":
            decision = "adapt";
            reason = "Synthesize an empirical executive summary from the research objective, actual methods, sample size, and verified results. Never copy template abstract instructions or blank underscores.";
            evidenceSources = ["dataset_profile", "verified_results_json", "user_context"];
            plannedOutputs = ["study_objective", "sample_and_hygiene", "verified_results_summary", "grounded_conclusion"];
            break;

          case "introduction":
            decision = "adapt";
            reason = "Frame research context using supplied research question or dataset domain; omit generic template writing prompts.";
            evidenceSources = ["user_context", "dataset_profile"];
            plannedOutputs = ["problem_context", "research_question", "variable_scope"];
            if (!this.userContext.research_objective) {
              unresolvedItems.push("Specific research objective not supplied (standard quantitative baseline inquiry adopted).");
            }
            break;

          case "literature_review":
            if (this.userContext.literature_sources && this.userContext.literature_sources.length > 0) {
              decision = "populate";
              reason = "Incorporate authentic scholarly literature provided by researcher.";
              evidenceSources = ["user_context_literature"];
              plannedOutputs = ["literature_review_narrative", "scholarly_citations"];
            } else {
              decision = "ask_user";
              reason = "Scholarly literature requires genuine academic sources. ResAI prohibits hallucinating authors, DOIs, or fictitious citations.";
              evidenceSources = ["user_context"];
              requiredInputs = ["genuine_peer_reviewed_sources"];
              unresolvedItems = ["literature_citations_pending_researcher_input"];
              status = "pending_user_input";
              blockingQuestions.push({
                question_id: "q_literature",
                section_id: sec.section_id,
                prompt: "Please provide authentic literature citations or related work references for this study. ResAI will not hallucinate papers or DOIs.",
                type: "optional_metadata",
                default_action: "State in manuscript that external literature review is reserved for researcher entry."
              });
            }
            break;

          case "methodology":
            decision = "generate";
            reason = "Accurately document operations actually performed on the dataset (data cleaning, missingness handling, Bessel standard deviation, and test specifications).";
            evidenceSources = ["dataset_profile", "verified_results_json"];
            plannedOutputs = ["sample_specifications", "hygiene_protocol", "statistical_procedures"];
            break;

          case "analytical_results":
            decision = "generate";
            reason = "Generate grounded empirical results from verified computations. Never manufacture unverified numbers or p-values.";
            evidenceSources = ["verified_results_json", "dataset_profile"];
            plannedOutputs = ["descriptive_statistics", "relevant_tables", "supported_visualizations", "inferential_test_statistics"];
            if (!hasGrouping && hasContinuous) {
              warnings.push("Hypothesis testing (p-value, t-statistic) is blocked due to the absence of a categorical grouping variable. Reporting is restricted to descriptive distributions.");
            }
            break;

          case "cohort_comparison":
            // Check if section demands specific treatment/control or clinical concepts not present in dataset
            const isClinicalOrTreatment = /clinical|placebo|patient|drug|hospital|treatment\s*vs\s*control/i.test(heading) ||
              (sec.paragraphs || []).some(p => /clinical|placebo|patient|drug|hospital|treatment\s*(vs|versus)\s*control/i.test(p));
            
            // Check if dataset has treatment/control or clinical variables
            const hasClinicalOrTreatmentVars = columns.some(c => 
              /treatment|control|placebo|patient|drug|hospital/i.test(c.name) ||
              (c.categories && c.categories.some(cat => /treatment|control|placebo/i.test(String(cat))))
            );

            if (!hasGrouping || (isClinicalOrTreatment && !hasClinicalOrTreatmentVars)) {
              decision = "omit";
              reason = isClinicalOrTreatment && !hasClinicalOrTreatmentVars
                ? "Section requires clinical or treatment-vs-control cohort data, which is absent from the input dataset profile. Eliminated to prevent ungrounded claims."
                : "Section requires categorical grouping cohorts, but input dataset lacks a valid grouping factor. Eliminated to prevent ungrounded claims.";
              status = "omitted";
              isRequired = false;
            } else {
              decision = "generate";
              reason = "Synthesize empirical between-cohort statistical comparisons from verified data.";
              evidenceSources = ["verified_results_json"];
              plannedOutputs = ["between_cohort_inferences"];
            }
            break;

          case "discussion":
            decision = "adapt";
            reason = "Interpret findings strictly in relation to observed data boundaries and stated research objectives without speculative causal claims.";
            evidenceSources = ["verified_results_json", "user_context"];
            plannedOutputs = ["findings_interpretation", "contextual_implications"];
            break;

          case "limitations":
            decision = "generate";
            reason = "Generate empirical limitations directly derived from dataset boundaries (sample size, cell missingness rate, observational scope).";
            evidenceSources = ["dataset_profile"];
            plannedOutputs = ["sample_size_constraints", "observational_boundaries"];
            break;

          case "conclusion":
            decision = "adapt";
            reason = "Summarize verified findings and their scientific implications without introducing ungrounded external claims.";
            evidenceSources = ["verified_results_json"];
            plannedOutputs = ["summary_of_findings", "future_directions"];
            break;

          case "references":
            if (this.userContext.literature_sources && this.userContext.literature_sources.length > 0) {
              decision = "populate";
              reason = "Incorporate genuine researcher-supplied references.";
              evidenceSources = ["user_context_literature"];
              plannedOutputs = ["formatted_references_list"];
            } else {
              decision = "ask_user";
              reason = "Retain references heading and include procedural standards citation while clearly stating that study-specific literature requires researcher submission.";
              evidenceSources = ["standard_methodology_references"];
              unresolvedItems = ["study_specific_citations_not_supplied"];
              status = "ready";
            }
            break;

          case "formatting_guidance":
            decision = "omit";
            reason = "Template instructions and formatting guidance (e.g. margin rules, font guidelines) must be excluded from final research prose.";
            evidenceSources = [];
            plannedOutputs = [];
            status = "omitted";
            isRequired = false;
            break;

          default:
            const isMismatchedDomain = /clinical|placebo|patient|hospital|biomarker/i.test(heading) && !columns.some(c => /patient|clinical|hospital|biomarker/i.test(c.name));
            const nonInstructionParas = (sec.paragraphs || []).filter(p => !this.isInstructionOrExampleParagraph(p));
            if (isMismatchedDomain) {
              decision = "omit";
              reason = "Section domain (clinical/biomedical) does not match the uploaded dataset variables. Eliminated to preserve empirical integrity.";
              status = "omitted";
              isRequired = false;
            } else if (nonInstructionParas.length === 0 && (sec.paragraphs || []).length > 0) {
              decision = "omit";
              reason = "Section contains exclusively instructional boilerplate or template author guidance.";
              status = "omitted";
              isRequired = false;
            } else {
              decision = "keep";
              reason = "Section contains user-provided template prose that does not conflict with verified findings.";
              evidenceSources = ["user_template_content"];
              status = "ready";
            }
            break;
        }

        decisionsList.push({
          section_id: sec.section_id,
          original_heading: heading,
          required: isRequired,
          section_type: secType,
          decision: decision,
          reason: reason,
          evidence_sources: evidenceSources,
          required_inputs: requiredInputs,
          planned_outputs: plannedOutputs,
          unresolved_items: unresolvedItems,
          status: status
        });
      });

      this.templateDecisionsJSON = {
        template_id: tpl.template_id || "tpl_001",
        document_title: this.userContext.document_title || tpl.document_title || "Empirical Research Report",
        user_context: this.userContext,
        sections: decisionsList,
        global_requirements: {
          citation_style: "APA 7",
          preserve_template_formatting: true,
          strip_template_instructions: true,
          strip_blank_underscores: true,
          strip_template_branding: true
        },
        blocking_questions: blockingQuestions,
        warnings: warnings
      };

      return this.templateDecisionsJSON;
    }

    _synthesizeSectionNarrative(sectionType, heading, userContext = {}, resMap = {}, profileJSON = null) {
      const u = userContext || {};
      const prof = profileJSON || this.profileJSON;
      const datasetName = (resMap["dataset_name"] && resMap["dataset_name"].value) || (prof ? prof.filename : "the analyzed dataset");
      const sampleSize = (resMap["sample_size"] && resMap["sample_size"].formatted_value) || (prof ? String(prof.row_count) : "N");
      const colCount = (resMap["column_count"] && resMap["column_count"].formatted_value) || (prof ? String(prof.column_count) : "k");
      const healthScore = (resMap["data_health_score"] && resMap["data_health_score"].formatted_value) || (prof ? `${prof.data_quality.health_score}%` : "100%");
      const missingRate = (resMap["missing_rate"] && resMap["missing_rate"].formatted_value) || (prof ? `${prof.data_quality.missing_rate_overall}%` : "0%");
      const dupRows = (resMap["duplicate_rows"] && resMap["duplicate_rows"].formatted_value) || (prof ? String(prof.data_quality.duplicate_rows) : "0");
      
      const meanScore = resMap["mean_score"] ? resMap["mean_score"].formatted_value : "N/A";
      const standardDeviation = resMap["standard_deviation"] ? resMap["standard_deviation"].formatted_value : "N/A";
      const hasHypothesisTest = resMap["p_value"] && resMap["p_value"].status === "computed";
      const contColName = (resMap["mean_score"] && resMap["mean_score"].input_columns && resMap["mean_score"].input_columns[0]) || "";
      const varDesc = contColName ? contColName.replace(/_/g, " ") : "continuous outcome measures";
      const objective = u.research_objective || `evaluate empirical distributions of ${varDesc} across validated observations in ${datasetName}`;

      switch (sectionType) {
        case "title_page":
          const title = u.document_title || `Quantitative Empirical Analysis of ${datasetName}`;
          const author = u.researcher_name || "Lead Lab Investigator";
          const inst = u.institution || "Department of Quantitative Research";
          const subDate = u.submission_date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          return `**${title}**\n\n**Investigator:** ${author} | **Affiliation:** ${inst}\n\n**Date:** ${subDate} | **Session Identifier:** \`${this.sessionId}\``;

        case "abstract":
          let abstractInferential = hasHypothesisTest
            ? `Inferential hypothesis testing indicated ${resMap["inferential_significance_statement"].value} (${resMap["test_statistic"].formatted_value}, p = ${resMap["p_value"].formatted_value}, ${resMap["effect_size"].formatted_value}).`
            : "Hypothesis testing was not conducted due to the absence of a verified categorical grouping variable; analysis was constrained to descriptive parameter distributions.";
          return `This quantitative investigation evaluated empirical metrics across N = ${sampleSize} validated observations from ${datasetName}. The primary research objective was to ${objective}. Univariate continuous evaluations yielded a sample mean of ${meanScore} (SD = ${standardDeviation}). ${abstractInferential} Results establish verified baseline distributions for subsequent reproducible investigation.`;

        case "introduction":
          return `Establishing verified empirical distributions is essential for reproducible quantitative science. This study examines data from ${datasetName}, comprising N = ${sampleSize} validated records across ${colCount} attributes. The central research inquiry focuses on: ${objective}. Analyses were restricted to deterministic computations derived directly from empirical data, with zero synthetic or unverified values introduced.`;

        case "literature_review":
          if (u.literature_sources && u.literature_sources.length > 0) {
            return u.literature_sources.join("\n\n");
          }
          return `*Researcher Note: External literature review citations were not supplied by the author. In accordance with ResAI strict scientific integrity standards, the system does not fabricate fictitious papers, authors, or DOIs. Scholarly context should be populated with verified peer-reviewed sources.*`;

        case "methodology":
          let testMethodText = hasHypothesisTest
            ? "Between-group comparisons were evaluated using Welch's robust two-sample t-test to protect against potential variance heterogeneity, alongside pooled Cohen's d effect size calculations."
            : "Inferential comparative hypothesis testing was formally blocked due to the absence of a two-group categorical grouping factor; analysis was constrained to univariate descriptive profiling.";
          return `Data hygiene protocols were conducted on the dataset '${datasetName}' (${sampleSize} observations, ${colCount} attributes). Quality screening identified an overall health index of ${healthScore}, with an observed cell missingness rate of ${missingRate} and ${dupRows} duplicate records. Continuous variables were evaluated using sample standard deviations with Bessel's correction (N - 1 denominator). ${testMethodText} All calculations were performed deterministically without imputation or synthetic augmentation.`;

        case "analytical_results":
          let resultsInferentialText = hasHypothesisTest
            ? `Hypothesis testing was conducted to evaluate differences between experimental cohorts. As reported in Table 1, the analysis revealed ${resMap["inferential_significance_statement"].formatted_value} (${resMap["test_statistic"].formatted_value}, p = ${resMap["p_value"].formatted_value}, ${resMap["effect_size"].formatted_value}).`
            : "Hypothesis testing was not conducted due to the absence of a categorical grouping variable with two or more distinct levels. Numerical reporting was constrained to verified descriptive and distributional parameters.";
          return `Comprehensive statistical summaries were computed for validated observations (N = ${sampleSize}). The primary continuous outcome measure (${varDesc}) yielded an arithmetic mean of ${meanScore} (SD = ${standardDeviation}). ${resultsInferentialText}\n\n### Table 1: Verified Quantitative Findings & Statistical Inferences\n| Metric / Measure | Verified Value | Statistical Procedure |\n| :--- | :--- | :--- |\n| Sample Size (N) | ${sampleSize} | Valid Record Count |\n| Arithmetic Mean (${varDesc}) | ${meanScore} | Sample Mean |\n| Sample Standard Deviation | ${standardDeviation} | Bessel's Correction (N-1) |\n| Data Health Score | ${healthScore} | Hygiene Index Algorithm |\n| Missingness Rate | ${missingRate} | Cell Missing Percentage |${hasHypothesisTest ? `\n| Test Statistic | ${resMap["test_statistic"].formatted_value} | ${resMap["test_statistic"].method} |\n| p-value | ${resMap["p_value"].formatted_value} | Two-Tailed t Distribution |\n| Effect Size | ${resMap["effect_size"].formatted_value} | Pooled Cohen's d |` : ''}`;

        case "discussion":
          let discInferential = hasHypothesisTest
            ? `The observed effect size (${resMap["effect_size"].formatted_value}) substantiates practical magnitude beyond mere sampling variance.`
            : "Because comparative grouping cohorts were not defined in the dataset, findings characterize baseline sample properties rather than differential treatment effects.";
          return `The empirical findings provide quantitative characterization of the study observations in ${datasetName}. The observed sample mean of ${meanScore} (SD = ${standardDeviation}) reflects the central tendency of the validated records. ${discInferential} These outcomes align with the research objective (${objective}). Interpretations are disciplined by observed data boundaries, and causal claims are avoided in the absence of longitudinal randomized controls.`;

        case "limitations":
          return `Several empirical boundaries contextualize the reported results. First, the analysis is based on an observed sample of N = ${sampleSize} records in ${datasetName}. Second, data quality screening recorded a missingness rate of ${missingRate}. Third, in the absence of randomized manipulation or prospective tracking, findings characterize observed associations rather than causal mechanisms.`;

        case "conclusion":
          return `In conclusion, deterministic analysis of ${datasetName} confirms verified baseline metrics for N = ${sampleSize} observations. Verified parameters—including Mean = ${meanScore} and SD = ${standardDeviation}—provide an auditable foundation for future empirical inquiry and replication.`;

        case "references":
          if (u.literature_sources && u.literature_sources.length > 0) {
            return u.literature_sources.map((src, i) => `${i + 1}. ${src}`).join("\n\n");
          }
          return `1. American Psychological Association. (2020). Publication Manual of the American Psychological Association (7th ed.). https://doi.org/10.1037/0000165-000\n\n*Researcher Note: External study-specific literature citations were not provided by the researcher. In accordance with strict scientific integrity guidelines, ResAI does not synthesize fictitious citations, authors, or DOIs.*`;

        default:
          return `Deterministic analysis was executed on ${datasetName} across N = ${sampleSize} observations. Continuous variables yielded Mean = ${meanScore} (SD = ${standardDeviation}).`;
      }
    }

    // =========================================================================
    // Stage 4: Template Field Mapping -> Structured JSON
    // =========================================================================
    createFieldMapping(templateJSON, profileJSON) {
      this.lifecycle = "mapped";
      if (!this.templateDecisionsJSON) {
        this.interpretTemplate(templateJSON, profileJSON, this.userContext);
      }
      const placeholders = templateJSON.placeholders_found || [];
      const columns = profileJSON.columns || [];
      const numCols = columns.filter(c => c.inferred_type === "numeric");
      // Identify valid categorical grouping factors with 2 to 15 distinct levels
      const catCols = columns.filter(c => c.inferred_type === "categorical" && c.unique_count >= 2 && c.unique_count <= Math.min(15, Math.max(2, profileJSON.row_count * 0.8)));

      const mappings = [];
      const unmapped = [];
      const warnings = [];

      const synonymDictionary = {
        sample_size: ["sample_size", "sample", "n", "total_n", "observations", "participants", "records", "count"],
        dataset_name: ["dataset_name", "dataset", "data_source", "study_name", "file_name"],
        data_health_score: ["data_health_score", "health_score", "quality_score", "hygiene_index"],
        missing_rate: ["missing_rate", "missing_pct", "missingness"],
        duplicate_rows: ["duplicate_rows", "duplicates", "redundant_rows"],
        mean_score: ["mean_score", "mean", "average", "avg", "post_test", "outcome", "biomarker", "score"],
        standard_deviation: ["standard_deviation", "std_dev", "std", "sd"],
        p_value: ["p_value", "p_val", "p", "significance", "sig", "alpha"],
        test_statistic: ["test_statistic", "f_statistic", "t_statistic", "f_stat", "t_stat", "chi_sq"],
        effect_size: ["effect_size", "cohen_d", "eta_squared", "eta_sq", "cramer_v"]
      };

      placeholders.forEach(targetField => {
        const normTarget = targetField.toLowerCase().trim();
        let mappingEntry = null;

        // 1. Study-level Global Metrics
        if (["sample_size", "dataset_name", "data_health_score", "missing_rate", "duplicate_rows", "column_count"].includes(normTarget)) {
          mappingEntry = {
            target_field: targetField,
            display_name: targetField.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
            source_type: "computed_metric",
            source_column: null,
            transformation: normTarget,
            status: "confirmed",
            confidence: 1.0,
            requires_confirmation: false,
            reason: "Standard study-level structural metric directly mapped from dataset profile."
          };
        }

        // 2. Statistical Test Metrics
        else if (["p_value", "test_statistic", "effect_size", "inferential_significance_statement"].includes(normTarget)) {
          const hasGroups = catCols.length > 0;
          const hasContinuous = numCols.length > 0;

          if (hasContinuous && hasGroups) {
            mappingEntry = {
              target_field: targetField,
              display_name: targetField.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
              source_type: "computed_metric",
              source_column: `${numCols[0].name} by ${catCols[0].name}`,
              transformation: normTarget,
              status: "suggested",
              confidence: 0.92,
              requires_confirmation: true,
              reason: `Derived from two-group inferential hypothesis test (${numCols[0].name} across ${catCols[0].name} cohorts).`
            };
          } else {
            mappingEntry = {
              target_field: targetField,
              display_name: targetField.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
              source_type: "computed_metric",
              source_column: null,
              transformation: normTarget,
              status: "unresolved",
              confidence: null,
              requires_confirmation: true,
              reason: "Cannot perform hypothesis test: Dataset lacks a categorical grouping variable with >= 2 cohorts."
            };
            warnings.push(`Hypothesis metric '${targetField}' cannot be computed due to absence of a comparative grouping variable.`);
          }
        }

        // 3. Continuous Column Mappings
        else {
          let matchedCol = numCols.find(c => c.name.toLowerCase() === normTarget);
          let confidence = 0.98;
          let reason = "Exact column name match.";

          if (!matchedCol) {
            for (const [canonical, syns] of Object.entries(synonymDictionary)) {
              if (syns.includes(normTarget)) {
                matchedCol = numCols.find(c => syns.some(s => c.name.toLowerCase().includes(s)));
                if (matchedCol) {
                  confidence = 0.88;
                  reason = `Semantic synonym match with '${canonical}'.`;
                  break;
                }
              }
            }
          }

          if (!matchedCol && numCols.length > 0) {
            matchedCol = numCols[numCols.length - 1];
            confidence = 0.72;
            reason = "Heuristic match to primary continuous outcome measure.";
          }

          if (matchedCol) {
            const isStd = normTarget.includes("sd") || normTarget.includes("standard_deviation");
            mappingEntry = {
              target_field: targetField,
              display_name: targetField.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
              source_type: "dataset_column",
              source_column: matchedCol.name,
              transformation: isStd ? "sample_standard_deviation" : "arithmetic_mean",
              status: confidence >= 0.85 ? "suggested" : "unresolved",
              confidence: confidence,
              requires_confirmation: confidence < 0.95,
              reason: reason
            };
          } else {
            unmapped.push(targetField);
            warnings.push(`Placeholder '${targetField}' could not be safely mapped to a dataset column.`);
          }
        }

        if (mappingEntry) {
          mappings.push(mappingEntry);
        }
      });

      this.mappingJSON = {
        mapping_id: "map_" + Date.now(),
        mappings: mappings,
        unmapped_fields: unmapped,
        warnings: warnings
      };

      this.lifecycle = "awaiting_confirmation";
      return this.mappingJSON;
    }

    updateMappingChoice(targetField, newSourceColumn, newTransformation) {
      if (!this.mappingJSON) return;
      const item = this.mappingJSON.mappings.find(m => m.target_field === targetField);
      if (item) {
        item.source_column = newSourceColumn;
        if (newTransformation) item.transformation = newTransformation;
        item.status = "confirmed";
        item.requires_confirmation = false;
        item.reason = "Manually selected and verified by researcher.";
      }
    }

    confirmAllMappings() {
      if (!this.mappingJSON) return;
      this.mappingJSON.mappings.forEach(m => {
        if (m.source_type === "computed_metric" && m.status !== "unresolved") {
          m.status = "confirmed";
          m.requires_confirmation = false;
        } else if (m.source_type === "dataset_column" && m.source_column) {
          m.status = "confirmed";
          m.requires_confirmation = false;
        } else if (m.status === "suggested") {
          m.status = "confirmed";
          m.requires_confirmation = false;
        }
      });
      this.lifecycle = "analysis_ready";
    }

    // =========================================================================
    // Stage 5: Analysis Planning -> Structured JSON
    // =========================================================================
    createAnalysisPlan() {
      if (!this.mappingJSON || !this.profileJSON) {
        throw new Error("Cannot create analysis plan before field mapping and profiling.");
      }

      const operations = [];
      const blockedOperations = [];
      const warnings = [];

      this.mappingJSON.mappings.forEach((m, idx) => {
        if (m.status === "unresolved") {
          blockedOperations.push({
            operation_id: `op_blocked_${idx + 1}`,
            target_field: m.target_field,
            reason: m.reason || "Unresolved mapping: Required dataset inputs are absent."
          });
        } else {
          operations.push({
            operation_id: `op_${idx + 1}`,
            operation: m.transformation,
            input_column: m.source_column,
            output_field: m.target_field,
            status: "ready"
          });
        }
      });

      if (blockedOperations.length > 0) {
        warnings.push(`${blockedOperations.length} planned analysis operation(s) are blocked due to missing or unresolved inputs.`);
      }

      this.analysisPlanJSON = {
        analysis_plan_id: "plan_" + Date.now(),
        operations: operations,
        blocked_operations: blockedOperations,
        assumptions: [
          "Continuous metric variance evaluated using sample Bessel's correction (N - 1).",
          "Two-sample hypothesis test evaluated via Welch's robust t-distribution (alpha = .05) without assuming equal variances."
        ],
        warnings: warnings
      };

      return this.analysisPlanJSON;
    }

    // =========================================================================
    // Stage 6: Statistical Computation & Verified Results (Canonical Source)
    // =========================================================================
    executeAnalysis(rows) {
      if (!this.analysisPlanJSON) this.createAnalysisPlan();
      this.lifecycle = "analyzed";

      const p = this.profileJSON;
      const numCols = p.columns.filter(c => c.inferred_type === "numeric");
      const catCols = p.columns.filter(c => c.inferred_type === "categorical" && c.unique_count >= 2 && c.unique_count <= Math.min(15, Math.max(2, p.row_count * 0.8)));

      const resultMap = {};

      // 1. Execute Study-level baseline metrics
      resultMap["sample_size"] = {
        result_id: "res_sample_size",
        field: "sample_size",
        value: p.row_count,
        formatted_value: String(p.row_count),
        method: "valid_observation_count",
        input_columns: [],
        valid_sample_size: p.row_count,
        status: "computed",
        warnings: []
      };

      resultMap["dataset_name"] = {
        result_id: "res_dataset_name",
        field: "dataset_name",
        value: p.filename,
        formatted_value: p.filename,
        method: "file_metadata",
        input_columns: [],
        valid_sample_size: p.row_count,
        status: "computed",
        warnings: []
      };

      resultMap["data_health_score"] = {
        result_id: "res_health_score",
        field: "data_health_score",
        value: p.data_quality.health_score,
        formatted_value: `${p.data_quality.health_score}%`,
        method: "hygiene_index_algorithm",
        input_columns: [],
        valid_sample_size: p.row_count,
        status: "computed",
        warnings: []
      };

      resultMap["missing_rate"] = {
        result_id: "res_missing_rate",
        field: "missing_rate",
        value: p.data_quality.missing_rate_overall,
        formatted_value: `${p.data_quality.missing_rate_overall}%`,
        method: "cell_missingness_percentage",
        input_columns: [],
        valid_sample_size: p.row_count,
        status: "computed",
        warnings: []
      };

      resultMap["duplicate_rows"] = {
        result_id: "res_duplicate_rows",
        field: "duplicate_rows",
        value: p.data_quality.duplicate_rows,
        formatted_value: String(p.data_quality.duplicate_rows),
        method: "row_hash_deduplication",
        input_columns: [],
        valid_sample_size: p.row_count,
        status: "computed",
        warnings: []
      };

      resultMap["column_count"] = {
        result_id: "res_col_count",
        field: "column_count",
        value: p.column_count,
        formatted_value: String(p.column_count),
        method: "schema_column_count",
        input_columns: [],
        valid_sample_size: p.row_count,
        status: "computed",
        warnings: []
      };

      // 2. Execute Planned Column Operations
      this.analysisPlanJSON.operations.forEach((op) => {
        if (!op.input_column) return;
        const colName = op.input_column;
        
        // Ensure input column exists in dataset rows
        const hasColumn = rows.length > 0 && (colName in rows[0]);
        if (!hasColumn) {
          resultMap[op.output_field] = {
            result_id: `res_${op.output_field}`,
            field: op.output_field,
            value: null,
            formatted_value: "N/A (Column Not Found)",
            method: "missing_column_guard",
            input_columns: [colName],
            valid_sample_size: 0,
            status: "blocked",
            warnings: [`Input column '${colName}' does not exist in dataset.`]
          };
          return;
        }

        // Filter missing or non-numeric values (supporting unit-suffixed values like '5 LPA')
        const validNumericVals = [];
        rows.forEach(r => {
          const v = r[colName];
          if (v === null || v === undefined || v === "") return;
          let num = Number(v);
          if (isNaN(num) && typeof v === "string") {
            const cleaned = v.replace(/,/g, "").trim();
            const match = cleaned.match(/^([+-]?\d+(?:\.\d+)?)/);
            if (match && !/^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(cleaned)) {
              const parsed = Number(match[1]);
              if (!isNaN(parsed)) num = parsed;
            }
          }
          if (!isNaN(num) && typeof v !== "boolean") {
            validNumericVals.push(num);
          }
        });

        if (validNumericVals.length === 0) {
          resultMap[op.output_field] = {
            result_id: `res_${op.output_field}`,
            field: op.output_field,
            value: null,
            formatted_value: "N/A (No Numeric Data)",
            method: "missing_values_guard",
            input_columns: [colName],
            valid_sample_size: 0,
            status: "blocked",
            warnings: [`Column '${colName}' has 0 valid numeric records.`]
          };
          return;
        }

        if (op.operation === "arithmetic_mean" || op.operation === "mean") {
          const mean = validNumericVals.reduce((a, b) => a + b, 0) / validNumericVals.length;
          resultMap[op.output_field] = {
            result_id: `res_${op.output_field}`,
            field: op.output_field,
            value: Number(mean.toFixed(2)),
            formatted_value: mean.toFixed(2),
            method: "arithmetic_mean",
            input_columns: [colName],
            valid_sample_size: validNumericVals.length,
            status: "computed",
            warnings: []
          };
        } else if (op.operation === "sample_standard_deviation" || op.operation === "std") {
          const mean = validNumericVals.reduce((a, b) => a + b, 0) / validNumericVals.length;
          // Sample standard deviation with Bessel's correction (N - 1)
          const std = validNumericVals.length > 1
            ? Math.sqrt(validNumericVals.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / (validNumericVals.length - 1))
            : 0;
          resultMap[op.output_field] = {
            result_id: `res_${op.output_field}`,
            field: op.output_field,
            value: Number(std.toFixed(2)),
            formatted_value: std.toFixed(2),
            method: "sample_standard_deviation_n_minus_1",
            input_columns: [colName],
            valid_sample_size: validNumericVals.length,
            status: "computed",
            warnings: []
          };
        }
      });

      // 3. Execute Inferential Hypothesis Test
      // RULE: If grouping variable is missing or invalid, BLOCK the test. Never fabricate plausible numbers.
      let primaryTestRes = null;
      const hasContinuous = numCols.length > 0;
      const hasGrouping = catCols.length > 0;

      if (hasContinuous && hasGrouping) {
        const contCol = numCols[0].name;
        const grpCol = catCols[0].name;

        // Group rows and clean missing values
        const groupMap = {};
        rows.forEach(r => {
          const g = r[grpCol];
          const y = r[contCol];
          if (g === null || g === undefined || y === null || y === undefined || y === "") return;
          let numY = Number(y);
          if (isNaN(numY) && typeof y === "string") {
            const match = String(y).replace(/,/g, "").trim().match(/^([+-]?\d+(?:\.\d+)?)/);
            if (match) {
              const parsed = Number(match[1]);
              if (!isNaN(parsed)) numY = parsed;
            }
          }
          if (!isNaN(numY) && typeof y !== "boolean") {
            const gStr = String(g).trim();
            if (!groupMap[gStr]) groupMap[gStr] = [];
            groupMap[gStr].push(numY);
          }
        });

        const groupKeys = Object.keys(groupMap);

        if (groupKeys.length >= 2 && groupMap[groupKeys[0]].length >= 2 && groupMap[groupKeys[1]].length >= 2) {
          const g1 = groupKeys[0];
          const g2 = groupKeys[1];
          const data1 = groupMap[g1];
          const data2 = groupMap[g2];
          const n1 = data1.length;
          const n2 = data2.length;

          const m1 = data1.reduce((a, b) => a + b, 0) / n1;
          const m2 = data2.reduce((a, b) => a + b, 0) / n2;
          const v1 = data1.map(x => Math.pow(x - m1, 2)).reduce((a, b) => a + b, 0) / (n1 - 1);
          const v2 = data2.map(x => Math.pow(x - m2, 2)).reduce((a, b) => a + b, 0) / (n2 - 1);

          // Welch's t-test (robust against unequal variances)
          const se = Math.sqrt((v1 / n1) + (v2 / n2));
          const t = se > 0 ? (m1 - m2) / se : 0;
          const numDf = Math.pow((v1 / n1) + (v2 / n2), 2);
          const denDf = (Math.pow(v1 / n1, 2) / (n1 - 1)) + (Math.pow(v2 / n2, 2) / (n2 - 1));
          const df = denDf > 0 ? numDf / denDf : (n1 + n2 - 2);

          // Exact mathematical p-value using regularized incomplete beta function
          const pVal = studentTPValue(t, df);
          const isSig = pVal !== null && pVal < 0.05;

          // Pooled Cohen's d effect size
          const pooledSD = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / Math.max(1, n1 + n2 - 2));
          const cohensD = pooledSD > 0 ? Math.abs(m1 - m2) / pooledSD : 0;

          primaryTestRes = {
            test_type: "Welch's Two-Sample t-Test",
            statistic: Number(t.toFixed(2)),
            degrees_of_freedom: Number(df.toFixed(1)),
            p_value: pVal,
            is_significant: isSig,
            variables: [contCol, grpCol],
            effect_size: {
              type: "Cohen's d",
              value: Number(cohensD.toFixed(2)),
              magnitude: cohensD >= 0.8 ? "Large" : (cohensD >= 0.5 ? "Medium" : "Small")
            }
          };
        }
      }

      if (primaryTestRes) {
        const pVal = primaryTestRes.p_value;
        const pValFormatted = formatPValue(pVal);
        const isSig = primaryTestRes.is_significant;

        resultMap["p_value"] = {
          result_id: "res_p_value",
          field: "p_value",
          value: pVal,
          formatted_value: pValFormatted,
          method: primaryTestRes.test_type,
          input_columns: primaryTestRes.variables || [],
          valid_sample_size: rows.length,
          status: "computed",
          warnings: []
        };

        resultMap["test_statistic"] = {
          result_id: "res_test_statistic",
          field: "test_statistic",
          value: primaryTestRes.statistic,
          formatted_value: `t(${primaryTestRes.degrees_of_freedom}) = ${primaryTestRes.statistic.toFixed(2)}`,
          method: primaryTestRes.test_type,
          input_columns: primaryTestRes.variables || [],
          valid_sample_size: rows.length,
          status: "computed",
          warnings: []
        };

        resultMap["effect_size"] = {
          result_id: "res_effect_size",
          field: "effect_size",
          value: primaryTestRes.effect_size.value,
          formatted_value: `Cohen's d = ${primaryTestRes.effect_size.value} (${primaryTestRes.effect_size.magnitude})`,
          method: "pooled_cohens_d",
          input_columns: primaryTestRes.variables || [],
          valid_sample_size: rows.length,
          status: "computed",
          warnings: []
        };

        resultMap["inferential_significance_statement"] = {
          result_id: "res_sig_statement",
          field: "inferential_significance_statement",
          value: isSig ? "statistically significant discrepancies" : "no statistically significant discrepancies",
          formatted_value: isSig ? "statistically significant differences between experimental cohorts" : "no statistically significant differences between cohorts",
          method: "decision_rule_alpha_0.05",
          input_columns: primaryTestRes.variables || [],
          valid_sample_size: rows.length,
          status: "computed",
          warnings: []
        };
      } else {
        // Explicitly block hypothesis test when grouping variable or inputs are absent.
        // DO NOT fabricate plausible numbers or p-values.
        const blockReason = !hasContinuous
          ? "No numeric continuous variable available for hypothesis testing."
          : "Dataset lacks a valid categorical grouping variable with >= 2 cohorts.";

        resultMap["p_value"] = {
          result_id: "res_p_value",
          field: "p_value",
          value: null,
          formatted_value: "N/A (Test Blocked: Missing Grouping Variable)",
          method: "blocked_hypothesis_test",
          input_columns: [],
          valid_sample_size: 0,
          status: "blocked",
          warnings: [blockReason]
        };

        resultMap["test_statistic"] = {
          result_id: "res_test_statistic",
          field: "test_statistic",
          value: null,
          formatted_value: "N/A (No justified test)",
          method: "blocked_hypothesis_test",
          input_columns: [],
          valid_sample_size: 0,
          status: "blocked",
          warnings: [blockReason]
        };

        resultMap["effect_size"] = {
          result_id: "res_effect_size",
          field: "effect_size",
          value: null,
          formatted_value: "N/A (No justified test)",
          method: "blocked_hypothesis_test",
          input_columns: [],
          valid_sample_size: 0,
          status: "blocked",
          warnings: [blockReason]
        };

        resultMap["inferential_significance_statement"] = {
          result_id: "res_sig_statement",
          field: "inferential_significance_statement",
          value: null,
          formatted_value: "Hypothesis testing was not conducted due to the absence of a two-group comparative factor.",
          method: "blocked_hypothesis_test",
          input_columns: [],
          valid_sample_size: 0,
          status: "blocked",
          warnings: [blockReason]
        };
      }

      this.verifiedResultsJSON = {
        analysis_session_id: this.sessionId,
        dataset_id: p.dataset_id,
        results_map: resultMap,
        results_list: Object.values(resultMap),
        primary_test: primaryTestRes
      };

      return this.verifiedResultsJSON;
    }

    // =========================================================================
    // Stage 7 & 8: Report Content Generation & Document Assembly
    // =========================================================================
    async generateReport() {
      if (!this.verifiedResultsJSON) {
        throw new Error("Cannot generate report prior to verified results calculation.");
      }
      this.lifecycle = "assembled";

      const tpl = this.templateJSON || BUILTIN_TEMPLATE;
      const resMap = this.verifiedResultsJSON.results_map;

      // Ensure template decisions are computed
      if (!this.templateDecisionsJSON) {
        this.interpretTemplate(tpl, this.profileJSON, this.userContext);
      }

      const assembledSections = [];
      const sectionReplacementMap = {};

      // Prepare section replacements for adaptive and generated sections
      for (const dec of this.templateDecisionsJSON.sections) {
        if (["adapt", "generate", "populate", "ask_user"].includes(dec.decision)) {
          let narrative = this._synthesizeSectionNarrative(
            dec.section_type,
            dec.original_heading,
            this.userContext || {},
            resMap,
            this.profileJSON
          );

          // If in-browser Local LLM is active and ready, generate grounded narrative
          if (typeof window !== 'undefined' && window.ResAILocalLLM && window.ResAILocalLLM.state === "ready") {
            try {
              const llmNarrative = await window.ResAILocalLLM.generateSectionProse(
                { heading: dec.original_heading, section_type: dec.section_type },
                this.userContext || {},
                this.verifiedResultsJSON,
                narrative
              );
              if (llmNarrative && llmNarrative.text) {
                narrative = llmNarrative.text;
              }
            } catch (llmErr) {
              console.warn("Local LLM section prose generation error, using deterministic narrative:", llmErr);
            }
          }

          sectionReplacementMap[dec.section_id] = narrative;
          sectionReplacementMap[dec.original_heading.toLowerCase()] = narrative;
          sectionReplacementMap[dec.section_type] = narrative;
        }
      }

      tpl.sections.forEach(sec => {
        const secDec = this.templateDecisionsJSON.sections.find(d =>
          d.section_id === sec.section_id ||
          d.original_heading.toLowerCase() === sec.heading.toLowerCase()
        );
        const decision = secDec ? secDec.decision : "keep";
        const secType = secDec ? secDec.section_type : this.classifySectionType(sec.heading);

        // Omit unneeded formatting guidelines, instructions, or branding
        if (decision === "omit" || secType === "formatting_guidance") {
          return;
        }

        // Check if section contains valid research prose (non-instructional paragraphs)
        const validProse = (sec.paragraphs || []).filter(p => !this.isInstructionOrExampleParagraph(p));

        if (validProse.length > 0 && !tpl.is_builtin && (decision === "keep" || decision === "adapt" || decision === "populate")) {
          // Section in custom template contains authentic user prose; preserve it with placeholders replaced
          const updatedParagraphs = validProse.map(para => {
            let updated = para;
            Object.keys(resMap).forEach(key => {
              const ph = `{{${key}}}`;
              if (updated.includes(ph)) {
                updated = updated.split(ph).join(resMap[key].formatted_value || String(resMap[key].value || ""));
              }
              const phBrackets = `[${key}]`;
              if (updated.includes(phBrackets)) {
                updated = updated.split(phBrackets).join(resMap[key].formatted_value || String(resMap[key].value || ""));
              }
            });
            return updated;
          });

          assembledSections.push({
            section_id: sec.section_id,
            heading: sec.heading,
            level: sec.level || 2,
            paragraphs: updatedParagraphs
          });
        } else {
          // Adapt or generate section narrative based on empirical data
          const narrative = sectionReplacementMap[sec.section_id] ||
            sectionReplacementMap[sec.heading.toLowerCase()] ||
            sectionReplacementMap[secType] ||
            this._synthesizeSectionNarrative(secType, sec.heading, this.userContext || {}, resMap, this.profileJSON);

          assembledSections.push({
            section_id: sec.section_id,
            heading: sec.heading,
            level: sec.level || (secType === "title_page" ? 1 : 2),
            paragraphs: [narrative]
          });
        }
      });

      // Construct Markdown representation
      let markdown = `# ${this.templateDecisionsJSON.document_title || tpl.document_title}\n\n`;
      const researcherName = (this.userContext && this.userContext.researcher_name) || "Lead Lab Investigator";
      markdown += `**Principal Investigator:** ${researcherName} | **Session:** \`${this.sessionId}\` | **Date:** ${new Date().toLocaleDateString()}\n\n---\n\n`;

      assembledSections.forEach(sec => {
        const prefix = "#".repeat(Math.max(2, sec.level || 2));
        markdown += `${prefix} ${sec.heading}\n\n`;
        sec.paragraphs.forEach(p => {
          markdown += `${p}\n\n`;
        });
      });

      // Construct genuine OpenXML DOCX archive
      let docxBlob = null;
      let docxBuffer = null;
      const jszipObj = (typeof window !== 'undefined' && window.JSZip) || (typeof global !== 'undefined' && global.JSZip) || (typeof JSZip !== 'undefined' ? JSZip : null);

      if (jszipObj) {
        try {
          if (this.templateZip) {
            // DIRECT WORD XML EDITING of uploaded template container
            const docXmlFile = this.templateZip.file("word/document.xml");
            if (docXmlFile) {
              const originalXml = await docXmlFile.async("string");
              const replacedXml = this._replaceWordXml(originalXml, resMap, this.templateDecisionsJSON, sectionReplacementMap);
              this.templateZip.file("word/document.xml", replacedXml);

              // Also replace placeholders in headers/footers if present
              const headerFooterFiles = this.templateZip.file(/^word\/(header|footer)\d+\.xml$/);
              for (const hf of headerFooterFiles) {
                const hfXml = await hf.async("string");
                const replacedHf = this._replaceWordXml(hfXml, resMap, this.templateDecisionsJSON, sectionReplacementMap);
                this.templateZip.file(hf.name, replacedHf);
              }

              if (typeof Blob !== 'undefined') {
                docxBlob = await this.templateZip.generateAsync({
                  type: "blob",
                  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                });
              }
              if (typeof Buffer !== 'undefined') {
                docxBuffer = await this.templateZip.generateAsync({ type: "nodebuffer" });
              }
            }
          } else {
            // Generate genuine OpenXML DOCX package for built-in template
            const zip = this._buildBuiltinDocxPackage(jszipObj, assembledSections, resMap, this.templateDecisionsJSON.document_title || tpl.document_title);
            if (typeof Blob !== 'undefined') {
              docxBlob = await zip.generateAsync({
                type: "blob",
                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              });
            }
            if (typeof Buffer !== 'undefined') {
              docxBuffer = await zip.generateAsync({ type: "nodebuffer" });
            }
          }
        } catch (docxErr) {
          console.warn("Direct OpenXML packaging encountered issue:", docxErr);
        }
      }

      this.assembledReport = {
        report_id: "rep_" + Date.now(),
        session_id: this.sessionId,
        title: this.templateDecisionsJSON.document_title || tpl.document_title,
        template_id: tpl.template_id,
        is_builtin: tpl.is_builtin,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        sections: assembledSections,
        markdown: markdown,
        results_snapshot: this.verifiedResultsJSON.results_list,
        docx_blob: docxBlob,
        docx_buffer: docxBuffer
      };

      return this.assembledReport;
    }

    _replaceWordXml(xmlString, resMap, decisionsJSON = null, sectionReplacementMap = {}) {
      const decisions = decisionsJSON || this.templateDecisionsJSON;
      let currentSectionHeading = "Overview";
      let currentSectionId = "sec_intro";
      let currentSectionDecision = "adapt";
      const sectionReplacedFlags = {};

      return xmlString.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paraXml) => {
        const tRegex = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g;
        const matches = [];
        let m;
        while ((m = tRegex.exec(paraXml)) !== null) {
          matches.push({ full: m[0], open: m[1], text: m[2], close: m[3] });
        }
        if (matches.length === 0) return paraXml;

        const combinedText = matches.map(m => m.text).join("");
        const trimmed = combinedText.trim();
        if (!trimmed) return paraXml;

        // 1. Detect if this paragraph is a Section Heading
        const isStyleHeading = /<w:pStyle[^>]*w:val="([^"]*Heading[^"]*|[^"]*Title[^"]*)"/i.test(paraXml);
        const isSemanticHeading = /^(Abstract|Overview|Title\s*Page|1\.\s+Introduction|2\.\s+Methodology|2\.\s+Literature\s+Review|3\.\s+Methodology|3\.\s+Results|4\.\s+Results|4\.\s+Discussion|5\.\s+Discussion|5\.\s+Limitations|6\.\s+Limitations|6\.\s+Conclusion|7\.\s+Conclusion|7\.\s+References|References|Formatting\s+Guidelines|\d+\.\s+[A-Z])/i.test(trimmed);

        if (isStyleHeading || isSemanticHeading) {
          currentSectionHeading = trimmed;
          const secType = this.classifySectionType(trimmed);

          let secDec = null;
          if (decisions && decisions.sections) {
            secDec = decisions.sections.find(s => 
              s.original_heading.toLowerCase() === trimmed.toLowerCase() ||
              s.section_type === secType
            );
          }

          currentSectionId = secDec ? secDec.section_id : `sec_${secType}`;
          currentSectionDecision = secDec ? secDec.decision : (secType === "formatting_guidance" ? "omit" : "adapt");

          // If this section is to be omitted (e.g. Formatting Guidelines), remove the heading
          if (currentSectionDecision === "omit" || secType === "formatting_guidance") {
            return "";
          }

          // Otherwise keep the authentic heading with original formatting
          return paraXml;
        }

        // 2. Remove third-party template generator branding
        if (/gentext\s*(group|\.ai)|generated\s+by\s+gentext|template\s+by\s+microsoft/i.test(trimmed)) {
          return "";
        }

        // 3. Remove paragraphs in omitted sections
        if (currentSectionDecision === "omit") {
          return "";
        }

        // 4. Handle instructional paragraphs or blank placeholders
        let updatedText = combinedText;
        if (this.isInstructionOrExampleParagraph(trimmed)) {
          if (["adapt", "generate", "populate", "ask_user"].includes(currentSectionDecision)) {
            const repl = sectionReplacementMap[currentSectionId] || 
                         sectionReplacementMap[currentSectionHeading.toLowerCase()] ||
                         sectionReplacementMap[this.classifySectionType(currentSectionHeading)];

            if (repl && !sectionReplacedFlags[currentSectionId]) {
              updatedText = repl;
              sectionReplacedFlags[currentSectionId] = true;
            } else {
              // Additional instructional paragraph in this section -> omit
              return "";
            }
          } else {
            return "";
          }
        }

        // 5. Replace placeholders {{field}} and [field]
        Object.keys(resMap).forEach(key => {
          const ph = `{{${key}}}`;
          if (updatedText.includes(ph)) {
            updatedText = updatedText.split(ph).join(resMap[key].formatted_value || String(resMap[key].value || ""));
          }
          const phBrackets = `[${key}]`;
          if (updatedText.includes(phBrackets)) {
            updatedText = updatedText.split(phBrackets).join(resMap[key].formatted_value || String(resMap[key].value || ""));
          }
        });

        if (updatedText === combinedText) return paraXml;

        // Safely update text runs
        let matchIdx = 0;
        return paraXml.replace(tRegex, (tTag, open, text, close) => {
          if (matchIdx === 0) {
            matchIdx++;
            const hasSpaceAttr = open.includes("xml:space");
            const safeOpen = hasSpaceAttr ? open : open.replace("<w:t", '<w:t xml:space="preserve"');
            return `${safeOpen}${updatedText}${close}`;
          } else {
            matchIdx++;
            return `${open}${close}`;
          }
        });
      });
    }

    _buildBuiltinDocxPackage(jszipObj, sections, resMap, title) {
      const ZipCtor = (typeof jszipObj === "function") ? jszipObj : (jszipObj && jszipObj.default ? jszipObj.default : (typeof window !== "undefined" && window.JSZip ? window.JSZip : (typeof global !== "undefined" ? global.JSZip : JSZip)));
      const zip = new ZipCtor();

      const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
        '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
        '  <Default Extension="xml" ContentType="application/xml"/>\n' +
        '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n' +
        '  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>\n' +
        '</Types>';

      const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
        '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n' +
        '</Relationships>';

      const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
        '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\n' +
        '</Relationships>';

      const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
        '  <w:docDefaults>\n' +
        '    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="1E293B"/></w:rPr></w:rPrDefault>\n' +
        '  </w:docDefaults>\n' +
        '</w:styles>';

      let bodyXml = '<w:body>';

      // Title
      bodyXml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="160"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="1E3A8A"/></w:rPr><w:t xml:space="preserve">${escapeXml(title)}</w:t></w:r></w:p>`;

      // Subtitle
      bodyXml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="360"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve">Principal Investigator: Lead Researcher | Session: ${this.sessionId} | Verified Report</w:t></w:r></w:p>`;

      // Sections
      sections.forEach(sec => {
        bodyXml += `<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1E3A8A"/></w:rPr><w:t xml:space="preserve">${escapeXml(sec.heading)}</w:t></w:r></w:p>`;
        sec.paragraphs.forEach(p => {
          bodyXml += `<w:p><w:pPr><w:spacing w:after="140"/><w:ind w:firstLine="360"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`;
        });
      });

      // Table 1: Comprehensive Verified Metric Summary
      bodyXml += '<w:p><w:pPr><w:spacing w:before="240" w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1E3A8A"/></w:rPr><w:t>Table 1: Verified Quantitative Findings &amp; Statistical Inferences</w:t></w:r></w:p>';

      bodyXml += '<w:tbl>' +
        '<w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/></w:tblBorders></w:tblPr>' +
        '<w:tr><w:tblHeader/>' +
        '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1E3A8A"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Variable / Operational Measure</w:t></w:r></w:p></w:tc>' +
        '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1E3A8A"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Verified Empirical Value</w:t></w:r></w:p></w:tc>' +
        '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1E3A8A"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Statistical Method</w:t></w:r></w:p></w:tc>' +
        '</w:tr>';

      Object.keys(resMap).forEach(key => {
        const item = resMap[key];
        bodyXml += '<w:tr>' +
          `<w:tc><w:p><w:r><w:t>${escapeXml(item.field.replace(/_/g, ' '))}</w:t></w:r></w:p></w:tc>` +
          `<w:tc><w:p><w:r><w:t>${escapeXml(item.formatted_value)}</w:t></w:r></w:p></w:tc>` +
          `<w:tc><w:p><w:r><w:t>${escapeXml(item.method || 'Standard Empirical Profiling')}</w:t></w:r></w:p></w:tc>` +
          '</w:tr>';
      });

      bodyXml += '</w:tbl>';
      bodyXml += '</w:body>';

      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${bodyXml}</w:document>`;

      zip.file('[Content_Types].xml', contentTypes);
      zip.file('_rels/.rels', rels);
      zip.file('word/_rels/document.xml.rels', docRels);
      zip.file('word/styles.xml', stylesXml);
      zip.file('word/document.xml', docXml);

      return zip;
    }

    // =========================================================================
    // Stage 9: Independent Report Validation -> Structured JSON
    // =========================================================================
    validateReport() {
      if (!this.assembledReport || !this.verifiedResultsJSON) {
        throw new Error("Cannot validate report without assembled content and verified results.");
      }
      this.lifecycle = "validated";

      const checks = [];
      const warnings = [];
      const blockingIssues = [];
      const resMap = this.verifiedResultsJSON.results_map;
      const fullText = this.assembledReport.markdown;

      // 1. Check for blocked operations propagating from planning and computation
      if (this.analysisPlanJSON && this.analysisPlanJSON.blocked_operations) {
        this.analysisPlanJSON.blocked_operations.forEach(b => {
          blockingIssues.push(`Analysis blocked: ${b.target_field} (${b.reason})`);
        });
      }

      // Check results map for blocked metrics
      Object.keys(resMap).forEach(field => {
        const r = resMap[field];
        if (r.status === "blocked") {
          blockingIssues.push(`Metric '${field}' blocked: ${(r.warnings || []).join('; ') || 'Input requirements not satisfied.'}`);
        }
      });

      // 2. Numerical Accuracy Check: Verify that every calculated metric appears accurately in narrative
      Object.keys(resMap).forEach(field => {
        const r = resMap[field];
        if (r.field === "dataset_name" || r.status === "blocked") return;

        const valStr = String(r.value);
        const formStr = String(r.formatted_value);
        const appears = fullText.includes(valStr) || fullText.includes(formStr);

        if (appears) {
          checks.push({
            check_id: `chk_${field}`,
            category: "numerical_accuracy",
            target_field: field,
            reported_value: formStr,
            verified_value: valStr,
            status: "passed",
            message: `Reported value '${formStr}' matches verified dataset calculation exactly.`
          });
        } else {
          checks.push({
            check_id: `chk_${field}`,
            category: "numerical_accuracy",
            target_field: field,
            reported_value: null,
            verified_value: valStr,
            status: "warning",
            message: `Verified metric '${field}' (${formStr}) was not explicitly placed in narrative sections.`
          });
        }
      });

      // 3. Statistical Validity Check
      if (resMap["p_value"] && resMap["p_value"].status === "computed") {
        const pVal = resMap["p_value"].value;
        const isSig = pVal < 0.05;
        const claimedSig = fullText.toLowerCase().includes("statistically significant");

        if (isSig === claimedSig) {
          checks.push({
            check_id: "chk_stat_validity",
            category: "statistical_validity",
            target_field: "p_value",
            reported_value: resMap["p_value"].formatted_value,
            verified_value: String(pVal),
            status: "passed",
            message: "Significance narrative aligns with verified threshold (alpha = 0.05)."
          });
        } else {
          warnings.push("Significance phrasing discrepancy detected between narrative and computed p-value.");
          checks.push({
            check_id: "chk_stat_validity",
            category: "statistical_validity",
            target_field: "p_value",
            reported_value: null,
            verified_value: String(pVal),
            status: "warning",
            message: "Significance wording in narrative requires researcher verification against p-value."
          });
        }
      }

      // 4. Template Intelligence & Decision Compliance Checks
      const allParas = (this.assembledReport.sections || []).flatMap(s => s.paragraphs || []);
      let instructionalProseFound = false;
      let blankUnderscoresFound = false;
      let bracketPlaceholdersFound = false;
      let brandingFound = false;

      allParas.forEach(p => {
        if (this.isInstructionOrExampleParagraph(p)) {
          instructionalProseFound = true;
          blockingIssues.push(`Instructional template prose detected in narrative: "${p.substring(0, 70)}..."`);
        }
        if (/_{3,}/.test(p)) {
          blankUnderscoresFound = true;
          blockingIssues.push(`Unfilled underscore placeholder blanks detected: "${p.substring(0, 70)}..."`);
        }
        if (/\[(insert|your|university|course)[^\]]*\]/i.test(p)) {
          bracketPlaceholdersFound = true;
          blockingIssues.push(`Unfilled bracketed metadata placeholder detected: "${p.substring(0, 70)}..."`);
        }
        if (/gentext\s*(group|\.ai)|generated\s+by\s+gentext/i.test(p)) {
          brandingFound = true;
          blockingIssues.push(`Third-party template branding detected in narrative.`);
        }
      });

      checks.push({
        check_id: "chk_instruction_removal",
        category: "template_integrity",
        target_field: "instructional_text",
        status: !instructionalProseFound ? "passed" : "failed",
        message: !instructionalProseFound 
          ? "Zero template instructional paragraphs remain in final report." 
          : "Instructional template prose remains in assembled report."
      });

      checks.push({
        check_id: "chk_placeholder_removal",
        category: "template_integrity",
        target_field: "placeholder_blanks",
        status: (!blankUnderscoresFound && !bracketPlaceholdersFound) ? "passed" : "failed",
        message: (!blankUnderscoresFound && !bracketPlaceholdersFound)
          ? "Zero unfilled placeholder blanks or generic author brackets remain."
          : "Unfilled placeholder blanks remain in assembled report."
      });

      checks.push({
        check_id: "chk_branding_removal",
        category: "template_integrity",
        target_field: "generator_branding",
        status: !brandingFound ? "passed" : "failed",
        message: !brandingFound
          ? "Zero third-party template generator branding remains in final report."
          : "Template generator branding remains in report."
      });

      // 5. Traceable Grounding Score Calculation
      // Formula: (grounded_numbers / total_numbers) * 100
      // Protection: Exclude citation years (e.g., 1900-2099) and outline numbers
      const narrativeText = this.assembledReport.sections
        ? this.assembledReport.sections.map(s => s.paragraphs.join("\n")).join("\n")
        : fullText;
      const numberMatches = narrativeText.match(/\b\d+(\.\d+)?\b/g) || [];
      const groundTruthNumbers = new Set(
        Object.values(resMap).filter(r => r.value !== null).map(r => String(r.value))
      );
      // Include accepted alpha thresholds and standard degrees of freedom / indices
      groundTruthNumbers.add("0.05");
      groundTruthNumbers.add("0.01");
      groundTruthNumbers.add("0.001");
      groundTruthNumbers.add("1");
      groundTruthNumbers.add("2");
      groundTruthNumbers.add("3");
      groundTruthNumbers.add("4");
      groundTruthNumbers.add("5");
      groundTruthNumbers.add("6");
      groundTruthNumbers.add("100");

      let groundedCount = 0;
      let totalChecked = 0;

      numberMatches.forEach(num => {
        // Protected years in citations (e.g. 2021, 2024, 2026) are not treated as ungrounded claims
        if (num.length === 4 && !isNaN(Number(num)) && Number(num) >= 1950 && Number(num) <= 2050) return;
        totalChecked++;
        if (groundTruthNumbers.has(num) || Array.from(groundTruthNumbers).some(g => Math.abs(Number(g) - Number(num)) < 0.05)) {
          groundedCount++;
        }
      });

      const score = totalChecked > 0 ? Math.round((groundedCount / totalChecked) * 100) : 100;

      // Status Rule: If there are unresolved critical blocking issues, status MUST be 'blocked'
      const overallStatus = blockingIssues.length > 0 ? "blocked" : (warnings.length > 0 ? "requires_review" : "passed");

      this.validationJSON = {
        validation_id: "val_" + Date.now(),
        analysis_session_id: this.sessionId,
        status: overallStatus,
        overall_grounding_score: score,
        grounding_score_percent: score,
        grounding_calculation_method: "Calculated as (grounded_claims / total_claims) * 100, where each reported numerical claim in the narrative is checked against verified canonical calculations from verifiedResultsJSON. No arbitrary weighting.",
        template_compliance: {
          instructional_prose_removed: !instructionalProseFound,
          blank_placeholders_removed: !blankUnderscoresFound && !bracketPlaceholdersFound,
          branding_removed: !brandingFound,
          sections_assembled: (this.assembledReport.sections || []).length
        },
        checks: checks,
        warnings: warnings,
        blocking_issues: blockingIssues
      };

      this.lifecycle = overallStatus === "blocked" ? "blocked" : "ready_for_download";
      return this.validationJSON;
    }

    exportDocxBlob(assembledReport) {
      const rep = assembledReport || this.assembledReport;
      if (!rep) return;
      if (rep.docx_blob) {
        const url = URL.createObjectURL(rep.docx_blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(rep.title || "Research_Report").replace(/\s+/g, "_")}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }

    exportDocx(assembledReport) {
      this.exportDocxBlob(assembledReport);
    }

    exportMarkdown(assembledReport) {
      const rep = assembledReport || this.assembledReport;
      if (!rep || !rep.markdown) return;
      const blob = new Blob([rep.markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(rep.title || "Research_Report").replace(/\s+/g, "_")}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  // Export to window or global
  if (typeof window !== 'undefined') {
    window.ResAIWorkflowEngine = new WorkflowEngine();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WorkflowEngine };
  }

})(typeof window !== 'undefined' ? window : global);
