"use client";
import { useEffect, useState } from "react";
import type { Episode } from "./studio-shared";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
type Job = {
  id: number;
  episode_id: number;
  status: string;
  attempts: number;
  error: string | null;
  voice: boolean;
};
export default function ProductionWorkspace({
  episodes,
}: {
  episodes: Episode[];
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState("");
  const [voice, setVoice] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [worker, setWorker] = useState<boolean | null>(null);
  async function refresh() {
    try {
      const response = await fetch(`${API}/api/production/jobs`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Could not load production jobs");
      setJobs(await response.json());
      const status = await fetch(`${API}/api/production/status`, {
        credentials: "include",
      });
      if (status.ok) setWorker((await status.json()).worker_enabled);
    } catch (error) {
      setMessage(String(error));
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, []);
  async function submit(path: string, body?: object) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API}/api/production/${path}`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Request failed");
      setMessage("Render queued. This page updates automatically.");
      await refresh();
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="z-card" style={{ padding: 24 }}>
      <h2>Production Jobs & Video Export</h2>
      {worker === false && (
        <p role="alert">
          The production worker is disabled. Start the backend with
          PRODUCTION_WORKER=1 to process queued renders.
        </p>
      )}
      <p>
        Export your saved scenes as a vertical storyboard MP4. This renderer
        creates caption cards; animated AI cartoon generation still requires a
        video provider. AI speech uses your server’s OpenAI account and may
        incur charges.
      </p>
      <div
        style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "24px 0" }}
      >
        <select
          aria-label="Episode to render"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose a saved story</option>
          {episodes
            .filter((e) => e.story && e.status !== "cancelled")
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.story?.title || e.topic}
              </option>
            ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={voice}
            onChange={(e) => setVoice(e.target.checked)}
          />{" "}
          Generate AI speech (paid)
        </label>
        <button
          disabled={busy || !selected}
          onClick={() =>
            submit("jobs", { episode_id: Number(selected), voice })
          }
        >
          Render MP4
        </button>
      </div>
      <p role="status">{message}</p>
      {!jobs.length && (
        <p>No production jobs yet. Save a story, then start a render.</p>
      )}
      {jobs.map((job) => (
        <article
          key={job.id}
          style={{ padding: 16, borderBottom: "1px solid #e5d8ff" }}
        >
          <strong>
            Job #{job.id} · Episode {job.episode_id}
          </strong>
          <p>
            {job.status} · Attempt {job.attempts} ·{" "}
            {job.voice ? "AI speech" : "Silent"}
          </p>
          {job.error && <p role="alert">{job.error}</p>}
          {job.status === "failed" && (
            <button
              disabled={busy}
              onClick={() => submit(`jobs/${job.id}/retry`)}
            >
              Retry render
            </button>
          )}
          {job.status === "completed" && (
            <>
              <video
                controls
                preload="metadata"
                src={`${API}/api/production/jobs/${job.id}/video`}
                style={{
                  width: 180,
                  maxHeight: 320,
                  display: "block",
                  marginBottom: 12,
                }}
              />
              <a href={`${API}/api/production/jobs/${job.id}/video`}>
                Download MP4
              </a>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
