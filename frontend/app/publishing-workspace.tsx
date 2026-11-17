"use client";
import { FormEvent, useEffect, useState } from "react";
import type { Episode } from "./studio-shared";
import "./publishing.css";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
type Channel = {
  key: string;
  name: string;
  series_id: number;
  publish_time: string;
  youtube_url: string;
  instagram_url: string;
};
type Job = {
  id: number;
  episode_id: number;
  status: string;
  story_snapshot: { title: string; description: string };
};
type Release = {
  id: number;
  job_id: number;
  channel_key: string;
  title: string;
  caption: string;
  made_for_kids: boolean;
  publish_at: string;
  status: string;
  calendar_status: string;
  error: string | null;
  platform_results: Record<string, { id: string; status: string }>;
};
type Connections = {
  google_configured: boolean;
  instagram_configured: boolean;
  automatic_publishing_enabled: boolean;
  calendar_sync_enabled: boolean;
  redirect_uris: Record<string, string>;
  connections: {
    channel_key: string;
    provider: string;
    account_label: string;
  }[];
};
async function api<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(API + "/api" + path, {
    credentials: "include",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Check the form and retry.",
    );
  return data;
}
const indiaDate = (value: string) =>
  new Date(
    /[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : value + "Z",
  ).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function PublishingWorkspace({
  episodes,
}: {
  episodes: Episode[];
}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [connections, setConnections] = useState<Connections | null>(null);
  const [key, setKey] = useState("");
  const [job, setJob] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [kids, setKids] = useState("");
  const [reviewed, setReviewed] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    try {
      const [profileData, jobData, releaseData, connectionData] =
        await Promise.all([
          api<{ channels: Channel[] }>("/channels"),
          api<Job[]>("/production/jobs"),
          api<Release[]>("/publishing/releases"),
          api<Connections>("/connections/status"),
        ]);
      setChannels(profileData.channels);
      setJobs(jobData);
      setReleases(releaseData);
      setConnections(connectionData);
      setKey((previous) => previous || profileData.channels[0]?.key || "");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load publishing workspace",
      );
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  const channel = channels.find((c) => c.key === key);
  const available = jobs.filter(
    (j) =>
      j.status === "completed" &&
      episodes.some(
        (e) => e.id === j.episode_id && e.series_id === channel?.series_id,
      ),
  );
  async function connect(channelKey: string, provider: string) {
    await run(async () => {
      const data = await api<{ authorization_url: string }>(
        `/connections/${channelKey}/${provider}/authorize`,
        {},
      );
      window.location.assign(data.authorization_url);
    });
  }
  function selectJob(value: string) {
    setJob(value);
    const selected = jobs.find((j) => j.id === Number(value));
    setTitle(selected?.story_snapshot.title.slice(0, 100) || "");
    setCaption(selected?.story_snapshot.description.slice(0, 2200) || "");
    setKids("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await api("/publishing/releases", {
        job_id: Number(job),
        channel_key: key,
        title,
        caption,
        made_for_kids: kids === "yes",
      });
      setMessage(
        "Scheduled for review. Watch the video below and approve when ready.",
      );
      selectJob("");
    });
  }
  return (
    <div className="z-publishing" style={{ display: "grid", gap: 20 }}>
      <section className="z-card" style={{ padding: 24 }}>
        <h2>Channel connections</h2>
        <p>
          Each channel keeps its own content and accounts. Connect the matching
          YouTube channel and Instagram professional account. Google
          authorization also enables Calendar reminders.
        </p>
        <p>
          Automatic publishing:{" "}
          <strong>
            {connections?.automatic_publishing_enabled
              ? "Enabled — approved releases only"
              : "Off until server activation"}
          </strong>{" "}
          · Google Calendar sync:{" "}
          <strong>
            {connections?.calendar_sync_enabled
              ? "Enabled"
              : "Off until server activation"}
          </strong>
        </p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {channels.map((c) => (
            <article
              key={c.key}
              style={{
                flex: "1 1 280px",
                minWidth: 0,
                padding: 16,
                border: "1px solid #e5d8ff",
                borderRadius: 12,
              }}
            >
              <h3>{c.name}</h3>
              <p>
                Tamil · Daily {c.publish_time} India time · Reminder 15 minutes
                before
              </p>
              <p>
                <a href={c.youtube_url} target="_blank" rel="noreferrer">
                  YouTube channel
                </a>{" "}
                ·{" "}
                <a href={c.instagram_url} target="_blank" rel="noreferrer">
                  Instagram account
                </a>
              </p>
              {(["google", "instagram"] as const).map((provider) => {
                const match = connections?.connections.find(
                  (r) => r.channel_key === c.key && r.provider === provider,
                );
                const configured =
                  provider === "google"
                    ? connections?.google_configured
                    : connections?.instagram_configured;
                return (
                  <div key={provider} style={{ marginTop: 12 }}>
                    <button
                      disabled={busy || !configured}
                      onClick={() => connect(c.key, provider)}
                    >
                      {match ? "Reconnect" : "Connect"}{" "}
                      {provider === "google"
                        ? "YouTube + Calendar"
                        : "Instagram"}
                    </button>
                    <p>
                      {match
                        ? `Authorized: ${match.account_label}`
                        : configured
                          ? "Ready to authorize"
                          : "OAuth application credentials needed on the server"}
                    </p>
                  </div>
                );
              })}
            </article>
          ))}
        </div>
        {!channels.length && (
          <p>Load the two channel plans before connecting accounts.</p>
        )}
        <details style={{ marginTop: 16 }}>
          <summary>Account setup information</summary>
          <p>
            Register these exact callback URLs in your Google Cloud and Meta
            applications. Keep application secrets on the server.
          </p>
          {Object.entries(connections?.redirect_uris || {}).map(
            ([provider, url]) => (
              <p key={provider} style={{ overflowWrap: "anywhere" }}>
                {provider}: {url}
              </p>
            ),
          )}
          <p>
            Instagram publishing needs a public HTTPS host. GitHub stores the
            code; a running backend performs scheduling. Calendar alerts also
            depend on your Calendar notification settings.
          </p>
        </details>
      </section>
      <section className="z-card" style={{ padding: 24 }}>
        <h2>Schedule a finished video for review</h2>
        <p>
          Choose a completed render. The next daily slot is selected
          automatically. Nothing publishes before you approve the exact video,
          title, caption and audience setting.
        </p>
        <form
          onSubmit={submit}
          style={{ display: "grid", gap: 14, maxWidth: 720 }}
        >
          <label>
            Channel
            <select
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                selectJob("");
              }}
              style={{ display: "block", width: "100%" }}
            >
              {channels.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name} · {c.publish_time} IST
                </option>
              ))}
            </select>
          </label>
          <label>
            Completed video
            <select
              required
              value={job}
              onChange={(e) => selectJob(e.target.value)}
              style={{ display: "block", width: "100%" }}
            >
              <option value="">Select a completed render</option>
              {available.map((j) => (
                <option key={j.id} value={j.id}>
                  #{j.id} · {j.story_snapshot.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Caption
            <textarea
              required
              maxLength={2200}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Is this video made for children?
            <select
              required
              value={kids}
              onChange={(e) => setKids(e.target.value)}
              style={{ display: "block", width: "100%" }}
            >
              <option value="">Choose the intended audience</option>
              <option value="yes">Yes, made for children</option>
              <option value="no">No, not made for children</option>
            </select>
          </label>
          <button disabled={busy || !job || !kids}>
            Save next daily slot · Require review
          </button>
        </form>
        <p role="status">{message}</p>
      </section>
      <section className="z-card" style={{ padding: 24 }}>
        <h2>Reviews and scheduled releases</h2>
        {!releases.length && <p>No finished videos scheduled yet.</p>}
        {releases.map((release) => (
          <article
            key={release.id}
            style={{ padding: "20px 0", borderBottom: "1px solid #e5d8ff" }}
          >
            <h3>{release.title}</h3>
            <p>
              {channels.find((c) => c.key === release.channel_key)?.name} ·{" "}
              {indiaDate(release.publish_at)} IST
            </p>
            <p>
              <strong>{release.status.replaceAll("_", " ")}</strong> · Calendar:{" "}
              {release.calendar_status}
            </p>
            <video
              controls
              preload="none"
              crossOrigin="use-credentials"
              src={`${API}/api/production/jobs/${release.job_id}/video`}
              style={{ width: 200, maxWidth: "100%", maxHeight: 350 }}
            />
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {release.caption}
            </p>
            <p>
              Made for children: {release.made_for_kids ? "Yes" : "No"} ·
              AI-generated media disclosure enabled
            </p>
            {release.error && <p role="alert">{release.error}</p>}
            {Object.entries(release.platform_results).map(
              ([platform, result]) => (
                <p key={platform}>
                  {platform}: {result.status} · Receipt {result.id}
                </p>
              ),
            )}
            {release.status === "pending_review" && (
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={!!reviewed[release.id]}
                    onChange={(e) =>
                      setReviewed({
                        ...reviewed,
                        [release.id]: e.target.checked,
                      })
                    }
                  />{" "}
                  I watched the full video and checked the title, caption and
                  audience setting.
                </label>
                <p>
                  <button
                    disabled={busy || !reviewed[release.id]}
                    onClick={() =>
                      run(async () => {
                        await api(
                          `/publishing/releases/${release.id}/approve`,
                          { reviewed_video_and_metadata: true },
                        );
                        setMessage(
                          "Approved for its scheduled slot. Server activation and both connected accounts are required.",
                        );
                      })
                    }
                  >
                    Approve scheduled publishing
                  </button>
                </p>
              </div>
            )}
            {[
              "pending_review",
              "approved",
              "held",
              "missed",
              "stale",
              "blocked",
            ].includes(release.status) && (
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api(`/publishing/releases/${release.id}/cancel`, {});
                    setMessage(
                      "Release cancelled. Choose the video again to schedule a fresh review.",
                    );
                  })
                }
              >
                Cancel release
              </button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
