"use client";
import { useCallback, useEffect, useState, FormEvent } from "react";
import StudioViews from "./studio-views";
import AuthGate from "./auth-gate";
import "./studio.css";
import {
  AudioLines,
  BookOpen,
  Check,
  Clock3,
  LoaderCircle,
  Plus,
  Sparkles,
  WandSparkles,
} from "lucide-react";

type Series = {
  id: number;
  name: string;
  description: string;
  characters: string;
  visual_style: string;
};
type Scene = {
  number: number;
  duration_seconds: number;
  visual_prompt: string;
  dialogue: string;
  narration: string;
  caption: string;
};
type Story = {
  title: string;
  synopsis: string;
  continuity_notes: string;
  scenes: Scene[];
  description: string;
  hashtags: string[];
};
type Episode = {
  id: number;
  series_id: number;
  topic: string;
  publish_at: string;
  generate_at: string;
  status: string;
  story: Story | null;
  error: string | null;
  generation_mode: string | null;
  attempts: number;
};
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const date = (s: string) =>
  new Date(
    s.endsWith("Z") || /[+-]\d\d:\d\d$/.test(s) ? s : s + "Z",
  ).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + "/api" + path, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!r.ok) {
    let msg = "Request failed";
    try {
      const data = await r.json();
      msg =
        typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail);
    } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export default function Page() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
function Dashboard() {
  const [series, setSeries] = useState<Series[]>([]),
    [episodes, setEpisodes] = useState<Episode[]>([]),
    [mode, setMode] = useState("demo"),
    [connected, setConnected] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [modal, setModal] = useState<"series" | "episode" | "channel" | null>(null),
    [selected, setSelected] = useState<Episode | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [s, e, h] = await Promise.all([
        api<Series[]>("/series"),
        api<Episode[]>("/episodes"),
        api<{ generation_mode: string }>("/health"),
      ]);
      setSeries(s);
      setEpisodes(e);
      setMode(h.generation_mode);
      setConnected(true);
      setError("");
    } catch {
      setConnected(false);
      setError(
        "The studio API is offline. Start the backend to load your series and episodes.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!modal && !selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setModal(null);
        setSelected(null);
      }
      if (e.key === "Tab") {
        const dialog = document.querySelector('[role="dialog"]');
        const items = dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, select, textarea",
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const timer = setTimeout(
      () =>
        document
          .querySelector<HTMLElement>(
            '[role="dialog"] input, [role="dialog"] button',
          )
          ?.focus(),
      0,
    );
    document.addEventListener("keydown", handle);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [modal, selected, busy]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (modal === "series")
        await api("/series", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(f)),
        });
      else {
        const local = String(f.get("publish_at"));
        await api("/episodes", {
          method: "POST",
          body: JSON.stringify({
            series_id: Number(f.get("series_id")),
            topic: f.get("topic"),
            publish_at: new Date(local + ":00+05:30").toISOString(),
            lead_hours: Number(f.get("lead_hours")),
          }),
        });
      }
      setModal(null);
      setNotice(
        modal === "series"
          ? "Your new series is ready."
          : "Episode added to your publishing plan.",
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  async function generate(e: Episode) {
    setBusy(true);
    setError("");
    try {
      const result = await api<Episode>("/episodes/" + e.id + "/generate", {
        method: "POST",
      });
      setSelected(result);
      await refresh();
      if (result.status === "failed")
        setError(result.error || "Generation failed");
      else
        setNotice(
          mode === "demo"
            ? "Sample story created. Demo mode uses a template."
            : "Story and scene prompts generated.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }
  const currentSeries = (id: number) =>
    series.find((s) => s.id === id)?.name || "Series";
  const newEpisode = () => {
    if (!connected) {
      setError("Start the backend before creating an episode.");
      return;
    }
    if (!series.length) {
      setModal("series");
      setNotice("Create your first series to give your stories a home.");
    } else setModal("episode");
  };
  return (
    <>
      <StudioViews
        series={series}
        episodes={episodes}
        connected={connected}
        loading={loading}
        mode={mode}
        error={error}
        onNewEpisode={newEpisode}
        onNewSeries={() => setModal("series")}
        onOpen={setSelected}
        onConnect={() => setModal("channel")}
        onRefresh={refresh}
        notify={setNotice}
      />
      {modal && (
        <div className="modal-backdrop" onClick={() => !busy && setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              disabled={busy}
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              ×
            </button>
            {modal === "channel" ? (
              <>
                <span className="modal-symbol">
                  <AudioLines />
                </span>
                <h2 id="modal-title">Connect your audience.</h2>
                <p>
                  YouTube and Instagram integrations need server-side OAuth and
                  approved app permissions. They are not connected in this first
                  module.
                </p>
                <button
                  className="button primary full"
                  onClick={() => setModal(null)}
                >
                  Got it
                </button>
              </>
            ) : (
              <form onSubmit={submit}>
                <span className="modal-symbol">
                  {modal === "series" ? <BookOpen /> : <Sparkles />}
                </span>
                <h2 id="modal-title">
                  {modal === "series"
                    ? "A world of your own."
                    : "A new story starts here."}
                </h2>
                <p>
                  {modal === "series"
                    ? "Give your series a cast and a consistent visual identity."
                    : "Add an idea. Choose when your audience should see it."}
                </p>
                {error && (
                  <div className="form-error" role="alert">
                    {error}
                  </div>
                )}
                {modal === "series" ? (
                  <>
                    <label>
                      Series name
                      <input
                        name="name"
                        required
                        maxLength={100}
                        placeholder="Drawing Comes Alive"
                      />
                    </label>
                    <label>
                      About this series
                      <textarea
                        name="description"
                        maxLength={2000}
                        placeholder="Small sketches become big adventures."
                      />
                    </label>
                    <label>
                      Recurring characters
                      <textarea
                        name="characters"
                        required
                        maxLength={5000}
                        placeholder="Zee: a curious yellow bee with teal glasses…"
                      />
                    </label>
                    <label>
                      Visual style
                      <input
                        name="visual_style"
                        required
                        maxLength={2000}
                        placeholder="Soft 3D cartoon, pastel palette, warm light"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Series
                      <select name="series_id">
                        {series.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Episode topic
                      <textarea
                        name="topic"
                        required
                        maxLength={1000}
                        placeholder="A tiny bee discovers a flower that changes color…"
                      />
                    </label>
                    <label>
                      Publishing time · Asia/Kolkata
                      <input name="publish_at" type="datetime-local" required />
                    </label>
                    <label>
                      Start generation before publishing
                      <select name="lead_hours" defaultValue="24">
                        <option value="6">6 hours before</option>
                        <option value="24">24 hours before</option>
                        <option value="48">48 hours before</option>
                        <option value="168">7 days before</option>
                      </select>
                    </label>
                    <p className="micro-note">
                      Saves a one-time publishing plan. Story generation is
                      started manually in this version.
                    </p>
                  </>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="button primary" disabled={busy}>
                    {busy ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <Plus size={14} />
                    )}{" "}
                    {modal === "series" ? "Create series" : "Schedule episode"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
      {selected && (
        <div
          className="modal-backdrop"
          onClick={() => !busy && setSelected(null)}
        >
          <section
            className="modal detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              disabled={busy}
              aria-label="Close episode"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <span className="eyebrow">
              {currentSeries(selected.series_id)} · EPISODE {selected.id}
            </span>
            <h2 id="detail-title">{selected.topic}</h2>
            <div className="detail-meta">
              <span>
                <Clock3 size={13} />
                Publish: {date(selected.publish_at)} IST
              </span>
              <span>Generate after: {date(selected.generate_at)} IST</span>
            </div>
            {selected.error && (
              <div className="form-error">{selected.error}</div>
            )}
            {error && <div className="form-error">{error}</div>}
            {selected.story ? (
              <>
                <span className="status">
                  {selected.generation_mode === "demo"
                    ? "Sample template · not AI generated"
                    : "AI generated · review required"}
                </span>
                <p>{selected.story.synopsis}</p>
                <div className="memory">
                  <BookOpen size={15} />
                  <p>{selected.story.continuity_notes}</p>
                </div>
                {selected.story.scenes.map((s) => (
                  <article className="scene" key={s.number}>
                    <div>
                      <h3>Scene {s.number}</h3>
                      <span>{s.duration_seconds}s</span>
                    </div>
                    <h4>VIDEO PROMPT</h4>
                    <p>{s.visual_prompt}</p>
                    <h4>DIALOGUE</h4>
                    <p>{s.dialogue}</p>
                    <h4>NARRATION</h4>
                    <p>{s.narration}</p>
                    <h4>CAPTION</h4>
                    <p>{s.caption}</p>
                  </article>
                ))}
                <h3>Publishing copy</h3>
                <p>{selected.story.description}</p>
                <p className="hashtags">{selected.story.hashtags.join(" ")}</p>
                <button
                  className="button full"
                  onClick={() => {
                    const blob = new Blob(
                      [JSON.stringify(selected.story, null, 2)],
                      { type: "application/json" },
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `zenbee-episode-${selected.id}.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  Download script & prompts
                </button>
              </>
            ) : (
              <>
                <p>
                  Your topic is saved. Generate a script and structured scene
                  prompts using the series characters, visual style, and
                  previous episode memory.
                </p>
                <button
                  className="button primary full"
                  disabled={busy || selected.status === "generating"}
                  onClick={() => generate(selected)}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <WandSparkles size={15} />
                  )}{" "}
                  {busy
                    ? "Creating your story…"
                    : selected.status === "generating"
                      ? "Generation in progress"
                      : selected.status === "failed"
                        ? "Retry story generation"
                        : mode === "demo"
                          ? "Generate sample story"
                          : "Generate AI story & prompts"}
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          {notice}
        </div>
      )}
    </>
  );
}
