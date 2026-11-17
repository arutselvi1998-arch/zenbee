"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Eye,
  FileText,
  Film,
  Heart,
  Instagram,
  Layers3,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Tag,
  Target,
  Trash2,
  Users,
  Video,
  WandSparkles,
  X,
  XCircle,
  Youtube,
  Zap,
} from "lucide-react";
import { Art, type Episode, type Series } from "./studio-shared";
import { occurrences, type Recurrence } from "./recurrence";

export const operationsPages = [
  "Automation Rules",
  "Recurring Content Scheduler",
  "Production Queue",
  "Publishing Queue",
  "Approval & Quality Review",
  "Failed Jobs & Retry",
  "Publishing Calendar",
  "YouTube Channel Manager",
  "Instagram Account Manager",
  "Scheduled Posts",
  "Publishing History",
  "Channel Analytics",
  "Analytics",
  "SEO & Caption Generator",
];
export const operationDescriptions: Record<string, string> = {
  "Automation Rules": "Build a workflow that makes room for more creativity.",
  "Recurring Content Scheduler":
    "Plan a steady rhythm for your next chapter — daily, weekly, monthly or custom.",
  "Production Queue":
    "Track your story jobs, review progress and keep your creative flow moving.",
  "Publishing Queue":
    "Your stories, getting ready for their moment in the spotlight.",
  "Approval & Quality Review":
    "Thoughtful stories deserve a thoughtful final review.",
  "Failed Jobs & Retry":
    "Find what needs attention and get your stories moving again.",
  "Publishing Calendar":
    "Plan your releases. Keep your next great story on the calendar.",
  "YouTube Channel Manager":
    "Create • Optimize • Schedule • Grow your YouTube universe.",
  "Instagram Account Manager":
    "A little creativity. A whole community of possibilities.",
  "Scheduled Posts":
    "Every planned story, in one place. Review and reschedule with ease.",
  "Publishing History": "A record of your stories and the people they reach.",
  "Channel Analytics": "Discover the stories your audience loves most.",
  Analytics: "Understand your audience. Grow your creative universe.",
  "SEO & Caption Generator":
    "Find the right words to help your next story find its audience.",
};
type Props = {
  page: string;
  series: Series[];
  episodes: Episode[];
  preview: boolean;
  connected: boolean;
  query: string;
  onNew: () => void;
  onNavigate: (s: string) => void;
  onOpen: (e: Episode) => void;
  onConnect: () => void;
  onRefresh: () => Promise<void>;
  notify: (s: string) => void;
};
type RuleData = {
  trigger: string;
  actions: string[];
  require_approval: boolean;
};
type ScheduleData = Recurrence & { series_id: number; platforms: string[] };
type ReviewData = {
  episode_id: number;
  decision: string;
  checklist: Record<string, boolean>;
  comment: string;
};
type SeoData = {
  episode_id: number;
  title: string;
  description: string;
  caption: string;
  tags: string[];
  platform: string;
};
type Saved<T> = {
  id: number;
  kind: string;
  name: string;
  enabled: boolean;
  data: T;
  updated_at: string;
};
type Event = {
  id: number;
  episode_id: number | null;
  action: string;
  detail: string;
  created_at: string;
};
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const actions = [
  "Generate story",
  "Generate video",
  "Add voice & music",
  "Prepare SEO",
  "Request review",
  "Publish content",
  "Send notification",
];
const checklist = [
  ["script", "Script & storyline", "Clear, engaging and family friendly"],
  [
    "characters",
    "Character consistency",
    "Appearance, personality and dialogue",
  ],
  ["continuity", "Story continuity", "World rules and previous episodes"],
  ["seo", "Title, description & captions", "Relevant, readable and accurate"],
];
const nowIST = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
function date(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
) {
  const d = new Date(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : value + "Z");
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...options });
}
function inputDate(value: string) {
  const d = new Date(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : value + "Z");
  return new Date(d.getTime() + 19800000).toISOString().slice(0, 16);
}
async function api<T>(
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
): Promise<T> {
  const result = await fetch(API + "/api" + path, {
    credentials: "include",
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await result.json();
  } catch {
    throw new Error("The studio API did not return a valid response.");
  }
  if (!result.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Check the required fields and publishing time.",
    );
  return data;
}
function exportJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const sampleStory = {
  title: "The Talking Panda",
  synopsis:
    "Tura discovers a little magic in her sketchbook — and a very unexpected new friend.",
  continuity_notes:
    "Keep Tura’s curly hair, yellow hoodie and kind-hearted personality consistent.",
  scenes: [1, 2, 3].map((number) => ({
    number,
    duration_seconds: 8,
    visual_prompt:
      "Warm 3D cartoon, a glowing sketchbook and a friendly panda.",
    dialogue: "Tura: “A little imagination goes a long way!”",
    narration: "A magical new adventure begins.",
    caption: "A little spark of magic.",
  })),
  description:
    "Join Tura and Panda for a magical story about imagination and friendship.",
  hashtags: ["#ZENBEE", "#TalkingPanda", "#KidsAnimation"],
};
const sampleEpisodes: Episode[] = [
  "The Talking Panda",
  "The Magical Sketch",
  "A Jungle of Surprises",
  "The Little Star’s Wish",
  "Back to the Drawing Room",
].map((topic, i) => ({
  id: -i - 1,
  series_id: -1,
  topic,
  publish_at: new Date(Date.now() + (i + 1) * 86400000).toISOString(),
  generate_at: new Date(Date.now() + i * 86400000).toISOString(),
  status: ["script_ready", "failed", "scheduled", "generating", "script_ready"][
    i
  ],
  story: i === 0 || i === 4 ? sampleStory : null,
  error: i === 1 ? "Example: a story provider request timed out." : null,
  generation_mode: "demo",
  attempts: i === 1 ? 2 : 1,
}));

export default function OperationsWorkspace(p: Props) {
  const [rules, setRules] = useState<Saved<RuleData>[]>([]),
    [schedules, setSchedules] = useState<Saved<ScheduleData>[]>([]),
    [reviews, setReviews] = useState<Saved<ReviewData>[]>([]),
    [seoRecords, setSeoRecords] = useState<Saved<SeoData>[]>([]),
    [events, setEvents] = useState<Event[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("All"),
    [activeId, setActiveId] = useState<number | null>(null),
    [selected, setSelected] = useState<number[]>([]),
    [exampleAnalytics, setExampleAnalytics] = useState(p.preview),
    [range, setRange] = useState("Last 28 Days"),
    [platform, setPlatform] = useState("All Platforms"),
    [seriesFilter, setSeriesFilter] = useState("All Series"),
    [scheduleEdit, setScheduleEdit] = useState(false),
    [publishTime, setPublishTime] = useState(""),
    [leadHours, setLeadHours] = useState("24"),
    [confirmCancel, setConfirmCancel] = useState(false),
    [ruleId, setRuleId] = useState<number | null>(null),
    [ruleName, setRuleName] = useState("My creative workflow"),
    [trigger, setTrigger] = useState("Episode scheduled"),
    [ruleActions, setRuleActions] = useState([
      "Generate story",
      "Prepare SEO",
      "Request review",
    ]),
    [approval, setApproval] = useState(true),
    [enabled, setEnabled] = useState(true),
    [scheduleId, setScheduleId] = useState<number | null>(null),
    [scheduleEnabled, setScheduleEnabled] = useState(true),
    [scheduleName, setScheduleName] = useState("A new episode, every day"),
    [recurrence, setRecurrence] = useState<ScheduleData>({
      series_id: p.series[0]?.id || 0,
      frequency: "Daily",
      time: "18:00",
      start_date: nowIST(),
      weekdays: [2, 4],
      month_day: 1,
      interval_hours: 24,
      count: 7,
      platforms: ["YouTube"],
    }),
    [reviewChecks, setReviewChecks] = useState<Record<string, boolean>>({}),
    [comment, setComment] = useState(""),
    [decisionFilter, setDecisionFilter] = useState("All"),
    [seoTitle, setSeoTitle] = useState("The Talking Panda"),
    [seoDescription, setSeoDescription] = useState(sampleStory.description),
    [seoCaption, setSeoCaption] = useState(
      "A little imagination. An unexpected new friend. 🐼✨",
    ),
    [seoTags, setSeoTags] = useState(
      "ZENBEE, TalkingPanda, KidsAnimation, MagicalStory",
    ),
    [seoPlatform, setSeoPlatform] = useState("YouTube"),
    [month, setMonth] = useState(() => Number(nowIST().slice(5, 7)) - 1),
    [year, setYear] = useState(() => Number(nowIST().slice(0, 4))),
    [selectedDay, setSelectedDay] = useState(nowIST()),
    [calendarView, setCalendarView] = useState("Month"),
    [growthTasks, setGrowthTasks] = useState<Record<string, boolean>>({});
  const eps = p.preview ? sampleEpisodes : p.episodes;
  const active = eps.find((e) => e.id === activeId) || eps[0];
  const allSeries = p.series;
  const displaySeries = (id: number) =>
    p.series.find((s) => s.id === id)?.name || "Drawing Comes Alive";
  const review = reviews.find((r) => r.data.episode_id === active?.id);
  const nextDates = occurrences(recurrence);
  const upcoming = eps
    .filter(
      (e) => e.status !== "cancelled" && new Date(e.publish_at) > new Date(),
    )
    .sort((a, b) => a.publish_at.localeCompare(b.publish_at));
  const jobs = eps.filter(
    (e) =>
      (["All", "Error Log", "Retry History"].includes(tab) ||
        e.status === tab) &&
      (p.page !== "Failed Jobs & Retry" || e.status === "failed") &&
      (!p.query ||
        `${e.id} ${e.topic} ${e.error || ""}`
          .toLowerCase()
          .includes(p.query.toLowerCase())),
  );
  async function load() {
    if (!p.connected) return;
    try {
      const [r, s, v, m, e] = await Promise.all([
        api<Saved<RuleData>[]>("/studio/records/automation_rule"),
        api<Saved<ScheduleData>[]>("/studio/records/recurring_schedule"),
        api<Saved<ReviewData>[]>("/studio/records/quality_review"),
        api<Saved<SeoData>[]>("/studio/records/seo"),
        api<Event[]>("/studio/events"),
      ]);
      setRules(r);
      setSchedules(s);
      setReviews(v);
      setSeoRecords(m);
      setEvents(e);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load studio plans.");
    }
  }
  useEffect(() => {
    load();
    setTab("All");
    setError("");
    setSelected([]);
    setScheduleEdit(false);
    setConfirmCancel(false);
  }, [p.page, p.connected]);
  useEffect(() => {
    if (!recurrence.series_id && p.series.length)
      setRecurrence((r) => ({ ...r, series_id: p.series[0].id }));
  }, [p.series]);
  useEffect(() => {
    setReviewChecks(review?.data.checklist || {});
    setComment(review?.data.comment || "");
    setPublishTime(active ? inputDate(active.publish_at) : "");
    setScheduleEdit(false);
    setConfirmCancel(false);
  }, [active?.id, review?.id, review?.updated_at]);
  useEffect(() => {
    const record = seoRecords.find((r) => r.data.episode_id === active?.id);
    setSeoTitle(
      record?.data.title || active?.story?.title || active?.topic || "",
    );
    setSeoDescription(
      record?.data.description || active?.story?.description || "",
    );
    setSeoCaption(record?.data.caption || active?.story?.synopsis || "");
    setSeoTags((record?.data.tags || active?.story?.hashtags || []).join(", "));
    setSeoPlatform(record?.data.platform || "YouTube");
  }, [active?.id, seoRecords]);
  useEffect(() => {
    try {
      setGrowthTasks(
        JSON.parse(localStorage.getItem("zenbee-growth-tasks") || "{}"),
      );
    } catch {}
  }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The studio could not complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  function needConnection() {
    if (!p.connected)
      throw new Error("Start the studio backend to save this plan.");
  }
  function needEpisode() {
    needConnection();
    if (!active || active.id < 1)
      throw new Error("Create a workspace episode before saving this change.");
    return active;
  }
  async function saveRecord<T>(
    kind: string,
    name: string,
    data: T,
    id?: number | null,
    flag = true,
  ) {
    needConnection();
    const saved = await api<Saved<T>>(
      `/studio/records/${kind}${id ? "/" + id : ""}`,
      { name, data, enabled: flag },
      id ? "PUT" : "POST",
    );
    await load();
    return saved;
  }
  function choose(id: number) {
    setActiveId(id);
    setScheduleEdit(false);
    setConfirmCancel(false);
  }
  function toggleSelected(id: number) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }
  function moveAction(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= ruleActions.length) return;
    const next = [...ruleActions];
    [next[index], next[target]] = [next[target], next[index]];
    setRuleActions(next);
  }
  async function retry(list: Episode[]) {
    needConnection();
    const failed = list.filter((e) => e.id > 0 && e.status === "failed");
    if (!failed.length)
      throw new Error("Select a failed workspace story job to retry.");
    let passed = 0;
    for (const episode of failed) {
      const result = await api<Episode>(`/episodes/${episode.id}/generate`, {});
      if (result.status === "script_ready") passed++;
    }
    await p.onRefresh();
    await load();
    p.notify(
      `${passed} of ${failed.length} story jobs recovered. No publishing was attempted.`,
    );
  }
  async function reviewDecision(decision: string) {
    const episode = needEpisode();
    await saveRecord(
      "quality_review",
      `Review · ${episode.topic}`.slice(0, 120),
      { episode_id: episode.id, decision, checklist: reviewChecks, comment },
      review?.id,
    );
    p.notify(
      decision === "Approved"
        ? "Script approved. Media quality review and publishing are still pending."
        : "Review saved. No content was published.",
    );
  }
  async function reschedule() {
    const episode = needEpisode();
    if (!publishTime) throw new Error("Choose a future publishing time.");
    await api(
      `/episodes/${episode.id}/schedule`,
      {
        publish_at: new Date(publishTime + ":00+05:30").toISOString(),
        lead_hours: Number(leadHours),
      },
      "PUT",
    );
    await p.onRefresh();
    await load();
    setScheduleEdit(false);
    p.notify("Publishing plan updated. Automatic publishing is not connected.");
  }
  async function cancelSchedule() {
    const episode = needEpisode();
    await api(`/episodes/${episode.id}/schedule`, { cancel: true }, "PUT");
    await p.onRefresh();
    await load();
    setConfirmCancel(false);
    p.notify("Episode schedule cancelled. The story record is preserved.");
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      p.notify("Copied to clipboard.");
    } catch {
      p.notify("Clipboard access is unavailable. Select the text to copy it.");
    }
  }
  function prepareSEO() {
    const title =
      active?.story?.title || seoTitle || active?.topic || "Your next story";
    setSeoTitle(
      `${title} | ${displaySeries(active?.series_id || 0)} | ZENBEE`.slice(
        0,
        150,
      ),
    );
    setSeoDescription(
      `${active?.story?.synopsis || seoDescription || "A new ZENBEE story is taking shape."}\n\nDiscover a little magic, imagination and friendship with ZENBEE. Follow along for the next adventure.`,
    );
    setSeoCaption(
      `${title} ✨\n${active?.story?.synopsis || "A little spark. A new adventure."}\n\nWhat should our characters discover next?`,
    );
    setSeoTags(
      [
        ...new Set([
          "ZENBEE",
          ...(active?.story?.hashtags || []).map((t) => t.replace(/^#/, "")),
          "Cartoon",
          "Shorts",
          "Animation",
        ]),
      ].join(", "),
    );
    p.notify(
      "Metadata draft prepared from your story. This is a template, not a new AI request.",
    );
  }
  const seoChecklist = [
    seoTitle.trim().length >= 20 && seoTitle.length <= 100,
    seoDescription.trim().length >= 80,
    seoTags.split(",").filter((t) => t.trim()).length >= 5,
    seoCaption.trim().length > 0,
  ];
  const seoScore = seoChecklist.filter(Boolean).length * 25;
  const summaries = [
    { label: "Total Jobs", value: eps.length, icon: Layers3, color: "purple" },
    {
      label: "Scheduled",
      value: eps.filter((e) => e.status === "scheduled").length,
      icon: CalendarDays,
      color: "blue",
    },
    {
      label: "Generating",
      value: eps.filter((e) => e.status === "generating").length,
      icon: Settings2,
      color: "orange",
    },
    {
      label: "Scripts Ready",
      value: eps.filter((e) => e.status === "script_ready").length,
      icon: CheckCircle2,
      color: "green",
    },
    {
      label: "Failed",
      value: eps.filter((e) => e.status === "failed").length,
      icon: XCircle,
      color: "pink",
    },
  ];
  const matching = (e: Episode) =>
    (!p.query || e.topic.toLowerCase().includes(p.query.toLowerCase())) &&
    (seriesFilter === "All Series" || String(e.series_id) === seriesFilter);
  const scheduledRows = eps.filter(
    (e) =>
      matching(e) &&
      (tab === "All" ||
        (tab === "Upcoming" &&
          new Date(e.publish_at) > new Date() &&
          e.status !== "cancelled") ||
        (tab === "This Week" &&
          new Date(e.publish_at) > new Date() &&
          new Date(e.publish_at).getTime() < Date.now() + 7 * 86400000) ||
        (tab === "Cancelled" && e.status === "cancelled")),
  );
  const graphValues =
    range === "Last 7 Days"
      ? [40, 62, 50, 89, 110, 92, 150]
      : range === "Last 90 Days"
        ? [20, 40, 32, 65, 45, 80, 100, 70, 110, 140, 130, 180]
        : [
            20, 52, 37, 65, 55, 98, 110, 84, 70, 125, 160, 145, 120, 190, 210,
            180, 225, 280,
          ];
  const showSample = exampleAnalytics;
  return (
    <div className="o-workspace">
      {error && (
        <div className="z-error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}
      {["Automation Rules", "Recurring Content Scheduler"].includes(p.page) && (
        <div className="o-planning-banner">
          <ShieldCheck size={15} />
          <span>
            <strong>Planning mode.</strong> Rules and recurring schedules save
            to your database. Background execution and publishing are not
            connected.
          </span>
        </div>
      )}

      {p.page === "Automation Rules" && (
        <>
          <div className="z-page-actions">
            <Tabs values={["All", "Templates"]} value={tab} onChange={setTab} />
            <button
              className="z-btn z-primary"
              onClick={() => {
                setRuleId(null);
                setRuleName("My creative workflow");
                setTrigger("Episode scheduled");
                setRuleActions([
                  "Generate story",
                  "Prepare SEO",
                  "Request review",
                ]);
                setEnabled(true);
              }}
            >
              <Plus size={15} />
              New Automation Rule
            </button>
          </div>
          <div className="o-rules-layout" hidden={tab === "Templates"}>
            <section className="z-card">
              <Heading
                title={`My Automation Rules (${rules.length})`}
                icon={Zap}
              />
              <div className="o-rule-list">
                {rules
                  .filter(
                    (r) =>
                      !p.query ||
                      r.name.toLowerCase().includes(p.query.toLowerCase()),
                  )
                  .map((r) => (
                    <div
                      className={ruleId === r.id ? "selected" : ""}
                      key={r.id}
                    >
                      <button
                        onClick={() => {
                          setRuleId(r.id);
                          setRuleName(r.name);
                          setTrigger(r.data.trigger);
                          setRuleActions(r.data.actions);
                          setApproval(r.data.require_approval);
                          setEnabled(r.enabled);
                        }}
                      >
                        <span className="o-round-icon">
                          <Zap size={17} />
                        </span>
                        <span>
                          <strong>{r.name}</strong>
                          <small>{r.data.trigger}</small>
                        </span>
                      </button>
                      <Toggle
                        value={r.enabled}
                        label={`Enable plan ${r.name}`}
                        onChange={() =>
                          run(async () => {
                            await saveRecord(
                              "automation_rule",
                              r.name,
                              r.data,
                              r.id,
                              !r.enabled,
                            );
                            p.notify(
                              "Rule plan updated. It will not run until a worker is connected.",
                            );
                          })
                        }
                      />
                    </div>
                  ))}
                {!rules.length && (
                  <div className="o-compact-empty">
                    <Zap size={26} />
                    <h3>Your creative flow starts here.</h3>
                    <p>Save a rule or start with a template.</p>
                  </div>
                )}
              </div>
            </section>
            <form
              className="z-card"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const saved = await saveRecord(
                    "automation_rule",
                    ruleName,
                    {
                      trigger,
                      actions: ruleActions,
                      require_approval: approval,
                    },
                    ruleId,
                    enabled,
                  );
                  p.notify(
                    "Automation plan saved. No background actions have run.",
                  );
                  setRuleId(saved.id);
                });
              }}
            >
              <Heading title="Create / Edit Automation Rule" icon={Pencil} />
              <div className="z-form-body">
                <div className="z-input-row">
                  <label>
                    Rule Name <em>*</em>
                    <input
                      required
                      maxLength={120}
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                    />
                  </label>
                  <label className="o-status-label">
                    Plan Status
                    <Toggle
                      value={enabled}
                      label="Enable automation plan"
                      onChange={() => setEnabled(!enabled)}
                    />
                    <small>{enabled ? "Enabled plan" : "Paused plan"}</small>
                  </label>
                </div>
                <div className="o-flow">
                  <div>
                    <Zap size={21} />
                    <span>
                      Trigger<small>When this happens</small>
                    </span>
                  </div>
                  <ArrowRight size={17} />
                  <div>
                    <Sparkles size={21} />
                    <span>
                      Actions<small>In this order</small>
                    </span>
                  </div>
                  <ArrowRight size={17} />
                  <div>
                    <CheckCircle2 size={21} />
                    <span>
                      Result<small>With your approval</small>
                    </span>
                  </div>
                </div>
                <div className="o-rule-editor-grid">
                  <div>
                    <label>
                      Trigger <em>*</em>
                      <select
                        value={trigger}
                        onChange={(e) => setTrigger(e.target.value)}
                      >
                        {[
                          "Episode scheduled",
                          "Script ready",
                          "Time based",
                          "New idea added",
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label className="o-check">
                      <input
                        type="checkbox"
                        checked={approval}
                        onChange={(e) => setApproval(e.target.checked)}
                      />
                      Require review before publishing
                    </label>
                    <div className="o-muted-note">
                      Saving a plan does not enable paid generation or external
                      publishing.
                    </div>
                  </div>
                  <div>
                    <label>
                      Actions in Order <em>*</em>
                    </label>
                    <div className="o-action-order">
                      {ruleActions.map((a, i) => (
                        <div key={i}>
                          <span>{i + 1}</span>
                          <strong>{a}</strong>
                          <button
                            type="button"
                            aria-label={`Move ${a} up`}
                            disabled={i === 0}
                            onClick={() => moveAction(i, -1)}
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${a} down`}
                            disabled={i === ruleActions.length - 1}
                            onClick={() => moveAction(i, 1)}
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${a}`}
                            onClick={() =>
                              setRuleActions(
                                ruleActions.filter((_, n) => n !== i),
                              )
                            }
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <select
                      aria-label="Add action"
                      value=""
                      onChange={(e) => {
                        if (e.target.value && ruleActions.length < 10)
                          setRuleActions([...ruleActions, e.target.value]);
                      }}
                    >
                      <option value="">+ Add Action</option>
                      {actions.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  className="z-btn z-primary z-full"
                  disabled={busy || !ruleActions.length}
                >
                  <Save size={14} />
                  Save Rule Plan
                </button>
              </div>
            </form>
            <div className="z-stack">
              <section className="z-card">
                <Heading title="Trigger Library" icon={Zap} />
                <div className="o-library">
                  {[
                    "Episode scheduled",
                    "Script ready",
                    "Time based",
                    "New idea added",
                  ].map((s) => (
                    <button key={s} onClick={() => setTrigger(s)}>
                      <CalendarDays size={17} />
                      {s}
                    </button>
                  ))}
                </div>
              </section>
              <section className="z-card">
                <Heading title="Action Library" icon={Sparkles} />
                <div className="o-library">
                  {actions.map((a) => (
                    <button
                      key={a}
                      disabled={ruleActions.length >= 10}
                      onClick={() => setRuleActions([...ruleActions, a])}
                    >
                      <Plus size={14} />
                      {a}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
          <section className="z-card o-template-panel">
            <Heading title="A Little Help Getting Started" icon={Sparkles} />
            <div className="o-template-grid">
              {[
                {
                  name: "Daily Episode",
                  trigger: "Time based",
                  actions: ["Generate story", "Prepare SEO", "Request review"],
                },
                {
                  name: "Review First",
                  trigger: "Script ready",
                  actions: ["Request review", "Send notification"],
                },
                {
                  name: "Multi-platform Release",
                  trigger: "Script ready",
                  actions: ["Prepare SEO", "Request review", "Publish content"],
                },
                {
                  name: "New Idea to Story",
                  trigger: "New idea added",
                  actions: ["Generate story", "Request review"],
                },
              ].map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => {
                    setRuleId(null);
                    setTab("All");
                    setRuleName(t.name);
                    setTrigger(t.trigger);
                    setRuleActions(t.actions);
                    setApproval(true);
                    p.notify(
                      "Template loaded. Review and save your automation plan.",
                    );
                  }}
                >
                  <span
                    className={
                      "z-stat-icon " + ["purple", "blue", "pink", "orange"][i]
                    }
                  >
                    <Zap size={23} />
                  </span>
                  <strong>{t.name}</strong>
                  <small>Use template</small>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {p.page === "Recurring Content Scheduler" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={["All", "Schedules", "Upcoming Preview"]}
              value={tab}
              onChange={setTab}
            />
            <button
              className="z-btn"
              onClick={() => p.onNavigate("Publishing Calendar")}
            >
              <CalendarDays size={14} />
              Content Calendar
            </button>
          </div>
          <div className="o-recurring-layout" data-view={tab}>
            <form
              className="z-card"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  if (!recurrence.series_id)
                    throw new Error("Create a workspace series first.");
                  const saved = await saveRecord(
                    "recurring_schedule",
                    scheduleName,
                    recurrence,
                    scheduleId,
                    scheduleEnabled,
                  );
                  p.notify(
                    "Recurring plan saved. Upcoming dates are a preview; no episodes were automatically created.",
                  );
                  setScheduleId(saved.id);
                });
              }}
            >
              <Heading
                title={
                  scheduleId
                    ? "Edit Recurring Schedule"
                    : "Create Recurring Schedule"
                }
                icon={CalendarDays}
              />
              <div className="z-form-body">
                <label>
                  Schedule Name <em>*</em>
                  <input
                    value={scheduleName}
                    required
                    maxLength={120}
                    onChange={(e) => setScheduleName(e.target.value)}
                  />
                </label>
                <label>
                  Content / Series <em>*</em>
                  <select
                    required
                    value={recurrence.series_id || ""}
                    onChange={(e) =>
                      setRecurrence({
                        ...recurrence,
                        series_id: Number(e.target.value),
                      })
                    }
                  >
                    <option value="" disabled>
                      Select a workspace series
                    </option>
                    {allSeries.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>Schedule Type</label>
                <div className="o-frequency">
                  {(["Daily", "Weekly", "Monthly", "Custom"] as const).map(
                    (s) => (
                      <button
                        type="button"
                        key={s}
                        className={recurrence.frequency === s ? "selected" : ""}
                        onClick={() =>
                          setRecurrence({ ...recurrence, frequency: s })
                        }
                      >
                        <CalendarDays size={19} />
                        {s}
                        {recurrence.frequency === s && (
                          <CheckCircle2 size={12} />
                        )}
                      </button>
                    ),
                  )}
                </div>
                {recurrence.frequency === "Weekly" && (
                  <>
                    <label>Repeat On</label>
                    <div className="o-weekdays">
                      {weekdays.map((s, i) => (
                        <button
                          key={s}
                          type="button"
                          className={
                            recurrence.weekdays.includes(i) ? "selected" : ""
                          }
                          onClick={() =>
                            setRecurrence({
                              ...recurrence,
                              weekdays: recurrence.weekdays.includes(i)
                                ? recurrence.weekdays.filter((d) => d !== i)
                                : [...recurrence.weekdays, i],
                            })
                          }
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {recurrence.frequency === "Monthly" && (
                  <label>
                    Day of Month
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={recurrence.month_day}
                      onChange={(e) =>
                        setRecurrence({
                          ...recurrence,
                          month_day: Number(e.target.value),
                        })
                      }
                    />
                    <small>Months without this day are skipped.</small>
                  </label>
                )}
                {recurrence.frequency === "Custom" && (
                  <label>
                    Repeat Every (Hours)
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={recurrence.interval_hours}
                      onChange={(e) =>
                        setRecurrence({
                          ...recurrence,
                          interval_hours: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                )}
                <div className="z-input-row">
                  <label>
                    Start Date
                    <input
                      required
                      type="date"
                      value={recurrence.start_date}
                      onChange={(e) =>
                        setRecurrence({
                          ...recurrence,
                          start_date: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Publish Time · IST
                    <input
                      required
                      type="time"
                      value={recurrence.time}
                      onChange={(e) =>
                        setRecurrence({ ...recurrence, time: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>Planned Platforms</label>
                <div className="o-platform-options">
                  {["YouTube", "Instagram"].map((s) => (
                    <label key={s}>
                      <input
                        type="checkbox"
                        checked={recurrence.platforms.includes(s)}
                        onChange={() =>
                          setRecurrence({
                            ...recurrence,
                            platforms: recurrence.platforms.includes(s)
                              ? recurrence.platforms.filter((v) => v !== s)
                              : [...recurrence.platforms, s],
                          })
                        }
                      />
                      {s === "YouTube" ? (
                        <Youtube size={17} />
                      ) : (
                        <Instagram size={17} />
                      )}
                      {s}
                    </label>
                  ))}
                </div>
                <label>
                  Preview Next Occurrences
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={recurrence.count}
                    onChange={(e) =>
                      setRecurrence({
                        ...recurrence,
                        count: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="o-check">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                  />
                  Enable this schedule plan
                </label>
                <button
                  className="z-btn z-primary z-full"
                  disabled={
                    busy || !nextDates.length || !recurrence.platforms.length
                  }
                >
                  <Save size={14} />
                  Save Recurring Plan
                </button>
              </div>
            </form>
            <div className="z-stack">
              <section className="z-card">
                <Heading
                  title={`Recurring Schedules (${schedules.length})`}
                  icon={RefreshCw}
                />
                <div className="o-schedule-list">
                  {schedules
                    .filter(
                      (s) =>
                        !p.query ||
                        s.name.toLowerCase().includes(p.query.toLowerCase()),
                    )
                    .map((s) => (
                      <div key={s.id}>
                        <span className="o-round-icon">
                          <CalendarDays size={18} />
                        </span>
                        <button
                          onClick={() => {
                            setScheduleId(s.id);
                            setScheduleName(s.name);
                            setRecurrence(s.data);
                            setScheduleEnabled(s.enabled);
                          }}
                        >
                          <strong>{s.name}</strong>
                          <small>{displaySeries(s.data.series_id)}</small>
                          <small>
                            {s.data.frequency} · {s.data.time} IST ·{" "}
                            {s.data.platforms.join(" + ")}
                          </small>
                        </button>
                        <button
                          disabled={!s.enabled || busy}
                          onClick={() =>
                            run(async () => {
                              const result = await api<{ created: number }>(
                                `/production/schedules/${s.id}/materialize`,
                                { method: "POST" },
                              );
                              await p.onRefresh();
                              p.notify(
                                `${result.created} episode plans created. Existing occurrences were skipped.`,
                              );
                            })
                          }
                        >
                          Create Episodes
                        </button>
                        <Toggle
                          value={s.enabled}
                          label={`Enable schedule ${s.name}`}
                          onChange={() =>
                            run(async () => {
                              await saveRecord(
                                "recurring_schedule",
                                s.name,
                                s.data,
                                s.id,
                                !s.enabled,
                              );
                              p.notify("Recurring plan updated.");
                            })
                          }
                        />
                      </div>
                    ))}
                  {!schedules.length && (
                    <CompactEmpty
                      title="Your creative rhythm starts here."
                      text="Save a recurring plan to keep your next stories organized."
                    />
                  )}
                </div>
              </section>
              <section className="z-card">
                <Heading title="Upcoming Dates · Preview" icon={CalendarDays} />
                <div className="o-next-dates">
                  {nextDates.slice(0, 7).map((d, i) => (
                    <div key={d}>
                      <span>{i + 1}</span>
                      <strong>
                        {date(d, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </strong>
                      <small>
                        {date(d, { hour: "2-digit", minute: "2-digit" })} IST
                      </small>
                    </div>
                  ))}
                  {!nextDates.length && (
                    <CompactEmpty
                      title="Choose a rhythm."
                      text="Select valid weekdays, a start date and a publishing time."
                    />
                  )}
                </div>
              </section>
            </div>
            <div className="z-stack">
              <section className="z-card o-summary-card">
                <CalendarDays size={28} />
                <h3>A little planning. A steady flow.</h3>
                <div className="o-big-number">{nextDates.length}</div>
                <p>upcoming occurrences in this preview</p>
                <button
                  className="z-btn z-soft z-full"
                  onClick={() =>
                    exportJson(
                      {
                        name: scheduleName,
                        timezone: "Asia/Kolkata",
                        plan: recurrence,
                        occurrences: nextDates,
                        execution_connected: false,
                      },
                      "zenbee-recurring-plan.json",
                    )
                  }
                >
                  <Download size={14} />
                  Export Plan
                </button>
              </section>
              <section className="z-card">
                <Heading title="Automation Settings" icon={Settings2} />
                <div className="o-checklist">
                  <div>
                    <CheckCircle2 size={17} />
                    <span>Generation planned before publishing</span>
                  </div>
                  <div>
                    <CheckCircle2 size={17} />
                    <span>Asia/Kolkata timezone</span>
                  </div>
                  <div>
                    <Clock3 size={17} />
                    <span>Background worker not connected</span>
                  </div>
                  <div>
                    <Clock3 size={17} />
                    <span>Platform publishing not connected</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </>
      )}

      {["Production Queue", "Publishing Queue", "Failed Jobs & Retry"].includes(
        p.page,
      ) && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={
                p.page === "Failed Jobs & Retry"
                  ? ["All", "Retry History", "Error Log"]
                  : ["All", "scheduled", "generating", "script_ready", "failed"]
              }
              value={tab}
              onChange={setTab}
            />
            <div>
              <button
                className="z-btn"
                onClick={() =>
                  run(async () => {
                    await p.onRefresh();
                    await load();
                  })
                }
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <button
                className="z-btn z-primary"
                disabled={busy}
                onClick={
                  p.page === "Failed Jobs & Retry"
                    ? () =>
                        run(() =>
                          retry(eps.filter((e) => selected.includes(e.id))),
                        )
                    : p.onNew
                }
              >
                {p.page === "Failed Jobs & Retry" ? (
                  <RefreshCw size={14} />
                ) : (
                  <Plus size={14} />
                )}
                {p.page === "Failed Jobs & Retry"
                  ? "Retry Selected Stories"
                  : "New Production Job"}
              </button>
            </div>
          </div>
          <MetricGrid items={summaries} />
          {p.page === "Failed Jobs & Retry" && tab === "Retry History" ? (
            <section className="z-card">
              <Heading
                title="Story Generation & Schedule Events"
                icon={Clock3}
              />
              <EventList events={events} query={p.query} />
            </section>
          ) : (
            <div className="o-jobs-layout">
              <section className="z-card">
                <Heading
                  title={
                    p.page === "Failed Jobs & Retry"
                      ? "Failed Story Jobs"
                      : "Production Jobs"
                  }
                  icon={Layers3}
                />
                <div className="z-table-wrap">
                  <table className="z-table o-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            aria-label="Select all visible jobs"
                            checked={
                              jobs.length > 0 &&
                              jobs.every((e) => selected.includes(e.id))
                            }
                            onChange={(e) =>
                              setSelected(
                                e.target.checked ? jobs.map((e) => e.id) : [],
                              )
                            }
                          />
                        </th>
                        <th>Job / Episode</th>
                        <th>Stage</th>
                        <th>Progress</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs
                        .filter(
                          (e) =>
                            p.page !== "Failed Jobs & Retry" ||
                            e.status === "failed",
                        )
                        .map((e, i) => (
                          <tr
                            key={e.id}
                            className={active?.id === e.id ? "selected" : ""}
                          >
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Select ${e.topic}`}
                                checked={selected.includes(e.id)}
                                onChange={() => toggleSelected(e.id)}
                              />
                            </td>
                            <td>
                              <button
                                className="o-table-title"
                                onClick={() => choose(e.id)}
                              >
                                <EpisodeArt index={i} />
                                <span>
                                  <strong>{e.topic}</strong>
                                  <small>
                                    {e.id < 0
                                      ? "Sample job"
                                      : `STORY-${String(e.id).padStart(4, "0")}`}{" "}
                                    · {displaySeries(e.series_id)}
                                  </small>
                                </span>
                              </button>
                            </td>
                            <td>Story & prompts</td>
                            <td>
                              <div className="o-progress">
                                <i
                                  style={{
                                    width:
                                      e.status === "script_ready"
                                        ? "100%"
                                        : e.status === "generating"
                                          ? "45%"
                                          : "0%",
                                  }}
                                />
                              </div>
                              <small>
                                {e.status === "script_ready"
                                  ? "Script complete"
                                  : e.status === "generating"
                                    ? "Working…"
                                    : "Not complete"}
                              </small>
                            </td>
                            <td>
                              <Status value={e.status} />
                            </td>
                            <td>
                              <div className="o-table-actions">
                                <button
                                  aria-label={`View ${e.topic}`}
                                  onClick={() => choose(e.id)}
                                >
                                  <Eye size={14} />
                                </button>
                                {e.status === "failed" && (
                                  <button
                                    aria-label={`Retry ${e.topic}`}
                                    disabled={busy || e.id < 0}
                                    onClick={() => run(() => retry([e]))}
                                  >
                                    <RefreshCw size={14} />
                                  </button>
                                )}
                                <button
                                  aria-label={`Open episode ${e.topic}`}
                                  onClick={() =>
                                    e.id > 0
                                      ? p.onOpen(e)
                                      : p.notify(
                                          "This is a sample job. Create your own workspace episode to run it.",
                                        )
                                  }
                                >
                                  <ArrowUpRight size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!jobs.filter(
                  (e) =>
                    p.page !== "Failed Jobs & Retry" || e.status === "failed",
                ).length && (
                  <CompactEmpty
                    title={
                      p.page === "Failed Jobs & Retry"
                        ? "All clear. Keep creating!"
                        : "Your next story starts here."
                    }
                    text={
                      p.page === "Failed Jobs & Retry"
                        ? "There are no matching failed story jobs."
                        : "Schedule an episode to add a story job to your queue."
                    }
                  />
                )}
              </section>
              <div className="z-stack">
                <section className="z-card">
                  <Heading
                    title={
                      active?.status === "failed"
                        ? "Error Details"
                        : "Selected Job"
                    }
                    icon={active?.status === "failed" ? XCircle : Film}
                  />
                  <div className="z-form-body">
                    {active ? (
                      <>
                        <Art source="review" crop={[728, 320, 444, 250]} />
                        <h3 className="o-detail-title">{active.topic}</h3>
                        <Status value={active.status} />
                        <div className="o-detail-rows">
                          <div>
                            <span>Stage</span>
                            <strong>Story & prompts</strong>
                          </div>
                          <div>
                            <span>Attempts</span>
                            <strong>{active.attempts}</strong>
                          </div>
                          <div>
                            <span>Publish plan</span>
                            <strong>{date(active.publish_at)} IST</strong>
                          </div>
                        </div>
                        {active.error && (
                          <div className="o-error-note">
                            {active.error}
                            <p>
                              Check the configured provider, connectivity and
                              quota. Retry the story job after resolving the
                              issue.
                            </p>
                          </div>
                        )}
                        <button
                          className="z-btn z-primary z-full"
                          disabled={busy || active.id < 0}
                          onClick={() =>
                            active.status === "failed"
                              ? run(() => retry([active]))
                              : p.onOpen(active)
                          }
                        >
                          {active.status === "failed" ? (
                            <RefreshCw size={14} />
                          ) : (
                            <FileText size={14} />
                          )}
                          {active.status === "failed"
                            ? "Retry Story Generation"
                            : "Open Episode"}
                        </button>
                        <p className="z-help-text">
                          Preview artwork is a reference. Script progress does
                          not mean a video has been generated.
                        </p>
                      </>
                    ) : (
                      <p>Select a job to see its details.</p>
                    )}
                  </div>
                </section>
                <section className="z-card">
                  <Heading title="Production Services" icon={Settings2} />
                  <div className="o-service-list">
                    {[
                      [
                        "Story generation",
                        p.connected ? "API connected" : "Offline",
                      ],
                      ["Video rendering", "Not connected"],
                      ["Audio processing", "Not connected"],
                      ["Platform publishing", "Not connected"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <span>{k}</span>
                        <span className="z-tag">{v}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}
          <section className="z-card o-template-panel">
            <Heading title="Your Production Journey" icon={Zap} />
            <div className="o-pipeline">
              {[
                "Idea / Script",
                "Scenes & Prompts",
                "Video & Voice",
                "Edit & Review",
                "Publish",
              ].map((s, i) => (
                <div key={s}>
                  <span
                    className={"z-stat-icon " + (i < 2 ? "green" : "purple")}
                  >
                    {
                      [
                        <FileText key="s" />,
                        <Sparkles key="p" />,
                        <Video key="v" />,
                        <ShieldCheck key="r" />,
                        <ArrowUpRight key="u" />,
                      ][i]
                    }
                  </span>
                  <strong>{s}</strong>
                  <small>{i < 2 ? "Available" : "Integration pending"}</small>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {p.page === "Approval & Quality Review" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={[
                "All",
                "Pending",
                "Approved",
                "Changes requested",
                "Rejected",
              ]}
              value={decisionFilter}
              onChange={setDecisionFilter}
            />
            <button className="z-btn" onClick={() => run(load)}>
              <RefreshCw size={14} />
              Refresh Reviews
            </button>
          </div>
          <div className="o-review-layout">
            <section className="z-card">
              <Heading title="Content Review Queue" icon={ShieldCheck} />
              <div className="o-review-queue">
                {eps
                  .filter(
                    (e) =>
                      matching(e) &&
                      (decisionFilter === "All" ||
                        (reviews.find((r) => r.data.episode_id === e.id)?.data
                          .decision || "Pending") === decisionFilter),
                  )
                  .map((e, i) => (
                    <button
                      key={e.id}
                      className={active?.id === e.id ? "selected" : ""}
                      onClick={() => choose(e.id)}
                    >
                      <EpisodeArt index={i} />
                      <span>
                        <strong>{e.topic}</strong>
                        <small>{displaySeries(e.series_id)}</small>
                        <Status
                          value={
                            reviews.find((r) => r.data.episode_id === e.id)
                              ?.data.decision || "Pending"
                          }
                        />
                      </span>
                    </button>
                  ))}
                {!eps.length && (
                  <CompactEmpty
                    title="A little care before the spotlight."
                    text="Create and generate an episode to begin its script review."
                  />
                )}
              </div>
            </section>
            <section className="z-card">
              <Heading title="Review Content" icon={Film} />
              <div className="z-form-body">
                <Art source="review" crop={[728, 320, 444, 250]} />
                <h3 className="o-detail-title">
                  {active?.topic || "Choose an episode"}
                </h3>
                <span className="z-tag">
                  Reference artwork · no rendered video attached
                </span>
                <div className="o-review-script">
                  <h4>SCRIPT & STORY</h4>
                  <p>
                    {active?.story?.synopsis ||
                      "Generate a story before approving its script review."}
                  </p>
                  {active?.story?.scenes.map((s) => (
                    <div key={s.number}>
                      <strong>
                        Scene {s.number} · {s.duration_seconds}s
                      </strong>
                      <p>{s.narration}</p>
                      <p>{s.dialogue}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <div className="z-stack">
              <section className="z-card">
                <Heading title="Script Review Checklist" icon={ShieldCheck} />
                <div className="o-review-checks">
                  {checklist.map(([key, label, description]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={!!reviewChecks[key]}
                        onChange={(e) =>
                          setReviewChecks({
                            ...reviewChecks,
                            [key]: e.target.checked,
                          })
                        }
                      />
                      <span>
                        <strong>{label}</strong>
                        <small>{description}</small>
                      </span>
                      <span
                        className={
                          "z-tag " + (reviewChecks[key] ? "green" : "amber")
                        }
                      >
                        {reviewChecks[key] ? "Reviewed" : "Review"}
                      </span>
                    </label>
                  ))}
                  {[
                    "Video quality & animation",
                    "Audio & voiceover quality",
                    "Thumbnail / cover",
                    "Rights & final publishing checks",
                  ].map((s) => (
                    <div className="o-media-pending" key={s}>
                      <Clock3 size={14} />
                      <span>{s}</span>
                      <span className="z-tag amber">Media pending</span>
                    </div>
                  ))}
                </div>
                <div className="z-form-body">
                  <label>
                    Review Comments
                    <textarea
                      rows={4}
                      maxLength={3000}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="A little feedback to make this story even better…"
                    />
                  </label>
                  <div className="o-review-actions">
                    <button
                      className="z-btn o-approve"
                      disabled={busy || !active?.story}
                      onClick={() => run(() => reviewDecision("Approved"))}
                    >
                      <Check size={15} />
                      Approve Script
                    </button>
                    <button
                      className="z-btn"
                      disabled={busy}
                      onClick={() =>
                        run(() => reviewDecision("Changes requested"))
                      }
                    >
                      <Pencil size={14} />
                      Request Changes
                    </button>
                    <button
                      className="z-btn o-reject"
                      disabled={busy}
                      onClick={() => run(() => reviewDecision("Rejected"))}
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                  </div>
                  <p className="z-help-text">
                    Script approval does not approve media or trigger
                    publishing.
                  </p>
                </div>
              </section>
              <section className="z-card">
                <Heading title="Review Summary" icon={BarChart3} />
                <div className="o-review-summary">
                  {["Approved", "Pending", "Changes requested", "Rejected"].map(
                    (s) => (
                      <div key={s}>
                        <strong>
                          {s === "Pending"
                            ? eps.filter(
                                (e) =>
                                  !reviews.some(
                                    (r) =>
                                      r.data.episode_id === e.id &&
                                      r.data.decision !== "Pending",
                                  ),
                              ).length
                            : reviews.filter((r) => r.data.decision === s)
                                .length}
                        </strong>
                        <small>{s}</small>
                      </div>
                    ),
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      )}

      {p.page === "Scheduled Posts" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={["All", "Upcoming", "This Week", "Cancelled"]}
              value={tab}
              onChange={setTab}
            />
            <div>
              <select
                aria-label="Filter series"
                value={seriesFilter}
                onChange={(e) => setSeriesFilter(e.target.value)}
              >
                <option>All Series</option>
                {allSeries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button className="z-btn z-primary" onClick={p.onNew}>
                <Plus size={14} />
                Schedule New Episode
              </button>
            </div>
          </div>
          <MetricGrid
            items={[
              {
                label: "Episode Plans",
                value: eps.length,
                icon: CalendarDays,
                color: "purple",
              },
              {
                label: "Upcoming",
                value: upcoming.length,
                icon: Clock3,
                color: "green",
              },
              {
                label: "Scripts Ready",
                value: eps.filter((e) => e.story).length,
                icon: FileText,
                color: "blue",
              },
              {
                label: "Cancelled",
                value: eps.filter((e) => e.status === "cancelled").length,
                icon: XCircle,
                color: "pink",
              },
            ]}
          />
          <div className="o-scheduled-layout">
            <section className="z-card">
              <Heading title="Scheduled Episode Plans" icon={CalendarDays} />
              <div className="z-table-wrap">
                <table className="z-table o-table">
                  <thead>
                    <tr>
                      <th>Content / Title</th>
                      <th>Series</th>
                      <th>Publishing Time · IST</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledRows.map((e, i) => (
                      <tr
                        className={active?.id === e.id ? "selected" : ""}
                        key={e.id}
                      >
                        <td>
                          <button
                            className="o-table-title"
                            onClick={() => choose(e.id)}
                          >
                            <EpisodeArt index={i} />
                            <span>
                              <strong>{e.topic}</strong>
                              <small>
                                {e.id < 0
                                  ? "Sample episode"
                                  : `Episode ${e.id}`}
                              </small>
                            </span>
                          </button>
                        </td>
                        <td>{displaySeries(e.series_id)}</td>
                        <td>{date(e.publish_at)}</td>
                        <td>
                          <Status value={e.status} />
                        </td>
                        <td>
                          <div className="o-table-actions">
                            <button
                              aria-label={`Edit schedule for ${e.topic}`}
                              onClick={() => {
                                choose(e.id);
                                setPublishTime(inputDate(e.publish_at));
                                setScheduleEdit(true);
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              aria-label={`Review ${e.topic}`}
                              onClick={() => choose(e.id)}
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!scheduledRows.length && (
                <CompactEmpty
                  title="A little space for your next story."
                  text="No episode plans match these filters."
                />
              )}
            </section>
            <ScheduleDetails
              active={active}
              displaySeries={displaySeries}
              scheduleEdit={scheduleEdit}
              setScheduleEdit={setScheduleEdit}
              publishTime={publishTime}
              setPublishTime={setPublishTime}
              leadHours={leadHours}
              setLeadHours={setLeadHours}
              busy={busy}
              onSave={() => run(reschedule)}
              confirmCancel={confirmCancel}
              setConfirmCancel={setConfirmCancel}
              onCancel={() => run(cancelSchedule)}
              onConnect={p.onConnect}
            />
          </div>
        </>
      )}

      {p.page === "Publishing Calendar" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={["Month", "Schedule List"]}
              value={calendarView}
              onChange={setCalendarView}
            />
            <div className="o-month-controls">
              <button
                className="z-btn"
                aria-label="Previous month"
                onClick={() => {
                  if (month === 0) {
                    setMonth(11);
                    setYear(year - 1);
                  } else setMonth(month - 1);
                }}
              >
                <ChevronLeft size={15} />
              </button>
              <strong>
                {new Date(year, month).toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                })}
              </strong>
              <button
                className="z-btn"
                aria-label="Next month"
                onClick={() => {
                  if (month === 11) {
                    setMonth(0);
                    setYear(year + 1);
                  } else setMonth(month + 1);
                }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
            <button className="z-btn z-primary" onClick={p.onNew}>
              <Plus size={14} />
              Create Schedule
            </button>
          </div>
          <div className="o-calendar-layout">
            <section className="z-card">
              {calendarView === "Month" ? (
                <>
                  <div className="o-calendar-days">
                    {weekdays.map((s) => (
                      <strong key={s}>{s}</strong>
                    ))}
                  </div>
                  <div className="o-calendar-grid">
                    {Array.from(
                      {
                        length:
                          Math.ceil(
                            (new Date(year, month, 1).getDay() +
                              new Date(year, month + 1, 0).getDate()) /
                              7,
                          ) * 7,
                      },
                      (_, i) => {
                        const day = i - new Date(year, month, 1).getDay() + 1;
                        const valid =
                          day > 0 &&
                          day <= new Date(year, month + 1, 0).getDate();
                        const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const items = eps.filter(
                          (e) =>
                            e.status !== "cancelled" &&
                            inputDate(e.publish_at).slice(0, 10) === key,
                        );
                        return (
                          <div
                            className={
                              "o-calendar-cell " +
                              (selectedDay === key ? "selected" : "") +
                              (!valid ? " inactive" : "")
                            }
                            key={i}
                          >
                            {valid && (
                              <button
                                className="o-day-number"
                                aria-label={`Select ${key}`}
                                onClick={() => {
                                  setSelectedDay(key);
                                  if (items[0]) choose(items[0].id);
                                }}
                              >
                                {day}
                              </button>
                            )}
                            {items.map((e) => (
                              <button
                                className="o-calendar-event"
                                key={e.id}
                                onClick={() => {
                                  setSelectedDay(key);
                                  choose(e.id);
                                }}
                              >
                                <Film size={12} />
                                <span>
                                  {e.topic}
                                  <small>
                                    {date(e.publish_at, {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </small>
                                </span>
                              </button>
                            ))}
                          </div>
                        );
                      },
                    )}
                  </div>
                </>
              ) : (
                <div className="o-upcoming-list">
                  {upcoming
                    .filter((e) => {
                      const local = inputDate(e.publish_at);
                      return local.startsWith(
                        `${year}-${String(month + 1).padStart(2, "0")}`,
                      );
                    })
                    .map((e, i) => (
                      <button key={e.id} onClick={() => choose(e.id)}>
                        <EpisodeArt index={i} />
                        <span>
                          <strong>{e.topic}</strong>
                          <small>{date(e.publish_at)} IST</small>
                        </span>
                        <Status value={e.status} />
                      </button>
                    ))}
                </div>
              )}
            </section>
            <ScheduleDetails
              active={active}
              displaySeries={displaySeries}
              scheduleEdit={scheduleEdit}
              setScheduleEdit={setScheduleEdit}
              publishTime={publishTime}
              setPublishTime={setPublishTime}
              leadHours={leadHours}
              setLeadHours={setLeadHours}
              busy={busy}
              onSave={() => run(reschedule)}
              confirmCancel={confirmCancel}
              setConfirmCancel={setConfirmCancel}
              onCancel={() => run(cancelSchedule)}
              onConnect={p.onConnect}
            />
          </div>
          <div className="o-calendar-bottom">
            <section className="z-card">
              <Heading title="Publishing Plan Summary" icon={BarChart3} />
              <div className="o-review-summary">
                <div>
                  <strong>{upcoming.length}</strong>
                  <small>Upcoming plans</small>
                </div>
                <div>
                  <strong>{eps.filter((e) => e.story).length}</strong>
                  <small>Scripts ready</small>
                </div>
                <div>
                  <strong>0</strong>
                  <small>Platform posts</small>
                </div>
                <div>
                  <strong>{schedules.length}</strong>
                  <small>Recurring plans</small>
                </div>
              </div>
            </section>
            <section className="z-card">
              <Heading title="Next Chapters" icon={CalendarDays} />
              <div className="o-next-dates">
                {upcoming.slice(0, 3).map((e, i) => (
                  <div key={e.id}>
                    <span>{i + 1}</span>
                    <strong>{e.topic}</strong>
                    <small>{date(e.publish_at)}</small>
                  </div>
                ))}
              </div>
            </section>
            <section className="z-card z-form-body">
              <h3>Keep your calendar close.</h3>
              <button
                className="z-btn z-soft z-full"
                onClick={() =>
                  exportJson(
                    {
                      timezone: "Asia/Kolkata",
                      plans: p.episodes.map((e) => ({
                        title: e.topic,
                        publish_at: e.publish_at,
                        status: e.status,
                      })),
                      publishing_connected: false,
                    },
                    "zenbee-publishing-plans.json",
                  )
                }
              >
                <Download size={14} />
                Export Calendar Plan
              </button>
            </section>
          </div>
        </>
      )}

      {p.page === "Publishing History" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={["All", "Studio Activity"]}
              value={tab}
              onChange={setTab}
            />
            <button
              className="z-btn"
              onClick={() =>
                exportJson(
                  {
                    type: "studio_activity",
                    publishing_connected: false,
                    events,
                  },
                  "zenbee-studio-activity.json",
                )
              }
            >
              <Download size={14} />
              Export Studio Activity
            </button>
          </div>
          <MetricGrid
            items={[
              {
                label: "Published by Zenbee",
                value: 0,
                icon: CheckCircle2,
                color: "green",
              },
              {
                label: "YouTube Posts",
                value: "—",
                icon: Youtube,
                color: "pink",
              },
              {
                label: "Instagram Posts",
                value: "—",
                icon: Instagram,
                color: "purple",
              },
              {
                label: "Live Performance",
                value: "—",
                icon: BarChart3,
                color: "blue",
              },
            ]}
          />
          <div className="o-history-layout">
            <section className="z-card">
              <Heading
                title={
                  tab === "Studio Activity"
                    ? "Studio Activity · Not Publishing Events"
                    : "Publishing History"
                }
                icon={Clock3}
              />
              {tab === "Studio Activity" ? (
                <EventList events={events} query={p.query} />
              ) : (
                <CompactEmpty
                  title="Your first published story belongs here."
                  text="No platform publishing is connected. Episode plans, generated scripts and approvals are not published posts."
                  action="Set up channels"
                  onAction={p.onConnect}
                />
              )}
            </section>
            <section className="z-card z-form-body">
              <span className="o-round-icon">
                <ShieldCheck size={25} />
              </span>
              <h3 className="o-detail-title">
                A clear record of every release.
              </h3>
              <p>
                Once publishing is connected, this screen will show platform
                post IDs, publication times, links and performance.
              </p>
              <div className="o-checklist">
                <div>
                  <Clock3 size={15} />
                  <span>Platform OAuth not connected</span>
                </div>
                <div>
                  <Clock3 size={15} />
                  <span>Publishing workers not connected</span>
                </div>
                <div>
                  <CheckCircle2 size={15} />
                  <span>Local planning activity available</span>
                </div>
              </div>
              <button
                className="z-btn z-soft z-full"
                onClick={() => setTab("Studio Activity")}
              >
                View Studio Activity
                <ArrowRight size={13} />
              </button>
            </section>
          </div>
        </>
      )}

      {[
        "YouTube Channel Manager",
        "Instagram Account Manager",
        "Channel Analytics",
        "Analytics",
      ].includes(p.page) && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={
                p.page === "Instagram Account Manager"
                  ? ["Overview", "Content", "Growth"]
                  : p.page === "YouTube Channel Manager"
                    ? ["Overview", "Videos", "SEO & Growth"]
                    : ["Overview", "Content Performance", "Audience"]
              }
              value={tab === "All" ? "Overview" : tab}
              onChange={setTab}
            />
            <div>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                aria-label="Analytics date range"
              >
                <option>Last 7 Days</option>
                <option>Last 28 Days</option>
                <option>Last 90 Days</option>
              </select>
              <button
                className="z-btn"
                onClick={() => setExampleAnalytics(!exampleAnalytics)}
              >
                {showSample ? "Show Workspace" : "Explore Sample Data"}
              </button>
              <button className="z-btn z-primary" onClick={p.onConnect}>
                <Plus size={14} />
                Connect Account
              </button>
            </div>
          </div>
          <div className="o-analytics-banner">
            <span className="z-tag amber">
              {showSample
                ? "Sample analytics · illustrative data"
                : "Channel not connected"}
            </span>
            <span>
              {showSample
                ? "These numbers demonstrate the design. They are not your channel metrics."
                : "Connect a platform in the publishing phase to load real metrics."}
            </span>
          </div>
          <MetricGrid
            items={
              p.page === "Instagram Account Manager"
                ? [
                    {
                      label: "Followers",
                      value: showSample ? "27,860" : "—",
                      icon: Users,
                      color: "purple",
                    },
                    {
                      label: "Posts",
                      value: showSample ? "326" : "—",
                      icon: Film,
                      color: "blue",
                    },
                    {
                      label: "Reach",
                      value: showSample ? "1.84M" : "—",
                      icon: Activity,
                      color: "pink",
                    },
                    {
                      label: "Impressions",
                      value: showSample ? "396K" : "—",
                      icon: Eye,
                      color: "orange",
                    },
                    {
                      label: "Engagement",
                      value: showSample ? "7.9%" : "—",
                      icon: Heart,
                      color: "pink",
                    },
                  ]
                : [
                    {
                      label: "Views",
                      value: showSample ? "312,460" : "—",
                      icon: Eye,
                      color: "purple",
                    },
                    {
                      label: "Subscribers",
                      value: showSample ? "27,540" : "—",
                      icon: Users,
                      color: "blue",
                    },
                    {
                      label: "Watch Hours",
                      value: showSample ? "6,420" : "—",
                      icon: Clock3,
                      color: "orange",
                    },
                    {
                      label: "Videos",
                      value: showSample ? "18" : "—",
                      icon: Film,
                      color: "green",
                    },
                    {
                      label: "Engagement",
                      value: showSample ? "7.9%" : "—",
                      icon: Heart,
                      color: "pink",
                    },
                  ]
            }
          />
          {["Videos", "Content", "Content Performance"].includes(tab) ? (
            <section className="z-card">
              <Heading title="Content Performance" icon={Film} />
              {showSample ? (
                <SamplePerformance
                  onExplore={() =>
                    p.notify(
                      "Sample performance only. No platform video or post is connected.",
                    )
                  }
                />
              ) : (
                <CompactEmpty
                  title="The next audience favorite could be yours."
                  text="Connect a channel to see content performance."
                  action="Set up channel"
                  onAction={p.onConnect}
                />
              )}
            </section>
          ) : tab === "Audience" ? (
            <div className="o-analytics-grid">
              <section className="z-card">
                <Heading title="Audience Overview" icon={Users} />
                <Audience sample={showSample} />
              </section>
              <section className="z-card">
                <Heading title="Audience Demographics" icon={Users} />
                <Demographics sample={showSample} />
              </section>
            </div>
          ) : (
            <>
              <div className="o-channel-layout">
                {p.page.includes("Manager") && (
                  <div className="z-stack">
                    <section className="z-card z-form-body">
                      <div className="o-channel-profile">
                        <span>🐝</span>
                        <div>
                          <h3>
                            {p.page.startsWith("Instagram")
                              ? "Zenbee Creations"
                              : "Zenbee Animation"}
                          </h3>
                          <p>
                            {showSample
                              ? "Sample account profile"
                              : "No account connected"}
                          </p>
                          <span className="z-tag amber">Not connected</span>
                        </div>
                      </div>
                      <button
                        className="z-btn z-primary z-full"
                        onClick={p.onConnect}
                      >
                        Connect{" "}
                        {p.page.startsWith("Instagram")
                          ? "Instagram"
                          : "YouTube"}
                        <ArrowUpRight size={13} />
                      </button>
                    </section>
                    <section className="z-card">
                      <Heading title="Account Health" icon={ShieldCheck} />
                      <div className="o-checklist">
                        {[
                          "Account authorization",
                          "Publishing permissions",
                          "Channel analytics access",
                          "Publishing worker",
                        ].map((s) => (
                          <div key={s}>
                            <Clock3 size={15} />
                            <span>{s}</span>
                            <span className="z-tag">Pending</span>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="z-card">
                      <Heading title="Quick Actions" icon={Zap} />
                      <div className="o-library">
                        {[
                          ["Plan an Episode", "Create Episode"],
                          ["Prepare SEO & Captions", "SEO & Caption Generator"],
                          ["Create a Thumbnail", "Thumbnail & Cover Creator"],
                          ["Schedule Content", "Scheduled Posts"],
                        ].map(([s, d]) => (
                          <button key={s} onClick={() => p.onNavigate(d)}>
                            <Plus size={15} />
                            {s}
                            <ArrowRight size={12} />
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
                <div className="z-stack">
                  <section className="z-card">
                    <Heading title={`Views Trend · ${range}`} icon={Eye} />
                    <LineChart values={graphValues} sample={showSample} />
                  </section>
                  <section className="z-card">
                    <Heading title="Top Performing Content" icon={Play} />
                    {showSample ? (
                      <SamplePerformance
                        onExplore={() =>
                          p.notify(
                            "These rows are illustrative sample metrics.",
                          )
                        }
                      />
                    ) : (
                      <CompactEmpty
                        title="Your audience story is yet to unfold."
                        text="Content performance will appear after platform analytics is connected."
                      />
                    )}
                  </section>
                </div>
                <div className="z-stack">
                  <section className="z-card">
                    <Heading title="Audience Overview" icon={Users} />
                    <Audience sample={showSample} />
                  </section>
                  <section className="z-card">
                    <Heading title="Growth & To-Do" icon={Target} />
                    <div className="o-growth-list">
                      {[
                        "Plan the next five stories",
                        "Create episode thumbnails",
                        "Review titles & captions",
                        "Build a seven-day video buffer",
                        "Review audience feedback",
                      ].map((s, i) => (
                        <label key={s}>
                          <input
                            type="checkbox"
                            checked={!!growthTasks[`${p.page}-${i}`]}
                            onChange={(e) => {
                              const next = {
                                ...growthTasks,
                                [`${p.page}-${i}`]: e.target.checked,
                              };
                              setGrowthTasks(next);
                              localStorage.setItem(
                                "zenbee-growth-tasks",
                                JSON.stringify(next),
                              );
                            }}
                          />
                          {s}
                        </label>
                      ))}
                      <div className="o-progress">
                        <i
                          style={{
                            width: `${Object.entries(growthTasks).filter(([k, v]) => k.startsWith(p.page) && v).length * 20}%`,
                          }}
                        />
                      </div>
                      <small>Checklist saved on this device</small>
                    </div>
                  </section>
                </div>
              </div>
              {!p.page.includes("Manager") && (
                <div className="o-analytics-grid">
                  <section className="z-card">
                    <Heading title="Traffic Sources" icon={Share2} />
                    <div className="o-traffic">
                      {[
                        ["YouTube Search", 42.6],
                        ["Suggested Videos", 24.8],
                        ["External", 12.4],
                        ["Channel Pages", 10.8],
                        ["Playlists", 6.3],
                        ["Other", 3.1],
                      ].map(([s, v], i) => (
                        <div key={s}>
                          <i
                            style={{
                              background: [
                                "#9b39f4",
                                "#df6cbd",
                                "#e7bd47",
                                "#7eb5e9",
                                "#75c5bd",
                                "#c7b0d7",
                              ][i],
                            }}
                          />
                          <strong>{s}</strong>
                          <span>{showSample ? v + "%" : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="z-card">
                    <Heading title="Audience Demographics" icon={Users} />
                    <Demographics sample={showSample} />
                  </section>
                </div>
              )}
            </>
          )}
          {["Growth", "SEO & Growth"].includes(tab) && (
            <section className="z-card o-template-panel">
              <Heading
                title="Help Your Next Story Find Its Audience"
                icon={Sparkles}
              />
              <div className="z-form-body">
                <p>
                  Start with a clear title, useful description, relevant tags
                  and a cover that matches your story. These are planning
                  suggestions, not measured channel recommendations.
                </p>
                <button
                  className="z-btn z-primary z-full"
                  onClick={() => p.onNavigate("SEO & Caption Generator")}
                >
                  Open SEO & Caption Studio
                  <ArrowRight size={14} />
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {p.page === "SEO & Caption Generator" && (
        <>
          <div className="z-page-actions">
            <div className="o-episode-picker">
              <Film size={18} />
              <select
                aria-label="Choose episode for SEO"
                value={active?.id || ""}
                onChange={(e) => choose(Number(e.target.value))}
              >
                {eps.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.id < 0 ? "Sample" : `Ep ${e.id}`} — {e.topic}
                  </option>
                ))}
                {!eps.length && <option>No episode yet</option>}
              </select>
            </div>
            <div>
              <button
                className="z-btn"
                onClick={() =>
                  copy(
                    [seoTitle, seoDescription, seoCaption, seoTags].join(
                      "\n\n",
                    ),
                  )
                }
              >
                <Copy size={14} />
                Copy All
              </button>
              <button className="z-btn z-primary" onClick={prepareSEO}>
                <Sparkles size={14} />
                Prepare Metadata Draft
              </button>
            </div>
          </div>
          <Tabs
            values={["All", "Captions & Hashtags", "Title Ideas"]}
            value={tab}
            onChange={setTab}
          />
          <div className="o-seo-layout">
            <section className="z-card">
              <Heading title="Video Details · Input" icon={Settings2} />
              <div className="z-form-body">
                <label>
                  Episode Title
                  <input
                    value={seoTitle}
                    maxLength={150}
                    onChange={(e) => setSeoTitle(e.target.value)}
                  />
                </label>
                <label>
                  Short Description / Topic
                  <textarea
                    rows={6}
                    value={seoDescription}
                    maxLength={5000}
                    onChange={(e) => setSeoDescription(e.target.value)}
                  />
                </label>
                <label>
                  Planned Platform
                  <select
                    value={seoPlatform}
                    onChange={(e) => setSeoPlatform(e.target.value)}
                  >
                    <option>YouTube</option>
                    <option>Instagram</option>
                  </select>
                </label>
                <div className="o-muted-note">
                  Drafts use existing story metadata and templates. Preparing a
                  draft does not make an AI request.
                </div>
                <button
                  className="z-btn z-primary z-full"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const e = needEpisode();
                      const existing = seoRecords.find(
                        (r) => r.data.episode_id === e.id,
                      );
                      await saveRecord(
                        "seo",
                        `SEO · ${e.topic}`.slice(0, 120),
                        {
                          episode_id: e.id,
                          title: seoTitle,
                          description: seoDescription,
                          caption: seoCaption,
                          tags: seoTags
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                          platform: seoPlatform,
                        },
                        existing?.id,
                      );
                      p.notify("SEO metadata saved to this episode’s draft.");
                    })
                  }
                >
                  <Save size={14} />
                  Save Metadata Draft
                </button>
              </div>
            </section>
            <section className="z-card">
              <Heading
                title={
                  tab === "Title Ideas"
                    ? "Title Inspiration"
                    : "SEO Content & Captions"
                }
                icon={Sparkles}
              />
              <div className="z-form-body">
                {tab === "Title Ideas" ? (
                  <div className="o-title-ideas">
                    {[
                      `${active?.story?.title || active?.topic || "A New Story"} | ZENBEE`,
                      `${active?.story?.title || "A Little Magic"} — A New Adventure`,
                      `${displaySeries(active?.series_id || 0)}: A Little Spark of Magic`,
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setSeoTitle(s.slice(0, 150));
                          p.notify("Title added to your metadata draft.");
                        }}
                      >
                        <LightbulbIcon />
                        <span>{s}</span>
                        <Plus size={13} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="o-copy-heading">
                      <h4>SEO TITLE</h4>
                      <button onClick={() => copy(seoTitle)}>
                        <Copy size={12} />
                        Copy
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={seoTitle}
                      maxLength={150}
                      onChange={(e) => setSeoTitle(e.target.value)}
                    />
                    {tab !== "Captions & Hashtags" && (
                      <>
                        <div className="o-copy-heading">
                          <h4>DESCRIPTION</h4>
                          <button onClick={() => copy(seoDescription)}>
                            <Copy size={12} />
                            Copy
                          </button>
                        </div>
                        <textarea
                          rows={7}
                          value={seoDescription}
                          maxLength={5000}
                          onChange={(e) => setSeoDescription(e.target.value)}
                        />
                      </>
                    )}
                    <div className="o-copy-heading">
                      <h4>CAPTION FOR SOCIAL MEDIA</h4>
                      <button onClick={() => copy(seoCaption)}>
                        <Copy size={12} />
                        Copy
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      maxLength={2200}
                      value={seoCaption}
                      onChange={(e) => setSeoCaption(e.target.value)}
                    />
                    <label>
                      Tags / Keywords · Comma Separated
                      <input
                        value={seoTags}
                        onChange={(e) => setSeoTags(e.target.value)}
                      />
                    </label>
                    <div className="z-chip-row">
                      {seoTags
                        .split(",")
                        .filter((t) => t.trim())
                        .map((s, i) => (
                          <button
                            className="z-tag"
                            key={i}
                            onClick={() =>
                              setSeoTags(
                                seoTags
                                  .split(",")
                                  .filter((_, n) => i !== n)
                                  .join(", "),
                              )
                            }
                          >
                            {s.trim()}
                            <X size={9} />
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </section>
            <div className="z-stack">
              <section className="z-card">
                <Heading title="Metadata Completeness" icon={ShieldCheck} />
                <div className="o-seo-score">
                  <div
                    style={{
                      background: `conic-gradient(#8b27eb ${seoScore * 3.6}deg,#eee2fc 0deg)`,
                    }}
                  >
                    <span>
                      <strong>{seoScore}</strong>
                      <small>/ 100</small>
                    </span>
                  </div>
                  <div>
                    {[
                      "Clear title length",
                      "Useful description",
                      "5+ relevant tags",
                      "Social caption included",
                    ].map((s, i) => (
                      <p key={s}>
                        {seoChecklist[i] ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <Clock3 size={14} />
                        )}
                        {s}
                      </p>
                    ))}
                  </div>
                </div>
                <p className="o-score-note">
                  A local completeness check, not a search ranking or
                  performance prediction.
                </p>
              </section>
              <section className="z-card">
                <Heading title="Platform Preview" icon={Eye} />
                <div className="z-form-body">
                  <div className="o-platform-preview">
                    <Art source="thumbnails" crop={[538, 291, 666, 437]} />
                    <h3>{seoTitle || "Your next story title"}</h3>
                    <p>ZENBEE Studio · Draft preview</p>
                    <span className="z-tag">{seoPlatform}</span>
                  </div>
                  <p className="o-caption-preview">{seoCaption}</p>
                  <button
                    className="z-btn z-soft z-full"
                    onClick={() =>
                      exportJson(
                        {
                          title: seoTitle,
                          description: seoDescription,
                          caption: seoCaption,
                          tags: seoTags
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                          platform: seoPlatform,
                        },
                        "zenbee-seo-draft.json",
                      )
                    }
                  >
                    <Download size={14} />
                    Export Metadata
                  </button>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Heading({
  title,
  icon: Icon,
}: {
  title: string;
  icon: typeof Film;
}) {
  return (
    <div className="z-card-title">
      <h3>
        <Icon size={17} />
        {title}
      </h3>
    </div>
  );
}
export function Tabs({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="z-tabs o-tabs">
      {values.map((s) => (
        <button
          key={s}
          className={value === s ? "selected" : ""}
          onClick={() => onChange(s)}
        >
          {s.replaceAll("_", " ")}
        </button>
      ))}
    </div>
  );
}
export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      className={"o-toggle " + (value ? "on" : "")}
      onClick={onChange}
    >
      <i />
    </button>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span
      className={
        "z-tag " +
        (["script_ready", "Approved"].includes(value)
          ? "green"
          : ["failed", "Rejected", "cancelled"].includes(value)
            ? "red"
            : ["generating", "Changes requested"].includes(value)
              ? "blue"
              : "amber")
      }
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
export function CompactEmpty({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="o-compact-empty">
      <Sparkles size={27} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="z-btn z-primary" onClick={onAction}>
          {action}
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
export function MetricGrid({
  items,
}: {
  items: {
    label: string;
    value: string | number;
    icon: typeof Film;
    color: string;
  }[];
}) {
  return (
    <div
      className="o-metrics"
      style={{ gridTemplateColumns: `repeat(${items.length},minmax(0,1fr))` }}
    >
      {items.map((s) => (
        <article className="o-metric" key={s.label}>
          <span className={"z-stat-icon " + s.color}>
            <s.icon size={23} />
          </span>
          <div>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
function EpisodeArt({ index }: { index: number }) {
  return (
    <Art
      source="series"
      crop={
        [
          [310, 411, 274, 100],
          [753, 411, 274, 100],
          [1197, 411, 274, 100],
        ][index % 3]
      }
    />
  );
}
function EventList({ events, query }: { events: Event[]; query: string }) {
  const list = events.filter((e) =>
    `${e.action} ${e.detail}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="o-events">
      {list.map((e) => (
        <div key={e.id}>
          <span className="o-round-icon">
            <Clock3 size={16} />
          </span>
          <div>
            <strong>{e.action}</strong>
            <p>{e.detail}</p>
            <small>{date(e.created_at)} IST</small>
          </div>
        </div>
      ))}
      {!list.length && (
        <CompactEmpty
          title="A new chapter is waiting."
          text="Saved plans, schedule changes and story-generation events will appear here."
        />
      )}
    </div>
  );
}
function ScheduleDetails({
  active,
  displaySeries,
  scheduleEdit,
  setScheduleEdit,
  publishTime,
  setPublishTime,
  leadHours,
  setLeadHours,
  busy,
  onSave,
  confirmCancel,
  setConfirmCancel,
  onCancel,
  onConnect,
}: {
  active: Episode | undefined;
  displaySeries: (id: number) => string;
  scheduleEdit: boolean;
  setScheduleEdit: (b: boolean) => void;
  publishTime: string;
  setPublishTime: (s: string) => void;
  leadHours: string;
  setLeadHours: (s: string) => void;
  busy: boolean;
  onSave: () => void;
  confirmCancel: boolean;
  setConfirmCancel: (b: boolean) => void;
  onCancel: () => void;
  onConnect: () => void;
}) {
  return (
    <section className="z-card o-schedule-details">
      <Heading title="Episode Schedule Details" icon={CalendarDays} />
      <div className="z-form-body">
        {active ? (
          <>
            <Art source="review" crop={[728, 320, 444, 250]} />
            <h3 className="o-detail-title">{active.topic}</h3>
            <Status value={active.status} />
            <div className="o-detail-rows">
              <div>
                <span>Series</span>
                <strong>{displaySeries(active.series_id)}</strong>
              </div>
              <div>
                <span>Publish time</span>
                <strong>{date(active.publish_at)} IST</strong>
              </div>
              <div>
                <span>Generation plan</span>
                <strong>{date(active.generate_at)} IST</strong>
              </div>
              <div>
                <span>Platform post</span>
                <strong>Not connected</strong>
              </div>
            </div>
            {scheduleEdit ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSave();
                }}
              >
                <label>
                  New Publishing Time · IST
                  <input
                    type="datetime-local"
                    required
                    value={publishTime}
                    onChange={(e) => setPublishTime(e.target.value)}
                  />
                </label>
                <label>
                  Generation Lead Time
                  <select
                    value={leadHours}
                    onChange={(e) => setLeadHours(e.target.value)}
                  >
                    <option value="6">6 hours before</option>
                    <option value="24">24 hours before</option>
                    <option value="48">48 hours before</option>
                    <option value="168">7 days before</option>
                  </select>
                </label>
                <div className="o-inline-actions">
                  <button
                    className="z-btn"
                    type="button"
                    onClick={() => setScheduleEdit(false)}
                  >
                    Back
                  </button>
                  <button
                    className="z-btn z-primary"
                    disabled={busy || active.id < 0}
                  >
                    <Save size={13} />
                    Save Plan
                  </button>
                </div>
              </form>
            ) : (
              <>
                <button
                  className="z-btn z-primary z-full"
                  disabled={active.id < 0}
                  onClick={() => setScheduleEdit(true)}
                >
                  <Pencil size={14} />
                  {active.status === "cancelled"
                    ? "Restore & Reschedule"
                    : "Edit Publishing Plan"}
                </button>
                {active.status !== "cancelled" &&
                  (confirmCancel ? (
                    <div className="o-cancel-confirm">
                      <p>
                        Cancel this episode’s publishing plan? The episode and
                        script will be kept.
                      </p>
                      <div>
                        <button
                          className="z-btn"
                          onClick={() => setConfirmCancel(false)}
                        >
                          Keep Plan
                        </button>
                        <button
                          className="z-btn o-reject"
                          disabled={busy}
                          onClick={onCancel}
                        >
                          Cancel Plan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="z-btn z-full"
                      disabled={active.id < 0}
                      onClick={() => setConfirmCancel(true)}
                    >
                      <XCircle size={13} />
                      Cancel Plan
                    </button>
                  ))}
              </>
            )}
            <p className="z-help-text">
              This is a saved episode plan. No platform upload or scheduled post
              exists yet.
            </p>
          </>
        ) : (
          <CompactEmpty
            title="Choose your next story."
            text="Add an episode to start planning a release."
          />
        )}
      </div>
    </section>
  );
}
function LineChart({ values, sample }: { values: number[]; sample: boolean }) {
  const max = Math.max(...values);
  const points = values
    .map(
      (v, i) =>
        `${25 + (i / (values.length - 1)) * 550},${175 - (v / max) * 145}`,
    )
    .join(" ");
  return (
    <div className="o-line-chart">
      <svg
        viewBox="0 0 600 215"
        role="img"
        aria-label={
          sample
            ? "Illustrative sample views trend"
            : "No analytics data connected"
        }
      >
        <defs>
          <linearGradient id="o-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#aa55ec" stopOpacity=".3" />
            <stop offset="1" stopColor="#aa55ec" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {[30, 65, 100, 135, 175].map((y) => (
          <line
            key={y}
            x1="25"
            x2="575"
            y1={y}
            y2={y}
            stroke="#f0e7f9"
            strokeWidth="1"
          />
        ))}
        {sample && (
          <>
            <polygon
              points={`25,175 ${points} 575,175`}
              fill="url(#o-chart-fill)"
            />
            <polyline
              points={points}
              fill="none"
              stroke="#a23cf0"
              strokeWidth="3"
            />
            {values.map((v, i) => (
              <circle
                key={i}
                cx={25 + (i / (values.length - 1)) * 550}
                cy={175 - (v / max) * 145}
                r="3.5"
                fill="white"
                stroke="#a23cf0"
                strokeWidth="2"
              />
            ))}
          </>
        )}
        {["Start", "Week 1", "Week 2", "Week 3", "Latest"].map((s, i) => (
          <text
            key={s}
            x={25 + i * 137.5}
            y="203"
            textAnchor={i === 4 ? "end" : i === 0 ? "start" : "middle"}
            fontSize="10"
            fill="#aa8cbf"
          >
            {s}
          </text>
        ))}
      </svg>
      <span>
        {sample
          ? "Illustrative trend · not live channel data"
          : "Connect a channel to see real performance"}
      </span>
    </div>
  );
}
function Audience({ sample }: { sample: boolean }) {
  return (
    <div className="o-audience">
      <div className={"o-donut " + (!sample ? "empty" : "")}>
        <div>
          <strong>{sample ? "27,540" : "—"}</strong>
          <small>{sample ? "Sample audience" : "No live data"}</small>
        </div>
      </div>
      <div className="o-donut-legend">
        {[
          ["New viewers", "87.3%"],
          ["Returning viewers", "10.4%"],
          ["Other", "2.3%"],
        ].map(([s, v], i) => (
          <div key={s}>
            <i style={{ background: ["#a13cf1", "#df70ba", "#efc64d"][i] }} />
            <span>{s}</span>
            <strong>{sample ? v : "—"}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
function Demographics({ sample }: { sample: boolean }) {
  return (
    <div className="o-demographics">
      {[
        ["18–24", 34.2],
        ["25–34", 41.6],
        ["35–44", 15.8],
        ["45+", 8.4],
      ].map(([s, v]) => (
        <div key={s}>
          <span>{s}</span>
          <div>
            <i style={{ width: sample ? String(v) + "%" : "0%" }} />
          </div>
          <strong>{sample ? v + "%" : "—"}</strong>
        </div>
      ))}
      <small>
        {sample
          ? "Illustrative age-group distribution"
          : "Audience data is not connected"}
      </small>
    </div>
  );
}
function SamplePerformance({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="z-table-wrap">
      <table className="z-table o-table">
        <thead>
          <tr>
            <th>Sample Content</th>
            <th>Views</th>
            <th>Watch Hours</th>
            <th>Engagement</th>
          </tr>
        </thead>
        <tbody>
          {[
            "The Talking Panda",
            "Magic Sketch",
            "Funny Food Adventures",
            "The Little Star’s Wish",
          ].map((s, i) => (
            <tr key={s}>
              <td>
                <button className="o-table-title" onClick={onExplore}>
                  <EpisodeArt index={i} />
                  <strong>{s}</strong>
                </button>
              </td>
              <td>{["52.3K", "38.9K", "74.2K", "29.4K"][i]}</td>
              <td>{["1,842", "1,210", "2,846", "976"][i]}</td>
              <td>
                <span className="z-tag green">
                  {["7.9%", "7.4%", "8.7%", "7.0%"][i]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function LightbulbIcon() {
  return <Sparkles size={17} />;
}
