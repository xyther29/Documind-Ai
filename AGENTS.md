# DocuMind AI — Agent Instructions

## Workflow
- Start every task with `/plan`.
- Show the implementation plan and wait for my approval before editing files.
- Work in small, verifiable steps.
- After each task, summarize files changed, commands run, and checks performed.

## Project Goal
Build a working demo where a user uploads a PDF, asks a question, and receives an answer supported by page-level citations.

## Stack
- Python 3.12
- FastAPI
- pypdf
- scikit-learn for TF-IDF retrieval and cosine similarity
- Gemini API using HTTP requests
- python-dotenv
- Plain HTML, CSS, and JavaScript
- pytest

## Coding Rules
- Keep code beginner-friendly and readable.
- Use small modules and clear function names.
- Never hardcode API keys or other secrets.
- Keep `.env` out of version control and provide `.env.example`.
- Do not install dependencies outside `requirements.txt` without asking first.
- Accept PDF uploads only, with a 10 MB maximum.
- Reject PDFs that contain no extractable text.
- Keep uploaded documents in memory for this demo.

## Answer Quality
- Ground answers in retrieved document passages.
- Include document names and page numbers with answers.
- If the document does not support an answer, return this exact text:
  `The document does not contain this information.`
- If Gemini fails, use a clearly identified fallback based on the retrieved passages.

## Testing
- Write tests for every module.
- Test PDF ingestion, retrieval, citations, unsupported questions, and API failures.
- Run the test suite and report results honestly.
- Never claim a test passed unless it was actually run.

## Git Workflow Rules

- Git commands are allowed for reviewing and saving project progress.
- Before committing, inspect `git status` and `git diff`.
- Run the relevant tests before each commit.
- Commit only intentional, reviewed changes using clear conventional commit messages.
- Never run destructive commands such as `git reset --hard`, `git clean -fd`, or commands that discard uncommitted changes.
- Never force-push or push to a remote unless the user explicitly approves it.
- Never include `.env`, API keys, secrets, `.venv/`, or generated cache files in commits.
- Do not rewrite or fabricate past commit history.
- If unsure which files should be committed, ask the user before proceeding.