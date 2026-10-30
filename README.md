# Research Graph RAG

Multi-document research workspace. Upload several documents, retrieve related passages using vectors and a concept graph, and ask questions with document/page citations.

## Run locally

Requires Node.js 22 or newer, npm, and internet for dependency installation and the first embedding-model download.

```bash
npm install
cp .env.example .env
npm start
```

Open http://127.0.0.1:3001. Add PDF, DOCX, TXT or Markdown files, select documents in the library, and ask a question. Drag-and-drop and pasted text are supported. The graph tab shows shared concepts; click a node to inspect its connections. Delete buttons remove a document and its passages from retrieval.

No API key is required for indexing or retrieval. Without one, the answer panel explicitly shows retrieved evidence rather than claiming to generate an answer. To enable generated answers, set `LLM_API_KEY`, `LLM_API_URL` and `LLM_MODEL` in `.env` and restart. `LLM_PROVIDER=openai` means any compatible chat endpoint, including OpenRouter. Gemini is still supported with `LLM_PROVIDER=gemini` and its corresponding model/key. Only retrieved passages and questions are sent to the answer provider; embeddings run locally.

Never put real keys in example files or commit `.env`. The old repository contained a key-like value in `.env.example`; revoke it if it was real. It has been replaced in the working tree, but this does not remove it from Git history.

## Architecture

1. Server-side parsing: PDF.js extracts page text, Mammoth reads DOCX, and UTF-8 text/Markdown are read directly. Scanned PDFs require OCR before upload.
2. Text is split into 180-word passages with 35-word overlap. PDF page numbers are preserved. TXT, Markdown and DOCX are treated as one logical page.
3. Transformers.js runs `Xenova/all-MiniLM-L6-v2` locally, producing normalized 384-dimensional sentence embeddings. The model is cached in `.cache/` after first use.
4. LanceDB stores vectors, passage text, document metadata, page numbers and concept labels in `data/vectors/`. Search uses cosine distance. Small corpora use exact nearest-neighbor search; this app does not claim an ANN index.
5. Compromise extracts noun phrases. Graphology builds document → passage → concept links. Identical normalized phrases connect passages across documents. The graph is reconstructed from persisted LanceDB rows after restart.
6. Vector mode retrieves nearest passages. Vector + Graph additionally traverses shared concepts from the top four vector matches, then reranks candidates with a lightweight graph boost. Document filters apply to both paths.
7. Questions mentioning an uploaded filename (with or without its extension) are scoped to that document within the selected library. Summaries and question-count requests use ordered document coverage rather than nearest-neighbor samples, capped at 40 passages and 40,000 characters. Larger documents are explicitly marked as partial coverage. Exact question totals are calculated from distinct, contiguous Q1/Question 1-style labels only when coverage is complete; missing or ambiguous labels cause an explicit refusal rather than a guessed total.
8. The selected evidence is passed to the configured LLM. Its answer must reference valid numbered sources; missing/out-of-range citations trigger an explicit evidence-only fallback. Provider responses cut short by the output limit are rejected rather than displayed as complete. Citation-number validation cannot verify the factual correctness of every claim.

The graph is a noun-phrase mention graph, not an LLM-extracted factual relationship graph or a Neo4j service. The UI aggregates passage edges to document/concept edges and shows at most 65 concepts. Full graph connections remain available to retrieval. Graph phrase matching is exact after normalization, so aliases and synonyms may not connect. Questions are independent; earlier chat turns are not sent as conversational memory.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Provider configuration and index counts |
| `GET /api/documents` | List persisted documents |
| `POST /api/documents` | Multipart `documents` files, or JSON `{ "name": "Notes", "text": "..." }` |
| `DELETE /api/documents/:id` | Remove a document and all its passages |
| `GET /api/graph` | Graph visualization nodes/edges and full graph counts |
| `POST /api/ask` | JSON `{ "question": "...", "documentIds": [], "mode": "hybrid" }`; empty IDs search all documents |

Responses from `/api/ask` include `answer`, `sources`, `generated`, and `retrieval` (intent, document scope, and passage coverage). Verified counts also include `answerType: "document_count"`; unsupported totals use `"insufficient_evidence"`. Each source includes its document ID, filename, page, passage position, text, score (null for ordered coverage) and retrieval path.

## Storage and limits

Local data lives under `data/`; override it with `RAG_DATA_DIR`. Back up that directory to preserve the corpus. `.cache/` contains downloaded model files and can be recreated. Both are ignored by Git and blocked from static HTTP access. Only the explicit frontend asset allowlist is publicly served.

Limits: 20 files per request, 20 MB per file, 50 MB per batch, 500 pages per PDF, 1.5 million extracted characters per document, and 10,000 passages per local workspace. The hosted free demo sets `RAG_MAX_CHUNKS=1000`, `EMBED_BATCH_SIZE=4` and `EMBED_THREADS=1` to fit its smaller instance. Duplicate content is detected by SHA-256. Index writes are serialized in one Node process. Failed files in a batch are reported individually; successful files remain indexed.

This is a single-workspace application, without tenant isolation. Local development binds to loopback and can run without a password. Hosted production requires `APP_AUTH_PASSWORD` (at least 16 characters) and uses browser HTTP Basic authentication with `APP_AUTH_USER` (default `admin`). All pages, assets and document APIs require authentication; `/api/health` remains public for host probes. Use HTTPS in production. Everyone given the shared password can read and delete the same document library.

## Deployment

The included `render.yaml` uses a **free Docker web service** in Singapore with no persistent disk. LanceDB lives at `/var/data/rag` on the ephemeral filesystem. Uploaded documents and their indexes are lost when the service restarts, redeploys or spins down after inactivity. The app displays this limitation in its document library. The demo limits the workspace to 1,000 passages and uses small, single-threaded embedding batches for the free 512 MB instance.

The Docker image uses Node 24 on Debian, runs the tests during build, downloads and validates MiniLM before serving traffic, and runs as the unprivileged `node` user. The embedding model ships in the image and survives service restarts; uploaded documents do not. Only one application instance may access the local LanceDB directory.

1. Push the reviewed source to the GitHub repository.
2. Create or sync a Render Blueprint using this repository's `render.yaml`, or create a free Docker service from the `codex/graph-rag-deploy` branch with the same environment settings. No paid disk or service is required for this demo.
3. Render generates `APP_AUTH_PASSWORD` as a secret. Read it from the service's Environment settings and log in with username `admin` over the service's HTTPS URL.
4. For generated answers, create your own API key at https://openrouter.ai/settings/keys and add it as the `LLM_API_KEY` Render secret. The configured `openrouter/free` router uses free models only, subject to provider quotas and availability. Without a key, indexing and evidence retrieval still work. Never commit secrets or use keys from public repositories.
5. Wait for GitHub checks and the Render build to finish. Verify `/api/health`, password protection, document upload, citation retrieval and persistence after a restart.

The CI workflow runs tests and a dependency audit on Linux/Node 24. Blueprint deployments use `checksPass`; direct service creation uses Render's supported auto-deploy settings. Docker can also run on a compatible host using a persistent volume at `/var/data` and an externally supplied `APP_AUTH_PASSWORD`. To retain hosted documents permanently, change to a paid service with a persistent disk, or move storage to an external persistent database.

## Verification

```bash
npm test
```

Tests exercise overlap/page provenance, real LanceDB persistence, multi-document retrieval, duplicate detection, scoped graph retrieval, deletion and reindexing. Deterministic test embeddings keep these checks independent of model downloads or paid API calls.

The old `PROJECT_NOTES.md` and presentation outputs describe the original summariser and are historical material, not documentation for this RAG implementation.
