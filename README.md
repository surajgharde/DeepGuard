# DeepGuard

Multimodal deepfake detection system — a full-stack UI over a visual / audio / lip-sync
analyser with score fusion. Built as an MSc dissertation prototype.

## What the scores actually are

The default pipeline (`heuristic`) **measures the uploaded file**. It decodes real frames
with OpenCV, locates faces, and computes classical forensic signals on them; it decodes the
real soundtrack and measures synthesis fingerprints; it cross-correlates real mouth motion
against the real speech envelope. It is fully deterministic — the same file always produces
the same verdict.

It is **not a trained detector.** There is no neural network and no learned decision
boundary: the thresholds in `app/inference/signals/` are hand-set operating points. The
clean anchors were set by measuring genuine footage so ordinary video scores low; the
suspicious anchors are reasoned from what each artefact looks like, *not* fitted to labelled
deepfakes. Consequences, stated plainly:

- **No accuracy figure can be quoted for this system**, and none should be. Precision,
  recall and AUC require training and evaluating against a labelled corpus
  (FaceForensics++, DFDC, Celeb-DF). See [Training a real model](#training-a-real-model).
- It targets **face swaps**, not full synthesis. The visual features look for a face that
  does not belong in its frame — a blend seam, a resolution mismatch. A clip generated whole,
  internally consistent in every pixel, offers none of those and can score as clean.
- It needs a **visible frontal face and audible speech**. Branches that cannot measure
  anything report "not assessable" and are dropped from fusion rather than defaulting to 0.5.

Every result carries this caveat in its `notes`, on the result page, and in the PDF export.

### Pipelines

| `DEEPGUARD_PIPELINE` | Behaviour |
| --- | --- |
| `heuristic` *(default)* | Measures the file. Deterministic. Described above. |
| `mock` | **Never opens the video.** Verdict is `random() < 0.5` and scores are drawn from a distribution. UI development only; the result page shows a red demo warning. |
| `real` | Unimplemented PyTorch stub — raises `NotImplementedError`. |

```
DeepGuard/
├── backend/     FastAPI + SQLAlchemy (SQLite) + BackgroundTasks
└── frontend/    Next.js 14 (App Router) + TypeScript + Tailwind
```

---

## Quick start

Two terminals. Backend first (the frontend expects it on port 8000).

### 1. Backend — http://localhost:8000

```bash
cd backend
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Interactive API docs: <http://localhost:8000/docs>

On first start it creates `deepguard.db`, the `uploads/` and `outputs/` folders, and seeds
5 completed demo analyses plus 1 failed one so History is not empty.

### 2. Frontend — http://localhost:3000

```bash
cd frontend
npm install
npm run dev
```

`.env.local` is already present with working defaults. Copy `.env.example` if you need to
change the API URL.

> If port 3000 is busy, `next dev` falls back to 3001/3002 — both are already in the
> backend's allowed CORS origins. For any other port, add it to `DEEPGUARD_CORS_ORIGINS`.

---

## Configuration

Both sides are fully env-driven; no URLs are hardcoded.

**`backend/.env`** (see `backend/.env.example`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEEPGUARD_PIPELINE` | `heuristic` | `heuristic`, `mock` or `real` (see above) |
| `DEEPGUARD_DATABASE_URL` | `sqlite:///.../deepguard.db` | SQLAlchemy URL |
| `DEEPGUARD_PUBLIC_BASE_URL` | `http://localhost:8000` | Used to build absolute image/video URLs |
| `DEEPGUARD_CORS_ORIGINS` | `http://localhost:3000,127.0.0.1:3000,:3001,:3002` | Comma-separated allowed origins |
| `DEEPGUARD_MAX_UPLOAD_MB` | `100` | Upload size limit |
| `DEEPGUARD_UPLOAD_DIR` / `DEEPGUARD_OUTPUT_DIR` | `uploads` / `outputs` | Storage roots |
| `DEEPGUARD_SEED_ON_STARTUP` | `true` | Insert demo history when the DB is empty |

**`frontend/.env.local`** (see `frontend/.env.example`)

| Variable | Default |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | `2000` |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | `100` |
| `NEXT_PUBLIC_ALLOWED_EXTENSIONS` | `.mp4,.avi,.mov` |

---

## API

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/analyze` | Multipart video upload (mp4/avi/mov, ≤100 MB). Validates, stores, creates a job, launches background inference. Returns `{ job_id, filename, size_bytes, status }` with `202`. |
| `GET` | `/api/jobs/{job_id}` | Status (`queued`/`processing`/`done`/`failed`), `stage`, `progress` 0-100, and on completion the full `result`. Polled every 2 s by the UI. |
| `DELETE` | `/api/jobs/{job_id}` | Deletes the job row, the upload and all generated artefacts. |
| `GET` | `/api/history?page=1&page_size=12` | Paginated past jobs with thumbnails and verdicts. |
| `GET` | `/health` | Liveness + whether models are loaded + jobs in flight. |
| `GET` | `/static/...` | Generated artefact-map frames and thumbnails. |
| `GET` | `/media/...` | Uploaded videos (so the result page can play the source clip). |

Completed `result` payload:

```jsonc
{
  "verdict": "fake",              // "real" | "fake"
  "confidence": 0.87,             // confidence in the verdict, 0-1
  "modalities": {
    "visual":  { "score": 0.91, "label": "Strong artefacts", "explanation": "..." },
    "audio":   { "score": 0.74, "label": "Questionable",     "explanation": "..." },
    "lipsync": { "score": 0.88, "label": "High mismatch",    "explanation": "..." }
  },
  "gradcam_frames": ["http://localhost:8000/static/<job_id>/artefact_01.jpg", "..."],
  "thumbnail_url": "http://localhost:8000/static/<job_id>/thumb.jpg",
  "frames_analyzed": 101,
  "duration_seconds": 12.1,
  "model_version": "heuristic-1.0.0",
  "processing_time_ms": 4320,
  "notes": "..."
}
```

Per-modality `score` is how strongly that signal points to manipulation, higher meaning more
evidence. It is a measurement mapped onto a hand-set scale, **not a calibrated probability**.
`confidence` is distance from the decision threshold, discounted for thin evidence and capped
at 0.85. A branch that could not be measured reports `score: 0.5` with a "not assessable"
label and is excluded from fusion — check `notes` for which branches contributed.

> `gradcam_frames` keeps its name for API compatibility, but under the `heuristic` pipeline
> it carries measured artefact-map overlays on real frames, not network gradients.

---

## Training a real model

This is the work that would give the system a defensible accuracy figure. It is **not**
started — `RealPipeline` is a stub.

1. **Get a labelled corpus.** FaceForensics++, DFDC or Celeb-DF. All are access-gated behind
   a signed research agreement and run to hundreds of gigabytes.
2. **Get a CUDA GPU.** Not optional. Fine-tuning even a single EfficientNet-B0 visual branch
   is impractical on integrated graphics; the full four-branch stack is a multi-GPU job.
   Colab / Kaggle / RunPod are the usual routes if no local card is available.
3. Uncomment the torch/transformers block in `backend/requirements.txt` and install it.
4. Write the training scripts (dataset loaders, augmentation, per-branch training, fusion
   head, held-out evaluation). None of this exists yet.
5. Fill in the `TODO` blocks in `backend/app/inference/real.py`:
   - load the checkpoints in `__init__` and set `self._loaded = True`
   - decode frames + detect faces, write a thumbnail into `output_dir`
   - run the visual / audio / lip-sync branches, writing genuine Grad-CAM overlays
     (real gradients, unlike the heuristic pipeline's measured artefact map) into `output_dir`
   - fuse the branch outputs and return a `ResultDict`
6. Set `DEEPGUARD_PIPELINE=real` and restart.
7. **Report the held-out metrics**, and only then quote an accuracy number anywhere.

The heuristic pipeline is a reasonable baseline to compare a trained model against — it is
reproducible and its features are documented per-branch in `app/inference/signals/`.

The contract lives in `backend/app/inference/base.py`:

```python
class InferencePipeline(ABC):
    @abstractmethod
    def analyze(
        self,
        video_path: Path,
        progress_callback: ProgressCallback,  # (stage, percent, message) -> None
        output_dir: Path,
    ) -> ResultDict: ...
```

Call `progress_callback` with the stage keys in `STAGES` and their progress bands
(`extracting_frames` 0-20, `visual_analysis` 20-45, `audio_analysis` 45-65,
`lipsync_analysis` 65-85, `fusion` 85-100) and the existing progress UI just works.
`/health` reports `models_loaded` from the pipeline's `is_loaded` property.

---

## Project layout

```
backend/
  app/
    main.py            FastAPI app, CORS, /static + /media mounts, lifespan
    config.py          env-driven Settings (DEEPGUARD_* prefix)
    database.py        engine / SessionLocal / Base
    models.py          Job ORM model
    schemas.py         Pydantic response models + builders
    seed.py            demo history rows
    routers/           analyze.py, jobs.py, history.py, health.py
    services/
      storage.py       upload validation, streaming save, cleanup
      media.py         Pillow thumbnail + heatmap rendering (mock/seed only)
      job_runner.py    background task: pipeline -> DB progress/result
      overlay.py       real frame + measured artefact-map rendering (heuristic)
    inference/
      base.py          InferencePipeline ABC, ResultDict, STAGES
      heuristic.py     HeuristicPipeline (default) - fusion + honest confidence
      signals/         scan.py (decode + face detect), visual.py, audio.py,
                       lipsync.py, scoring.py (all operating points live here)
      mock.py          MockPipeline - random, never opens the video
      real.py          RealPipeline stub - not implemented
  uploads/  outputs/   local file storage

frontend/src/
  app/
    page.tsx                    Analyze: drag & drop, preview, live progress
    result/[jobId]/page.tsx     Result: verdict, gauge, modalities, artefact map, video, PDF
    history/page.tsx            Paginated grid with delete
    about/page.tsx              Method write-up (edit this text)
  components/                   NavBar, UploadZone, ProgressView, VerdictBanner,
                                ConfidenceGauge, ModalityCard, GradCamStrip, MethodNotice,
                                VerdictBadge, DownloadReportButton, ToastProvider
  hooks/useJobPolling.ts        2 s polling, stops on terminal state
  lib/                          api.ts (typed client), types.ts (mirrors Pydantic),
                                config.ts (env), format.ts, report.ts (jsPDF)
```

---

## Notes

- **Background jobs** use FastAPI `BackgroundTasks` — the worker runs in the threadpool and
  writes progress straight to the `jobs` table, which the UI polls. No Celery/Redis.
- **Errors** surface as toasts: oversized file, unsupported format, backend unreachable,
  failed job. The nav bar shows a live API/model status pill.
- **Type checking**: `npm run typecheck` (frontend, strict mode). Every API response has a
  Pydantic model on the backend and a matching interface in `lib/types.ts`.
- **Runtime**: the heuristic pipeline takes roughly 3–6 s per clip on a laptop CPU (decode
  dominates; 96 frames are sampled as 3 windows of 32 consecutive frames). The mock pipeline
  sleeps for 12–18 s instead, to exercise the polling and progress UI.
- **Seeded demo history** is generated by the mock pipeline, so those 5 rows carry
  `model_version: mock-0.1.0` and the result page flags them with a red demo warning. Set
  `DEEPGUARD_SEED_ON_STARTUP=false` to skip them.
