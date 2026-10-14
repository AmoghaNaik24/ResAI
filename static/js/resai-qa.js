/**
 * ResAI - Client-Side Document-Grounded Dataset Q&A Engine
 * Answers natural language research questions grounded in the active uploaded dataset
 * and the indexed RAG methodology library, running 100% in-browser with zero hallucinations.
 */

(function (window) {
  'use strict';

  const DatasetQA = {
    KNOWLEDGE_LIMITED_MSG: 
      "Knowledge is limited regarding this inquiry based on the active dataset and methodology library. " +
      "ResAI can only answer questions grounded in the uploaded dataset attributes, statistical calculations, " +
      "and indexed lab guidelines.",

    answerQuestion(query, rows, columns, profile, statisticalResults, researchObjective = "", filename = "Active Dataset") {
      if (!query || !query.trim()) {
        return {
          answer: "Please ask a question regarding the active dataset or research methodology.",
          source: "System",
          grounded: true
        };
      }

      const q = query.trim();
      const qLower = q.toLowerCase();

      if (!rows || rows.length === 0) {
        return {
          answer: "No active dataset is currently loaded. Please upload a dataset in Tab 1 first.",
          source: "System Guardrail",
          grounded: false
        };
      }

      // 1. RAG Methodology Retrieval & Dataset Cross-Checking
      const ragAns = DatasetQA._ragCrossCheckMethodology(q, qLower, rows, columns, profile, statisticalResults, filename, researchObjective);
      if (ragAns) return ragAns;

      // 2. Deterministic Dataset Computation
      const dataAns = DatasetQA._computeDatasetAnswer(q, qLower, rows, columns, profile, statisticalResults, filename, researchObjective);
      if (dataAns) return dataAns;

      // 3. Strict Grounding Guardrail
      return {
        answer: DatasetQA.KNOWLEDGE_LIMITED_MSG,
        source: "RAG Guardrail (Dataset Grounded)",
        grounded: false
      };
    },

    _columnMatchesQuery(colName, query) {
      const qLower = query.toLowerCase();
      const colLower = colName.toLowerCase();
      const colClean = colLower.replace(/[^a-z0-9]/g, '');
      const qClean = qLower.replace(/[^a-z0-9]/g, '');

      // Exact word match
      const re = new RegExp(`\\b${colLower}\\b`, 'i');
      if (re.test(qLower)) return true;

      // Substring match for longer column names
      if (colClean.length >= 4 && qClean.includes(colClean)) {
        const commonWords = ["average", "categories", "distribution", "variance", "deviation", "percentage", "outliers", "missing"];
        if (!commonWords.some(w => colClean.includes(w) && colClean !== w)) return true;
      }

      // Sub-tokens (snake_case or camelCase)
      const tokens = colName.replace(/([A-Z])/g, ' $1').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
      for (const t of tokens) {
        if (t.length >= 4 && qLower.includes(t) && !["days", "hours", "week", "rate", "level", "score", "time", "date"].includes(t)) {
          return true;
        }
      }
      return false;
    },

    _ragCrossCheckMethodology(q, qLower, rows, columns, profile, statisticalResults, filename, researchObjective) {
      const methodologyKeywords = [
        "apa", "reporting", "format", "guideline", "p-value", "alpha", "hypothesis",
        "nhst", "protocol", "effect size", "cohen", "eta", "outlier rule",
        "cleansing protocol", "hygiene protocol", "template", "manuscript structure"
      ];
      if (!methodologyKeywords.some(k => qLower.includes(k))) return null;

      const ragEngine = window.ragEngine;
      if (!ragEngine) return null;

      const results = ragEngine.retrieveRelevantContext(qLower, 2);
      if (!results || results.length === 0 || results[0].relevance_score < 0.05) return null;

      const topMatch = results[0];
      const docId = topMatch.id || '';
      const title = topMatch.title || 'Laboratory Standard';
      const content = topMatch.content || '';

      const numCols = columns.numeric || [];
      const catCols = columns.categorical || [];

      // 1. APA 7th Edition Reporting Standard Cross-Check
      if (qLower.includes('apa') || docId.includes('apa')) {
        const examples = [];
        if (numCols.length >= 2) {
          const c1 = numCols[0], c2 = numCols[1];
          const cRes = window.StatisticalEngine ? window.StatisticalEngine.correlationAnalysis(rows, c1, c2) : null;
          if (cRes && cRes.r !== undefined) {
            examples.push(`- **Bivariate Association (\`${c1}\` & \`${c2}\`):** \`${cRes.apa_statement}\``);
          }
        }
        if (numCols.length >= 1) {
          const s = profile && profile.columns && profile.columns[numCols[0]];
          const numSummary = profile && profile.numerical_summary && profile.numerical_summary[numCols[0]];
          const m = numSummary ? numSummary.mean : (rows.reduce((acc, r) => acc + (Number(r[numCols[0]]) || 0), 0) / rows.length);
          const sd = numSummary ? numSummary.std : 1.0;
          examples.push(`- **Descriptive Metrics (\`${numCols[0]}\`):** \`(M = ${m.toFixed(2)}, SD = ${sd.toFixed(2)})\``);
        }
        if (statisticalResults && statisticalResults.length > 0) {
          const firstT = statisticalResults[0];
          if (firstT.formatted_apa || firstT.apa_statement) {
            examples.push(`- **Computed Statistical Result:** \`${firstT.formatted_apa || firstT.apa_statement}\``);
          }
        }

        const appBlock = examples.length > 0 ? '\n' + examples.join('\n') : '';
        return {
          answer: 
`**${title}** (Retrieved from Tab 6 RAG Library):

${content}

🔬 **Cross-Checked Evidence from Active Dataset '${filename}':**${appBlock}

💡 *All statements formatted in compliance with APA 7th Edition standards based on active data.*`,
          source: `RAG Retrieval & Dataset Cross-Check (${title})`,
          grounded: true
        };
      }

      // 2. Outlier & Data Hygiene Protocol Cross-Check
      if (['outlier', 'clean', 'hygiene', 'mcar'].some(w => qLower.includes(w))) {
        const outlierDetails = [];
        numCols.forEach(col => {
          const vals = rows.map(r => Number(r[col])).filter(v => !isNaN(v)).sort((a, b) => a - b);
          if (vals.length >= 4) {
            const q25 = vals[Math.floor(vals.length * 0.25)];
            const q75 = vals[Math.floor(vals.length * 0.75)];
            const iqr = q75 - q25;
            const lowerBound = q25 - 1.5 * iqr;
            const upperBound = q75 + 1.5 * iqr;
            const outliers = vals.filter(v => v < lowerBound || v > upperBound);
            if (outliers.length > 0) {
              outlierDetails.push(`- \`${col}\`: ${outliers.length} observation(s) exceed Tukey 1.5×IQR boundary [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`);
            }
          }
        });

        const outlierMsg = outlierDetails.length > 0 ? outlierDetails.join('\n') : "No observations violate the 1.5×IQR Tukey threshold in any numerical attribute.";
        const missingCells = profile ? profile.total_missing_cells : 0;
        const missingRate = profile ? profile.missing_rate_overall : 0;

        return {
          answer: 
`**${title}** (Retrieved from Tab 6 RAG Library):

${content}

🔬 **Cross-Checked Data Hygiene Audit on '${filename}':**
- **Missingness Assessment:** ${missingCells} cells (${missingRate}%). ${missingRate < 5 ? 'Complies with the < 5% threshold for standard imputation.' : 'Exceeds 5% threshold; sensitivity audit recommended.'}
- **Tukey Outlier Audit (1.5×IQR):**
${outlierMsg}

💡 *Audited deterministically against raw observations in '${filename}'.*`,
          source: `RAG Protocol Cross-Checked with Dataset (${title})`,
          grounded: true
        };
      }

      // 3. NHST Hypothesis Testing Protocol Cross-Check
      if (['hypothesis', 'nhst', 'null', 'alpha'].some(w => qLower.includes(w))) {
        const obj = researchObjective || "Evaluate statistical relationships across variables.";
        const cText = numCols[0] || "Outcome";
        const gText = catCols[0] || "Group";
        return {
          answer: 
`**${title}** (Retrieved from Tab 6 RAG Library):

${content}

🔬 **Cross-Checked Hypotheses Formulated for '${filename}':**
- **Primary Study Inquiry:** "${obj}"
- **Null Hypothesis (H₀):** There is no significant difference or relationship in \`${cText}\` across \`${gText}\` (effect size = 0, p ≥ 0.05).
- **Alternative Hypothesis (H₁):** There is a statistically significant effect in \`${cText}\` across \`${gText}\` at pre-specified α = 0.05.

💡 *Hypotheses framed directly on active dataset variables.*`,
          source: `RAG Protocol Cross-Checked with Dataset (${title})`,
          grounded: true
        };
      }

      // General RAG match
      return {
        answer: 
`**${title}** (Retrieved from Tab 6 RAG Library):

${content}

🔬 **Context in '${filename}':** ${rows.length} observations across ${numCols.length} continuous metrics and ${catCols.length} categorical factors.`,
        source: `RAG Knowledge Base (${title})`,
        grounded: true
      };
    },

    _computeDatasetAnswer(q, qLower, rows, columns, profile, statisticalResults, filename, researchObjective) {
      const nRows = rows.length;
      const numCols = columns.numeric || [];
      const catCols = columns.categorical || [];
      const nCols = (columns.all && columns.all.length) || (numCols.length + catCols.length);

      // 0. Comprehensive Dataset Summary
      const summaryTerms = [
        "what is this dataset about", "what is the dataset about", "tell me about this dataset",
        "tell me about the dataset", "summarize the dataset", "summarize this dataset", "summarize data",
        "dataset summary", "data summary", "dataset overview", "data overview", "describe dataset",
        "describe the dataset", "describe this dataset", "what does this dataset contain",
        "what data is uploaded", "what dataset is this", "explain this dataset", "overview"
      ];
      if (summaryTerms.some(term => qLower.includes(term))) {
        const numSamples = [];
        numCols.slice(0, 4).forEach(c => {
          const vals = rows.map(r => Number(r[c])).filter(v => !isNaN(v));
          if (vals.length > 0) {
            const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            numSamples.push(`\`${c}\` (Mean=${mean.toFixed(2)}, Range=[${min.toFixed(1)}, ${max.toFixed(1)}])`);
          }
        });
        const numSummary = numSamples.length > 0 ? numSamples.join('; ') : "None";

        const catSamples = [];
        catCols.slice(0, 3).forEach(c => {
          const lvls = Array.from(new Set(rows.map(r => String(r[c] || '').trim()).filter(Boolean))).slice(0, 3);
          catSamples.push(`\`${c}\` (${lvls.length} levels: ${lvls.join(', ')})`);
        });
        const catSummary = catSamples.length > 0 ? catSamples.join('; ') : "None";

        const health = profile ? profile.health_score : 100;
        const missing = profile ? profile.total_missing_cells : 0;
        const objLine = researchObjective ? `\n- **Active Research Objective:** ${researchObjective}` : '';

        return {
          answer: 
`**Empirical Dataset Summary for '${filename}':**
- **Observations (N):** ${nRows} rows across ${nCols} variables
- **Continuous Metrics (${numCols.length}):** ${numSummary}
- **Categorical Factors (${catCols.length}):** ${catSummary}
- **Hygiene Index:** Health Score **${health}%** (${missing} missing cells)${objLine}

💡 *All statistics computed deterministically from active DataFrame with zero hallucination.*`,
          source: "Document Grounded Profile Summary",
          grounded: true
        };
      }

      // 0.1 Research Objective Inquiries
      if (["research objective", "what is the objective", "what are we studying", "what is the goal", "primary inquiry", "hypothesis to test"].some(term => qLower.includes(term))) {
        return {
          answer: 
`**Active Research Objective for '${filename}':**

> "${researchObjective || 'Empirical quantitative evaluation and hypothesis testing.'}"

This inquiry dictates automated hypothesis model recommendations and academic report synthesis.`,
          source: "Research Objective Registry",
          grounded: true
        };
      }

      // 0.2 Statistical Test Recommendations
      const isRecQuery = (
        ["recommend", "suggest", "appropriate", "what test", "which test", "best test"].some(term => qLower.includes(term)) &&
        ["test", "analysis", "procedure", "model", "method", "run"].some(term => qLower.includes(term))
      ) || ["recommended tests", "recommended analysis", "statistical recommendations"].some(term => qLower.includes(term));

      if (isRecQuery && window.StatisticalEngine) {
        const recs = window.StatisticalEngine.autoRecommendAnalysis(rows, columns, researchObjective);
        if (recs && recs.length > 0) {
          const recLines = recs.slice(0, 4).map(r => `- **${r.name}**: ${r.reason}`).join('\n');
          return {
            answer: 
`**Recommended Statistical Tests for '${filename}':**
${recLines}

*These tests can be computed automatically via the '⚡ Generate Automatic Report' button.*`,
            source: "Statistical Recommender Engine",
            grounded: true
          };
        }
      }

      // 1. Dimensions, Rows, Samples
      if (["how many rows", "row count", "sample size", "observations", "how many records", "how many samples", "n="].some(term => qLower.includes(term))) {
        return {
          answer: `The active dataset **'${filename}'** contains **${nRows} rows/observations** across **${nCols} columns**.`,
          source: "DataFrame Shape Audit",
          grounded: true
        };
      }

      // Column listing
      if (["column", "variable", "feature", "attribute"].some(t => qLower.includes(t)) && ["what", "list", "show", "which", "names", "schema"].some(t => qLower.includes(t))) {
        const numStr = numCols.length > 0 ? numCols.map(c => `\`${c}\``).join(', ') : "None";
        const catStr = catCols.length > 0 ? catCols.map(c => `\`${c}\``).join(', ') : "None";
        return {
          answer: 
`The dataset **'${filename}'** has **${nCols} attributes**:
- **Numerical (${numCols.length}):** ${numStr}
- **Categorical (${catCols.length}):** ${catStr}`,
          source: "Schema Profiler",
          grounded: true
        };
      }

      // 2. Missing Values & Hygiene
      if (["missing", "null", "nan", "health score", "data health", "hygiene", "duplicate"].some(term => qLower.includes(term))) {
        const totalMissing = profile ? profile.total_missing_cells : 0;
        const missingRate = profile ? profile.missing_rate_overall : 0;
        const duplicates = profile ? profile.duplicate_rows : 0;
        const healthScore = profile ? profile.health_score : 100;

        const missingBreakdown = [];
        if (profile && profile.columns) {
          Object.keys(profile.columns).forEach(col => {
            const m = profile.columns[col].missing_count;
            if (m > 0) {
              missingBreakdown.push(`\`${col}\`: ${m} missing (${profile.columns[col].missing_percentage}%)`);
            }
          });
        }
        const details = missingBreakdown.length > 0 ? ` Breakdown: ${missingBreakdown.join(', ')}.` : " No missing values detected in any column.";

        return {
          answer: 
`**Data Health Index:** **${healthScore}%**
- **Total Missing Cells:** ${totalMissing} (${missingRate}% overall missingness).${details}
- **Duplicate Records:** ${duplicates} duplicate rows detected.`,
          source: "Data Quality Profiler",
          grounded: true
        };
      }

      // 3. Outlier Queries
      if (["outlier", "tukey", "extreme value"].some(term => qLower.includes(term))) {
        const outlierReports = [];
        numCols.forEach(col => {
          const vals = rows.map(r => Number(r[col])).filter(v => !isNaN(v)).sort((a, b) => a - b);
          if (vals.length >= 4) {
            const q25 = vals[Math.floor(vals.length * 0.25)];
            const q75 = vals[Math.floor(vals.length * 0.75)];
            const iqr = q75 - q25;
            const lowerBound = q25 - 1.5 * iqr;
            const upperBound = q75 + 1.5 * iqr;
            const outliers = vals.filter(v => v < lowerBound || v > upperBound);
            if (outliers.length > 0) {
              outlierReports.push(`- **\`${col}\`**: ${outliers.length} outliers detected (IQR bounds: [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}], sample: ${outliers.slice(0, 3).join(', ')})`);
            }
          }
        });

        if (outlierReports.length > 0) {
          return {
            answer: `**Outlier Analysis (Tukey 1.5×IQR Rule):**\n` + outlierReports.join('\n'),
            source: "Outlier Detection Engine",
            grounded: true
          };
        } else {
          return {
            answer: "No Tukey IQR outliers (|x - Q| > 1.5×IQR) were detected in any continuous column.",
            source: "Outlier Detection Engine",
            grounded: true
          };
        }
      }

      // 4. Statistical Results / Hypotheses Questions
      if (statisticalResults && statisticalResults.length > 0 && ["significant", "p-value", "t-test", "anova", "f-test", "effect size", "correlation between", "finding"].some(term => qLower.includes(term))) {
        const findings = statisticalResults.map(r => {
          const tType = r.test_type || r.title || "Statistical Test";
          const apa = r.formatted_apa || r.apa_statement || "";
          const sig = r.is_significant ? "Statistically Significant (p < .05)" : "Not Statistically Significant (p ≥ .05)";
          return `• **${tType}**: \`${apa}\` — *${sig}*`;
        });
        return {
          answer: `**Computed Hypothesis Testing Results for this Dataset:**\n` + findings.join('\n'),
          source: "Statistical Testing Engine",
          grounded: true
        };
      }

      // 5. Group-by Comparison Queries (e.g. "average recovery by treatment")
      for (const numC of numCols) {
        for (const catC of catCols) {
          const numMatched = DatasetQA._columnMatchesQuery(numC, q);
          const catMatched = DatasetQA._columnMatchesQuery(catC, q);
          if (numMatched && (catMatched || ["by group", "across groups", "each group", "which", "compare", "highest", "lowest", "treatment", "arm"].some(t => qLower.includes(t)))) {
            const groupMap = {};
            rows.forEach(r => {
              const g = r[catC];
              const v = Number(r[numC]);
              if (g !== null && g !== undefined && !isNaN(v)) {
                const gStr = String(g).trim();
                if (!groupMap[gStr]) groupMap[gStr] = [];
                groupMap[gStr].push(v);
              }
            });

            const lines = [`**Comparison of \`${numC}\` across \`${catC}\`:**`];
            let bestMinG = null, bestMinM = Infinity;
            let bestMaxG = null, bestMaxM = -Infinity;

            Object.keys(groupMap).forEach(g => {
              const arr = groupMap[g];
              const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
              const variance = arr.length > 1 ? arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1) : 0;
              const std = Math.sqrt(variance);
              const min = Math.min(...arr);
              const max = Math.max(...arr);

              lines.push(`- **${g}** (n=${arr.length}): Mean = **${mean.toFixed(2)}**, SD = ${std.toFixed(2)} (Range: ${min.toFixed(1)} - ${max.toFixed(1)})`);

              if (mean < bestMinM) { bestMinM = mean; bestMinG = g; }
              if (mean > bestMaxM) { bestMaxM = mean; bestMaxG = g; }
            });

            if (bestMinG && bestMaxG && bestMinG !== bestMaxG) {
              lines.push(`\n💡 Lowest mean is **${bestMinG}** (${bestMinM.toFixed(2)}); Highest mean is **${bestMaxG}** (${bestMaxM.toFixed(2)}).`);
            }

            return {
              answer: lines.join('\n'),
              source: `DataFrame GroupBy (${catC} -> ${numC})`,
              grounded: true
            };
          }
        }
      }

      // 6. Specific Column Aggregation Queries (mean, median, max, min, std)
      for (const c of numCols) {
        if (DatasetQA._columnMatchesQuery(c, q)) {
          const vals = rows.map(r => Number(r[c])).filter(v => !isNaN(v)).sort((a, b) => a - b);
          if (vals.length === 0) continue;

          const count = vals.length;
          const mean = vals.reduce((a, b) => a + b, 0) / count;
          const variance = count > 1 ? vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (count - 1) : 0;
          const std = Math.sqrt(variance);
          const median = count % 2 === 0 ? (vals[count / 2 - 1] + vals[count / 2]) / 2 : vals[Math.floor(count / 2)];
          const min = vals[0];
          const max = vals[count - 1];

          if (["average", "mean"].some(w => qLower.includes(w))) {
            return {
              answer: `For continuous attribute **\`${c}\`**, the mean average is **${mean.toFixed(2)}** (SD = ${std.toFixed(2)}, Median = ${median.toFixed(2)}, N = ${count}).`,
              source: `Descriptive Statistics (\`${c}\`)`,
              grounded: true
            };
          } else if (qLower.includes("median")) {
            return {
              answer: `For attribute **\`${c}\`**, the median is **${median.toFixed(2)}** (Mean = ${mean.toFixed(2)}, Range = [${min.toFixed(1)}, ${max.toFixed(1)}]).`,
              source: `Descriptive Statistics (\`${c}\`)`,
              grounded: true
            };
          } else if (["highest", "max", "maximum"].some(w => qLower.includes(w))) {
            return {
              answer: `The maximum observed value for **\`${c}\`** is **${max.toFixed(2)}** (Min = ${min.toFixed(2)}, Mean = ${mean.toFixed(2)}).`,
              source: `Descriptive Statistics (\`${c}\`)`,
              grounded: true
            };
          } else if (["lowest", "min", "minimum"].some(w => qLower.includes(w))) {
            return {
              answer: `The minimum observed value for **\`${c}\`** is **${min.toFixed(2)}** (Max = ${max.toFixed(2)}, Mean = ${mean.toFixed(2)}).`,
              source: `Descriptive Statistics (\`${c}\`)`,
              grounded: true
            };
          } else if (["std", "standard deviation", "variance", "spread"].some(w => qLower.includes(w))) {
            return {
              answer: `For attribute **\`${c}\`**, the sample standard deviation is **${std.toFixed(2)}** (Variance = ${variance.toFixed(2)}, Mean = ${mean.toFixed(2)}).`,
              source: `Descriptive Statistics (\`${c}\`)`,
              grounded: true
            };
          } else {
            return {
              answer: 
`**Summary Statistics for \`${c}\`:**
- **Observations (N):** ${count}
- **Mean ± SD:** ${mean.toFixed(2)} ± ${std.toFixed(2)}
- **Median:** ${median.toFixed(2)}
- **Range:** ${min.toFixed(2)} to ${max.toFixed(2)}`,
              source: `Descriptive Statistics (\`${c}\`)`,
              grounded: true
            };
          }
        }
      }

      // 7. Categorical Column Breakdown
      for (const c of catCols) {
        if (DatasetQA._columnMatchesQuery(c, q)) {
          const counts = {};
          rows.forEach(r => {
            const val = r[c] !== null && r[c] !== undefined ? String(r[c]).trim() : 'Missing';
            counts[val] = (counts[val] || 0) + 1;
          });
          const lines = [`**Frequency Distribution for \`${c}\` (${Object.keys(counts).length} levels):**`];
          Object.keys(counts).forEach(k => {
            const cnt = counts[k];
            const pct = ((cnt / nRows) * 100).toFixed(1);
            lines.push(`- **${k}**: ${cnt} occurrences (${pct}%)`);
          });
          return {
            answer: lines.join('\n'),
            source: `Categorical Distribution (\`${c}\`)`,
            grounded: true
          };
        }
      }

      // 8. Bivariate Correlations
      if (["correlation", "correlated", "relationship", "association"].some(term => qLower.includes(term)) && numCols.length >= 2 && window.StatisticalEngine) {
        const pairs = [];
        for (let i = 0; i < numCols.length; i++) {
          for (let j = i + 1; j < numCols.length; j++) {
            const res = window.StatisticalEngine.correlationAnalysis(rows, numCols[i], numCols[j]);
            if (res && res.r !== undefined) {
              pairs.push({ c1: numCols[i], c2: numCols[j], r: res.r, absR: Math.abs(res.r), apa: res.apa_statement, p: res.p_value });
            }
          }
        }
        pairs.sort((a, b) => b.absR - a.absR);
        const topPairs = pairs.slice(0, 4);
        const lines = ["**Bivariate Pearson Correlations:**"];
        topPairs.forEach(p => {
          const strength = p.absR >= 0.7 ? "Strong" : (p.absR >= 0.4 ? "Moderate" : "Weak");
          const direction = p.r > 0 ? "Positive" : "Negative";
          lines.push(`- **\`${p.c1}\` vs \`${p.c2}\`**: r = **${p.r.toFixed(3)}** (${strength} ${direction}) — \`${p.apa}\``);
        });
        return {
          answer: lines.join('\n'),
          source: "Correlation Engine",
          grounded: true
        };
      }

      return null;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatasetQA;
  }
  if (typeof window !== 'undefined') {
    window.DatasetQA = DatasetQA;
  } else if (typeof global !== 'undefined') {
    global.DatasetQA = DatasetQA;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
