import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


def test_health_check():
    async def _run():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/health")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "healthy"
    asyncio.run(_run())


def test_full_pipeline_clinical():
    async def _run():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Load Sample
            load_res = await client.post("/api/eda/load-sample", data={"sample_type": "clinical"})
            assert load_res.status_code == 200
            sample_data = load_res.json()
            assert "Clinical_Drug_Trial" in sample_data["filename"]
            assert sample_data["profile"]["total_rows"] > 0

            # 2. Recommendations
            recs_res = await client.get("/api/analysis/recommendations")
            assert recs_res.status_code == 200
            recs = recs_res.json()
            assert "recommended_tests" in recs
            assert len(recs["recommended_tests"]) > 0

            # 3. Unified Run-Test (ANOVA)
            test_payload = {
                "test_type": "anova",
                "group_col": "TreatmentGroup",
                "numeric_col": "RecoveryDays"
            }
            test_res = await client.post("/api/analysis/run-test", json=test_payload)
            assert test_res.status_code == 200
            anova = test_res.json()
            assert anova["status"] == "success"
            assert anova["is_significant"] is True
            assert "F(" in anova["apa_statement"]

            # 4. Two-sample test via unified run-test
            t_payload = {
                "test_type": "two_sample",
                "group_col": "Gender",
                "numeric_col": "RecoveryDays"
            }
            t_res = await client.post("/api/analysis/run-test", json=t_payload)
            assert t_res.status_code == 200

            # 5. Visualizations via POST (Boxplot, Research Bar with Error Bars, Pie, Heatmap, Line Trend)
            viz_res = await client.post("/api/analysis/visualize", json={
                "viz_type": "boxplot",
                "x_col": "TreatmentGroup",
                "y_col": "RecoveryDays"
            })
            assert viz_res.status_code == 200
            assert "plotly_json" in viz_res.json()

            bar_res = await client.post("/api/analysis/visualize", json={
                "viz_type": "bar",
                "x_col": "TreatmentGroup",
                "y_col": "RecoveryDays"
            })
            assert bar_res.status_code == 200
            assert bar_res.json()["chart_type"] == "research_bar_means"

            pie_res = await client.post("/api/analysis/visualize", json={
                "viz_type": "pie",
                "col1": "TreatmentGroup"
            })
            assert pie_res.status_code == 200
            assert pie_res.json()["chart_type"] == "pie"

            heat_res = await client.post("/api/analysis/visualize", json={"viz_type": "heatmap"})
            assert heat_res.status_code == 200
            assert heat_res.json()["chart_type"] == "correlation_heatmap"

            line_res = await client.post("/api/analysis/visualize", json={
                "viz_type": "line",
                "x_col": "Age",
                "y_col": "Biomarker_Baseline"
            })
            assert line_res.status_code == 200
            assert line_res.json()["chart_type"] == "line_trend"

            # 6. RAG retrieval
            rag_res = await client.get("/api/rag/documents")
            assert rag_res.status_code == 200
            assert len(rag_res.json()) >= 4

            # 7. Auto pipeline report generation
            rep_res = await client.post("/api/report/auto-pipeline", json={"llm_provider": "offline"})
            assert rep_res.status_code == 200
            rep = rep_res.json()
            assert rep["status"] == "success"
            assert "report" in rep
            assert rep["report"]["validation_status"] == "DRAFT_PENDING_REVIEW"

            # 8. DOCX export
            docx_res = await client.get("/api/report/export-docx")
            assert docx_res.status_code == 200
            assert len(docx_res.content) > 1000

            # 9. Markdown export
            md_res = await client.get("/api/report/export-markdown")
            assert md_res.status_code == 200
            assert b"# " in md_res.content

            # 10. Test Dataset Q&A Tool Grounded vs Knowledge Limited
            qa_valid_res = await client.post("/api/eda/ask", json={"question": "What is the average of RecoveryDays?"})
            assert qa_valid_res.status_code == 200
            qa_data = qa_valid_res.json()
            assert qa_data["grounded"] is True
            assert "RecoveryDays" in qa_data["answer"]

            # 10.1 Dataset summary query
            qa_summary_res = await client.post("/api/eda/ask", json={"question": "Summarize this dataset and list key attributes"})
            assert qa_summary_res.status_code == 200
            qa_sum_data = qa_summary_res.json()
            assert qa_sum_data["grounded"] is True
            assert "Summary" in qa_sum_data["answer"] or "Observations" in qa_sum_data["answer"]

            # 10.2 Research objective query
            qa_obj_res = await client.post("/api/eda/ask", json={"question": "What is the primary research objective of this study?"})
            assert qa_obj_res.status_code == 200
            qa_obj_data = qa_obj_res.json()
            assert qa_obj_data["grounded"] is True
            assert "Research Objective" in qa_obj_data["answer"]

            # 10.3 Statistical recommendations query
            qa_rec_res = await client.post("/api/eda/ask", json={"question": "What statistical tests are recommended for this dataset?"})
            assert qa_rec_res.status_code == 200
            qa_rec_data = qa_rec_res.json()
            assert qa_rec_data["grounded"] is True
            assert "Recommended Statistical Tests" in qa_rec_data["answer"]

            # 10.4 Out of domain query -> Knowledge is limited
            qa_invalid_res = await client.post("/api/eda/ask", json={"question": "Who won the 2022 football world cup?"})
            assert qa_invalid_res.status_code == 200
            qa_inv_data = qa_invalid_res.json()
            assert qa_inv_data["grounded"] is False
            assert "Knowledge is limited" in qa_inv_data["answer"]

            # 11. Test Dynamic Report Title based on file details
            assert "Clinical" in rep["report"]["title"] or "RecoveryDays" in rep["report"]["title"]
            assert "document_grounding" in rep["report"]

            # 12. Load another dataset (Academic Performance) and test dynamic title & report synthesis
            edu_res = await client.post("/api/eda/load-sample", data={"sample_type": "education"})
            assert edu_res.status_code == 200
            assert "Student_Academic_Predictors" in edu_res.json()["filename"]

            edu_rep_res = await client.post("/api/report/auto-pipeline", json={})
            assert edu_rep_res.status_code == 200
            edu_rep = edu_rep_res.json()["report"]
            # Dynamic title must reflect the Student Academic dataset, not clinical trial
            assert "Student" in edu_rep["title"] or "Exam" in edu_rep["title"] or "Predictors" in edu_rep["title"]
            assert "Clinical" not in edu_rep["title"]
            assert "Student_Academic_Predictors" in edu_rep["abstract"]

            # 13. Test Claim Audit in generated report
            assert "claim_audit" in edu_rep
            assert "grounding_score_percent" in edu_rep["claim_audit"]

            # 14. Test LLM Status endpoint (Ollama detection)
            llm_res = await client.get("/api/report/llm-status")
            assert llm_res.status_code == 200
            llm_data = llm_res.json()
            assert "status" in llm_data

            # 15. Test Validate Claims endpoint
            val_res = await client.post("/api/report/validate-claims", json={
                "report_text": "The sample size was N = 120 with Mean = 45.2 and p = 0.042."
            })
            assert val_res.status_code == 200
            val_data = val_res.json()
            assert val_data["status"] == "success"
            assert "audit" in val_data
    asyncio.run(_run())

