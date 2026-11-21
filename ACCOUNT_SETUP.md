# Activate the two-channel workflow

The integration code is present, but account authorization and continuous HTTPS hosting are required before it can run against your accounts. No credentials are included in GitHub. No live posts or Calendar events were created during development tests.

## 1. Keep the app running on an HTTPS host

Run one backend instance with a persistent database and media directory. The frontend and API must use the same site (for example `studio.example.com` and `api.example.com`) so strict session cookies work. GitHub is source hosting, not the backend worker. Instagram fetches approved video files through short-lived signed HTTPS URLs; localhost is insufficient.

Set `PUBLIC_API_URL` to your HTTPS API address, `FRONTEND_ORIGIN` to the exact frontend origin, and `COOKIE_SECURE=1`. Set the frontend's `NEXT_PUBLIC_API_URL` before building it. Create the owner account before exposing the workspace, or configure a strong `OWNER_SETUP_TOKEN` for initial setup. Keep `AUTH_REQUIRED=1`.

## 2. Configure server secrets

Use a private `backend/.env` for local operation, or your hosting provider's secret settings for deployment. Never enter secrets into chat or commit them to GitHub. Copy variable names from `backend/.env.example`.

Generate a token encryption key locally with:

```powershell
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Save it as `TOKEN_ENCRYPTION_KEY`. Keep a secure backup: changing it makes existing account tokens unreadable and requires reconnecting accounts. Generate a separate random secret for `MEDIA_SIGNING_KEY` with `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

OpenAI generation uses `OPENAI_API_KEY` and `GENERATION_MODE=openai`. API access and available credit are required; a ChatGPT login alone does not provide application credentials. Demo templates are explicitly blocked from approval for publishing.

## 3. Google Cloud: YouTube and Calendar

Create a Google Cloud application, enable YouTube Data API v3 and Google Calendar API, and configure an OAuth consent screen. Register a Web application OAuth client and save its ID/secret as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Register this exact redirect URI, using your API host:

`https://YOUR-API-HOST/api/connections/oauth/google/callback`

The app requests YouTube upload/read access and Calendar event access. Add your account as a test user while the consent application is in testing. Provider verification/audit and account restrictions may limit public uploads or offline token lifetime; a successful private upload is displayed as `uploaded_private`, not as published.

Open **Publishing → Publishing Queue** (also available through **Settings → Social Account Connections**). For each channel, choose **Connect YouTube + Calendar**, select the appropriate Google or Brand account, and grant the requested permissions. The app compares the authorized YouTube handle with `@TuraInfotech` or `@zenbeechannel` before saving encrypted credentials. It does not accept the wrong channel. Calendar events go to that authorized Google account's `primary` calendar unless `GOOGLE_CALENDAR_ID` is configured otherwise.

## 4. Meta: both Instagram professional accounts

Both Instagram accounts must be professional accounts supported by Instagram Login. Create/configure a Meta app with Instagram API setup and Business Login for Instagram. Set `INSTAGRAM_CLIENT_ID` and `INSTAGRAM_CLIENT_SECRET` using its Instagram application credentials.

Register:

`https://YOUR-API-HOST/api/connections/oauth/instagram/callback`

The app requests `instagram_business_basic` and `instagram_business_content_publish`. Add the accounts/people to the application as required for development access, or complete the required Meta review. Configure `INSTAGRAM_GRAPH_VERSION` to a version available to your app; the current code defaults to `v27.0`.

Connect each Instagram account in the Publishing Queue. The callback checks that the returned username matches `turainfotech` or `zenbee_channel`. Tokens are encrypted in the database and refreshed before expiration when supported. Provider revocation or expired grants require reconnection.

## 5. Review, Calendar reminders and scheduled publishing

1. Generate real content, inspect/edit it, and render the final video in AI Video Generator or Production Queue. Choose Runway animation for moving cartoon clips; the separate storyboard mode makes caption-card previews. Follow [ANIMATION_SETUP.md](ANIMATION_SETUP.md) to configure the video provider.
2. In Publishing Queue, choose the channel and completed render. Review the title, caption and whether the video is made for children. Saving chooses the next daily 4 PM or 7 PM India-time slot automatically.
3. Set `GOOGLE_CALENDAR_SYNC=1` to enable automatic Calendar synchronization. One event per release is created/updated with a popup reminder 15 minutes before the publishing time (3:45 PM / 6:45 PM). Enable Calendar notifications on your device. Creating a release less than 15 minutes before its slot cannot retroactively deliver the reminder. Cancelling a release removes its event on the next successful sync.
4. Watch the complete video, review its automatic YouTube thumbnail, metadata and audience setting, then select **Approve scheduled publishing**. Approval binds to the video, thumbnail and script. Changed files cannot publish through that release. The thumbnail is uploaded automatically to the resulting YouTube video; if YouTube rejects it, **Retry thumbnail only** retries the image without uploading a duplicate video. Existing approved releases from before this feature must be cancelled and reviewed again to include a thumbnail.
5. Set `AUTOMATED_PUBLISHING=1` only after accounts and public hosting are verified. Keep `PRODUCTION_WORKER=1`; the separate publishing worker checks every 15 seconds. It publishes only approved releases, checks both accounts and HTTPS media configuration first, and records each platform receipt independently.

An unapproved release becomes `held` when its time arrives. An approved release more than 15 minutes late becomes `missed`; it is not silently posted later. Cancel and create a new review/slot for held, missed, blocked or stale releases. Interrupted provider attempts become `needs_reconciliation`; inspect both platform accounts before any further attempt, because the provider may have accepted a post even if the response was lost. The system deliberately does not automatically retry uncertain social posts. There is no claim of exactly-once delivery across external APIs.

This is a single-owner, single-backend-instance workflow. Live account authorization, provider acceptance, hosting uptime and device Calendar delivery still need an end-to-end live trial. Do not enable publishing until that trial uses content you approve for release.

Official implementation references: [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [YouTube resumable uploads](https://developers.google.com/youtube/data/guides/using_resumable_upload_protocol), [Calendar events](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [Instagram Business Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login), [Instagram publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing).
