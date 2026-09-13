# IELTS / TOEIC exam import

The exam MVP supports two PDF extraction paths and a shared downstream parser/editor/practice flow.

```text
PDF
├─ Fast PDF text (existing EchoType extractor)
└─ PaddleOCR-VL (scanned/layout-heavy PDFs)
       ↓
Optional AI structured parsing
       ↓
Exam editor / verification
       ↓
Practice + grading
       ↓
Incorrect questions → Weak Spots
```

## PaddleOCR-VL

EchoType does not bundle the OCR model. Run a PaddleOCR-VL serving process separately, then point EchoType at it.

Current PaddleX serving setup:

```bash
paddlex --install serving
paddlex --serve --pipeline PaddleOCR-VL-1.6
```

The default server listens on port `8080`.

Create or update `.env.local`:

```env
PADDLEOCR_VL_URL=http://127.0.0.1:8080
# Optional, only when the OCR server is behind an authenticated proxy.
PADDLEOCR_VL_API_KEY=
```

Restart the EchoType dev/server process after changing environment variables.

The EchoType route `POST /api/exams/ocr` sends the uploaded PDF as Base64 to:

```text
POST {PADDLEOCR_VL_URL}/layout-parsing
```

with `fileType: 0` (PDF). It requests Markdown output without embedded image payloads and stores the resulting text only in the exam draft.

For a remote deployment, `PADDLEOCR_VL_URL` must be reachable from the EchoType server. `127.0.0.1` only works when both services run on the same machine/network namespace.

Official PaddleX documentation:

- https://paddlepaddle.github.io/PaddleX/3.7/en/pipeline_usage/tutorials/ocr_pipelines/PaddleOCR-VL.html

## AI structured parsing

After text extraction, **AI parse & save** uses the same AI provider and model configured in EchoType Settings.

The parser is intentionally conservative:

- preserves question wording where possible;
- only imports a question automatically when an explicit answer can be matched from the supplied source;
- skips unanswered/uncertain questions instead of fabricating answers;
- keeps the start and end of very long sources so answer keys near the end remain available to the model.

Skipped or incorrectly parsed questions can be added manually in the exam editor.

## Current MVP limitations

- Exam data lives in the local `echotype:exams` Dexie database and is not in cloud sync/backup yet.
- Listening audio attachment and timed full-test mode are not implemented yet.
- Existing questions can be deleted and recreated, but inline editing is not implemented yet.
- Complex maps/diagrams/images are not persisted as exam assets yet; OCR currently stores Markdown text only.
