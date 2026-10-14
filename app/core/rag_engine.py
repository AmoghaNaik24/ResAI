import os
import json
import re
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.config import METHODOLOGY_DIR

# Default methodology seeds
BUILTIN_GUIDELINES = [
    {
        "id": "apa_reporting_guidelines",
        "title": "APA 7th Edition Statistical Reporting Standards",
        "category": "Methodology",
        "content": (
            "When reporting statistical results in APA 7th edition format:\n"
            "1. Report exact p-values to two or three decimal places (e.g., p = .034). For values below .001, report p < .001. Do not use leading zeros for p-values.\n"
            "2. Always report effect sizes alongside significance tests: Cohen's d for t-tests (d = 0.2 small, 0.5 medium, 0.8 large), eta-squared (η²) for ANOVA, and Cramér's V for Chi-Square.\n"
            "3. Format t-tests as: t(degrees of freedom) = t-value, p = p-value, d = effect size.\n"
            "4. Format ANOVA as: F(df_between, df_within) = F-value, p = p-value, η² = effect size.\n"
            "5. Report descriptive statistics (M and SD) in text or APA formatted summary tables."
        )
    },
    {
        "id": "hypothesis_testing_framework",
        "title": "Null Hypothesis Significance Testing (NHST) Protocol",
        "category": "Hypothesis",
        "content": (
            "Hypothesis Testing Protocol for Laboratory Research:\n"
            "1. State explicit Null Hypothesis (H0) and Alternative Hypothesis (H1) before running tests.\n"
            "2. Pre-specify significance threshold alpha (standard α = 0.05).\n"
            "3. If p < α, reject H0 in favor of H1, indicating statistically significant evidence.\n"
            "4. If p >= α, fail to reject H0, acknowledging lack of statistical evidence rather than proving the null.\n"
            "5. In clinical and educational research, differentiate statistical significance from practical/clinical significance using effect sizes and confidence intervals."
        )
    },
    {
        "id": "data_quality_and_hygiene",
        "title": "Research Data Cleansing and Outlier Handling Protocol",
        "category": "Data Hygiene",
        "content": (
            "Best Practices for Laboratory Data Preprocessing:\n"
            "1. Assess missing data mechanism (MCAR, MAR, MNAR). If missingness is below 5%, median/mean imputation is acceptable. For higher rates, consider sensitivity analysis.\n"
            "2. Identify outliers using both Tukey's IQR rule (1.5 * IQR) and z-score (|z| > 3.0).\n"
            "3. Test distributional assumptions using Shapiro-Wilk or D'Agostino tests. If normality is violated and sample size is small (n < 30), prefer non-parametric alternatives (Mann-Whitney U or Kruskal-Wallis).\n"
            "4. Check for multicollinearity in regression using correlation matrices and Variance Inflation Factors (VIF)."
        )
    },
    {
        "id": "lab_report_template",
        "title": "Standard Laboratory Scientific Report Structure",
        "category": "Template",
        "content": (
            "Standard Academic Research Manuscript Structure:\n"
            "1. Title & Abstract: Concise synthesis of objectives, key methodology, critical quantitative findings, and primary conclusion.\n"
            "2. Research Objectives & Hypotheses: Clear articulation of problem statement, independent/dependent variables, and directional hypotheses.\n"
            "3. Methodology & Data Hygiene: Sample size, inclusion criteria, data quality assessment, normality checks, and chosen statistical tests.\n"
            "4. Statistical Results: Exact numerical outputs, confidence intervals, test statistics, and formatted data tables.\n"
            "5. Discussion & Interpretation: Scientific reasoning explaining why these results occurred, contextualized against literature.\n"
            "6. Limitations & Future Work: Threats to internal/external validity, unmeasured confounders, and recommendations for subsequent experiments."
        )
    }
]


class RAGEngine:
    """
    Retrieval-Augmented Generation (RAG) Engine.
    Indexes methodology documents, lab protocols, and professor guidelines.
    Uses TF-IDF / Cosine Similarity and ChromaDB support for deterministic retrieval.
    """

    def __init__(self):
        self.documents = []
        self.vectorizer = TfidfVectorizer(stop_words="english")
        self.tfidf_matrix = None
        self._init_knowledge_base()

    def _init_knowledge_base(self):
        # Load built-in seeds
        self.documents = list(BUILTIN_GUIDELINES)

        # Load any user-uploaded documents from methodology directory
        if METHODOLOGY_DIR.exists():
            for filepath in METHODOLOGY_DIR.glob("*.*"):
                if filepath.suffix.lower() in [".txt", ".md", ".json"]:
                    try:
                        content = filepath.read_text(encoding="utf-8")
                        self.documents.append({
                            "id": filepath.stem,
                            "title": filepath.name,
                            "category": "User Uploaded",
                            "content": content
                        })
                    except Exception:
                        pass

        self._reindex()

    def _reindex(self):
        if not self.documents:
            self.tfidf_matrix = None
            return

        corpus = [f"{doc.get('title', '')} {doc.get('content', '')}" for doc in self.documents]
        try:
            self.tfidf_matrix = self.vectorizer.fit_transform(corpus)
        except Exception:
            self.tfidf_matrix = None

    def add_document(self, title: str, content: str, category: str = "Lab Protocol") -> dict:
        doc_id = re.sub(r"[^a-zA-Z0-9_]", "_", title.lower())
        doc_entry = {
            "id": doc_id,
            "title": title,
            "category": category,
            "content": content
        }
        
        # Save to disk
        save_path = METHODOLOGY_DIR / f"{doc_id}.json"
        save_path.write_text(json.dumps(doc_entry, indent=2), encoding="utf-8")

        self.documents.append(doc_entry)
        self._reindex()
        return doc_entry

    def retrieve_relevant_context(self, query: str, top_k: int = 3) -> list[dict]:
        """Query knowledge base and retrieve most relevant methodology chunks."""
        if not self.documents or self.tfidf_matrix is None or not query.strip():
            return self.documents[:top_k]

        try:
            query_vec = self.vectorizer.transform([query])
            similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
            top_indices = similarities.argsort()[::-1][:top_k]

            results = []
            for idx in top_indices:
                if similarities[idx] > 0.05:
                    doc = dict(self.documents[idx])
                    doc["relevance_score"] = round(float(similarities[idx]), 3)
                    results.append(doc)

            # If no similarity threshold met, provide general guidance
            if not results:
                results = [dict(d) for d in self.documents[:top_k]]

            return results
        except Exception:
            return self.documents[:top_k]

    def list_documents(self) -> list[dict]:
        return [
            {
                "id": d["id"],
                "title": d["title"],
                "category": d.get("category", "General"),
                "snippet": d["content"][:200] + "..." if len(d["content"]) > 200 else d["content"]
            }
            for d in self.documents
        ]


# Singleton instance
rag_engine = RAGEngine()
