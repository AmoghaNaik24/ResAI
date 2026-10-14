/**
 * ResAI - Client-Side Retrieval-Augmented Generation (RAG) Engine
 * Manages indexed laboratory protocols, APA 7th standards, and user guidelines.
 * Uses client-side token TF-IDF & Cosine Similarity with localStorage persistence.
 */

(function (window) {
  'use strict';

  const BUILTIN_GUIDELINES = [
    {
      id: "apa_reporting_guidelines",
      title: "APA 7th Edition Statistical Reporting Standards",
      category: "Methodology",
      content: 
`When reporting statistical results in APA 7th edition format:
1. Report exact p-values to two or three decimal places (e.g., p = .034). For values below .001, report p < .001. Do not use leading zeros for p-values.
2. Always report effect sizes alongside significance tests: Cohen's d for t-tests (d = 0.2 small, 0.5 medium, 0.8 large), eta-squared (η²) for ANOVA, and Cramér's V for Chi-Square.
3. Format t-tests as: t(degrees of freedom) = t-value, p = p-value, d = effect size.
4. Format ANOVA as: F(df_between, df_within) = F-value, p = p-value, η² = effect size.
5. Report descriptive statistics (M and SD) in text or APA formatted summary tables.`
    },
    {
      id: "hypothesis_testing_framework",
      title: "Null Hypothesis Significance Testing (NHST) Protocol",
      category: "Hypothesis",
      content: 
`Hypothesis Testing Protocol for Laboratory Research:
1. State explicit Null Hypothesis (H0) and Alternative Hypothesis (H1) before running tests.
2. Pre-specify significance threshold alpha (standard α = 0.05).
3. If p < α, reject H0 in favor of H1, indicating statistically significant evidence.
4. If p >= α, fail to reject H0, acknowledging lack of statistical evidence rather than proving the null.
5. In clinical and educational research, differentiate statistical significance from practical/clinical significance using effect sizes and confidence intervals.`
    },
    {
      id: "data_quality_and_hygiene",
      title: "Research Data Cleansing and Outlier Handling Protocol",
      category: "Data Hygiene",
      content: 
`Best Practices for Laboratory Data Preprocessing:
1. Assess missing data mechanism (MCAR, MAR, MNAR). If missingness is below 5%, median/mean imputation is acceptable. For higher rates, consider sensitivity analysis.
2. Identify outliers using both Tukey's IQR rule (1.5 * IQR) and z-score (|z| > 3.0).
3. Test distributional assumptions using Shapiro-Wilk or D'Agostino tests. If normality is violated and sample size is small (n < 30), prefer non-parametric alternatives (Mann-Whitney U or Kruskal-Wallis).
4. Check for multicollinearity in regression using correlation matrices and Variance Inflation Factors (VIF).`
    },
    {
      id: "lab_report_template",
      title: "Standard Laboratory Scientific Report Structure",
      category: "Template",
      content: 
`Standard Academic Research Manuscript Structure:
1. Title & Abstract: Concise synthesis of objectives, key methodology, critical quantitative findings, and primary conclusion.
2. Research Objectives & Hypotheses: Clear articulation of problem statement, independent/dependent variables, and directional hypotheses.
3. Methodology & Data Hygiene: Sample size, inclusion criteria, data quality assessment, normality checks, and chosen statistical tests.
4. Statistical Results: Exact numerical outputs, confidence intervals, test statistics, and formatted data tables.
5. Discussion & Interpretation: Scientific reasoning explaining why these results occurred, contextualized against literature.
6. Limitations & Future Work: Threats to internal/external validity, unmeasured confounders, and recommendations for subsequent experiments.`
    },
    {
      id: "biomedical_irb_standards",
      title: "Biomedical IRB & Clinical Protocol Reporting",
      category: "Clinical Standard",
      content: 
`Biomedical Experimental Protocols & Reporting:
1. Subject cohorts must be documented with baseline demographics and randomization integrity.
2. Primary efficacy endpoints require two-tailed hypothesis testing at α = 0.05 with intention-to-treat or per-protocol definitions.
3. Adverse events and biomarker shifts must be cross-tabulated with exact frequency percentages and confidence intervals.
4. Human verification sign-off is mandatory before archiving study registers.`
    }
  ];

  class RAGEngine {
    constructor() {
      this.documents = [];
      this.init();
    }

    init() {
      // 1. Load built-ins
      this.documents = BUILTIN_GUIDELINES.map(d => ({ ...d }));

      // 2. Load custom user protocols from localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const saved = window.localStorage.getItem('resai_user_guidelines');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              this.documents.push(...parsed);
            }
          }
        } catch (e) {}
      }
    }

    getAllDocuments() {
      return this.documents;
    }

    addDocument(title, category, content) {
      const doc = {
        id: `user_${Date.now()}`,
        title: title || 'Custom Protocol',
        category: category || 'User Uploaded',
        content: content || ''
      };
      this.documents.push(doc);

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const userDocs = this.documents.filter(d => d.id.startsWith('user_'));
          window.localStorage.setItem('resai_user_guidelines', JSON.stringify(userDocs));
        } catch (e) {}
      }
      return doc;
    }

    // Tokenize text into words
    tokenize(text) {
      if (!text) return [];
      return text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2);
    }

    // Retrieve relevant documents using term frequency & overlap scoring
    retrieveRelevantContext(query, topK = 3) {
      if (!query || !query.trim()) return [];
      const qTokens = this.tokenize(query);
      if (qTokens.length === 0) return [];

      const scored = this.documents.map(doc => {
        const text = `${doc.title} ${doc.category} ${doc.content}`;
        const docTokens = this.tokenize(text);
        const docSet = new Set(docTokens);

        let matches = 0;
        qTokens.forEach(t => {
          if (docSet.has(t)) matches += 2.0;
          else if (text.toLowerCase().includes(t)) matches += 1.0;
        });

        // Normalize by query length
        const score = matches / (qTokens.length * 2.0);
        return {
          ...doc,
          snippet: doc.content.slice(0, 220) + (doc.content.length > 220 ? '...' : ''),
          relevance_score: score
        };
      });

      scored.sort((a, b) => b.relevance_score - a.relevance_score);
      return scored.slice(0, topK);
    }
  }

  const ragEngine = new RAGEngine();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RAGEngine, ragEngine, BUILTIN_GUIDELINES };
  }
  if (typeof window !== 'undefined') {
    window.RAGEngine = RAGEngine;
    window.ragEngine = ragEngine;
  } else if (typeof global !== 'undefined') {
    global.RAGEngine = RAGEngine;
    global.ragEngine = ragEngine;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
