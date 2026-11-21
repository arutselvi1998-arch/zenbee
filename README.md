# ZENBEE Studio

First working module of the ZENBEE automation app: Next.js + Tailwind dashboard, FastAPI, PostgreSQL, series memory, episode scheduling, and structured story / scene-prompt generation.

## Automatic YouTube thumbnails

Completed renders automatically get a 1280×720 JPEG thumbnail from a representative video frame, with a channel badge and blurred side fill for portrait footage. This works with long or short MP4s without an image-generation API charge. Production Queue shows the image and a download link. Publishing Queue includes it in the required review, and changing it invalidates the release's approval. The YouTube adapter applies the reviewed image after upload and records thumbnail status separately from the video receipt. **Retry thumbnail only** updates the existing video without re-uploading it. YouTube account permissions and quota still apply; live thumbnail uploads have not been tested here. The video generator itself is still limited to 60 seconds; long-form video generation is a separate pending change.

## Open the local app on Windows

Double-click `Open-ZENBEE.cmd` in this folder. It starts the frontend and API in hidden background processes, waits until both respond, and opens http://localhost:3000. If they are already running, it reuses them. Logs are saved in `.logs/`.

This address works on the computer running ZENBEE. After shutting down or restarting Windows, launch `Open-ZENBEE.cmd` again. This launcher does not deploy a public website or turn on paid generation/publishing.

Animated generation is now implemented through Runway Gen-4.5, with per-scene task recovery, last-frame visual references, optional Tamil narration, MP4 assembly and subtitle downloads. See [ANIMATION_SETUP.md](ANIMATION_SETUP.md). It requires a funded Runway developer account and a server-side `RUNWAYML_API_SECRET`; no live paid sample has been generated or quality-checked yet. OpenAI remains the script/voice provider.

## Current status and chosen workflow

Source repository: https://github.com/arutselvi1998-arch/zenbee

Implemented: single-owner login, saved series and scripts, recurring episode materialization, opt-in unattended story generation, durable render jobs, real storyboard MP4 exports, optional OpenAI speech, manual script review, and local workspace settings. See the owner sign-in and production queue sections below for current configuration. Earlier reference-update sections describe the initial screen work and may refer to capabilities added later.

Chosen workflow: OpenAI generation → owner reviews the final video → approved videos publish to both YouTube and Instagram at the scheduled time, with a Google Calendar reminder 15 minutes beforehand. The OAuth connections, review-bound releases, platform adapters and Calendar synchronization are implemented and tested with provider mocks. They are not active against live accounts yet: application credentials, account consent and a continuously running HTTPS host are required. A ChatGPT login does not configure the app's OpenAI API credentials. Follow [ACCOUNT_SETUP.md](ACCOUNT_SETUP.md) for activation.

GitHub stores the source code and runs the included build/test workflow. It does not run this FastAPI backend or its scheduled worker. Continuous publishing requires an always-running host; no production hosting has been deployed. Never commit provider keys, OAuth tokens, the workspace database, or generated videos.

### Two separate channel plans

| Channel | Content | Language | Daily publishing time | Planned Calendar reminder |
| --- | --- | --- | --- | --- |
| Tura Infotech and Academy | Technical education | Tamil | 4:00 PM | 3:45 PM |
| Zenbee | Cartoon stories | Tamil | 7:00 PM | 6:45 PM |

All times use Asia/Kolkata. Both channels target their own YouTube and Instagram accounts, require owner review, and use separate series memory and recurring schedules. `config/channels.json` contains the exact account links and preferences. Technical generation uses an educational prompt; cartoon generation uses a storytelling prompt. The language instruction requires Tamil script for spoken narration, dialogue, captions and metadata. Demo mode remains a labeled English placeholder rather than pretending to be generated Tamil content.

To load these plans into a fresh workspace, run from `backend/`:

```powershell
python ../scripts/configure-channels.py --start-date 2026-11-17
```

The command is idempotent: it reuses each configured channel's series and schedule. It saves plans without contacting AI providers, creating Calendar events, publishing posts or modifying already materialized episode times. The authenticated `/api/channels` endpoint reports the saved profiles and disconnected Calendar/publishing state. In **Recurring Content Scheduler**, use **Create Episodes** to populate future episodes when ready.

## Reference design update

The settings / insights reference set adds nine more screens: Logs & Notifications, System Settings, Team & Permissions, Brand & Style Settings, Social Account Connections, AI Providers & API Keys, Generation Cost, AI Content Insights, and Episode Performance. The first three use the supplied dark robot banners; the other screens retain the cartoon / purple styling.

Settings are validated and saved in a new `WorkspaceSetting` table. Workspace name changes update the sidebar, and the saved generation lead time defaults new episode forms. Brand kits support palette / typography previews, image-logo upload (PNG/JPEG/WebP, under 250 KB), JSON import / export, and saved creative direction used by new story generation. Existing episodes and media are not retroactively changed.

Logs support filtering, pagination and export of real studio activity. Notification preferences control the in-app activity list; external delivery and scheduled summaries are preferences only. Provider status reports server configuration without returning any API key. The configuration check does not make a paid request or establish provider uptime / access.

Team member drafts and role matrices are planning records: no invitations are sent and no authentication or permissions are enforced. Social platform preferences do not connect accounts. Cost entries are manually recorded estimates in INR, with editable budget targets and local estimate alerts; there is no provider billing sync, token metering, automatic charge calculation or enforced spending cap. Insight ideas use story templates and local completeness checks. Performance metrics, keyword examples and heatmaps are explicitly labeled sample data until actual channel analytics is connected.

The latest publishing / automation reference set is implemented as twelve workspaces: channel analytics, publishing history, scheduled posts, Instagram and YouTube account managers, publishing calendar, failed jobs and retry, quality review, production queue, recurring scheduler, automation rules, and SEO / captions. Publishing Queue is also available from the sidebar.

Recurring schedules and ordered automation rules are validated and saved to new database tables. They are planning records: saving or enabling a plan does not start generation or publishing. The recurrence preview handles daily, weekly, monthly and custom hourly intervals in Asia/Kolkata; monthly dates that do not exist are skipped. The preview is bounded to 30 occurrences.

The review workspace saves script checklists, decisions and comments. Approving a script requires reviewing its storyline, characters and continuity; media checks remain pending. Editing the reviewed script resets its saved reviews to Pending. Approval never publishes content.

The SEO workspace prepares editable metadata templates from existing story content, checks local completeness, and saves per-episode drafts. This score is not a ranking prediction. Scheduled episode plans can be rescheduled, cancelled, and restored without deleting their scripts. Story retries use the existing generation endpoint and are logged with schedule / planning changes in Studio Activity. Publishing History contains no fabricated platform releases; its activity view is explicitly separate from real publication records.

Account managers and analytics include an optional, clearly labeled sample-data mode. No OAuth, live channel health, platform publishing, background automation, video rendering, or live analytics is connected by this update.

The interface now follows the supplied ZENBEE reference screens: dark purple sidebar, grouped navigation, pastel panels, cartoon banners, series cards, calendar, and content-production editors. Reference artwork is stored in `frontend/public/art/` and clipped with CSS; navigation, forms, tables and editor text are live HTML.

Available screens include overview, series dashboard and creation, character references, memory, episode history, activity, performance, ideas, content calendar, episode creation, script editor, scene/prompt editor, video settings, voice studio, video preview/editor, thumbnail creator, jobs, channels, analytics and settings.

Working behavior:

- Create series and schedule episodes in the database.
- Generate stories with the configured provider, edit and save scripts / scene prompts, and update series memory.
- Generate template-based ideas, bookmark ideas and save character references in this browser.
- Preview uploaded local audio/video; preview narration using the browser's speech synthesis.
- Edit thumbnail titles and filters and download a PNG using the supplied reference artwork.
- Save local production drafts and download JSON planning documents.

Design-preview data is labeled separately from workspace data. AI video generation, AI voice files, FFmpeg editing/mixing, rendering, real analytics and publishing remain unconnected. Reference preview images are not generated video files. Character references are local; put the cast into the series character details to include it in generated stories.

## Start with Docker

Requires Docker Compose. From this directory:

```powershell
docker compose up --build
```

Open http://localhost:3000. API docs: http://localhost:8000/docs. Database data persists in a Docker volume. Development services bind to localhost. This first module has no login; do not expose it publicly before adding authentication and authorization.

## Local development

Use Node.js 22+ and Python 3.12+. With a PostgreSQL server running, create the backend environment:

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
# Set DATABASE_URL in .env to your PostgreSQL connection.
.venv\Scripts\python -m uvicorn app.main:app --reload
```

For a quick local-only database, use `DATABASE_URL=sqlite:///./zenbee.db` in `backend/.env`. SQLite is only a development fallback; Compose uses PostgreSQL.

In another terminal:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

After dependencies are installed, Windows users can also launch both services with `powershell -ExecutionPolicy Bypass -File .\start-local.ps1` from the studio directory. This accepts a backend virtual environment or the workspace-local Python runtime used during development. The backend defaults to SQLite when no `DATABASE_URL` is set. Stop the frontend with Ctrl+C to stop the launcher-owned backend too.

The browser calls `http://localhost:8000` by default. Override `NEXT_PUBLIC_API_URL` before building if needed. Set backend `FRONTEND_ORIGIN` to match a changed frontend origin.

## Try the workflow

1. Create a series with recurring characters and a visual style.
2. Schedule an episode topic. All input times are Asia/Kolkata (IST), converted to UTC on save.
3. Open the episode and generate a sample story.
4. Review scene prompts, dialogue, narration, captions, continuity notes and SEO copy. Download the JSON.
5. Create another episode in the same series; generation receives the ten most recent generated stories from that series.

`GENERATION_MODE=demo` is the default. It uses explicit sample templates, makes no paid AI requests, and does not create videos. For real story generation set `GENERATION_MODE=openai`, `OPENAI_API_KEY`, and an accessible structured-output-capable `OPENAI_MODEL` on the backend, then restart. Compose reads these from your shell or a root `.env`; standalone FastAPI reads `backend/.env`. Provider errors leave a failed episode that can be retried. Atomic status transitions guard against duplicate generation requests.

## Scope and remaining modules

Publishing time and planned generation time are separate fields. Generation is planned 6 hours to 7 days in advance, clamped to the present if necessary. This version saves one-time plans and starts story generation manually. There is no unattended scheduler or automatic publishing yet.

Still to implement: enforced multi-user team roles and invitation delivery, timeline editing, AI thumbnail generation, a seven-day completed-video buffer, outbound email alerts, provider billing / cost metering and live analytics. Final media review and scheduled publishing now exist in Publishing Queue; the older script-review checklist remains a separate feature. Scripts ready is distinct from video ready. No consumer Google Flow automation or unverified video endpoint is used.

### Owner sign-in

The local launchers now set `AUTH_REQUIRED=0`, so the app opens directly into the dashboard with no login or owner setup screen. Compose also defaults to login off; set `AUTH_REQUIRED=1` in its environment to opt in. Existing owner accounts are retained. Untrusted browser origins are rejected for API writes even when login is off.

When optional owner sign-in is enabled, first create a username and a password of at least 12 characters. No default password exists. Passwords are salted and hashed with PBKDF2; session tokens are random, stored as hashes, and delivered through HttpOnly, SameSite=Strict cookies. Sessions expire after 12 hours and logout revokes them. Five incorrect passwords lock the account for 15 minutes. This is a single-owner workspace; saved team member and role plans do not create additional login accounts or enforce team roles.

Remote initial setup requires `OWNER_SETUP_TOKEN` configured on the backend and entered in the owner form. After setup, the owner cannot be recreated through the API. Keep database backups: password reset and recovery delivery are not implemented. For HTTPS deployment, set `COOKIE_SECURE=1`, configure the exact `FRONTEND_ORIGIN`, and use HTTPS for the frontend and API. The shipped launcher binds only to loopback. Direct backend commands must explicitly set `AUTH_REQUIRED=1`; tests intentionally run without it except security tests. Authenticated writes reject untrusted browser origins.

### Durable production queue and actual MP4 exports

Open **Automation → Production Queue**. Choose an episode with a saved story and click **Render MP4**. The local launcher enables the database-backed worker (`PRODUCTION_WORKER=1`). Each job snapshots its script, survives a server restart, and exposes its actual queued/rendering/completed/failed status. Completed videos can be played and downloaded from this screen. Files persist under `backend/media` (a named volume in Compose). The API limits retrieval to completed job IDs; it does not expose arbitrary filesystem paths.

The default renderer exports 720×1280 H.264/AAC storyboard caption cards at 24 FPS. It does **not** generate animated cartoons. Optional AI speech uses the server's `OPENAI_API_KEY` and `OPENAI_TTS_MODEL`; selecting it explicitly opts into provider charges. Each scene uses its saved duration, so review speech timing before sharing. Interrupted jobs become failed rather than silently repeating a billed request. Retry is manual, up to five attempts. Run exactly one backend application process while using this embedded worker; a separate distributed worker service remains future work.

To execute due story plans unattended, additionally set `AUTOMATED_STORIES=1`. This can call the configured paid story provider, so it is disabled by default. In the recurring scheduler, **Create Episodes** materializes the selected future window into scheduled episode records. Repeating the action skips previously created occurrences. Weekly and monthly dates follow the same India-time rules as the preview, including skipping nonexistent month days. `AUTOMATED_SCHEDULES=1` fills that future window every minute while the production worker is running. Pausing a plan stops future materialization; already created episodes retain their own schedules. None of these switches publishes anything to social accounts. Use `.env` on the server for credentials; never place them in frontend configuration.

Production queue validation includes an actual MP4 encode/download, duplicate active-job rejection, failure capture and manual retry. Provider speech and social publishing have not been tested against live accounts.

Before public production, add multi-user authorization if needed, migration management, managed secret storage, per-user limits, production database credentials, and recovery for stories interrupted while generating. `create_all` initializes new tables; it is not a migration system for existing columns.

## Validation

```powershell
cd backend
.venv\Scripts\python -m pytest tests -q
cd ../frontend
npm.cmd run typecheck
npm.cmd run build
```

Tests cover topic-to-prompt persistence, generation lead time, failed-job retry, duplicate generation protection, timezone validation, series-scoped memory, actual MP4 rendering, recurring episode materialization and owner session protection. Paid provider calls and external publishing are not exercised.

Verified in this workspace: production Next.js build, TypeScript checking, sixteen backend tests and eight recurrence checks (`node scripts/test-recurrence.mjs`, tested with Node 24), frontend HTTP 200, API health and CORS. An isolated Edge browser checked 33 workspace screens on desktop (1440 px) and mobile (390 px), including horizontal overflow and JavaScript exceptions. The browser workflow covers topic-to-prompt generation, script editing, PNG export, rules, recurring plans, SEO, reviews, schedule editing, workspace / brand settings, member drafts, role plans, budgets, manual estimates, notification preferences and safe provider-status checks. It also verifies that saved lead-time defaults appear in the episode form and saved brand direction reaches a new generated story. Backend tests used SQLite; PostgreSQL / Docker execution and paid AI generation were not tested here. `backend/requirements.lock.txt` records the tested Python environment; install it for exact package versions.

`scripts/browser-check.mjs` runs the visual/navigation checks against a running local frontend using installed Windows Edge. Set `ZENBEE_QA_WORKFLOW=1` only when the API points to an isolated QA database: the optional workflow creates test series and episodes. Browser screenshots and reports go into ignored `.qa/`.

Implementation references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [FastAPI SQL databases](https://fastapi.tiangolo.com/tutorial/sql-databases/), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
