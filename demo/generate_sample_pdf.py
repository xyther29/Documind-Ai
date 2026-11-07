"""Generate canonical 3-page RAG primer PDF for DocuMind AI demonstration.

Uses pure Python PDF 1.4 byte generation without external dependencies.
Produces factual, predictable content for reliable citation testing.
"""

from pathlib import Path
import io


def build_pdf_bytes(pages: list[dict[str, list[str]]]) -> bytes:
    """Construct a compliant PDF 1.4 document containing structured text."""
    buf = io.BytesIO()
    objects: list[bytes] = []
    num_pages = len(pages)

    # 1: Catalog
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")

    # 2: Pages tree
    page_ids = [5 + i * 2 for i in range(num_pages)]
    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects.append(
        f"2 0 obj\n<< /Type /Pages /Kids [{kids}] /Count {num_pages} >>\nendobj\n".encode("latin1")
    )

    # 3: ProcSet
    objects.append(b"3 0 obj\n[/PDF /Text]\nendobj\n")

    # 4: Default Font (Type 1 Helvetica)
    objects.append(
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Helvetica >>\nendobj\n"
    )

    for i, page_data in enumerate(pages):
        page_id = 5 + i * 2
        content_id = page_id + 1

        stream_lines = [
            "BT",
            "/F1 12 Tf",
            "16 TL",
            "54 730 Td",
        ]

        title = page_data.get("title", f"Section {i+1}")
        safe_title = title.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream_lines.append(f"({safe_title}) Tj T*")
        stream_lines.append("T*")

        paragraphs = page_data.get("paragraphs", [])
        for para in paragraphs:
            safe_para = para.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            # Split paragraph into wrapped lines of ~75 chars
            words = safe_para.split()
            current_line = []
            current_len = 0
            for word in words:
                if current_len + len(word) + 1 > 75:
                    line_str = " ".join(current_line)
                    stream_lines.append(f"({line_str}) Tj T*")
                    current_line = [word]
                    current_len = len(word)
                else:
                    current_line.append(word)
                    current_len += len(word) + 1
            if current_line:
                line_str = " ".join(current_line)
                stream_lines.append(f"({line_str}) Tj T*")
            stream_lines.append("T*")

        stream_lines.append("ET")
        stream_data = "\n".join(stream_lines).encode("latin1")

        page_obj = (
            f"{page_id} 0 obj\n"
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Contents {content_id} 0 R /Resources << /Font << /F1 4 0 R >> >> >>\n"
            f"endobj\n"
        ).encode("latin1")

        content_obj = (
            f"{content_id} 0 obj\n"
            f"<< /Length {len(stream_data)} >>\n"
            f"stream\n"
        ).encode("latin1") + stream_data + b"\nendstream\nendobj\n"

        objects.append(page_obj)
        objects.append(content_obj)

    # Write PDF header
    buf.write(b"%PDF-1.4\n")
    offsets = [0]

    for obj in objects:
        offsets.append(buf.tell())
        buf.write(obj)

    xref_pos = buf.tell()
    buf.write(b"xref\n")
    buf.write(f"0 {len(offsets)}\n".encode("latin1"))
    buf.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        buf.write(f"{off:010d} 00000 n \n".encode("latin1"))

    trailer = (
        f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n"
    ).encode("latin1")
    buf.write(trailer)

    return buf.getvalue()


SAMPLE_PAGES = [
    {
        "title": "Page 1: Retrieval-Augmented Generation Architecture",
        "paragraphs": [
            "Retrieval-Augmented Generation (RAG) is an artificial intelligence framework that enhances large language models by dynamically retrieving relevant facts from authoritative external knowledge bases before synthesizing a response.",
            "In standard RAG architectures, knowledge retrieval bridges the gap between static parametric weights learned during pre-training and private, dynamic, or domain-specific enterprise documents.",
            "The document ingestion pipeline executes three primary phases: document text extraction, document chunking into bounded passages, and index construction. Document chunking partitions multi-page PDFs into overlapping word segments, typically targeting 120 words with 30-word overlaps to maintain contextual continuity across chunk boundaries.",
            "By grounding model generation in retrieved passages, RAG systems dramatically mitigate generative hallucinations, provide verifiable page-level audit trails, and eliminate the prohibitive cost of continuous model fine-tuning.",
        ],
    },
    {
        "title": "Page 2: Vector Embeddings and TF-IDF Retrieval",
        "paragraphs": [
            "Information retrieval in RAG platforms relies on either dense vector embeddings, sparse lexical retrieval, or hybrid combinations.",
            "Dense retrieval encodes textual passages into high-dimensional continuous vector spaces using neural embedding models. In contrast, sparse lexical retrieval utilizes Term Frequency Inverse Document Frequency (TF-IDF) and BM25 algorithms, calculating term importance based on statistical distribution across document chunks.",
            "The TF-IDF retrieval engine scores candidate passages using cosine similarity between the expanded query vector and precomputed chunk vectors. Cosine similarity evaluates the cosine of the angle between two non-zero vectors in inner product space, yielding normalized scores between 0.0 and 1.0.",
            "To bridge vocabulary mismatches, acronym-aware query expansion discovers dynamic abbreviations such as NLP (Natural Language Processing) and RAG within the corpus, enriching short queries before matrix multiplication.",
        ],
    },
    {
        "title": "Page 3: Generation, Citations and Evaluation",
        "paragraphs": [
            "During the synthesis phase, retrieved passages are formatted as untrusted reference context inside privileged system prompts, directing the language model to answer strictly based on provided evidence.",
            "DocuMind AI requires answers to cite exact source filenames and page citations, such as [sample_rag_primer.pdf, p. 1], allowing students and evaluators to inspect source evidence immediately.",
            "A critical invariant in trustworthy document Q&A is honest abstention. If the retrieved passages do not contain sufficient evidence to answer the query, the system must return exactly: The document does not contain this information.",
            "Core evaluation metrics for production RAG include Faithfulness (measuring factual consistency with source passages), Answer Relevance (ensuring the response directly addresses the query), and Context Recall (measuring whether all necessary information was retrieved).",
        ],
    },
]


def generate_sample_pdf(output_path: Path) -> Path:
    """Generate and write the canonical sample RAG primer PDF."""
    pdf_bytes = build_pdf_bytes(SAMPLE_PAGES)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(pdf_bytes)
    return output_path


if __name__ == "__main__":
    target = Path(__file__).resolve().parent / "sample_rag_primer.pdf"
    generate_sample_pdf(target)
    print(f"Sample PDF generated successfully: {target} ({target.stat().st_size} bytes)")
