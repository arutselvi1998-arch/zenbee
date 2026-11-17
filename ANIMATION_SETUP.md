# Animated cartoon generation

The app now supports real animated video generation through **Runway Gen-4.5**, assembled into a 720×1280 MP4. This is separate from the older storyboard caption-card renderer. OpenAI continues to generate scripts and optional Tamil narration; it is not used as a video backend because its Sora/Videos API was shut down on September 24, 2026.

## Activate

1. Create a Runway **developer API** account at https://dev.runway.com/ and add the credits needed for your selected generations. A ChatGPT account or a consumer video subscription does not configure this API.
2. Save the API secret privately as `RUNWAYML_API_SECRET` in `backend/.env` or your deployment secret store. Never paste it into chat or commit it. Keep `OPENAI_API_KEY` configured for scripts and optional narration.
3. Install the backend requirements, restart the API with `PRODUCTION_WORKER=1`, and keep its database and media directory persistent. Use exactly one worker instance.
4. Open **Content Studio → AI Video Generator** or **Automation → Production Queue**. Choose an episode with a real, reviewed script; demo placeholders cannot start paid animation.
5. Choose **AI animated video · Runway Gen-4.5**. Select optional AI narration, check the paid-generation consent box, then click **Generate animated MP4**.

## Generation and continuity

Each scene is generated as moving video. The first shot uses text-to-video; subsequent shots use the last frame of the previous generated shot as an image reference. Character and visual-style descriptions are copied into the render plan, so later series edits do not silently change an existing generation. This improves visual continuity but does not guarantee identical characters, correct physical behavior or lip sync. Narration is a voiceover, not a lip-sync system.

The current adapter uses Gen-4.5 at 720×1280. Its tasks support 2–10 seconds. Longer scene durations are split into multiple shots; a one-second scene is generated as two seconds and trimmed, so provider-billed duration may exceed final output duration. The finished episode retains its saved scene timings and stays within the existing 60-second script limit. Provider clips are downloaded locally, normalized to 24 FPS, and concatenated with FFmpeg. Temporary provider URLs are not used as permanent media storage.

Optional narration uses the saved Tamil script and the server's `OPENAI_TTS_MODEL` / `OPENAI_TTS_VOICE`. Generated narration is cached. If a voice track is longer than its scene, assembly stops rather than cutting off words: shorten narration or revise timing, review again, and create a new render. Cached visual clips remain on disk. Native provider audio is replaced by the selected voiceover, or silence if voiceover is off.

Completed jobs include browser captions and an SRT subtitle download with the saved scene timings. These are sidecar captions; subtitles are not burned into the exported MP4 or automatically uploaded as a YouTube caption track.

## Resume without duplicate requests

The database stores each Runway task ID before polling. A retry resumes known tasks and reuses downloaded clips. Provider polling is spaced at least five seconds apart; a task still pending after 30 minutes can be resumed later without submitting another generation.

If task submission is interrupted before its ID is saved, the scene is marked uncertain. The app refuses automatic resubmission. Find the task ID in your Runway dashboard and use **Recover existing task** on that shot, then resume the job. A task explicitly failed/cancelled by the provider requires the **Allow new charges** checkbox before regeneration. Interrupted speech requests likewise require explicit consent before another potentially billed request. Keep generated media and the database together when backing up or moving servers.

No provider API can guarantee exactly-once billing after every network failure. Inspect provider usage when a submission is uncertain. No live paid API request was made during development verification. Automated tests mock the provider while exercising actual FFmpeg motion-video assembly, frame references, resume behavior, subtitle timing and guarded retries. Visual quality, Tamil pronunciation and character consistency still need a live, owner-approved sample.

Completed animated MP4s use the existing review-gated Publishing Queue. Generating a video never approves it or publishes it to social accounts.

Official references: [Runway API](https://docs.dev.runwayml.com/api.md), [Runway model documentation](https://docs.dev.runwayml.com/guides/models.md), [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations).
