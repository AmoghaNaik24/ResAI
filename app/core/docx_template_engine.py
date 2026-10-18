"""
ResAI - DOCX Template Parsing & Assembly Engine
Supports:
1. Parsing user-uploaded DOCX templates and populating placeholder tags (e.g. {{abstract}}, {{descriptive_statistics_table}})
2. Assembling publication-grade APA 7th Microsoft Word documents with styled tables, statistics, and figures
"""

import re
from pathlib import Path
from typing import Dict, Any, Optional
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT


class DocxTemplateEngine:
    """
    Template-driven DOCX assembler and parser for scientific manuscripts.
    """

    @staticmethod
    def populate_uploaded_docx_template(
        template_path: Path,
        output_path: Path,
        context: Dict[str, Any]
    ) -> Path:
        """
        Parses an existing user-supplied .docx template, replaces {{tags}} with
        computed results and markdown tables, and writes the output file.
        """
        doc = Document(template_path)

        # 1. Paragraph replacement
        for p in doc.paragraphs:
            for key, val in context.items():
                tag = f"{{{{{key}}}}}"
                if tag in p.text:
                    DocxTemplateEngine._replace_text_in_paragraph(p, tag, str(val))

        # 2. Table cell replacement
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        for key, val in context.items():
                            tag = f"{{{{{key}}}}}"
                            if tag in p.text:
                                DocxTemplateEngine._replace_text_in_paragraph(p, tag, str(val))

        doc.save(str(output_path))
        return output_path

    @staticmethod
    def _replace_text_in_paragraph(paragraph, search_text: str, replacement_text: str):
        """Replaces text in paragraph while attempting to preserve formatting."""
        if search_text in paragraph.text:
            new_text = paragraph.text.replace(search_text, replacement_text)
            paragraph.text = new_text

    @staticmethod
    def build_publication_docx(
        report_data: Dict[str, Any],
        output_path: Path
    ) -> Path:
        """
        Builds a comprehensive, publication-grade APA 7th DOCX report from scratch.
        """
        doc = Document()

        for s in doc.sections:
            s.top_margin = Inches(1.0)
            s.bottom_margin = Inches(1.0)
            s.left_margin = Inches(1.0)
            s.right_margin = Inches(1.0)

        # Title
        p_title = doc.add_paragraph()
        p_title.paragraph_format.space_before = Pt(0)
        p_title.paragraph_format.space_after = Pt(4)
        run_title = p_title.add_run(report_data.get("title", "Empirical Research Report"))
        run_title.font.name = "Calibri"
        run_title.font.size = Pt(22)
        run_title.font.bold = True
        run_title.font.color.rgb = RGBColor(30, 58, 138)

        # Subtitle & Metadata
        p_meta = doc.add_paragraph()
        p_meta.paragraph_format.space_after = Pt(14)
        meta_text = (
            f"Principal Investigator: {report_data.get('researcher_name', 'Research Fellow')}  |  "
            f"Date: {report_data.get('date', '')}  |  "
            f"Status: {report_data.get('validation_status', 'DRAFT_PENDING_REVIEW')}"
        )
        run_meta = p_meta.add_run(meta_text)
        run_meta.font.name = "Calibri"
        run_meta.font.size = Pt(9.5)
        run_meta.font.italic = True
        run_meta.font.color.rgb = RGBColor(100, 116, 139)

        # Divider line
        p_div = doc.add_paragraph()
        p_div.paragraph_format.space_after = Pt(12)
        run_div = p_div.add_run("―" * 55)
        run_div.font.color.rgb = RGBColor(203, 213, 225)

        # Abstract
        abstract_text = report_data.get("abstract", "")
        if abstract_text:
            DocxTemplateEngine._add_heading(doc, "Abstract", level=2)
            p_abs = doc.add_paragraph()
            p_abs.paragraph_format.space_after = Pt(12)
            p_abs.paragraph_format.line_spacing = 1.15
            run_abs = p_abs.add_run(abstract_text)
            run_abs.font.name = "Calibri"
            run_abs.font.size = Pt(10.5)
            run_abs.font.italic = True

        # Introduction
        intro_text = report_data.get("introduction", "")
        if intro_text:
            DocxTemplateEngine._add_heading(doc, "1. Introduction & Research Objectives", level=2)
            DocxTemplateEngine._add_body_paragraph(doc, intro_text)

        # Methodology & Data Profiling
        meth_text = report_data.get("methodology", "")
        if meth_text:
            DocxTemplateEngine._add_heading(doc, "2. Data Profiling & Hygiene Methodology", level=2)
            DocxTemplateEngine._add_body_paragraph(doc, meth_text)

        # Table 1: Descriptive Statistics
        desc_table_md = report_data.get("descriptive_statistics_table", "")
        if desc_table_md and "|" in desc_table_md:
            DocxTemplateEngine._add_heading(doc, "Table 1: Descriptive Statistics", level=3)
            DocxTemplateEngine._render_markdown_table_to_docx(doc, desc_table_md)

        # Table 2: Categorical Distribution
        cat_table_md = report_data.get("categorical_distribution_table", "")
        if cat_table_md and "|" in cat_table_md:
            DocxTemplateEngine._add_heading(doc, "Table 2: Categorical Distributions", level=3)
            DocxTemplateEngine._render_markdown_table_to_docx(doc, cat_table_md)

        # Inferential Hypothesis Testing Results
        results_list = report_data.get("results", [])
        if results_list:
            DocxTemplateEngine._add_heading(doc, "3. Inferential Hypothesis Testing Results", level=2)
            for idx, r in enumerate(results_list, 1):
                p_res = doc.add_paragraph()
                p_res.paragraph_format.space_after = Pt(4)
                r_title = p_res.add_run(f"Finding {idx}: {r.get('title', '')}\n")
                r_title.font.name = "Calibri"
                r_title.font.bold = True
                r_title.font.size = Pt(11)

                r_body = p_res.add_run(r.get("narrative", "").replace("**", ""))
                r_body.font.name = "Calibri"
                r_body.font.size = Pt(10.5)

        # Scientific Discussion
        disc_text = report_data.get("discussion", "")
        if disc_text:
            DocxTemplateEngine._add_heading(doc, "4. Discussion & Scientific Interpretation", level=2)
            DocxTemplateEngine._add_body_paragraph(doc, disc_text)

        # Limitations
        lim_text = report_data.get("limitations", "")
        if lim_text:
            DocxTemplateEngine._add_heading(doc, "5. Methodological Limitations & Validity Threats", level=2)
            DocxTemplateEngine._add_body_paragraph(doc, lim_text)

        # Conclusions
        conc_text = report_data.get("conclusions", "")
        if conc_text:
            DocxTemplateEngine._add_heading(doc, "6. Conclusions & Recommendations", level=2)
            DocxTemplateEngine._add_body_paragraph(doc, conc_text)

        # Human Review Notes
        notes = report_data.get("human_notes", "")
        if notes:
            DocxTemplateEngine._add_heading(doc, "Researcher Peer Review Notes", level=2)
            DocxTemplateEngine._add_body_paragraph(doc, f"Researcher Sign-Off Notes: {notes}")

        doc.save(str(output_path))
        return output_path

    @staticmethod
    def _add_heading(doc: Document, text: str, level: int = 2):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.bold = True
        run.font.size = Pt(14 if level == 2 else 12)
        run.font.color.rgb = RGBColor(30, 58, 138) if level == 2 else RGBColor(15, 23, 42)

    @staticmethod
    def _add_body_paragraph(doc: Document, text: str):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(8)
        p.paragraph_format.line_spacing = 1.15
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(10.5)
        run.font.color.rgb = RGBColor(15, 23, 42)

    @staticmethod
    def _render_markdown_table_to_docx(doc: Document, table_md: str):
        lines = [l.strip() for l in table_md.strip().split("\n") if l.strip()]
        valid_rows = [l for l in lines if not re.match(r"^\s*\|?\s*:?-+:?\s*\|", l)]
        if not valid_rows:
            return

        row_data = []
        for line in valid_rows:
            cols = [c.strip().replace("`", "") for c in line.strip().strip("|").split("|")]
            row_data.append(cols)

        if not row_data:
            return

        num_cols = max(len(r) for r in row_data)
        table = doc.add_table(rows=len(row_data), cols=num_cols)
        table.style = 'Table Grid'
        table.alignment = WD_TABLE_ALIGNMENT.CENTER

        for r_idx, row in enumerate(row_data):
            for c_idx in range(num_cols):
                cell_val = row[c_idx] if c_idx < len(row) else ""
                cell = table.cell(r_idx, c_idx)
                cell.text = cell_val
                for p in cell.paragraphs:
                    p.paragraph_format.space_after = Pt(2)
                    p.paragraph_format.space_before = Pt(2)
                    for run in p.runs:
                        run.font.name = "Calibri"
                        run.font.size = Pt(9.5)
                        if r_idx == 0:
                            run.font.bold = True
                            run.font.color.rgb = RGBColor(30, 58, 138)

        # Spacing after table
        p_sp = doc.add_paragraph()
        p_sp.paragraph_format.space_after = Pt(6)
