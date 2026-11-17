"use client";
import { useEffect, useState } from "react";
import type { Episode } from "./studio-shared";
import "./publishing.css";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
type Job = {
  id: number;
  episode_id: number;
  status: string;
  attempts: number;
  error: string | null;
  voice: boolean;
  renderer: "storyboard" | "animated";
  clips: {
    id: number;
    part: number;
    scene_index: number;
    duration: number;
    state: string;
    task_id: string | null;
  }[];
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
  const [renderer, setRenderer] = useState("animated");
  const [animationReady, setAnimationReady] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paidRetry, setPaidRetry] = useState<Record<number, boolean>>({});
  const [recovery, setRecovery] = useState<Record<number, string>>({});
  const chosen = episodes.find((e) => e.id === Number(selected));
  const totalSeconds =
    chosen?.story?.scenes.reduce((sum, s) => sum + s.duration_seconds, 0) || 0;
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
      if (status.ok) {
        const config = await status.json();
        setWorker(config.worker_enabled);
        setAnimationReady(config.animation_configured);
      }
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
      setMessage(
        path.endsWith("recover-task")
          ? "Task recovered. Resume the render to continue."
          : "Render queued. This page updates automatically.",
      );
      await refresh();
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
      if (path === "jobs") setPaid(false);
      if (path.endsWith("/retry"))
        setPaidRetry((previous) => ({
          ...previous,
          [Number(path.split("/")[1])]: false,
        }));
    }
  }
  return (
    <section className="z-card z-publishing" style={{ padding: 24 }}>
      <h2>Production Jobs & Video Export</h2>
      {worker === false && (
        <p role="alert">
          The production worker is disabled. Start the backend with
          PRODUCTION_WORKER=1 to process queued renders.
        </p>
      )}
      <p>
        Generate moving cartoon scenes with Runway Gen-4.5, then assemble a
        vertical MP4 with optional Tamil narration from OpenAI. Last-frame
        references help maintain visual continuity. Review character consistency
        and narration before publishing. Storyboard mode remains available for
        caption-card previews.
      </p>
      {!animationReady && (
        <p role="alert">
          Animated generation needs RUNWAYML_API_SECRET configured privately on
          the server and a funded Runway developer account. Your ChatGPT login
          does not supply this key.
        </p>
      )}
      <div
        style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "24px 0" }}
      >
        <label>
          Video type
          <select
            aria-label="Video type"
            value={renderer}
            onChange={(e) => {
              setRenderer(e.target.value);
              setPaid(false);
            }}
          >
            <option value="animated">AI animated video · Runway Gen-4.5</option>
            <option value="storyboard">Storyboard caption-card preview</option>
          </select>
        </label>
        <select
          aria-label="Episode to render"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setPaid(false);
          }}
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
        {renderer === "animated" && (
          <label>
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
            />{" "}
            I approve paid video generation for these scenes
            {totalSeconds ? ` (about ${totalSeconds} output seconds)` : ""}.
            Video and speech use separate provider credits.
          </label>
        )}
        {renderer === "animated" && chosen?.generation_mode === "demo" && (
          <p role="alert">
            Generate and review a real script first. Demo placeholders cannot
            start paid animation.
          </p>
        )}
        <button
          disabled={
            busy ||
            !selected ||
            (renderer === "animated" &&
              (!paid || !animationReady || chosen?.generation_mode === "demo"))
          }
          onClick={() =>
            submit("jobs", {
              episode_id: Number(selected),
              voice,
              renderer,
              paid_generation_approved: paid,
            })
          }
        >
          {renderer === "animated"
            ? "Generate animated MP4"
            : "Render storyboard MP4"}
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
            {job.renderer === "animated" ? "Runway animation" : "Storyboard"} ·{" "}
            {job.voice ? "AI narration" : "Silent"}
          </p>
          {job.error && <p role="alert">{job.error}</p>}
          {job.renderer === "animated" && (
            <div>
              <p>
                {job.clips.filter((c) => c.state === "downloaded").length} /{" "}
                {job.clips.length} clips downloaded
              </p>
              {job.clips.map((clip) => (
                <div key={clip.id} style={{ marginBottom: 10 }}>
                  <span>
                    Scene {clip.scene_index + 1}, shot {clip.part + 1}:{" "}
                    {clip.state} {clip.task_id ? `· Task ${clip.task_id}` : ""}
                  </span>
                  {["creating", "uncertain"].includes(clip.state) &&
                    job.status === "failed" && (
                      <div>
                        <input
                          aria-label={`Recover task ID for shot ${clip.part + 1}`}
                          placeholder="Task UUID from Runway dashboard"
                          value={recovery[clip.id] || ""}
                          onChange={(e) =>
                            setRecovery({
                              ...recovery,
                              [clip.id]: e.target.value,
                            })
                          }
                        />
                        <button
                          disabled={busy || !recovery[clip.id]}
                          onClick={() =>
                            submit(`jobs/${job.id}/recover-task`, {
                              clip_id: clip.id,
                              task_id: recovery[clip.id],
                            })
                          }
                        >
                          Recover existing task
                        </button>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
          {job.status === "failed" && job.renderer === "animated" && (
            <p>
              <label>
                <input
                  type="checkbox"
                  checked={!!paidRetry[job.id]}
                  onChange={(e) =>
                    setPaidRetry({ ...paidRetry, [job.id]: e.target.checked })
                  }
                />{" "}
                Allow new charges for failed scene generation or interrupted
                speech requests. Leave unchecked to resume existing tasks only.
              </label>
            </p>
          )}
          {job.status === "failed" && (
            <button
              disabled={busy}
              onClick={() =>
                submit(`jobs/${job.id}/retry`, {
                  regenerate_failed: !!paidRetry[job.id],
                  retry_speech: !!paidRetry[job.id],
                })
              }
            >
              Resume / retry render
            </button>
          )}
          {job.status === "completed" && (
            <>
              <video
                controls
                preload="metadata"
                crossOrigin="use-credentials"
                src={`${API}/api/production/jobs/${job.id}/video`}
                style={{
                  width: 180,
                  maxHeight: 320,
                  display: "block",
                  marginBottom: 12,
                }}
              >
                <track
                  kind="captions"
                  label="Scene captions"
                  srcLang="ta"
                  src={`${API}/api/production/jobs/${job.id}/captions.vtt`}
                  default
                />
              </video>
              <a href={`${API}/api/production/jobs/${job.id}/video`}>
                Download MP4
              </a>
              {" · "}
              <a href={`${API}/api/production/jobs/${job.id}/captions.srt`}>
                Download subtitles (SRT)
              </a>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
