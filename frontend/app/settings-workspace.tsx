"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Coins,
  Copy,
  Download,
  Eye,
  FileText,
  Film,
  Globe,
  Heart,
  ImagePlus,
  Instagram,
  KeyRound,
  Layers3,
  Lightbulb,
  LockKeyhole,
  Mail,
  Palette,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Upload,
  Users,
  Video,
  WandSparkles,
  X,
  Youtube,
  Zap,
} from "lucide-react";
import { Art, type Episode, type Series } from "./studio-shared";
import {
  Heading,
  Tabs,
  Toggle,
  MetricGrid,
  Status,
  CompactEmpty,
} from "./operations-workspace";
import {
  systemDefaults,
  brandDefaults,
  notificationDefaults,
  budgetDefaults,
  providerDefaults,
  roleDefaults,
  socialDefaults,
  roleNames,
  permissions,
  type SystemPrefs,
  type BrandPrefs,
  type NotificationPrefs,
  type BudgetPrefs,
  type ProviderPrefs,
  type RolePrefs,
  type SocialPrefs,
  type Role,
  type Permission,
  type Member,
  type CostEntry,
  type Saved,
  type EventRecord,
  type ProviderStatus,
} from "./settings-types";

export const settingsPages = [
  "Logs & Notifications",
  "System Settings",
  "Team & Permissions",
  "Brand & Style Settings",
  "Social Account Connections",
  "AI Providers & API Keys",
  "Generation Cost",
  "AI Content Insights",
  "Episode Performance",
];
export const settingsDescriptions: Record<string, string> = {
  "Logs & Notifications":
    "Your studio’s activity, a little clearer. Stay close to what matters.",
  "System Settings":
    "A creative workspace that feels like you. Set your preferences and future job defaults.",
  "Team & Permissions":
    "Plan the people, roles and responsibilities behind your next great story.",
  "Brand & Style Settings":
    "Your colors. Your characters. A consistent creative universe.",
  "Social Account Connections":
    "A home for every story. Prepare your publishing connections.",
  "AI Providers & API Keys":
    "Keep your creative tools organized and your credentials on the server.",
  "Generation Cost":
    "Understand your estimates, plan your budget, and keep creating.",
  "AI Content Insights":
    "Find a little inspiration in the stories you are already creating.",
  "Episode Performance":
    "Compare your stories and explore what your audience could love next.",
};
type Props = {
  page: string;
  episodes: Episode[];
  series: Series[];
  preview: boolean;
  connected: boolean;
  mode: string;
  query: string;
  notify: (s: string) => void;
  onNavigate: (s: string) => void;
  onConnect: () => void;
  onNew: () => void;
  onOpen: (e: Episode) => void;
};
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const fonts = ["Arial", "Georgia", "Verdana", "Trebuchet MS"];
const platforms = [
  "YouTube",
  "Instagram",
  "Facebook",
  "TikTok",
  "Pinterest",
  "X",
];
const today = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
const money = (n: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
function date(value: string) {
  return new Date(
    /[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : value + "Z",
  ).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function exportFile(data: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function api<T>(
  path: string,
  body?: unknown,
  method = body ? "PUT" : "GET",
): Promise<T> {
  let r: Response;
  try {
    r = await fetch(API + "/api" + path, {
      credentials: "include",
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "Start the studio backend to load or save workspace preferences.",
    );
  }
  const data = await r.json();
  if (!r.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Please check the fields and try again.",
    );
  return data;
}
function eventType(e: EventRecord) {
  const s = (e.action + " " + e.detail).toLowerCase().replaceAll("_", " ");
  return s.includes("failed")
    ? "Error"
    : s.includes("team member") || s.includes("roles")
      ? "Team"
      : s.includes("story") || s.includes("script")
        ? "Generation"
        : s.includes("cost") || s.includes("budget")
          ? "Cost"
          : s.includes("schedule") || s.includes("automation")
            ? "Automation"
            : "System";
}
const sampleEvents: EventRecord[] = [
  {
    id: -1,
    episode_id: null,
    action: "Sample story ready",
    detail: "A sample cartoon script and four scene prompts.",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: -2,
    episode_id: null,
    action: "Sample schedule created",
    detail: "Example weekly series plan saved.",
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: -3,
    episode_id: null,
    action: "Sample generation failed",
    detail: "Example provider timeout. No real provider request occurred.",
    created_at: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: -4,
    episode_id: null,
    action: "Sample settings updated",
    detail: "Example brand palette and visual direction.",
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
];
const sampleMembers: Saved<Member>[] = [
  ["Ammu", "Owner"],
  ["Vinoth", "Content Manager"],
  ["Sakthi", "Editor"],
  ["Divya", "Designer"],
  ["Ravi", "Publisher"],
].map(([name, role], i) => ({
  id: -i - 1,
  kind: "team_member",
  name,
  enabled: true,
  data: {
    name,
    email: `${name.toLowerCase()}@example.com`,
    role: role as Role,
    status: "Draft",
  },
  updated_at: new Date().toISOString(),
}));
const sampleCosts: Saved<CostEntry>[] = [
  ["OpenAI", "Script", "1284.00", 182],
  ["Example Image API", "Image", "384.00", 96],
  ["Example Video API", "Video", "228.00", 42],
  ["Example Voice API", "Voice", "38.00", 40],
  ["Other", "Other", "214.50", 126],
].map(([provider, category, amount, quantity], i) => ({
  id: -i - 1,
  kind: "cost_entry",
  name: `Sample ${category} estimate`,
  enabled: true,
  data: {
    provider: String(provider),
    category: category as CostEntry["category"],
    amount_inr: String(amount),
    quantity: Number(quantity),
    recorded_on: today(),
    note: "Illustrative sample estimate, not a provider price or invoice.",
  },
  updated_at: new Date().toISOString(),
}));
const samplePerformance = [
  {
    id: -1,
    title: "The Talking Panda",
    series: "Drawing Comes Alive",
    seconds: 45,
    views: 52340,
    hours: 1842,
    likes: 3200,
    comments: 412,
    engagement: 7.9,
  },
  {
    id: -2,
    title: "The Magical Sketch",
    series: "Drawing Comes Alive",
    seconds: 52,
    views: 38920,
    hours: 1210,
    likes: 2600,
    comments: 298,
    engagement: 7.4,
  },
  {
    id: -3,
    title: "Funny Food Adventures",
    series: "Funny Food Adventures",
    seconds: 45,
    views: 74210,
    hours: 2846,
    likes: 5100,
    comments: 702,
    engagement: 8.7,
  },
  {
    id: -4,
    title: "A Jungle of Surprises",
    series: "Tiny Adventures",
    seconds: 50,
    views: 29430,
    hours: 976,
    likes: 1900,
    comments: 156,
    engagement: 7.0,
  },
  {
    id: -5,
    title: "The Little Star’s Wish",
    series: "Drawing Comes Alive",
    seconds: 58,
    views: 88120,
    hours: 3420,
    likes: 6400,
    comments: 1100,
    engagement: 8.9,
  },
];

export default function SettingsWorkspace(p: Props) {
  const [system, setSystem] = useState<SystemPrefs>(systemDefaults),
    [brand, setBrand] = useState<BrandPrefs>(brandDefaults),
    [notifications, setNotifications] =
      useState<NotificationPrefs>(notificationDefaults),
    [budget, setBudget] = useState<BudgetPrefs>(budgetDefaults),
    [providers, setProviders] = useState<ProviderPrefs>(providerDefaults),
    [roles, setRoles] = useState<RolePrefs>(roleDefaults),
    [social, setSocial] = useState<SocialPrefs>(socialDefaults),
    [members, setMembers] = useState<Saved<Member>[]>([]),
    [costs, setCosts] = useState<Saved<CostEntry>[]>([]),
    [events, setEvents] = useState<EventRecord[]>([]),
    [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState("All"),
    [examples, setExamples] = useState(p.preview),
    [range, setRange] = useState("Last 7 Days"),
    [logType, setLogType] = useState("All Types"),
    [pageIndex, setPageIndex] = useState(1),
    [rowsPerPage, setRowsPerPage] = useState(8),
    [selectedRole, setSelectedRole] = useState<Role>("Owner"),
    [roleFilter, setRoleFilter] = useState("All Roles"),
    [memberId, setMemberId] = useState<number | null>(null),
    [member, setMember] = useState<Member>({
      name: "",
      email: "",
      role: "Editor",
      status: "Draft",
    }),
    [showMemberForm, setShowMemberForm] = useState(false),
    [costId, setCostId] = useState<number | null>(null),
    [costEntry, setCostEntry] = useState<CostEntry>({
      provider: "OpenAI",
      category: "Script",
      amount_inr: "0.00",
      quantity: 1,
      recorded_on: today(),
      note: "",
    }),
    [showCostForm, setShowCostForm] = useState(false),
    [selectedSeries, setSelectedSeries] = useState("All Series"),
    [sort, setSort] = useState("Views"),
    [compareIds, setCompareIds] = useState<number[]>([]),
    [insightChecks, setInsightChecks] = useState<Record<string, boolean>>({}),
    [tempConfirm, setTempConfirm] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (showMemberForm) {
      requestAnimationFrame(() => {
        document
          .querySelector(".s-member-form")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
        document
          .querySelector<HTMLInputElement>('[data-testid="member-name"]')
          ?.focus();
      });
    }
  }, [showMemberForm]);
  useEffect(() => {
    if (showCostForm) {
      requestAnimationFrame(() => {
        document
          .querySelector(".s-cost-form")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
        document
          .querySelector<HTMLInputElement>('[data-testid="cost-provider"]')
          ?.focus();
      });
    }
  }, [showCostForm]);
  useEffect(() => {
    setCompareIds([]);
  }, [examples, selectedSeries]);
  const activeTab = tab === "All" ? "Overview" : tab;
  async function load() {
    if (!p.connected) return;
    try {
      const [s, b, n, c, v, r, x, m, e, l, h] = await Promise.all([
        api<{ data: SystemPrefs }>("/settings/system"),
        api<{ data: BrandPrefs }>("/settings/brand"),
        api<{ data: NotificationPrefs }>("/settings/notifications"),
        api<{ data: BudgetPrefs }>("/settings/budget"),
        api<{ data: ProviderPrefs }>("/settings/providers"),
        api<{ data: RolePrefs }>("/settings/roles"),
        api<{ data: SocialPrefs }>("/settings/social"),
        api<Saved<Member>[]>("/studio/records/team_member"),
        api<Saved<CostEntry>[]>("/studio/records/cost_entry"),
        api<EventRecord[]>("/studio/events"),
        api<ProviderStatus>("/settings/provider-status"),
      ]);
      setSystem(s.data);
      setBrand(b.data);
      setNotifications(n.data);
      setBudget(c.data);
      setProviders(v.data);
      setRoles(r.data);
      setSocial(x.data);
      setMembers(m);
      setCosts(e);
      setEvents(l);
      setProviderStatus(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load settings.");
    }
  }
  useEffect(() => {
    load();
  }, [p.connected]);
  useEffect(() => {
    setTab("All");
    setError("");
    setPageIndex(1);
    setTempConfirm(false);
  }, [p.page]);
  useEffect(() => {
    setPageIndex(1);
  }, [p.query, range, logType, rowsPerPage]);
  useEffect(() => {
    try {
      setInsightChecks(
        JSON.parse(localStorage.getItem("zenbee-insight-checklist") || "{}"),
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
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  function needConnection() {
    if (!p.connected)
      throw new Error("Start the studio backend to save these preferences.");
  }
  async function save<T>(section: string, data: T) {
    needConnection();
    const result = await api<{ data: T }>(`/settings/${section}`, data);
    if (section === "system")
      window.dispatchEvent(
        new CustomEvent("zenbee-workspace-settings", { detail: result.data }),
      );
    return result.data;
  }
  async function saveRecord<T>(
    kind: string,
    name: string,
    data: T,
    id: number | null,
  ) {
    needConnection();
    const record = await api<Saved<T>>(
      `/studio/records/${kind}${id ? "/" + id : ""}`,
      { name: name.slice(0, 120), data, enabled: true },
      id ? "PUT" : "POST",
    );
    await load();
    return record;
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      p.notify("Copied to clipboard.");
    } catch {
      p.notify("Clipboard is unavailable. Select the text to copy it.");
    }
  }
  async function importSettings(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await run(async () => {
      if (file.size > 600000)
        throw new Error("Use a settings JSON file under 600 KB.");
      let value;
      try {
        value = JSON.parse(await file.text());
      } catch {
        throw new Error("Choose a valid JSON settings file.");
      }
      if (p.page === "Brand & Style Settings") {
        const result = await save("brand", value);
        setBrand(result as BrandPrefs);
        p.notify("Brand kit imported and saved.");
      } else {
        const result = await save("system", value);
        setSystem(result as SystemPrefs);
        p.notify("System preferences imported and saved.");
      }
    });
  }
  async function logoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 250000
    ) {
      setError("Choose a PNG, JPEG or WebP logo under 250 KB.");
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Logo could not be read."));
      reader.readAsDataURL(file);
    });
    setBrand({ ...brand, logo: data });
    p.notify("Logo loaded into the preview. Save your brand kit to keep it.");
  }
  const logRows = (examples ? sampleEvents : events).filter(
    (e) =>
      (!p.query ||
        `${e.action} ${e.detail}`
          .toLowerCase()
          .includes(p.query.toLowerCase())) &&
      (logType === "All Types" || eventType(e) === logType) &&
      (range === "All Time" ||
        Date.now() -
          new Date(
            /[Zz]|[+-]\d\d:\d\d$/.test(e.created_at)
              ? e.created_at
              : e.created_at + "Z",
          ).getTime() <
          Number(range === "Last 7 Days" ? 7 : 28) * 86400000),
  );
  const logPage = logRows.slice(
    (pageIndex - 1) * rowsPerPage,
    pageIndex * rowsPerPage,
  );
  const notificationRows = (examples ? sampleEvents : events)
    .filter((e) => {
      const type = eventType(e);
      return (
        notifications.in_app &&
        (type === "Generation" || type === "Error"
          ? notifications.generation
          : type === "Team"
            ? notifications.team
            : type === "Automation"
              ? notifications.automation
              : type === "Cost"
                ? notifications.costs
                : notifications.system)
      );
    })
    .slice(0, 6);
  const visibleMembers = (
    examples && !members.length ? sampleMembers : members
  ).filter(
    (m) =>
      (roleFilter === "All Roles" || m.data.role === roleFilter) &&
      `${m.data.name} ${m.data.email}`
        .toLowerCase()
        .includes(p.query.toLowerCase()),
  );
  const month = today().slice(0, 7);
  const costRows = (examples ? sampleCosts : costs).filter(
    (c) =>
      c.data.recorded_on.startsWith(month) &&
      `${c.data.provider} ${c.data.category} ${c.data.note}`
        .toLowerCase()
        .includes(p.query.toLowerCase()),
  );
  const totalEstimate = costRows.reduce(
    (sum, c) => sum + Number(c.data.amount_inr),
    0,
  );
  const budgetAmount = Number(budget.monthly_inr);
  const budgetPercent =
    budgetAmount > 0
      ? Math.min(100, (totalEstimate / budgetAmount) * 100)
      : totalEstimate > 0
        ? 100
        : 0;
  const costProviders = [...new Set(costRows.map((c) => c.data.provider))].map(
    (name) => ({
      name,
      cost: costRows
        .filter((c) => c.data.provider === name)
        .reduce((s, c) => s + Number(c.data.amount_inr), 0),
      quantity: costRows
        .filter((c) => c.data.provider === name)
        .reduce((s, c) => s + c.data.quantity, 0),
    }),
  );
  const actualPerformance = p.episodes.map((e) => ({
    id: e.id,
    title: e.topic,
    series: p.series.find((s) => s.id === e.series_id)?.name || "Series",
    seconds: e.story?.scenes.reduce((s, c) => s + c.duration_seconds, 0) || 0,
    views: null as number | null,
    hours: null as number | null,
    likes: null as number | null,
    comments: null as number | null,
    engagement: null as number | null,
  }));
  const performanceRows = (examples ? samplePerformance : actualPerformance)
    .filter(
      (e) =>
        (selectedSeries === "All Series" || e.series === selectedSeries) &&
        e.title.toLowerCase().includes(p.query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Title"
        ? a.title.localeCompare(b.title)
        : sort === "Duration"
          ? b.seconds - a.seconds
          : (b.views || 0) - (a.views || 0),
    );
  const best = examples
    ? [...samplePerformance].sort((a, b) => b.views - a.views)[0]
    : null;
  const scriptReady = p.episodes.filter((e) => e.story).length;
  const insightIdeas = p.episodes
    .filter((e) => e.story)
    .slice(0, 4)
    .map((e) => ({
      title: `The next chapter of ${e.story?.title}`,
      detail: `Continue the story while preserving: ${e.story?.continuity_notes}`,
      id: e.id,
    }));
  const ideaCards = insightIdeas.length
    ? insightIdeas
    : [
        {
          title: "A drawing with a big surprise",
          detail: "Start with a tiny sketch that changes an ordinary day.",
          id: -1,
        },
        {
          title: "An unexpected new friend",
          detail: "Let a character discover kindness in an unexpected place.",
          id: -2,
        },
        {
          title: "A little star’s big adventure",
          detail: "Explore a familiar world from a smaller point of view.",
          id: -3,
        },
      ];
  const keywordCounts = new Map<string, number>();
  for (const e of p.episodes) {
    for (const word of `${e.topic} ${e.story?.title || ""}`
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)) {
      if (
        word.length > 3 &&
        !["with", "from", "that", "this", "your", "story"].includes(word)
      )
        keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
    }
  }
  const keywords = examples
    ? ([
        ["Animation", 12],
        ["Magic", 10],
        ["Friendship", 8],
        ["Drawing", 6],
        ["Adventure", 5],
      ] as [string, number][])
    : [...keywordCounts].sort((a, b) => b[1] - a[1]).slice(0, 6);
  function ExampleButton() {
    return (
      <button
        className="z-btn"
        onClick={() => {
          setPageIndex(1);
          setExamples(!examples);
        }}
      >
        {examples ? "Show Workspace Data" : "Explore Sample Data"}
      </button>
    );
  }
  return (
    <div className="s-workspace">
      {error && (
        <div className="z-error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="s-hidden"
        onChange={importSettings}
      />

      {p.page === "Logs & Notifications" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={["All", "Notifications"]}
              value={tab}
              onChange={setTab}
            />
            <div>
              <ExampleButton />
              <button
                className="z-btn"
                onClick={() =>
                  run(async () => {
                    await load();
                    p.notify("Studio activity refreshed.");
                  })
                }
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <button
                className="z-btn"
                onClick={() =>
                  exportFile(
                    {
                      source: examples ? "sample" : "workspace",
                      events: logRows,
                    },
                    "zenbee-activity-logs.json",
                  )
                }
              >
                <Download size={14} />
                Export Logs
              </button>
            </div>
          </div>
          {examples && (
            <SampleNote text="Illustrative activity · these events are not actions from your workspace." />
          )}
          <MetricGrid
            items={[
              {
                label: "Activity Records",
                value: logRows.length,
                icon: Layers3,
                color: "blue",
              },
              {
                label: "Story Events",
                value: logRows.filter((e) => eventType(e) === "Generation")
                  .length,
                icon: Play,
                color: "purple",
              },
              {
                label: "Error Records",
                value: logRows.filter((e) => eventType(e) === "Error").length,
                icon: Bell,
                color: "pink",
              },
              {
                label: "In-app Updates",
                value: notificationRows.length,
                icon: Bell,
                color: "orange",
              },
            ]}
          />
          <div className="s-logs-layout">
            <section className="z-card">
              <Heading
                title={
                  tab === "Notifications"
                    ? "Workspace Notifications"
                    : "Activity Logs"
                }
                icon={tab === "Notifications" ? Bell : FileText}
              />
              {tab === "Notifications" ? (
                <NotificationList rows={notificationRows} />
              ) : (
                <>
                  <div className="s-log-filters">
                    <label>
                      Time Range
                      <select
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                      >
                        <option>Last 7 Days</option>
                        <option>Last 28 Days</option>
                        <option>All Time</option>
                      </select>
                    </label>
                    <label>
                      Record Type
                      <select
                        value={logType}
                        onChange={(e) => setLogType(e.target.value)}
                      >
                        {[
                          "All Types",
                          "Generation",
                          "Automation",
                          "Error",
                          "System",
                          "Team",
                          "Cost",
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="z-btn"
                      onClick={() => {
                        setRange("Last 7 Days");
                        setLogType("All Types");
                        setPageIndex(1);
                      }}
                    >
                      Reset Filters
                    </button>
                  </div>
                  <div className="z-table-wrap">
                    <table className="z-table s-log-table">
                      <thead>
                        <tr>
                          <th>Date & Time · IST</th>
                          <th>Activity</th>
                          <th>Type</th>
                          <th>Details</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logPage.map((e) => (
                          <tr key={e.id}>
                            <td>{date(e.created_at)}</td>
                            <td>
                              <strong>{e.action}</strong>
                            </td>
                            <td>
                              <span className="z-tag">{eventType(e)}</span>
                            </td>
                            <td>{e.detail}</td>
                            <td>
                              <Status
                                value={
                                  eventType(e) === "Error"
                                    ? "failed"
                                    : "Recorded"
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!logRows.length && (
                    <CompactEmpty
                      title="Your studio’s story starts here."
                      text="Saved preferences, plans and story-generation events will appear in this log."
                    />
                  )}
                  <div className="s-pagination">
                    <span>
                      {logRows.length
                        ? `${(pageIndex - 1) * rowsPerPage + 1}–${Math.min(pageIndex * rowsPerPage, logRows.length)} of ${logRows.length}`
                        : "0 records"}
                    </span>
                    <div>
                      <button
                        className="z-btn"
                        disabled={pageIndex === 1}
                        onClick={() => setPageIndex(pageIndex - 1)}
                      >
                        Previous
                      </button>
                      <span>{pageIndex}</span>
                      <button
                        className="z-btn"
                        disabled={pageIndex * rowsPerPage >= logRows.length}
                        onClick={() => setPageIndex(pageIndex + 1)}
                      >
                        Next
                      </button>
                    </div>
                    <select
                      aria-label="Rows per page"
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(Number(e.target.value))}
                    >
                      <option value={8}>8 rows</option>
                      <option value={16}>16 rows</option>
                      <option value={32}>32 rows</option>
                    </select>
                  </div>
                </>
              )}
            </section>
            <div className="z-stack">
              <section className="z-card">
                <Heading title="Notification Preferences" icon={Bell} />
                <div className="s-toggle-list">
                  {(
                    [
                      [
                        "generation",
                        "Generation alerts",
                        "Story successes and failures",
                      ],
                      [
                        "publishing",
                        "Publishing alerts",
                        "Preference for a future publishing service",
                      ],
                      [
                        "automation",
                        "Automation alerts",
                        "Saved plans and schedule changes",
                      ],
                      [
                        "costs",
                        "Cost & estimate alerts",
                        "Manually recorded estimates and budget targets",
                      ],
                      [
                        "team",
                        "Team planning updates",
                        "Member and role drafts",
                      ],
                      [
                        "system",
                        "System updates",
                        "Saved workspace preferences",
                      ],
                    ] as const
                  ).map(([key, title, description]) => (
                    <div key={key}>
                      <span>
                        <strong>{title}</strong>
                        <small>{description}</small>
                      </span>
                      <Toggle
                        value={notifications[key]}
                        label={title}
                        onChange={() =>
                          setNotifications({
                            ...notifications,
                            [key]: !notifications[key],
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="z-form-body">
                  <label className="s-check">
                    <input
                      type="checkbox"
                      checked={notifications.in_app}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          in_app: e.target.checked,
                        })
                      }
                    />
                    Show in-app activity updates
                  </label>
                  <label className="s-check">
                    <input
                      type="checkbox"
                      checked={notifications.email_requested}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          email_requested: e.target.checked,
                        })
                      }
                    />
                    Email delivery requested · not connected
                  </label>
                  <label>
                    Preferred Delivery Frequency
                    <select
                      value={notifications.frequency}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          frequency: e.target.value,
                        })
                      }
                    >
                      <option>Instant</option>
                      <option>Daily summary</option>
                      <option>Weekly summary</option>
                    </select>
                  </label>
                  <p className="s-small-note">
                    In-app updates come from studio activity. Email, scheduled
                    summaries and external delivery services are not connected.
                  </p>
                  <button
                    className="z-btn z-primary z-full"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        setNotifications(
                          await save("notifications", notifications),
                        );
                        p.notify(
                          "Notification preferences saved. No email or external message was sent.",
                        );
                      })
                    }
                  >
                    <Save size={14} />
                    Save Preferences
                  </button>
                </div>
              </section>
              <section className="z-card">
                <Heading title="Recent In-app Updates" icon={Bell} />
                <NotificationList rows={notificationRows.slice(0, 3)} />
              </section>
            </div>
          </div>
        </>
      )}

      {p.page === "System Settings" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={[
                "All",
                "General",
                "Automation",
                "Content & Media",
                "Security",
                "Data & Storage",
                "Advanced",
              ]}
              value={tab}
              onChange={setTab}
            />
            <button
              className="z-btn z-primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setSystem(await save("system", system));
                  p.notify(
                    "Workspace preferences and planned job defaults saved.",
                  );
                })
              }
            >
              <Save size={14} />
              Save Changes
            </button>
          </div>
          <div className="s-system-grid">
            {(tab === "All" || tab === "General") && (
              <section className="z-card">
                <Heading title="General Settings" icon={Settings2} />
                <div className="z-form-body">
                  <label>
                    Workspace Name <em>*</em>
                    <input
                      data-testid="workspace-name"
                      required
                      maxLength={80}
                      value={system.workspace_name}
                      onChange={(e) =>
                        setSystem({ ...system, workspace_name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Default Language
                    <select
                      value={system.language}
                      onChange={(e) =>
                        setSystem({
                          ...system,
                          language: e.target.value as SystemPrefs["language"],
                        })
                      }
                    >
                      <option>English</option>
                      <option>Tamil</option>
                      <option>Hindi</option>
                    </select>
                  </label>
                  <label>
                    Publishing Timezone
                    <input value="Asia/Kolkata · GMT +05:30" readOnly />
                  </label>
                  <label>
                    Date Format
                    <select
                      value={system.date_format}
                      onChange={(e) =>
                        setSystem({
                          ...system,
                          date_format: e.target
                            .value as SystemPrefs["date_format"],
                        })
                      }
                    >
                      <option>DD-MM-YYYY</option>
                      <option>YYYY-MM-DD</option>
                    </select>
                  </label>
                  <p className="s-small-note">
                    Scheduling currently uses Asia/Kolkata. Dates are stored in
                    UTC.
                  </p>
                </div>
              </section>
            )}
            {(tab === "All" || tab === "Automation") && (
              <section className="z-card">
                <Heading title="Planned Automation Defaults" icon={Zap} />
                <div className="z-form-body">
                  <label>
                    Generation Lead Time (Hours)
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={system.generation_lead_hours}
                      onChange={(e) =>
                        setSystem({
                          ...system,
                          generation_lead_hours: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Future Retry Attempts
                    <select
                      value={system.retry_attempts}
                      onChange={(e) =>
                        setSystem({
                          ...system,
                          retry_attempts: Number(e.target.value),
                        })
                      }
                    >
                      {[0, 1, 2, 3, 4, 5].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="s-check">
                    <input
                      type="checkbox"
                      checked={system.autosave_drafts}
                      onChange={(e) =>
                        setSystem({
                          ...system,
                          autosave_drafts: e.target.checked,
                        })
                      }
                    />
                    Prefer automatic draft saving
                  </label>
                  <div className="s-capability">
                    <Clock3 size={17} />
                    <span>Production worker configured on the server</span>
                  </div>
                  <p className="s-small-note">
                    The lead-time default applies to new episode forms. Retry
                    and autosave preferences are saved as future worker
                    defaults.
                  </p>
                </div>
              </section>
            )}
            {(tab === "All" || tab === "Content & Media") && (
              <section className="z-card">
                <Heading title="Content & Media Defaults" icon={ImagePlus} />
                <div className="z-form-body">
                  <label>
                    Video Resolution
                    <select
                      value={system.resolution}
                      onChange={(e) =>
                        setSystem({
                          ...system,
                          resolution: e.target
                            .value as SystemPrefs["resolution"],
                        })
                      }
                    >
                      <option>1080p</option>
                      <option>720p</option>
                    </select>
                  </label>
                  <label>
                    Aspect Ratio
                    <select
                      value={system.aspect_ratio}
                      onChange={(e) =>
                        setSystem({
                          ...system,
                          aspect_ratio: e.target
                            .value as SystemPrefs["aspect_ratio"],
                        })
                      }
                    >
                      <option>9:16</option>
                      <option>16:9</option>
                      <option>1:1</option>
                    </select>
                  </label>
                  <label>
                    Image Format
                    <select
                      value={system.image_format}
                      onChange={(e) =>
                        setSystem({
                          ...system,
                          image_format: e.target
                            .value as SystemPrefs["image_format"],
                        })
                      }
                    >
                      <option>PNG</option>
                      <option>JPEG</option>
                      <option>WebP</option>
                    </select>
                  </label>
                  <label>
                    Default Caption Template
                    <textarea
                      rows={4}
                      value={system.caption_template}
                      maxLength={1000}
                      onChange={(e) =>
                        setSystem({
                          ...system,
                          caption_template: e.target.value,
                        })
                      }
                    />
                  </label>
                  <p className="s-small-note">
                    Stored defaults for future media and publishing
                    integrations.
                  </p>
                </div>
              </section>
            )}
            {(tab === "All" || tab === "Security") && (
              <section className="z-card">
                <Heading title="Authentication & Security" icon={ShieldCheck} />
                <div className="z-form-body">
                  <div className="s-security-state">
                    <LockKeyhole size={32} />
                    <h3>Authentication is not configured.</h3>
                    <p>
                      This local first-module app does not enforce login, 2FA,
                      team roles or session policies.
                    </p>
                  </div>
                  <div className="s-capability">
                    <KeyRound size={16} />
                    <span>
                      Provider credentials stay in the backend environment.
                    </span>
                  </div>
                  <button
                    className="z-btn z-soft z-full"
                    onClick={() => p.onNavigate("Team & Permissions")}
                  >
                    Plan Team Roles
                    <ArrowRight size={13} />
                  </button>
                </div>
              </section>
            )}
            {(tab === "All" || tab === "Data & Storage") && (
              <section className="z-card">
                <Heading title="Data & Storage" icon={Layers3} />
                <div className="z-form-body">
                  <div className="s-setting-row">
                    <span>Saved series</span>
                    <strong>{p.series.length}</strong>
                  </div>
                  <div className="s-setting-row">
                    <span>Episode plans</span>
                    <strong>{p.episodes.length}</strong>
                  </div>
                  <div className="s-setting-row">
                    <span>Generated scripts</span>
                    <strong>{scriptReady}</strong>
                  </div>
                  <div className="s-setting-row">
                    <span>Cloud media storage</span>
                    <span className="z-tag amber">Not connected</span>
                  </div>
                  <button
                    className="z-btn z-soft z-full"
                    onClick={() =>
                      exportFile(
                        {
                          series: p.series,
                          episodes: p.episodes,
                          settings: system,
                        },
                        "zenbee-workspace-export.json",
                      )
                    }
                  >
                    <Download size={14} />
                    Export Workspace Data
                  </button>
                </div>
              </section>
            )}
            {(tab === "All" || tab === "Advanced") && (
              <section className="z-card">
                <Heading title="Advanced Preferences" icon={Settings2} />
                <div className="z-form-body">
                  <label>
                    Future Generation Concurrency
                    <select
                      value={system.concurrency}
                      onChange={(e) =>
                        setSystem({
                          ...system,
                          concurrency: Number(e.target.value),
                        })
                      }
                    >
                      {[1, 2, 3, 4].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <p className="s-small-note">
                    This preference is stored for a future worker. Manual story
                    generation uses the current backend implementation.
                  </p>
                  <div className="s-actions-stack">
                    <button
                      className="z-btn"
                      onClick={() =>
                        exportFile(system, "zenbee-system-settings.json")
                      }
                    >
                      <Download size={14} />
                      Export Settings
                    </button>
                    <button
                      className="z-btn"
                      onClick={() => importRef.current?.click()}
                    >
                      <Upload size={14} />
                      Import & Save Settings
                    </button>
                    <button
                      className="z-btn"
                      onClick={() => {
                        setSystem({ ...systemDefaults });
                        p.notify(
                          "Default values loaded into the form. Save to apply them.",
                        );
                      }}
                    >
                      <RefreshCw size={14} />
                      Load Defaults
                    </button>
                    <button
                      className="z-btn"
                      onClick={() => setTempConfirm(true)}
                    >
                      Clear Local Production Drafts
                    </button>
                  </div>
                  {tempConfirm && (
                    <div className="s-confirm">
                      <p>
                        Remove only this browser’s editor, audio, video, cover
                        and episode-form drafts? Database records, characters
                        and bookmarks will be kept.
                      </p>
                      <button
                        className="z-btn"
                        onClick={() => setTempConfirm(false)}
                      >
                        Keep Drafts
                      </button>
                      <button
                        className="z-btn"
                        onClick={() => {
                          [
                            "zenbee-editor-draft",
                            "zenbee-audio-draft",
                            "zenbee-video-settings",
                            "zenbee-edit-draft",
                            "zenbee-cover-draft",
                            "zenbee-episode-form-draft",
                          ].forEach((k) => localStorage.removeItem(k));
                          setTempConfirm(false);
                          p.notify("Local production drafts cleared.");
                        }}
                      >
                        Clear Drafts
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {p.page === "Team & Permissions" && (
        <>
          <Notice text="Team access planning · owner sign-in protects the local workspace. Member drafts and role matrices do not create login accounts; invitations and multi-user permission enforcement remain unconnected." />
          <div className="z-page-actions">
            <Tabs
              values={[
                "All",
                "Roles",
                "Permission Matrix",
                "Access Requests",
                "Activity",
              ]}
              value={tab}
              onChange={setTab}
            />
            <div>
              <select
                aria-label="Filter team role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option>All Roles</option>
                {roleNames.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <ExampleButton />
              <button
                className="z-btn z-primary"
                onClick={() => {
                  setMemberId(null);
                  setMember({
                    name: "",
                    email: "",
                    role: "Editor",
                    status: "Draft",
                  });
                  setShowMemberForm(true);
                }}
              >
                <Plus size={14} />
                Add Member Draft
              </button>
            </div>
          </div>
          <MetricGrid
            items={[
              {
                label: "Member Drafts",
                value: members.filter((m) => m.data.status !== "Archived")
                  .length,
                icon: Users,
                color: "purple",
              },
              {
                label: "Planned Roles",
                value: roleNames.length,
                icon: Layers3,
                color: "blue",
              },
              {
                label: "Invitations Sent",
                value: 0,
                icon: Mail,
                color: "orange",
              },
              {
                label: "Enforced Permissions",
                value: "—",
                icon: ShieldCheck,
                color: "green",
              },
            ]}
          />
          {tab === "Access Requests" ? (
            <section className="z-card">
              <Heading title="Access Requests" icon={ShieldCheck} />
              <CompactEmpty
                title="Team access starts with authentication."
                text="There are no live access requests. Member drafts do not grant anyone access to this app."
              />
            </section>
          ) : tab === "Activity" ? (
            <section className="z-card">
              <Heading title="Team Planning Activity" icon={Activity} />
              <ActivityRows
                rows={events.filter((e) => eventType(e) === "Team")}
              />
            </section>
          ) : (
            <div
              className={
                "s-team-layout " + (tab !== "All" ? "matrix-view" : "")
              }
            >
              <section className="z-card">
                <Heading
                  title={tab === "All" ? "Team Member Drafts" : "Planned Roles"}
                  icon={Users}
                />
                {tab === "All" ? (
                  <div className="z-table-wrap">
                    <table className="z-table s-team-table">
                      <thead>
                        <tr>
                          <th>Member Draft</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Access</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleMembers.map((m) => (
                          <tr key={m.id}>
                            <td>
                              <div className="s-member-cell">
                                <span>{m.data.name.slice(0, 1)}</span>
                                <div>
                                  <strong>{m.data.name}</strong>
                                  <small>{m.data.email}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="z-tag">{m.data.role}</span>
                            </td>
                            <td>
                              <Status
                                value={
                                  m.id < 0 ? "Sample draft" : m.data.status
                                }
                              />
                            </td>
                            <td>Not granted</td>
                            <td>
                              <button
                                className="z-icon-btn"
                                aria-label={`Edit ${m.data.name}`}
                                onClick={() => {
                                  setMemberId(m.id > 0 ? m.id : null);
                                  setMember({ ...m.data });
                                  setShowMemberForm(true);
                                }}
                              >
                                <Pencil size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!visibleMembers.length && (
                      <CompactEmpty
                        title="Great stories are made together."
                        text="Add a member draft and plan a role for your future team."
                      />
                    )}
                  </div>
                ) : (
                  <div className="s-role-list">
                    {roleNames.map((role) => (
                      <button
                        className={selectedRole === role ? "selected" : ""}
                        key={role}
                        onClick={() => setSelectedRole(role)}
                      >
                        <ShieldCheck size={17} />
                        {role}
                        <ArrowRight size={12} />
                      </button>
                    ))}
                  </div>
                )}
              </section>
              <section className="z-card">
                <Heading
                  title="Roles & Planned Permissions"
                  icon={ShieldCheck}
                />
                <div className="z-form-body">
                  <label>
                    Role
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as Role)}
                    >
                      {roleNames.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <div className="s-permission-checks">
                    {permissions.map((permission) => (
                      <label key={permission}>
                        <input
                          type="checkbox"
                          disabled={selectedRole === "Owner"}
                          checked={(roles.matrix[selectedRole] || []).includes(
                            permission,
                          )}
                          onChange={() => {
                            const list = roles.matrix[selectedRole] || [];
                            setRoles({
                              matrix: {
                                ...roles.matrix,
                                [selectedRole]: list.includes(permission)
                                  ? list.filter((x) => x !== permission)
                                  : [...list, permission],
                              },
                            });
                          }}
                        />
                        {permission}
                      </label>
                    ))}
                  </div>
                  <p className="s-small-note">
                    The owner keeps all planned permissions. This matrix is a
                    draft for future access enforcement.
                  </p>
                  <button
                    className="z-btn z-primary z-full"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        setRoles(await save("roles", roles));
                        p.notify(
                          "Role matrix saved as an access plan. It does not enforce permissions.",
                        );
                      })
                    }
                  >
                    <Save size={14} />
                    Save Permission Plan
                  </button>
                </div>
                <div className="s-permission-matrix">
                  <table>
                    <thead>
                      <tr>
                        <th>Feature</th>
                        {roleNames.map((r) => (
                          <th key={r}>{r}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {permissions.map((permission) => (
                        <tr key={permission}>
                          <td>{permission}</td>
                          {roleNames.map((role) => (
                            <td key={role}>
                              {(roles.matrix[role] || []).includes(
                                permission,
                              ) ? (
                                <CheckCircle2 size={13} />
                              ) : (
                                <span>—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
          {showMemberForm && (
            <form
              className="z-card s-member-form"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await saveRecord(
                    "team_member",
                    member.name,
                    member,
                    memberId,
                  );
                  setShowMemberForm(false);
                  p.notify(
                    "Member draft saved. No invitation was sent and no access was granted.",
                  );
                });
              }}
            >
              <Heading
                title={
                  memberId ? "Edit Member Draft" : "Add a Team Member Draft"
                }
                icon={Mail}
              />
              <div className="z-form-body">
                <div className="z-input-row">
                  <label>
                    Name <em>*</em>
                    <input
                      data-testid="member-name"
                      required
                      maxLength={80}
                      value={member.name}
                      onChange={(e) =>
                        setMember({ ...member, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Email <em>*</em>
                    <input
                      data-testid="member-email"
                      type="email"
                      required
                      maxLength={254}
                      value={member.email}
                      onChange={(e) =>
                        setMember({ ...member, email: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Planned Role
                    <select
                      value={member.role}
                      onChange={(e) =>
                        setMember({ ...member, role: e.target.value as Role })
                      }
                    >
                      {roleNames.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Draft Status
                    <select
                      value={member.status}
                      onChange={(e) =>
                        setMember({
                          ...member,
                          status: e.target.value as Member["status"],
                        })
                      }
                    >
                      <option>Draft</option>
                      <option>Planned</option>
                      <option>Archived</option>
                    </select>
                  </label>
                </div>
                <div className="s-inline-actions">
                  <button
                    type="button"
                    className="z-btn"
                    onClick={() => setShowMemberForm(false)}
                  >
                    Cancel
                  </button>
                  <button className="z-btn z-primary" disabled={busy}>
                    <Save size={14} />
                    Save Member Draft
                  </button>
                </div>
              </div>
            </form>
          )}
        </>
      )}

      {p.page === "Brand & Style Settings" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={[
                "All",
                "Color Palette",
                "Typography",
                "Visual Style",
                "Logo & Assets",
              ]}
              value={tab}
              onChange={setTab}
            />
            <div>
              <button
                className="z-btn"
                onClick={() => exportFile(brand, "zenbee-brand-kit.json")}
              >
                <Download size={14} />
                Export Brand Kit
              </button>
              <button
                className="z-btn z-primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    setBrand(await save("brand", brand));
                    p.notify(
                      "Brand kit saved. New story generation will use your saved creative direction.",
                    );
                  })
                }
              >
                <Save size={14} />
                Save Brand Kit
              </button>
            </div>
          </div>
          <div className="s-brand-grid">
            {tab === "All" && (
              <section className="z-card">
                <Heading title="Brand Identity" icon={Palette} />
                <div className="z-form-body">
                  <label>
                    Brand Name <em>*</em>
                    <input
                      data-testid="brand-name"
                      maxLength={80}
                      value={brand.name}
                      onChange={(e) =>
                        setBrand({ ...brand, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Tagline
                    <input
                      maxLength={150}
                      value={brand.tagline}
                      onChange={(e) =>
                        setBrand({ ...brand, tagline: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Brand Description
                    <textarea
                      rows={4}
                      maxLength={2000}
                      value={brand.description}
                      onChange={(e) =>
                        setBrand({ ...brand, description: e.target.value })
                      }
                    />
                  </label>
                </div>
              </section>
            )}
            {(tab === "All" || tab === "Logo & Assets") && (
              <section className="z-card">
                <Heading title="Logo & Brand Preview" icon={ImagePlus} />
                <div className="z-form-body">
                  <div
                    className="s-brand-logo"
                    style={{
                      background: brand.background,
                      color: brand.text,
                      fontFamily: brand.heading_font,
                    }}
                  >
                    {brand.logo ? (
                      <img src={brand.logo} alt={`${brand.name} logo`} />
                    ) : (
                      <span>🐝</span>
                    )}
                    <div>
                      <strong>{brand.name}</strong>
                      <small>{brand.tagline}</small>
                    </div>
                  </div>
                  <label className="s-upload">
                    <Upload size={15} />
                    Upload PNG, JPEG or WebP · under 250 KB
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) =>
                        logoUpload(e).catch(() =>
                          setError("Could not read the logo file."),
                        )
                      }
                    />
                  </label>
                  {brand.logo && (
                    <button
                      className="z-btn z-full"
                      onClick={() => setBrand({ ...brand, logo: "" })}
                    >
                      Remove Logo from Draft
                    </button>
                  )}
                  <p className="s-small-note">
                    Logo and brand values are saved to this workspace. Existing
                    video files are not modified.
                  </p>
                </div>
              </section>
            )}
            {(tab === "All" || tab === "Color Palette") && (
              <section className="z-card s-color-card">
                <Heading title="Color Palette" icon={Palette} />
                <div className="s-color-palette">
                  {(
                    [
                      "primary",
                      "secondary",
                      "accent",
                      "background",
                      "surface",
                      "text",
                    ] as const
                  ).map((key) => (
                    <label key={key}>
                      <span>{key}</span>
                      <input
                        aria-label={`${key} brand color`}
                        type="color"
                        value={brand[key]}
                        onChange={(e) =>
                          setBrand({ ...brand, [key]: e.target.value })
                        }
                      />
                      <strong>{brand[key].toUpperCase()}</strong>
                    </label>
                  ))}
                </div>
              </section>
            )}
            {(tab === "All" || tab === "Typography") && (
              <section className="z-card">
                <Heading title="Typography" icon={FileText} />
                <div className="z-form-body">
                  <div className="z-input-row">
                    <label>
                      Heading Font
                      <select
                        value={brand.heading_font}
                        onChange={(e) =>
                          setBrand({ ...brand, heading_font: e.target.value })
                        }
                      >
                        {fonts.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Body Font
                      <select
                        value={brand.body_font}
                        onChange={(e) =>
                          setBrand({ ...brand, body_font: e.target.value })
                        }
                      >
                        {fonts.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div
                    className="s-type-preview"
                    style={{ background: brand.background, color: brand.text }}
                  >
                    <h3
                      style={{
                        fontFamily: brand.heading_font,
                        color: brand.primary,
                      }}
                    >
                      Aa {brand.name}
                    </h3>
                    <p
                      style={{ fontFamily: brand.body_font, color: brand.text }}
                    >
                      A little spark. A world of possibility.
                      <br />
                      Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk
                      <br />
                      1234567890
                    </p>
                  </div>
                </div>
              </section>
            )}
            {(tab === "All" || tab === "Visual Style") && (
              <section className="z-card">
                <Heading
                  title="Visual Style & Story Direction"
                  icon={Sparkles}
                />
                <div className="z-form-body">
                  <div className="s-style-choices">
                    {["Modern", "Playful", "Minimal", "Creative"].map(
                      (s, i) => (
                        <button
                          key={s}
                          className={brand.visual_style === s ? "selected" : ""}
                          onClick={() =>
                            setBrand({ ...brand, visual_style: s })
                          }
                        >
                          <span
                            style={{
                              background: [
                                brand.primary,
                                brand.secondary,
                                brand.surface,
                                brand.accent,
                              ][i],
                            }}
                          >
                            <Sparkles size={20} />
                          </span>
                          {s}
                        </button>
                      ),
                    )}
                  </div>
                  <label>
                    Prompt Style
                    <textarea
                      data-testid="brand-direction"
                      rows={4}
                      maxLength={2000}
                      value={brand.prompt_style}
                      onChange={(e) =>
                        setBrand({ ...brand, prompt_style: e.target.value })
                      }
                    />
                  </label>
                  <p className="s-small-note">
                    Saved creative direction and core palette are included in
                    future AI story requests. Demo scene prompts include the
                    saved prompt style.
                  </p>
                </div>
              </section>
            )}
            {tab === "All" && (
              <section className="z-card">
                <Heading title="Content Brand Preview" icon={Eye} />
                <div className="z-form-body">
                  <div
                    className="s-social-preview"
                    style={{
                      background: brand.surface,
                      borderColor: brand.primary,
                    }}
                  >
                    <Art source="brand" crop={[1097, 782, 291, 77]} />
                    <div
                      style={{
                        color: brand.text,
                        fontFamily: brand.heading_font,
                      }}
                    >
                      <span style={{ background: brand.primary }}>🐝</span>
                      <strong>
                        {brand.name}
                        <small style={{ fontFamily: brand.body_font }}>
                          {brand.tagline}
                        </small>
                      </strong>
                    </div>
                  </div>
                  <div className="s-actions-stack">
                    <button
                      className="z-btn"
                      onClick={() => importRef.current?.click()}
                    >
                      <Upload size={14} />
                      Import & Save Brand Kit
                    </button>
                    <button
                      className="z-btn"
                      onClick={() => {
                        setBrand({ ...brandDefaults });
                        p.notify(
                          "Default brand values loaded. Save to apply them.",
                        );
                      }}
                    >
                      <RefreshCw size={14} />
                      Load Default Brand
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {p.page === "Social Account Connections" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={["All", "Permissions", "Publishing Setup"]}
              value={tab}
              onChange={setTab}
            />
            <button
              className="z-btn"
              onClick={() => p.onNavigate("Publishing Calendar")}
            >
              <CalendarIcon />
              Publishing Calendar
            </button>
          </div>
          <Notice text="No social account is authorized in this version. Selecting a preferred platform saves a plan; it does not establish an OAuth connection." />
          {tab === "All" ? (
            <>
              <div className="s-platform-grid">
                {platforms.map((platform, i) => (
                  <section className="z-card s-platform-card" key={platform}>
                    <PlatformIcon name={platform} />
                    <h3>{platform}</h3>
                    <p>
                      {
                        [
                          "Shorts & full episodes",
                          "Reels & your community",
                          "Pages & video posts",
                          "Short-form stories",
                          "Ideas & tutorials",
                          "Updates & conversation",
                        ][i]
                      }
                    </p>
                    <span className="z-tag amber">Not connected</span>
                    <button
                      className="z-btn z-soft"
                      onClick={() =>
                        i < 2
                          ? p.onConnect()
                          : p.notify(
                              `${platform} integration is planned and is not connected.`,
                            )
                      }
                    >
                      Set Up
                      <ArrowUpRight size={12} />
                    </button>
                  </section>
                ))}
              </div>
              <div className="s-social-lower">
                <section className="z-card">
                  <Heading title="Connected Accounts" icon={Globe} />
                  <CompactEmpty
                    title="A home for every story."
                    text="Your authorized channels will appear here after secure OAuth integration is implemented."
                    action="Prepare Publishing Preferences"
                    onAction={() => setTab("Publishing Setup")}
                  />
                </section>
                <section className="z-card">
                  <Heading title="Connection Overview" icon={Activity} />
                  <div className="s-connection-overview">
                    <div className="s-ring">
                      <span>
                        <strong>0</strong>
                        <small>Connected accounts</small>
                      </span>
                    </div>
                    <div className="s-setting-row">
                      <span>Supported planning targets</span>
                      <strong>{platforms.length}</strong>
                    </div>
                    <div className="s-setting-row">
                      <span>Preferred platforms</span>
                      <strong>{social.preferred_platforms.length}</strong>
                    </div>
                  </div>
                </section>
                <section className="z-card z-form-body">
                  <h3>One story. New possibilities.</h3>
                  <p>
                    Prepare platform preferences, review your captions and build
                    a buffer of finished stories before connecting automatic
                    publishing.
                  </p>
                  <button
                    className="z-btn z-primary z-full"
                    onClick={() => p.onNavigate("Scheduled Posts")}
                  >
                    View Episode Plans
                    <ArrowRight size={13} />
                  </button>
                </section>
              </div>
            </>
          ) : tab === "Permissions" ? (
            <section className="z-card">
              <Heading title="Platform Permissions" icon={ShieldCheck} />
              <div className="s-permission-info">
                {[
                  "Account identity",
                  "Upload / publish content",
                  "Read analytics",
                  "Manage scheduled posts",
                ].map((s) => (
                  <div key={s}>
                    <LockKeyhole size={18} />
                    <span>{s}</span>
                    <span className="z-tag amber">Not granted</span>
                  </div>
                ))}
              </div>
              <div className="z-form-body">
                <p>
                  No OAuth scopes or account tokens are stored by this
                  interface.
                </p>
              </div>
            </section>
          ) : (
            <section className="z-card s-narrow">
              <Heading
                title="Publishing Preferences · Planning Only"
                icon={Settings2}
              />
              <div className="z-form-body">
                <label>Preferred Platforms</label>
                <div className="s-platform-checks">
                  {platforms.map((s) => (
                    <label key={s}>
                      <input
                        type="checkbox"
                        checked={social.preferred_platforms.includes(s)}
                        onChange={() =>
                          setSocial({
                            ...social,
                            preferred_platforms:
                              social.preferred_platforms.includes(s)
                                ? social.preferred_platforms.filter(
                                    (v) => v !== s,
                                  )
                                : [...social.preferred_platforms, s],
                          })
                        }
                      />
                      {s}
                    </label>
                  ))}
                </div>
                <label>
                  Default Platform
                  <select
                    value={social.default_platform}
                    onChange={(e) =>
                      setSocial({ ...social, default_platform: e.target.value })
                    }
                  >
                    {platforms.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="s-check">
                  <input
                    type="checkbox"
                    checked={social.require_review}
                    onChange={(e) =>
                      setSocial({ ...social, require_review: e.target.checked })
                    }
                  />
                  Require a review in the planned publishing workflow
                </label>
                <label className="s-check">
                  <input
                    type="checkbox"
                    checked={social.cross_post_requested}
                    onChange={(e) =>
                      setSocial({
                        ...social,
                        cross_post_requested: e.target.checked,
                      })
                    }
                  />
                  Request cross-posting when integrations are available
                </label>
                <button
                  className="z-btn z-primary z-full"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      setSocial(await save("social", social));
                      p.notify(
                        "Social publishing preferences saved. No account was connected.",
                      );
                    })
                  }
                >
                  <Save size={14} />
                  Save Preferences
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {p.page === "AI Providers & API Keys" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={[
                "All",
                "Model Preferences",
                "Usage & Limits",
                "Configuration",
              ]}
              value={tab}
              onChange={setTab}
            />
            <button
              className="z-btn z-primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setProviderStatus(
                    await api<ProviderStatus>("/settings/provider-status"),
                  );
                  p.notify(
                    "Server configuration checked. Provider connectivity has not been tested.",
                  );
                })
              }
            >
              <RefreshCw size={14} />
              Check Configuration
            </button>
          </div>
          <Notice text="API keys are managed in the backend environment. This screen never collects, displays, copies or stores provider secrets." />
          {tab === "All" ? (
            <>
              <div className="s-provider-grid">
                {[
                  {
                    name: "OpenAI",
                    symbol: "◎",
                    detail: "Structured story generation",
                    status:
                      providerStatus?.generation_mode === "openai"
                        ? providerStatus.openai_key_configured
                          ? "Configured · untested"
                          : "Key missing"
                        : "Not active",
                  },
                  {
                    name: "Demo",
                    symbol: "✦",
                    detail: "Sample story templates",
                    status:
                      (providerStatus?.generation_mode || p.mode) === "demo"
                        ? "Active demo mode"
                        : "Available",
                  },
                  {
                    name: "Google video API",
                    symbol: "✧",
                    detail: "Video production · future integration",
                    status: "Not integrated",
                  },
                  {
                    name: "TTS provider",
                    symbol: "Ⅱ",
                    detail: "Voice production · future integration",
                    status: "Not integrated",
                  },
                ]
                  .filter((s) =>
                    s.name.toLowerCase().includes(p.query.toLowerCase()),
                  )
                  .map((s) => (
                    <section className="z-card s-provider-card" key={s.name}>
                      <span>{s.symbol}</span>
                      <h3>{s.name}</h3>
                      <p>{s.detail}</p>
                      <span className="z-tag">{s.status}</span>
                    </section>
                  ))}
              </div>
              <div className="s-provider-lower">
                <section className="z-card">
                  <Heading
                    title="Server Credential Configuration"
                    icon={KeyRound}
                  />
                  <div className="z-table-wrap">
                    <table className="z-table s-provider-table">
                      <thead>
                        <tr>
                          <th>Provider</th>
                          <th>Credential Source</th>
                          <th>Model / Mode</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>OpenAI</td>
                          <td>OPENAI_API_KEY · server environment</td>
                          <td>
                            {providerStatus?.story_model ||
                              "Read configuration to load"}
                          </td>
                          <td>
                            <span className="z-tag amber">
                              {providerStatus?.openai_key_configured
                                ? "Key present · untested"
                                : "Not configured"}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td>Demo</td>
                          <td>No credentials required</td>
                          <td>Deterministic sample templates</td>
                          <td>
                            <span className="z-tag green">
                              {p.mode === "demo" ? "Active" : "Available"}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="z-form-body">
                    <p>
                      A present key does not confirm access, quota, model
                      availability or provider uptime. Configure the backend
                      environment and run a workspace story when you are ready
                      to use the provider.
                    </p>
                  </div>
                </section>
                <section className="z-card">
                  <Heading title="Generation Configuration" icon={Activity} />
                  <div className="z-form-body">
                    <div className="s-setting-row">
                      <span>Active runtime mode</span>
                      <strong>
                        {providerStatus?.generation_mode || p.mode}
                      </strong>
                    </div>
                    <div className="s-setting-row">
                      <span>Story attempts in workspace</span>
                      <strong>
                        {p.episodes.reduce((s, e) => s + e.attempts, 0)}
                      </strong>
                    </div>
                    <div className="s-setting-row">
                      <span>Live billing / quota</span>
                      <span className="z-tag amber">Not connected</span>
                    </div>
                    <button
                      className="z-btn z-soft z-full"
                      onClick={() => p.onNavigate("Generation Cost")}
                    >
                      Budget & Cost Estimates
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </section>
              </div>
            </>
          ) : tab === "Configuration" ? (
            <section className="z-card s-narrow">
              <Heading title="Configure the Backend" icon={KeyRound} />
              <div className="z-form-body">
                <p>
                  Use the backend environment file or your deployment’s secret
                  manager. Do not add credentials to frontend files.
                </p>
                <div className="s-env-example">
                  <code>
                    GENERATION_MODE=openai
                    <br />
                    OPENAI_API_KEY=&lt;set on server&gt;
                    <br />
                    OPENAI_MODEL=&lt;accessible structured-output model&gt;
                  </code>
                </div>
                <p>
                  Restart the backend after configuration changes. The model
                  shown in this dashboard is read from server configuration. No
                  paid connectivity test is run by the configuration check.
                </p>
              </div>
            </section>
          ) : (
            <section className="z-card s-narrow">
              <Heading
                title={
                  tab === "Usage & Limits"
                    ? "Planned Usage Targets"
                    : "Provider Preferences"
                }
                icon={Settings2}
              />
              <div className="z-form-body">
                <label>
                  Preferred Story Provider
                  <select
                    value={providers.preferred_story_provider}
                    onChange={(e) =>
                      setProviders({
                        ...providers,
                        preferred_story_provider: e.target.value,
                      })
                    }
                  >
                    <option>Demo</option>
                    <option>OpenAI</option>
                  </select>
                </label>
                <label>
                  Preferred Video Provider
                  <select
                    value={providers.preferred_video_provider}
                    onChange={(e) =>
                      setProviders({
                        ...providers,
                        preferred_video_provider: e.target.value,
                      })
                    }
                  >
                    <option>Not configured</option>
                    <option>Google video API</option>
                    <option>Other API</option>
                  </select>
                </label>
                <label>
                  Preferred Voice Provider
                  <select
                    value={providers.preferred_voice_provider}
                    onChange={(e) =>
                      setProviders({
                        ...providers,
                        preferred_voice_provider: e.target.value,
                      })
                    }
                  >
                    <option>Not configured</option>
                    <option>TTS API</option>
                  </select>
                </label>
                <label>
                  Monthly Story-Request Target
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={providers.monthly_request_target}
                    onChange={(e) =>
                      setProviders({
                        ...providers,
                        monthly_request_target: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <p className="s-small-note">
                  Preferences do not switch the active server provider or
                  enforce request limits. Runtime settings come from the backend
                  environment.
                </p>
                <button
                  className="z-btn z-primary z-full"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      setProviders(await save("providers", providers));
                      p.notify(
                        "Provider preferences saved. Active runtime configuration is unchanged.",
                      );
                    })
                  }
                >
                  <Save size={14} />
                  Save Preferences
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {p.page === "Generation Cost" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={[
                "All",
                "Model Breakdown",
                "Recent Estimates",
                "Usage & Limits",
              ]}
              value={tab}
              onChange={setTab}
            />
            <div>
              <ExampleButton />
              <button
                className="z-btn"
                onClick={() =>
                  exportFile(
                    {
                      source: examples
                        ? "sample_estimates"
                        : "manual_estimates",
                      currency: "INR",
                      month,
                      entries: costRows,
                      budget,
                      provider_billing_connected: false,
                    },
                    "zenbee-cost-estimates.json",
                  )
                }
              >
                <Download size={14} />
                Export Estimates
              </button>
              <button
                className="z-btn z-primary"
                onClick={() => {
                  setCostId(null);
                  setCostEntry({
                    provider: "OpenAI",
                    category: "Script",
                    amount_inr: "0.00",
                    quantity: 1,
                    recorded_on: today(),
                    note: "",
                  });
                  setShowCostForm(true);
                }}
              >
                <Plus size={14} />
                Record Estimate
              </button>
            </div>
          </div>
          {examples ? (
            <SampleNote text="Illustrative estimates · these amounts are not provider prices, invoices or live charges." />
          ) : (
            <Notice text="Manual planning ledger · provider billing, token metering and actual costs are not synced. Budget checks use recorded estimates only." />
          )}
          <MetricGrid
            items={[
              {
                label: "Recorded Estimates",
                value: money(totalEstimate),
                icon: Coins,
                color: "pink",
              },
              {
                label: "Estimated Generations",
                value: costRows.reduce((s, c) => s + c.data.quantity, 0),
                icon: Zap,
                color: "green",
              },
              {
                label: "Monthly Budget Target",
                value: money(budget.monthly_inr),
                icon: Target,
                color: "purple",
              },
              {
                label: "Provider Billing",
                value: "Not synced",
                icon: Activity,
                color: "blue",
              },
            ]}
          />
          {budget.show_estimate_alerts &&
            budgetPercent >= budget.warning_percent && (
              <Notice
                text={`Recorded estimates have reached ${budgetPercent.toFixed(0)}% of the monthly target. This is an estimate alert; it does not block generation.`}
              />
            )}
          <div
            className={
              "s-cost-layout " +
              (tab === "Model Breakdown"
                ? "breakdown-only"
                : tab === "Usage & Limits"
                  ? "limits-view"
                  : "")
            }
          >
            {tab === "All" && (
              <section className="z-card">
                <Heading title="Recorded Estimate Trend" icon={BarChart3} />
                <TrendChart
                  values={
                    costRows.length
                      ? [
                          0,
                          ...[...costRows]
                            .reverse()
                            .reduce<number[]>(
                              (values, c) => [
                                ...values,
                                (values[values.length - 1] || 0) +
                                  Number(c.data.amount_inr),
                              ],
                              [],
                            ),
                        ]
                      : []
                  }
                  label="Cumulative recorded estimates"
                  empty="Record an estimate to start your planning ledger."
                />
                <p className="s-small-note s-chart-note">
                  No provider charges or ROI are inferred.
                </p>
              </section>
            )}
            {(tab === "All" || tab === "Model Breakdown") && (
              <section className="z-card">
                <Heading title="Provider Estimate Breakdown" icon={Layers3} />
                <div className="z-table-wrap">
                  <table className="z-table s-cost-table">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Quantity</th>
                        <th>Estimate · INR</th>
                        <th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costProviders.map((c) => (
                        <tr key={c.name}>
                          <td>{c.name}</td>
                          <td>{c.quantity}</td>
                          <td>{money(c.cost)}</td>
                          <td>
                            <span className="z-tag">
                              {totalEstimate
                                ? Math.round((c.cost / totalEstimate) * 100)
                                : 0}
                              %
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!costProviders.length && (
                    <CompactEmpty
                      title="A little planning goes a long way."
                      text="Record manual estimates to see a provider breakdown."
                    />
                  )}
                </div>
              </section>
            )}
            {(tab === "All" || tab === "Usage & Limits") && (
              <section className="z-card">
                <Heading title="Budget Overview" icon={Target} />
                <div className="z-form-body">
                  <div
                    className="s-budget-ring"
                    style={{
                      background: `conic-gradient(#ad59ed ${budgetPercent * 3.6}deg,#eee4f8 0deg)`,
                    }}
                  >
                    <span>
                      <strong>{budgetPercent.toFixed(0)}%</strong>
                      <small>Estimate / target</small>
                    </span>
                  </div>
                  <div className="s-setting-row">
                    <span>Recorded estimates</span>
                    <strong>{money(totalEstimate)}</strong>
                  </div>
                  <div className="s-setting-row">
                    <span>Remaining target</span>
                    <strong>
                      {money(Math.max(0, budgetAmount - totalEstimate))}
                    </strong>
                  </div>
                  <label>
                    Monthly Budget Target · INR
                    <input
                      data-testid="monthly-budget"
                      type="number"
                      min={0}
                      max={10000000}
                      step="0.01"
                      value={budget.monthly_inr}
                      onChange={(e) =>
                        setBudget({ ...budget, monthly_inr: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Estimate Alert Threshold (%)
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={budget.warning_percent}
                      onChange={(e) =>
                        setBudget({
                          ...budget,
                          warning_percent: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="s-check">
                    <input
                      type="checkbox"
                      checked={budget.show_estimate_alerts}
                      onChange={(e) =>
                        setBudget({
                          ...budget,
                          show_estimate_alerts: e.target.checked,
                        })
                      }
                    />
                    Show in-app estimate alerts
                  </label>
                  <button
                    className="z-btn z-primary z-full"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        setBudget(await save("budget", budget));
                        p.notify(
                          "Budget target saved. No spending cap is enforced.",
                        );
                      })
                    }
                  >
                    <Save size={14} />
                    Save Budget Target
                  </button>
                </div>
              </section>
            )}
          </div>
          {(tab === "All" || tab === "Recent Estimates") && (
            <section className="z-card s-cost-records">
              <Heading
                title={`Manual Estimate Records · ${month}`}
                icon={Clock3}
              />
              <div className="z-table-wrap">
                <table className="z-table s-cost-table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Type</th>
                      <th>Quantity</th>
                      <th>Estimate · INR</th>
                      <th>Recorded On</th>
                      <th>Source</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {costRows.map((c) => (
                      <tr key={c.id}>
                        <td>{c.data.provider}</td>
                        <td>
                          <span className="z-tag">{c.data.category}</span>
                        </td>
                        <td>{c.data.quantity}</td>
                        <td>{money(c.data.amount_inr)}</td>
                        <td>{c.data.recorded_on}</td>
                        <td>
                          {examples ? "Sample estimate" : "Manual estimate"}
                        </td>
                        <td>
                          <button
                            className="z-icon-btn"
                            disabled={c.id < 0}
                            aria-label={`Edit ${c.name}`}
                            onClick={() => {
                              setCostId(c.id);
                              setCostEntry({ ...c.data });
                              setShowCostForm(true);
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!costRows.length && (
                  <CompactEmpty
                    title="Give your creative budget a little clarity."
                    text="There are no recorded estimates for this month."
                  />
                )}
              </div>
            </section>
          )}
          {showCostForm && (
            <form
              className="z-card s-cost-form"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await saveRecord(
                    "cost_entry",
                    `${costEntry.provider} · ${costEntry.category} estimate`,
                    costEntry,
                    costId,
                  );
                  setShowCostForm(false);
                  setExamples(false);
                  p.notify(
                    "Manual estimate saved. This is not a provider billing record.",
                  );
                });
              }}
            >
              <Heading title="Record a Manual Cost Estimate" icon={Coins} />
              <div className="z-form-body">
                <div className="z-input-row">
                  <label>
                    Provider
                    <input
                      data-testid="cost-provider"
                      required
                      maxLength={80}
                      value={costEntry.provider}
                      onChange={(e) =>
                        setCostEntry({ ...costEntry, provider: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Content Type
                    <select
                      value={costEntry.category}
                      onChange={(e) =>
                        setCostEntry({
                          ...costEntry,
                          category: e.target.value as CostEntry["category"],
                        })
                      }
                    >
                      {["Script", "Video", "Image", "Voice", "Other"].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Total Estimate · INR
                    <input
                      data-testid="cost-amount"
                      type="number"
                      min={0}
                      max={1000000}
                      step="0.01"
                      required
                      value={costEntry.amount_inr}
                      onChange={(e) =>
                        setCostEntry({
                          ...costEntry,
                          amount_inr: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Quantity
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      required
                      value={costEntry.quantity}
                      onChange={(e) =>
                        setCostEntry({
                          ...costEntry,
                          quantity: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="z-input-row">
                  <label>
                    Recorded On
                    <input
                      type="date"
                      required
                      value={costEntry.recorded_on}
                      onChange={(e) =>
                        setCostEntry({
                          ...costEntry,
                          recorded_on: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Notes
                    <input
                      maxLength={1000}
                      value={costEntry.note}
                      onChange={(e) =>
                        setCostEntry({ ...costEntry, note: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="s-inline-actions">
                  <button
                    type="button"
                    className="z-btn"
                    onClick={() => setShowCostForm(false)}
                  >
                    Cancel
                  </button>
                  <button className="z-btn z-primary" disabled={busy}>
                    <Save size={14} />
                    Save Estimate
                  </button>
                </div>
              </div>
            </form>
          )}
        </>
      )}

      {p.page === "AI Content Insights" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={[
                "All",
                "Content Ideas",
                "Keywords & Topics",
                "Title Suggestions",
              ]}
              value={tab}
              onChange={setTab}
            />
            <div>
              <ExampleButton />
              <button
                className="z-btn z-primary"
                onClick={() => p.onNavigate("AI Topic & Idea Generator")}
              >
                <Lightbulb size={14} />
                Find New Story Ideas
              </button>
            </div>
          </div>
          <Notice
            text={
              examples
                ? "Sample insights are illustrative. They are not live trends, AI forecasts or audience predictions."
                : "Workspace insights use local script checks and simple story templates. Channel analytics, trends and predictive models are not connected."
            }
          />
          <MetricGrid
            items={[
              {
                label: "Story Ideas",
                value: ideaCards.length,
                icon: Lightbulb,
                color: "orange",
              },
              {
                label: "Scripts Ready",
                value: examples ? 8 : scriptReady,
                icon: FileText,
                color: "purple",
              },
              {
                label: "Story Keywords",
                value: keywords.length,
                icon: Layers3,
                color: "blue",
              },
              {
                label: "Live Predictions",
                value: "—",
                icon: Target,
                color: "pink",
              },
            ]}
          />
          <div className="s-insights-grid">
            {(tab === "All" || tab === "Content Ideas") && (
              <section className="z-card">
                <Heading title="Story Inspiration" icon={Lightbulb} />
                <div className="s-insight-ideas">
                  {ideaCards
                    .filter((c) =>
                      `${c.title} ${c.detail}`
                        .toLowerCase()
                        .includes(p.query.toLowerCase()),
                    )
                    .map((c, i) => (
                      <div key={c.id}>
                        <EpisodeArt index={i} />
                        <div>
                          <h3>{c.title}</h3>
                          <p>{c.detail}</p>
                          <button
                            className="z-btn z-soft"
                            onClick={() => {
                              localStorage.setItem(
                                "zenbee-episode-idea",
                                `${c.title}: ${c.detail}`,
                              );
                              p.onNavigate("Create Episode");
                              p.notify(
                                "Story idea added to your episode draft.",
                              );
                            }}
                          >
                            Use Idea
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}
            {(tab === "All" || tab === "Keywords & Topics") && (
              <section className="z-card">
                <Heading
                  title={
                    examples
                      ? "Illustrative Topic Keywords"
                      : "Keywords from Your Story Titles"
                  }
                  icon={Search}
                />
                <div className="s-keyword-list">
                  {keywords.map(([word, count], i) => (
                    <div key={word}>
                      <span>{i + 1}</span>
                      <strong>{word}</strong>
                      <div>
                        <i
                          style={{
                            width: `${(count / (keywords[0]?.[1] || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <small>{count}</small>
                    </div>
                  ))}
                  {!keywords.length && (
                    <CompactEmpty
                      title="Your stories have something to say."
                      text="Add topics and generated scripts to see recurring words from your titles."
                    />
                  )}
                </div>
                <p className="s-small-note s-chart-note">
                  Counts come from story titles or labeled samples. They are not
                  external search trends.
                </p>
              </section>
            )}
            {tab === "All" && (
              <section className="z-card">
                <Heading title="Publishing Time Explorer" icon={Clock3} />
                <div className="s-heatmap">
                  <div>
                    <span />
                    {[
                      "9 AM",
                      "11 AM",
                      "1 PM",
                      "3 PM",
                      "6 PM",
                      "8 PM",
                      "10 PM",
                    ].map((t) => (
                      <strong key={t}>{t}</strong>
                    ))}
                  </div>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (day, d) => (
                      <div key={day}>
                        <strong>{day}</strong>
                        {Array.from({ length: 7 }, (_, h) => (
                          <span
                            key={h}
                            style={{
                              background: examples
                                ? `rgba(156,66,235,${0.12 + ((d * 3 + h * 2) % 8) / 10})`
                                : "#f3eaf9",
                            }}
                            title={
                              examples
                                ? "Illustrative sample activity"
                                : "No audience activity connected"
                            }
                          />
                        ))}
                      </div>
                    ),
                  )}
                </div>
                <p className="s-small-note s-chart-note">
                  {examples
                    ? "Illustrative heatmap. No best publishing time is inferred."
                    : "Connect audience analytics to discover a real publishing rhythm."}
                </p>
              </section>
            )}
            {(tab === "All" || tab === "Title Suggestions") && (
              <section className="z-card">
                <Heading title="Title & Cover Inspiration" icon={Sparkles} />
                <div className="s-title-suggestions">
                  {ideaCards.slice(0, 3).map((c, i) => (
                    <div key={c.id}>
                      <EpisodeArt index={i} />
                      <span>
                        <small>Template title</small>
                        <strong>{c.title} | A New ZENBEE Adventure</strong>
                      </span>
                      <button
                        className="z-icon-btn"
                        aria-label={`Copy ${c.title}`}
                        onClick={() =>
                          copy(`${c.title} | A New ZENBEE Adventure`)
                        }
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="z-form-body">
                  <button
                    className="z-btn z-soft z-full"
                    onClick={() => p.onNavigate("Thumbnail & Cover Creator")}
                  >
                    Open Cover Creator
                    <ArrowRight size={13} />
                  </button>
                </div>
              </section>
            )}
            {tab === "All" && (
              <section className="z-card">
                <Heading title="Local Script Readiness" icon={ShieldCheck} />
                <div className="z-form-body">
                  <div className="s-setting-row">
                    <span>Episodes with generated stories</span>
                    <strong>
                      {scriptReady} / {p.episodes.length}
                    </strong>
                  </div>
                  <div className="s-setting-row">
                    <span>Stories with 3+ scene prompts</span>
                    <strong>
                      {
                        p.episodes.filter(
                          (e) =>
                            e.story &&
                            e.story.scenes.length >= 3 &&
                            e.story.scenes.every((s) => s.visual_prompt.trim()),
                        ).length
                      }
                    </strong>
                  </div>
                  <div className="s-setting-row">
                    <span>Stories with captions</span>
                    <strong>
                      {
                        p.episodes.filter((e) =>
                          e.story?.scenes.every((s) => s.caption.trim()),
                        ).length
                      }
                    </strong>
                  </div>
                  <p className="s-small-note">
                    Completeness is a local check. Review creative quality and
                    media separately.
                  </p>
                  <button
                    className="z-btn z-soft z-full"
                    onClick={() => p.onNavigate("Approval & Quality Review")}
                  >
                    Review Your Stories
                    <ArrowRight size={13} />
                  </button>
                </div>
              </section>
            )}
            {tab === "All" && (
              <section className="z-card">
                <Heading title="Your Creative Action Plan" icon={Target} />
                <div className="s-insight-checks">
                  {[
                    "Review recurring character details",
                    "Build a seven-day finished-video buffer",
                    "Write a clear title and caption",
                    "Create an episode cover",
                    "Review before connecting publishing",
                  ].map((s, i) => (
                    <label key={s}>
                      <input
                        type="checkbox"
                        checked={!!insightChecks[String(i)]}
                        onChange={(e) => {
                          const next = {
                            ...insightChecks,
                            [String(i)]: e.target.checked,
                          };
                          setInsightChecks(next);
                          localStorage.setItem(
                            "zenbee-insight-checklist",
                            JSON.stringify(next),
                          );
                        }}
                      />
                      {s}
                    </label>
                  ))}
                  <small>Checklist saved on this device</small>
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {p.page === "Episode Performance" && (
        <>
          <div className="z-page-actions">
            <Tabs
              values={["All", "Episode Comparison", "Audience Retention"]}
              value={tab}
              onChange={setTab}
            />
            <div>
              <ExampleButton />
              <select
                aria-label="Filter performance series"
                value={selectedSeries}
                onChange={(e) => setSelectedSeries(e.target.value)}
              >
                <option>All Series</option>
                {[
                  ...new Set(
                    (examples ? samplePerformance : actualPerformance).map(
                      (e) => e.series,
                    ),
                  ),
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Sort episode performance"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option>Views</option>
                <option>Title</option>
                <option>Duration</option>
              </select>
            </div>
          </div>
          <Notice
            text={
              examples
                ? "Illustrative episode metrics · these numbers are not your channel performance."
                : "Platform performance is not connected. Script duration and workspace episode counts are available; views, watch time and engagement are unknown."
            }
          />
          <MetricGrid
            items={[
              {
                label: examples ? "Sample Episodes" : "Workspace Episodes",
                value: performanceRows.length,
                icon: Film,
                color: "purple",
              },
              {
                label: "Views",
                value: examples
                  ? samplePerformance
                      .reduce((s, e) => s + e.views, 0)
                      .toLocaleString("en-IN")
                  : "—",
                icon: Eye,
                color: "blue",
              },
              {
                label: "Watch Hours",
                value: examples
                  ? samplePerformance
                      .reduce((s, e) => s + e.hours, 0)
                      .toLocaleString("en-IN")
                  : "—",
                icon: Clock3,
                color: "orange",
              },
              {
                label: "Likes",
                value: examples
                  ? samplePerformance
                      .reduce((s, e) => s + e.likes, 0)
                      .toLocaleString("en-IN")
                  : "—",
                icon: Heart,
                color: "pink",
              },
            ]}
          />
          {tab === "Audience Retention" ? (
            <section className="z-card">
              <Heading title="Audience Retention" icon={Activity} />
              <div className="s-retention">
                <TrendChart
                  values={examples ? [100, 94, 88, 82, 74, 68, 62, 58] : []}
                  label={
                    examples
                      ? "Illustrative retention curve"
                      : "Audience retention"
                  }
                  empty="Audience retention will appear after platform analytics is connected."
                />
                <p className="s-small-note">
                  {examples
                    ? "Sample retention curve for design exploration."
                    : "No retention estimate is inferred from the script."}
                </p>
              </div>
            </section>
          ) : (
            <div className="s-performance-layout">
              <section className="z-card">
                <Heading
                  title={
                    tab === "Episode Comparison"
                      ? "Compare Episodes"
                      : "Episode Performance"
                  }
                  icon={Play}
                />
                {tab === "Episode Comparison" ? (
                  <div className="z-form-body">
                    <p>
                      Select up to two episodes in the table below to compare
                      them.
                    </p>
                    <div className="s-comparison-grid">
                      {compareIds.map((id) => {
                        const row = performanceRows.find((e) => e.id === id);
                        return row ? (
                          <div key={id}>
                            <EpisodeArt index={Math.abs(id) % 3} />
                            <h3>{row.title}</h3>
                            <div className="s-setting-row">
                              <span>Script duration</span>
                              <strong>
                                {row.seconds || "—"}
                                {row.seconds ? " sec" : ""}
                              </strong>
                            </div>
                            <div className="s-setting-row">
                              <span>Views</span>
                              <strong>
                                {row.views?.toLocaleString("en-IN") || "—"}
                              </strong>
                            </div>
                            <div className="s-setting-row">
                              <span>Engagement</span>
                              <strong>
                                {row.engagement ? row.engagement + "%" : "—"}
                              </strong>
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                ) : null}
                <div className="z-table-wrap">
                  <table className="z-table s-performance-table">
                    <thead>
                      <tr>
                        <th>Compare</th>
                        <th>Episode Title</th>
                        <th>Series</th>
                        <th>Script Duration</th>
                        <th>Views</th>
                        <th>Watch Hours</th>
                        <th>Engagement</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {performanceRows.map((e, i) => (
                        <tr key={e.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Compare ${e.title}`}
                              checked={compareIds.includes(e.id)}
                              onChange={() =>
                                setCompareIds(
                                  compareIds.includes(e.id)
                                    ? compareIds.filter((id) => id !== e.id)
                                    : [...compareIds.slice(-1), e.id],
                                )
                              }
                            />
                          </td>
                          <td>
                            <div className="s-performance-title">
                              <EpisodeArt index={i} />
                              <strong>{e.title}</strong>
                            </div>
                          </td>
                          <td>{e.series}</td>
                          <td>{e.seconds ? e.seconds + "s" : "—"}</td>
                          <td>{e.views?.toLocaleString("en-IN") || "—"}</td>
                          <td>{e.hours?.toLocaleString("en-IN") || "—"}</td>
                          <td>
                            <span className="z-tag green">
                              {e.engagement ? e.engagement + "%" : "—"}
                            </span>
                          </td>
                          <td>
                            <button
                              className="z-icon-btn"
                              aria-label={`Open ${e.title}`}
                              onClick={() => {
                                const episode = p.episodes.find(
                                  (row) => row.id === e.id,
                                );
                                if (episode) p.onOpen(episode);
                                else
                                  p.notify(
                                    "This is an illustrative sample episode.",
                                  );
                              }}
                            >
                              <ArrowUpRight size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!performanceRows.length && (
                    <CompactEmpty
                      title="Your next audience favorite could be yours."
                      text="Create an episode to begin building your story library."
                      action="Create Episode"
                      onAction={p.onNew}
                    />
                  )}
                </div>
                <div className="z-form-body">
                  <button
                    className="z-btn z-soft"
                    disabled={compareIds.length < 2}
                    onClick={() => setTab("Episode Comparison")}
                  >
                    Compare Selected Episodes
                    <ArrowRight size={13} />
                  </button>
                </div>
              </section>
              <div className="z-stack">
                <section className="z-card">
                  <Heading title="Best Performing Episode" icon={Star} />
                  {best ? (
                    <div className="z-form-body">
                      <EpisodeArt index={2} />
                      <h3 className="s-detail-title">{best.title}</h3>
                      <span className="z-tag amber">Sample metric</span>
                      <div className="s-setting-row">
                        <span>Sample views</span>
                        <strong>{best.views.toLocaleString("en-IN")}</strong>
                      </div>
                      <div className="s-setting-row">
                        <span>Sample engagement</span>
                        <strong>{best.engagement}%</strong>
                      </div>
                    </div>
                  ) : (
                    <CompactEmpty
                      title="A little patience. A lot of potential."
                      text="Connect analytics to discover a real top performer."
                    />
                  )}
                </section>
                <section className="z-card">
                  <Heading title="Next Creative Step" icon={Zap} />
                  <div className="z-form-body">
                    <p>
                      Review your story, compare its structure, and plan the
                      next chapter. Performance recommendations need real
                      audience data.
                    </p>
                    <button
                      className="z-btn z-primary z-full"
                      onClick={p.onNew}
                    >
                      Plan Next Episode
                      <ArrowRight size={13} />
                    </button>
                    <button
                      className="z-btn z-soft z-full"
                      onClick={() => p.onNavigate("AI Content Insights")}
                    >
                      Explore Story Insights
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}
          {tab === "All" && (
            <div className="s-performance-charts">
              <section className="z-card">
                <Heading title="Views Trend" icon={BarChart3} />
                <TrendChart
                  values={examples ? samplePerformance.map((e) => e.views) : []}
                  label="Sample episode views"
                  empty="Live views are not connected."
                />
              </section>
              <section className="z-card">
                <Heading title="Engagement Trend" icon={Heart} />
                <TrendChart
                  values={
                    examples ? samplePerformance.map((e) => e.engagement) : []
                  }
                  label="Sample engagement rate"
                  empty="Live engagement is not connected."
                />
              </section>
              <section className="z-card z-form-body">
                <h3>Make your next chapter count.</h3>
                <p>
                  Use real audience feedback once channels are connected. Until
                  then, focus on consistent characters, clear dialogue and a
                  story worth sharing.
                </p>
                <button className="z-btn z-soft z-full" onClick={p.onConnect}>
                  Prepare Channel Connections
                  <ArrowUpRight size={13} />
                </button>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="s-notice">
      <ShieldCheck size={15} />
      <span>{text}</span>
    </div>
  );
}
function SampleNote({ text }: { text: string }) {
  return (
    <div className="s-sample-note">
      <span className="z-tag amber">Sample data</span>
      {text}
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
function ActivityRows({ rows }: { rows: EventRecord[] }) {
  return (
    <div className="s-activity-rows">
      {rows.map((e) => (
        <div key={e.id}>
          <span>
            <FileText size={17} />
          </span>
          <div>
            <strong>{e.action}</strong>
            <p>{e.detail}</p>
            <small>{date(e.created_at)} IST</small>
          </div>
        </div>
      ))}
      {!rows.length && (
        <CompactEmpty
          title="Your studio is ready for its next chapter."
          text="Workspace updates will appear here as you create and save."
        />
      )}
    </div>
  );
}
function NotificationList({ rows }: { rows: EventRecord[] }) {
  return (
    <div className="s-notification-list">
      {rows.map((e) => (
        <div key={e.id}>
          <span className={eventType(e) === "Error" ? "error" : ""}>
            {eventType(e) === "Error" ? (
              <Bell size={17} />
            ) : (
              <CheckCircle2 size={17} />
            )}
          </span>
          <div>
            <strong>{e.action}</strong>
            <p>{e.detail}</p>
            <small>{date(e.created_at)} IST</small>
          </div>
        </div>
      ))}
      {!rows.length && (
        <CompactEmpty
          title="A little quiet in the studio."
          text="There are no matching in-app updates."
        />
      )}
    </div>
  );
}
function PlatformIcon({ name }: { name: string }) {
  return (
    <span className={"s-platform-symbol " + name.toLowerCase()}>
      {name === "YouTube" ? (
        <Youtube size={30} />
      ) : name === "Instagram" ? (
        <Instagram size={30} />
      ) : name === "Facebook" ? (
        "f"
      ) : name === "TikTok" ? (
        "♪"
      ) : name === "Pinterest" ? (
        "P"
      ) : (
        "𝕏"
      )}
    </span>
  );
}
function CalendarIcon() {
  return <Clock3 size={14} />;
}
function TrendChart({
  values,
  label,
  empty,
}: {
  values: number[];
  label: string;
  empty: string;
}) {
  const max = Math.max(1, ...values),
    pts = values
      .map(
        (n, i) =>
          `${20 + (i / Math.max(1, values.length - 1)) * 460},${155 - (n / max) * 130}`,
      )
      .join(" ");
  return (
    <div className="s-trend-chart">
      <svg
        viewBox="0 0 500 190"
        role="img"
        aria-label={values.length ? label : empty}
      >
        {[25, 65, 110, 155].map((y) => (
          <line key={y} x1="20" x2="480" y1={y} y2={y} stroke="#f0e7fa" />
        ))}
        {values.length > 0 && (
          <>
            <polygon points={`20,155 ${pts} 480,155`} fill="#ba81ed22" />
            <polyline
              points={pts}
              fill="none"
              stroke="#ad63e5"
              strokeWidth="3"
            />
            {values.map((n, i) => (
              <circle
                key={i}
                cx={20 + (i / Math.max(1, values.length - 1)) * 460}
                cy={155 - (n / max) * 130}
                r="3.5"
                fill="white"
                stroke="#ad63e5"
                strokeWidth="2"
              />
            ))}
          </>
        )}
        <text x="20" y="180" fontSize="9" fill="#b196c3">
          Start
        </text>
        <text x="480" y="180" textAnchor="end" fontSize="9" fill="#b196c3">
          Latest
        </text>
      </svg>
      <span>{values.length ? label : empty}</span>
    </div>
  );
}
