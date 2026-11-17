"use client";
import {
  Art,
  type Series,
  type Scene,
  type Story,
  type Episode,
} from "./studio-shared";
import OperationsWorkspace, {
  operationsPages,
  operationDescriptions,
} from "./operations-workspace";
import "./operations.css";
import SettingsWorkspace, {
  settingsPages,
  settingsDescriptions,
} from "./settings-workspace";
import "./settings.css";
import ProductionWorkspace from "./production-workspace";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Clock3,
  Copy,
  Download,
  FileText,
  Film,
  FolderOpen,
  Gauge,
  Home,
  ImagePlus,
  Instagram,
  Layers3,
  Lightbulb,
  Menu,
  Mic,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Video,
  WandSparkles,
  X,
  Youtube,
  Zap,
} from "lucide-react";

type Props = {
  series: Series[];
  episodes: Episode[];
  connected: boolean;
  loading: boolean;
  mode: string;
  error: string;
  onNewEpisode: () => void;
  onNewSeries: () => void;
  onOpen: (e: Episode) => void;
  onConnect: () => void;
  onRefresh: () => Promise<void>;
  notify: (message: string) => void;
};
type Character = {
  name: string;
  role: string;
  description: string;
  art: number;
};
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
async function request<T>(
  path: string,
  body: unknown,
  method = "POST",
): Promise<T> {
  const r = await fetch(API + "/api" + path, {
    credentials: "include",
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Please check all required fields.",
    );
  return data;
}
function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ist(value: string) {
  return new Date(
    value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : value + "Z",
  ).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const demoSeries: Series[] = [
  {
    id: -1,
    name: "Drawing Comes Alive",
    description:
      "A little imagination. A world of possibilities. Follow Tura as her drawings turn into magical adventures.",
    characters:
      "Tura: curious girl with curly hair and a yellow hoodie. Panda: a playful, kind-hearted talking panda.",
    visual_style: "Vibrant 3D cartoon · warm magical lighting",
  },
  {
    id: -2,
    name: "Funny Food Adventures",
    description:
      "Foods come alive and go on funny missions. Join Tura and Panda for a delicious discovery.",
    characters: "Tura, Panda and their food friends",
    visual_style: "Colorful 3D cartoon",
  },
  {
    id: -3,
    name: "Ocean Adventures",
    description:
      "Explore the ocean world with Tura and friends. A new discovery around every coral reef.",
    characters: "Tura, Panda and their ocean friends",
    visual_style: "Soft 3D animation",
  },
];
const defaultCharacters: Character[] = [
  {
    name: "Tura",
    role: "Main character",
    description:
      "Curious, creative and brave. Curly hair, a yellow hoodie and a big imagination.",
    art: 0,
  },
  {
    name: "Panda",
    role: "Supporting character",
    description:
      "A playful, kind-hearted panda who brings joy to every adventure.",
    art: 1,
  },
  {
    name: "Bunny",
    role: "Supporting character",
    description: "A sweet little bunny with a curious mind and a gentle heart.",
    art: 2,
  },
  {
    name: "Fox",
    role: "Supporting character",
    description:
      "Clever, friendly and always ready for a new forest adventure.",
    art: 3,
  },
];
const sampleScenes: Scene[] = [
  {
    number: 1,
    duration_seconds: 8,
    visual_prompt:
      "A cute 3D cartoon scene of Tura, a girl with curly hair and a yellow hoodie, discovering a glowing drawing chest in her cozy room. Warm magical lighting, vibrant colors, child-friendly, 9:16 vertical composition.",
    dialogue: "Tura: “Wow! What is this? A magical drawing chest?”",
    narration:
      "In her cozy room, Tura finds a colorful drawing chest that glows with a magical light.",
    caption: "A little spark of magic…",
  },
  {
    number: 2,
    duration_seconds: 8,
    visual_prompt:
      "Tura opens her sketchbook. A glowing drawing of a panda begins to move. Keep Tura’s yellow hoodie and curly hair consistent.",
    dialogue: "Tura: “Did you just move?”",
    narration: "Something amazing is about to happen.",
    caption: "The panda comes alive!",
  },
  {
    number: 3,
    duration_seconds: 8,
    visual_prompt:
      "A friendly panda waves at Tura from the sketchbook, surrounded by golden sparkles. Soft 3D cartoon, warm light.",
    dialogue: "Panda: “Hello, friend!”",
    narration: "A new friendship begins with one small hello.",
    caption: "Hello, new friend!",
  },
  {
    number: 4,
    duration_seconds: 8,
    visual_prompt:
      "Tura and Panda smile together in the cozy colorful art room. Glowing sketchbook on the table, 9:16 framing.",
    dialogue: "Tura: “Let’s go on an adventure!”",
    narration: "Every great adventure starts with a little imagination.",
    caption: "What should they draw next?",
  },
];
const sampleStory: Story = {
  title: "The Talking Panda",
  synopsis:
    "Tura draws a cute panda in her room, and the panda suddenly comes alive! Together they discover the magic of imagination and friendship.",
  continuity_notes:
    "Tura’s magic comes from her sketchbook. Panda is her new friend. Keep the yellow hoodie, curly hair and soft 3D cartoon style consistent.",
  scenes: sampleScenes,
  description:
    "Watch Tura bring her imagination to life in a magical new adventure.",
  hashtags: [
    "#DrawingComesAlive",
    "#ZENBEE",
    "#TalkingPanda",
    "#KidsAdventure",
  ],
};
const sections = [
  {
    name: "Dashboard",
    icon: Home,
    pages: ["Overview", "Series Dashboard", "Activity"],
  },
  {
    name: "Series Management",
    icon: CalendarDays,
    pages: [
      "All Series",
      "Create New Series",
      "Characters Library",
      "Series Memory",
      "Episode History",
    ],
  },
  {
    name: "Content Studio",
    icon: Pencil,
    pages: [
      "AI Topic & Idea Generator",
      "Content Calendar",
      "Create Episode",
      "Story & Script Editor",
      "Scene & Prompt Editor",
      "AI Video Generator",
      "Voice & Sound Studio",
      "Video Editor & Preview",
      "Thumbnail & Cover Creator",
      "SEO & Caption Generator",
    ],
  },
  {
    name: "Automation",
    icon: Zap,
    pages: [
      "Automation Rules",
      "Recurring Content Scheduler",
      "Production Queue",
    ],
  },
  {
    name: "Publishing",
    icon: ArrowUpRight,
    pages: [
      "Publishing Queue",
      "Approval & Quality Review",
      "Failed Jobs & Retry",
      "Publishing Calendar",
      "YouTube Channel Manager",
      "Instagram Account Manager",
      "Scheduled Posts",
      "Publishing History",
      "Channels",
    ],
  },
  {
    name: "Analytics",
    icon: Activity,
    pages: [
      "Channel Analytics",
      "Episode Performance",
      "AI Content Insights",
      "Generation Cost",
      "Analytics",
    ],
  },
  {
    name: "Settings",
    icon: Settings2,
    pages: [
      "AI Providers & API Keys",
      "Social Account Connections",
      "Brand & Style Settings",
      "Team & Permissions",
      "System Settings",
      "Logs & Notifications",
    ],
  },
];
const descriptions: Record<string, string> = {
  ...operationDescriptions,
  ...settingsDescriptions,
  Overview: "Create, automate and grow your AI-powered content universe.",
  "Series Dashboard": "Track every series. Create the next chapter.",
  "All Series": "Manage your series, episodes, characters and creative worlds.",
  "Create New Series": "Bring your ideas to life. Build a world of your own.",
  "Characters Library": "Create, manage and keep your characters consistent.",
  "Series Memory": "Keep your story world connected, consistent and alive.",
  "Episode History": "Every episode. Every milestone. All in one place.",
  "Episode Performance": "See how your stories connect with your audience.",
  Activity: "Your creative journey, one moment at a time.",
  "AI Topic & Idea Generator":
    "A little spark. A whole new story. Find your next big idea.",
  "Content Calendar": "Plan • Schedule • Produce • Publish • Grow",
  "Create Episode":
    "Turn your idea into an episode — Script → Storyboard → Voice → Video.",
  "Story & Script Editor":
    "Craft engaging stories and full episode scripts, scene by scene.",
  "Scene & Prompt Editor":
    "Turn your script into stunning visuals with detailed scene prompts.",
  "AI Video Generator":
    "Bring your story to life with characters, voice, music and effects.",
  "Voice & Sound Studio":
    "Give every character a voice. Make every moment feel alive.",
  "Video Editor & Preview": "Edit, polish and preview your next great story.",
  "Thumbnail & Cover Creator":
    "Create covers that make your audience stop and smile.",
  "Production Queue": "Follow every story through your production pipeline.",
  "Failed Jobs & Retry":
    "A little help to get your creative flow moving again.",
  Channels: "Connect your stories to the people who will love them.",
  "Publishing Calendar": "Make room for your next great story.",
  Analytics: "Understand your audience. Grow your creative universe.",
  Settings: "A creative workspace that feels like you.",
};

export default function StudioViews(props: Props) {
  const [page, setPage] = useState("Overview"),
    [openGroups, setOpenGroups] = useState([
      "Dashboard",
      "Series Management",
      "Content Studio",
    ]),
    [mobile, setMobile] = useState(false),
    [query, setQuery] = useState(""),
    [workspaceOnly, setWorkspaceOnly] = useState(false),
    [selectedSeries, setSelectedSeries] = useState<number | null>(null),
    [activeEpisode, setActiveEpisode] = useState<number | null>(null),
    [tab, setTab] = useState("All"),
    [month, setMonth] = useState(() =>
      new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      ).getMonth(),
    ),
    [year, setYear] = useState(() =>
      new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      ).getFullYear(),
    ),
    [view, setView] = useState("Calendar View"),
    [working, setWorking] = useState(false),
    [formError, setFormError] = useState(""),
    [sceneIndex, setSceneIndex] = useState(0),
    [editorTab, setEditorTab] = useState("Script"),
    [draft, setDraft] = useState<Story>(sampleStory),
    [characterEdit, setCharacterEdit] = useState<Character | null>(null),
    [characterOriginalName, setCharacterOriginalName] = useState<string | null>(
      null,
    ),
    [characters, setCharacters] = useState<Character[]>(defaultCharacters),
    [ideas, setIdeas] = useState<
      { title: string; summary: string; kind: string }[]
    >([]),
    [savedIdeas, setSavedIdeas] = useState<string[]>([]),
    [ideaTopic, setIdeaTopic] = useState("Magic & friendship"),
    [ideaKind, setIdeaKind] = useState("Adventure"),
    [notes, setNotes] = useState(""),
    [playing, setPlaying] = useState(false),
    [audioUrl, setAudioUrl] = useState(""),
    [audioName, setAudioName] = useState(""),
    [videoUrl, setVideoUrl] = useState(""),
    [coverText, setCoverText] = useState("Drawing Comes Alive!"),
    [coverFilter, setCoverFilter] = useState("Vibrant"),
    [coverSize, setCoverSize] = useState("YouTube Thumbnail"),
    [toolTab, setToolTab] = useState("Video Settings"),
    [format, setFormat] = useState("9:16"),
    [voiceText, setVoiceText] = useState(sampleScenes[0].dialogue),
    [voiceName, setVoiceName] = useState("Narrator"),
    [speed, setSpeed] = useState("1"),
    [musicVolume, setMusicVolume] = useState("60");
  const [workspacePreferences, setWorkspacePreferences] = useState({
    workspace_name: "ZENBEE Studio",
    generation_lead_hours: 24,
  });
  useEffect(() => {
    if (props.connected)
      fetch(API + "/api/settings/system", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((value) => {
          if (value?.data)
            setWorkspacePreferences({
              workspace_name: value.data.workspace_name,
              generation_lead_hours: value.data.generation_lead_hours,
            });
        })
        .catch(() => {});
    const update = (event: Event) => {
      const data = (event as CustomEvent).detail;
      if (
        typeof data?.workspace_name === "string" &&
        typeof data?.generation_lead_hours === "number"
      )
        setWorkspacePreferences({
          workspace_name: data.workspace_name,
          generation_lead_hours: data.generation_lead_hours,
        });
    };
    window.addEventListener("zenbee-workspace-settings", update);
    return () =>
      window.removeEventListener("zenbee-workspace-settings", update);
  }, [props.connected]);
  const videoRef = useRef<HTMLVideoElement>(null),
    audioRef = useRef<HTMLAudioElement>(null),
    coverRef = useRef<HTMLCanvasElement>(null);
  const preview = !workspaceOnly && props.series.length === 0;
  const allSeries = preview ? demoSeries : props.series;
  const current =
    allSeries.find((s) => s.id === selectedSeries) || allSeries[0];
  const selectedEpisode =
    props.episodes.find((e) => e.id === activeEpisode) ||
    props.episodes.find((e) => e.series_id === current?.id);
  const dataEpisodes = props.episodes.filter(
    (e) => !selectedSeries || e.series_id === selectedSeries,
  );
  const selectedScene =
    draft.scenes[Math.min(sceneIndex, draft.scenes.length - 1)];
  const category =
    sections.find((s) => s.pages.includes(page))?.name || "Studio";
  useEffect(() => {
    try {
      const chars = localStorage.getItem("zenbee-characters");
      if (chars) setCharacters(JSON.parse(chars));
      const saved = localStorage.getItem("zenbee-saved-ideas");
      if (saved) setSavedIdeas(JSON.parse(saved));
      const cover = localStorage.getItem("zenbee-cover-draft");
      if (cover) {
        const c = JSON.parse(cover);
        setCoverText(c.coverText);
        setCoverFilter(c.coverFilter);
        setCoverSize(c.coverSize);
      }
      const edit = localStorage.getItem("zenbee-edit-draft");
      if (edit) {
        const e = JSON.parse(edit);
        setFormat(e.format);
        setMusicVolume(e.musicVolume);
      }
      const audio = localStorage.getItem("zenbee-audio-draft");
      if (audio) {
        const a = JSON.parse(audio);
        setVoiceName(a.voice);
        setVoiceText(a.text);
        setSpeed(a.speed);
      }
    } catch {}
  }, []);
  useEffect(() => {
    setSceneIndex(0);
    if (selectedEpisode?.story)
      setDraft(structuredClone(selectedEpisode.story));
    else {
      try {
        const local = localStorage.getItem("zenbee-editor-draft");
        setDraft(local ? JSON.parse(local) : structuredClone(sampleStory));
      } catch {
        setDraft(structuredClone(sampleStory));
      }
    }
  }, [selectedEpisode?.id, selectedEpisode?.story]);
  useEffect(() => {
    setNotes(current?.description || "");
  }, [current?.id, current?.description]);
  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );
  useEffect(
    () => () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    },
    [videoUrl],
  );
  const characterDialogOpen = !!characterEdit;
  useEffect(() => {
    if (!characterDialogOpen) return;
    const before = document.activeElement as HTMLElement | null;
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = document.querySelectorAll<HTMLElement>(
        ".z-dialog button,.z-dialog input,.z-dialog select,.z-dialog textarea",
      );
      if (!items.length) return;
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
    document.addEventListener("keydown", trap);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = overflow;
      before?.focus();
    };
  }, [characterDialogOpen]);
  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCharacterEdit(null);
        setMobile(false);
      }
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);
  function go(p: string) {
    if (p === "Settings") p = "System Settings";
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    setPage(p);
    setQuery("");
    setTab("All");
    setFormError("");
    setMobile(false);
    setPlaying(false);
    setToolTab("Video Settings");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function requireMedia() {
    props.notify(
      "This tool needs a connected generation provider or rendering backend. Your draft can be saved locally.",
    );
  }
  function changeScene(key: keyof Scene, value: string | number) {
    setDraft((d) => ({
      ...d,
      scenes: d.scenes.map((s, i) =>
        i === sceneIndex ? { ...s, [key]: value } : s,
      ),
    }));
  }
  async function saveStory() {
    if (!selectedEpisode?.story) {
      localStorage.setItem("zenbee-editor-draft", JSON.stringify(draft));
      props.notify(
        "Preview script saved on this device. Create a workspace episode to save to the database.",
      );
      return;
    }
    setWorking(true);
    try {
      await request(`/episodes/${selectedEpisode.id}/story`, draft, "PUT");
      await props.onRefresh();
      props.notify("Script and scene prompts saved.");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setWorking(false);
    }
  }
  async function generateStory() {
    if (!selectedEpisode) {
      go("Create Episode");
      props.notify("Create a workspace episode before generating its story.");
      return;
    }
    if (selectedEpisode.story) {
      props.notify(
        "This episode already has a script. Edit and save it, or create another episode.",
      );
      return;
    }
    setWorking(true);
    try {
      const result = await request<Episode>(
        `/episodes/${selectedEpisode.id}/generate`,
        {},
      );
      if (result.story) setDraft(result.story);
      if (result.error) setFormError(result.error);
      await props.onRefresh();
      props.notify(
        result.story
          ? "Story and prompts are ready for review."
          : "Generation failed. You can retry this episode.",
      );
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setWorking(false);
    }
  }
  async function saveSeries(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setWorking(true);
    setFormError("");
    try {
      const value = await request<Series>("/series", {
        name: f.get("name"),
        description: f.get("description"),
        characters: f.get("characters"),
        visual_style: f.get("visual_style"),
      });
      await props.onRefresh();
      setSelectedSeries(value.id);
      setWorkspaceOnly(true);
      props.notify("Your new series is ready. Let the storytelling begin!");
      go("All Series");
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Start the API to save your series.",
      );
    } finally {
      setWorking(false);
    }
  }
  async function saveMemory() {
    if (!current || current.id < 0) {
      props.notify("Create a workspace series to save its memory.");
      return;
    }
    setWorking(true);
    try {
      await request(
        `/series/${current.id}`,
        {
          name: current.name,
          description: notes,
          characters: current.characters,
          visual_style: current.visual_style,
        },
        "PUT",
      );
      await props.onRefresh();
      props.notify(
        "Series memory saved. Future story generation will use these notes.",
      );
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Unable to save memory");
    } finally {
      setWorking(false);
    }
  }
  function makeIdeas(event: FormEvent) {
    event.preventDefault();
    const subject = ideaTopic.trim() || "an unexpected friendship";
    const list = [
      {
        title: `The Secret of ${subject}`,
        summary: `A mysterious discovery sends your characters on a ${ideaKind.toLowerCase()} about ${subject}.`,
        kind: ideaKind,
      },
      {
        title: `A Little ${subject} Magic`,
        summary: `An ordinary day becomes extraordinary when a small act of kindness changes everything.`,
        kind: "Magic",
      },
      {
        title: `The Great ${subject} Adventure`,
        summary: `An unexpected challenge helps your characters discover what friendship really means.`,
        kind: "Friendship",
      },
      {
        title: `When ${subject} Comes Alive`,
        summary: `A drawing takes on a life of its own, with a surprising lesson for everyone.`,
        kind: "Imagination",
      },
    ];
    setIdeas(list);
    props.notify(
      "Four template-based ideas created. AI idea generation is not connected yet.",
    );
  }
  function saveIdea(title: string) {
    const next = savedIdeas.includes(title)
      ? savedIdeas.filter((s) => s !== title)
      : [...savedIdeas, title];
    setSavedIdeas(next);
    localStorage.setItem("zenbee-saved-ideas", JSON.stringify(next));
  }
  const demoIdeas = [
    {
      title: "The Talking Panda",
      summary:
        "Tura draws a cute panda — and suddenly, it comes alive! A magical new friendship begins.",
      kind: "Magic",
    },
    {
      title: "A Jungle of Surprises",
      summary:
        "A secret map leads Tura and Panda deep into a jungle filled with unexpected friends.",
      kind: "Adventure",
    },
    {
      title: "The Little Star’s Big Wish",
      summary:
        "A tiny fallen star needs help finding its way home. Can your friends make its wish come true?",
      kind: "Friendship",
    },
    {
      title: "The Color That Disappeared",
      summary:
        "All the colors have vanished from the sketchbook. A creative adventure brings them back.",
      kind: "Learning",
    },
  ];
  const showIdeas = (ideas.length ? ideas : demoIdeas).filter(
    (i) =>
      (tab !== "Saved Ideas" || savedIdeas.includes(i.title)) &&
      (!query || i.title.toLowerCase().includes(query.toLowerCase())),
  );
  function exportCover() {
    const canvas = coverRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = coverSize === "Channel Banner" ? 2560 : 1280;
      canvas.height = coverSize === "Channel Banner" ? 1440 : 720;
      ctx.filter =
        coverFilter === "Vibrant"
          ? "saturate(1.5)"
          : coverFilter === "Bright"
            ? "brightness(1.2)"
            : "none";
      ctx.drawImage(img, 538, 291, 666, 437, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";
      ctx.fillStyle = "#221143bb";
      ctx.fillRect(0, canvas.height - 150, canvas.width, 150);
      ctx.fillStyle = "white";
      ctx.font = "bold 58px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        coverText,
        canvas.width / 2,
        canvas.height - 55,
        canvas.width - 80,
      );
      const a = document.createElement("a");
      a.download = "zenbee-cover.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      props.notify("Cover downloaded using the supplied reference artwork.");
    };
    img.src = "/art/thumbnails.png";
  }
  function saveProductionDraft() {
    if (page === "Thumbnail & Cover Creator") {
      localStorage.setItem(
        "zenbee-cover-draft",
        JSON.stringify({ coverText, coverFilter, coverSize }),
      );
    } else if (page === "Voice & Sound Studio") {
      localStorage.setItem(
        "zenbee-audio-draft",
        JSON.stringify({ voice: voiceName, text: voiceText, speed }),
      );
    } else {
      localStorage.setItem(
        "zenbee-edit-draft",
        JSON.stringify({ format, musicVolume, style: tab }),
      );
    }
    props.notify("Production draft saved on this device.");
  }
  const searchPlaceholder = page.includes("Series")
    ? "Search series, episodes or characters…"
    : page.includes("Character")
      ? "Search characters…"
      : page.includes("Idea")
        ? "Search ideas, topics or themes…"
        : "Search your creative universe…";
  return (
    <div className="z-app">
      <aside className={"z-sidebar " + (mobile ? "is-open" : "")}>
        <a
          className="z-brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          <span className="z-bee">🐝</span>
          <span>
            {workspacePreferences.workspace_name === "ZENBEE Studio" ? (
              <>
                ZENBEE<strong>Studio</strong>
              </>
            ) : (
              <strong className="s-custom-workspace-name">
                {workspacePreferences.workspace_name}
              </strong>
            )}
            <small>AI Content Automation</small>
          </span>
        </a>
        <nav className="z-nav">
          {sections.map((group) => (
            <div className="z-nav-group" key={group.name}>
              <button
                className={
                  "z-nav-parent " + (category === group.name ? "current" : "")
                }
                onClick={() =>
                  group.pages.length === 1
                    ? go(group.pages[0])
                    : setOpenGroups((groups) =>
                        groups.includes(group.name)
                          ? groups.filter((g) => g !== group.name)
                          : [...groups, group.name],
                      )
                }
              >
                <group.icon size={18} />
                <span>{group.name}</span>
                {group.pages.length > 1 && (
                  <ChevronDown
                    size={13}
                    className={
                      openGroups.includes(group.name) ? "expanded" : ""
                    }
                  />
                )}
              </button>
              {openGroups.includes(group.name) && group.pages.length > 1 && (
                <div className="z-subnav">
                  {group.pages.map((p) => (
                    <button
                      key={p}
                      className={page === p ? "active" : ""}
                      onClick={() => go(p)}
                    >
                      <span className="z-nav-dot" />
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="z-sidebar-promo">
          <Art source="overview" crop={[27, 646, 218, 216]} />
          <div>
            <Sparkles size={16} />
            Big ideas.
            <br />
            Magical stories.<strong>Made with ZENBEE.</strong>
          </div>
        </div>
        <button
          className="z-help"
          onClick={() =>
            props.notify(
              "Quick start: create a series, schedule an episode, then generate your story and scene prompts.",
            )
          }
        >
          <CircleHelp size={16} />
          Need a little help?
          <ArrowUpRight size={13} />
        </button>
      </aside>
      {mobile && (
        <button
          className="z-mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="z-main">
        <header className="z-topbar">
          <button
            className="z-mobile-toggle"
            onClick={() => setMobile(!mobile)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
          <div className="z-breadcrumb">
            <span className="z-header-icon">
              <Clapperboard size={25} />
            </span>
            <div>
              <h1>
                {category}
                <ChevronRight size={16} />
                <span>{page}</span>
              </h1>
              <p>{descriptions[page]}</p>
            </div>
          </div>
          <div className="z-global-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search current page"
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={13} />
              </button>
            )}
          </div>
          <button
            className="z-bell"
            aria-label="View activity"
            onClick={() => go("Logs & Notifications")}
          >
            <Bell size={20} />
            <i />
          </button>
          <button className="z-user" onClick={() => go("Settings")}>
            <span>A</span>
            <div>
              Ammu<small>ZENBEE Creator</small>
            </div>
            <ChevronDown size={13} />
          </button>
        </header>
        <main className="z-content">
          <section
            className={
              "z-hero" +
              (operationsPages.includes(page) || settingsPages.includes(page)
                ? " z-ops-hero"
                : "") +
              ([
                "Logs & Notifications",
                "System Settings",
                "Team & Permissions",
              ].includes(page)
                ? " z-settings-dark"
                : "")
            }
          >
            <Art
              source={
                settingsPages.includes(page)
                  ? {
                      "Logs & Notifications": "logs",
                      "System Settings": "system",
                      "Team & Permissions": "team",
                      "Brand & Style Settings": "brand",
                      "Social Account Connections": "connections",
                      "AI Providers & API Keys": "providers",
                      "Generation Cost": "costs",
                      "AI Content Insights": "insights",
                      "Episode Performance": "performance",
                    }[page]
                  : operationsPages.includes(page)
                    ? page === "SEO & Caption Generator"
                      ? "seo"
                      : page === "YouTube Channel Manager"
                        ? "youtube"
                        : page === "Instagram Account Manager"
                          ? "instagram"
                          : page === "Channel Analytics"
                            ? "analytics"
                            : "automation"
                    : ["Voice & Sound Studio"].includes(page)
                      ? "voice"
                      : page.includes("Thumbnail")
                        ? "thumbnails"
                        : page.includes("Video")
                          ? "video"
                          : page.includes("Script")
                            ? "script"
                            : "overview"
              }
              crop={
                settingsPages.includes(page)
                  ? [
                      "Logs & Notifications",
                      "System Settings",
                      "Team & Permissions",
                    ].includes(page)
                    ? [275, 67, 1387, 115]
                    : [270, 70, 1390, 108]
                  : operationsPages.includes(page)
                    ? [270, 70, 1390, 108]
                    : ["Voice & Sound Studio"].includes(page)
                      ? [276, 71, 1381, 104]
                      : page.includes("Thumbnail")
                        ? [267, 73, 1390, 112]
                        : page.includes("Video")
                          ? [279, 77, 1380, 115]
                          : page.includes("Script")
                            ? [278, 76, 1379, 124]
                            : [302, 84, 1351, 176]
              }
              className="z-hero-art"
            />
            <div className="z-hero-copy">
              <div className="z-hero-sparkles">✦</div>
              <h2>
                {page === "Overview"
                  ? "Welcome to ZENBEE Studio"
                  : page === "All Series"
                    ? "Your Stories. Your Universe."
                    : page}
              </h2>
              <p>{descriptions[page]}</p>
            </div>
          </section>
          <div className="z-workspace-bar">
            <span>
              <i className={props.connected ? "connected" : ""} />
              {props.connected
                ? props.mode === "demo"
                  ? "Demo story provider"
                  : "Story provider connected"
                : "Backend offline"}
              <span className="z-bar-divider">|</span>
              {preview
                ? "Design preview · sample data"
                : "My workspace · saved data"}
            </span>
            <button
              onClick={() =>
                props.series.length
                  ? props.onRefresh()
                  : setWorkspaceOnly(!workspaceOnly)
              }
            >
              {preview
                ? "Switch to my workspace"
                : !props.series.length
                  ? "Show design preview"
                  : "Refresh workspace"}
              <ArrowRight size={12} />
            </button>
          </div>
          {formError && (
            <div className="z-error" role="alert">
              {formError}
              <button
                aria-label="Dismiss error"
                onClick={() => setFormError("")}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {props.error && !preview && (
            <div className="z-error">
              {props.error}
              <button onClick={props.onRefresh}>Reconnect</button>
            </div>
          )}
          {query &&
            !settingsPages.includes(page) &&
            !operationsPages.includes(page) &&
            ![
              "All Series",
              "Characters Library",
              "AI Topic & Idea Generator",
              "Overview",
              "Episodes",
              "Episode History",
            ].includes(page) && (
              <div className="z-search-results">
                <Search size={14} />
                <strong>Search results</strong>
                {props.episodes
                  .filter((e) =>
                    e.topic.toLowerCase().includes(query.toLowerCase()),
                  )
                  .slice(0, 4)
                  .map((e) => (
                    <button key={e.id} onClick={() => props.onOpen(e)}>
                      {e.topic}
                      <ArrowUpRight size={12} />
                    </button>
                  ))}
                {!props.episodes.some((e) =>
                  e.topic.toLowerCase().includes(query.toLowerCase()),
                ) && (
                  <span>
                    No matching episodes. Try the Series or Ideas pages.
                  </span>
                )}
              </div>
            )}
          {page === "Overview" && (
            <>
              <div className="z-page-actions">
                <div>
                  <h2>Your creative universe, at a glance.</h2>
                  <p>A little inspiration. A lot of possibility.</p>
                </div>
                <div>
                  <button
                    className="z-btn"
                    onClick={() => go("AI Topic & Idea Generator")}
                  >
                    <Lightbulb size={15} />
                    Find an idea
                  </button>
                  <button
                    className="z-btn z-primary"
                    onClick={() => go("Create Episode")}
                  >
                    <Plus size={15} />
                    Create Episode
                  </button>
                </div>
              </div>
              <div className="z-stats">
                {[
                  {
                    label: "Active Series",
                    value: preview ? 3 : props.series.length,
                    icon: Layers3,
                    color: "purple",
                    foot: "Your creative worlds",
                  },
                  {
                    label: "Total Episodes",
                    value: preview ? 32 : props.episodes.length,
                    icon: Film,
                    color: "blue",
                    foot: "Stories taking shape",
                  },
                  {
                    label: "Scripts Ready",
                    value: preview
                      ? 8
                      : props.episodes.filter(
                          (e) => e.status === "script_ready",
                        ).length,
                    icon: FileText,
                    color: "green",
                    foot: "Ready for your review",
                  },
                  {
                    label: "Scheduled",
                    value: preview
                      ? 12
                      : props.episodes.filter((e) => e.status === "scheduled")
                          .length,
                    icon: CalendarDays,
                    color: "orange",
                    foot: "Your next chapters",
                  },
                ].map((s) => (
                  <Stat key={s.label} {...s} />
                ))}
              </div>
              <div className="z-dashboard-grid">
                <section className="z-card">
                  <CardTitle
                    title="Your Series"
                    icon={Layers3}
                    action="View all"
                    onAction={() => go("All Series")}
                  />
                  <div className="z-series-mini-grid">
                    {allSeries
                      .filter((s) =>
                        s.name.toLowerCase().includes(query.toLowerCase()),
                      )
                      .slice(0, 3)
                      .map((s, i) => (
                        <article className="z-series-mini" key={s.id}>
                          <Art
                            crop={
                              [
                                [310, 411, 274, 100],
                                [753, 411, 274, 100],
                                [1197, 411, 274, 100],
                              ][i % 3]
                            }
                          />
                          <div>
                            <h3>{s.name}</h3>
                            <p>{s.description}</p>
                            <div className="z-mini-meta">
                              <span className="z-tag green">
                                {preview ? "Sample series" : "Active"}
                              </span>
                              <span>
                                {preview
                                  ? [12, 8, 12][i]
                                  : props.episodes.filter(
                                      (e) => e.series_id === s.id,
                                    ).length}{" "}
                                episodes
                              </span>
                            </div>
                            <button
                              className="z-btn z-soft"
                              onClick={() => {
                                setSelectedSeries(s.id);
                                go("Series Dashboard");
                              }}
                            >
                              View series
                              <ArrowRight size={13} />
                            </button>
                          </div>
                        </article>
                      ))}
                    {!allSeries.length && (
                      <Empty
                        title="Your universe starts here."
                        text="Create your first series and give your stories a home."
                        action="Create series"
                        onAction={() => go("Create New Series")}
                      />
                    )}
                  </div>
                </section>
                <section className="z-card">
                  <CardTitle title="Quick Create" icon={Sparkles} />
                  <div className="z-quick-grid">
                    {[
                      {
                        label: "New Series",
                        icon: Layers3,
                        page: "Create New Series",
                        color: "purple",
                      },
                      {
                        label: "New Episode",
                        icon: Clapperboard,
                        page: "Create Episode",
                        color: "blue",
                      },
                      {
                        label: "Find Ideas",
                        icon: Lightbulb,
                        page: "AI Topic & Idea Generator",
                        color: "orange",
                      },
                      {
                        label: "Characters",
                        icon: Users,
                        page: "Characters Library",
                        color: "pink",
                      },
                    ].map((q) => (
                      <button
                        className={"z-quick " + q.color}
                        key={q.label}
                        onClick={() => go(q.page)}
                      >
                        <q.icon size={23} />
                        <span>{q.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="z-studio-tip">
                    <Sparkles size={18} />
                    <div>
                      <strong>A spark is all it takes.</strong>
                      <p>Turn one little idea into your next big adventure.</p>
                    </div>
                  </div>
                </section>
              </div>
              <div className="z-dashboard-grid z-bottom-grid">
                <EpisodeTable
                  episodes={dataEpisodes}
                  series={allSeries}
                  preview={preview}
                  query={query}
                  onOpen={props.onOpen}
                  onNew={() => go("Create Episode")}
                />
                <section className="z-card">
                  <CardTitle title="Production Flow" icon={Zap} />
                  <div className="z-production-flow">
                    {[
                      "Idea & Script",
                      "Scenes & Prompts",
                      "Video & Voice",
                      "Review & Publish",
                    ].map((s, i) => (
                      <div key={s}>
                        <span className={"z-flow-icon color-" + i}>
                          {
                            [
                              <Lightbulb key="i" />,
                              <ImagePlus key="p" />,
                              <Video key="v" />,
                              <ShieldCheck key="r" />,
                            ][i]
                          }
                        </span>
                        <div>
                          <strong>{s}</strong>
                          <small>
                            {i === 0
                              ? "Available now"
                              : i === 1
                                ? "Prompts ready to create"
                                : "Provider not connected"}
                          </small>
                        </div>
                        {i < 2 ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <Clock3 size={15} />
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    className="z-btn z-soft z-full"
                    onClick={() => go("Production Queue")}
                  >
                    Open production queue
                    <ArrowRight size={13} />
                  </button>
                </section>
              </div>
            </>
          )}
          {page === "All Series" && (
            <>
              <div className="z-page-actions">
                <div className="z-tabs">
                  {["All", "Active", "Drafts"].map((t) => (
                    <button
                      className={tab === t ? "selected" : ""}
                      key={t}
                      onClick={() => setTab(t)}
                    >
                      {t === "All" ? "All Series" : t}
                      <span>{t === "Drafts" ? 0 : allSeries.length}</span>
                    </button>
                  ))}
                </div>
                <button
                  className="z-btn z-primary"
                  onClick={() => go("Create New Series")}
                >
                  <Plus size={15} />
                  Create New Series
                </button>
              </div>
              <div className="z-series-full-grid">
                {(tab === "Drafts" ? [] : allSeries)
                  .filter((s) =>
                    s.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((s, i) => (
                    <article className="z-card z-series-full" key={s.id}>
                      <Art
                        crop={
                          [
                            [310, 411, 274, 100],
                            [753, 411, 274, 100],
                            [1197, 411, 274, 100],
                          ][i % 3]
                        }
                      />
                      <div>
                        <div className="z-series-title">
                          <h3>{s.name}</h3>
                          <span className="z-tag green">
                            {s.id < 0 ? "Preview" : "Active"}
                          </span>
                        </div>
                        <p>{s.description}</p>
                        <div className="z-series-numbers">
                          <span>
                            <strong>
                              {s.id < 0
                                ? [12, 8, 12][i]
                                : props.episodes.filter(
                                    (e) => e.series_id === s.id,
                                  ).length}
                            </strong>
                            Episodes
                          </span>
                          <span>
                            <strong>
                              {s.id < 0
                                ? 4
                                : s.characters.split(/[\n.]/).filter(Boolean)
                                    .length}
                            </strong>
                            Characters
                          </span>
                          <span>
                            <strong>3D</strong>Style
                          </span>
                        </div>
                        <div className="z-chip-row">
                          <span className="z-tag">Adventure</span>
                          <span className="z-tag">Family friendly</span>
                        </div>
                        <button
                          className="z-btn z-primary z-full"
                          onClick={() => {
                            setSelectedSeries(s.id);
                            go("Series Dashboard");
                          }}
                        >
                          Open series
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
              {(tab === "Drafts" || !allSeries.length) && (
                <Empty
                  title={
                    tab === "Drafts"
                      ? "No draft series yet."
                      : "A new world is waiting."
                  }
                  text="Create a series with recurring characters and your own visual style."
                  action="Create New Series"
                  onAction={() => go("Create New Series")}
                />
              )}
            </>
          )}
          {page === "Create New Series" && (
            <form onSubmit={saveSeries}>
              <div className="z-stepper">
                {[
                  "Series Details",
                  "Characters & Style",
                  "Ready to Create",
                ].map((s, i) => (
                  <span key={s} className={i === 0 ? "active" : ""}>
                    <b>{i + 1}</b>
                    {s}
                    {i < 2 && <ChevronRight size={15} />}
                  </span>
                ))}
              </div>
              <div className="z-form-grid">
                <section className="z-card z-form-card">
                  <CardTitle title="Series Details" icon={FileText} />
                  <div className="z-form-body">
                    <label>
                      Series Name <em>*</em>
                      <input
                        name="name"
                        required
                        maxLength={100}
                        placeholder="e.g. Drawing Comes Alive"
                      />
                    </label>
                    <label>
                      Series Description
                      <textarea
                        name="description"
                        maxLength={2000}
                        rows={4}
                        placeholder="What makes your story world special?"
                      />
                    </label>
                    <label>
                      Visual Style <em>*</em>
                      <select name="visual_style">
                        <option>
                          3D cartoon, vibrant colors, warm magical lighting
                        </option>
                        <option>
                          2D animation, hand-drawn, soft pastel palette
                        </option>
                        <option>
                          Clay animation, cozy textures, playful lighting
                        </option>
                        <option>
                          Anime inspired, expressive characters, cinematic
                          composition
                        </option>
                      </select>
                    </label>
                    <label>
                      Recurring Characters <em>*</em>
                      <textarea
                        name="characters"
                        required
                        maxLength={5000}
                        rows={4}
                        placeholder="Tura: curious girl, curly hair, yellow hoodie. Panda: playful black-and-white panda…"
                      />
                    </label>
                    <p className="z-help-text">
                      <ShieldCheck size={13} />
                      These details are used for consistency in every generated
                      story.
                    </p>
                  </div>
                </section>
                <div className="z-stack">
                  <section className="z-card">
                    <CardTitle
                      title="A World of Possibilities"
                      icon={ImagePlus}
                    />
                    <Art crop={[310, 411, 274, 100]} />
                    <div className="z-form-body">
                      <h3>A little imagination goes a long way.</h3>
                      <p>
                        Build a cast your audience will love, then let the
                        stories unfold.
                      </p>
                      <div className="z-chip-row">
                        <span className="z-tag">Magic</span>
                        <span className="z-tag">Friendship</span>
                        <span className="z-tag">Adventure</span>
                      </div>
                    </div>
                  </section>
                  <section className="z-card z-form-body">
                    <h3>
                      <Sparkles size={16} />
                      Start with a spark
                    </h3>
                    <p>
                      Your series name, style, characters and description are
                      saved to the database. You can add episode topics and
                      publishing times next.
                    </p>
                  </section>
                </div>
              </div>
              <div className="z-form-footer">
                <button
                  className="z-btn"
                  type="button"
                  onClick={() => go("All Series")}
                >
                  Cancel
                </button>
                <button className="z-btn z-primary" disabled={working}>
                  <Save size={15} />
                  {working ? "Creating…" : "Create Series"}
                </button>
              </div>
            </form>
          )}
          {page === "Series Dashboard" && (
            <>
              <div className="z-page-actions">
                <div className="z-series-picker">
                  <Layers3 size={18} />
                  <select
                    value={current?.id || ""}
                    onChange={(e) => setSelectedSeries(Number(e.target.value))}
                  >
                    {allSeries.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="z-btn z-primary"
                  onClick={() => go("Create Episode")}
                >
                  <Plus size={15} />
                  Create Episode
                </button>
              </div>
              {current ? (
                <>
                  <div className="z-series-banner">
                    <Art crop={[310, 411, 274, 100]} />
                    <div>
                      <span className="z-tag green">
                        {preview ? "Sample series" : "Active series"}
                      </span>
                      <h2>{current.name}</h2>
                      <p>{current.description}</p>
                      <div className="z-chip-row">
                        <span className="z-tag">Adventure</span>
                        <span className="z-tag">3D Cartoon</span>
                        <span className="z-tag">Family friendly</span>
                      </div>
                    </div>
                  </div>
                  <div className="z-stats">
                    {[
                      {
                        label: "Total Episodes",
                        value: preview
                          ? 12
                          : props.episodes.filter(
                              (e) => e.series_id === current.id,
                            ).length,
                        icon: Film,
                        color: "purple",
                        foot: "In this story world",
                      },
                      {
                        label: "Scripts Ready",
                        value: preview
                          ? 4
                          : props.episodes.filter(
                              (e) => e.series_id === current.id && e.story,
                            ).length,
                        icon: CheckCircle2,
                        color: "green",
                        foot: "Ready for review",
                      },
                      {
                        label: "Scheduled",
                        value: preview
                          ? 5
                          : props.episodes.filter(
                              (e) =>
                                e.series_id === current.id &&
                                e.status === "scheduled",
                            ).length,
                        icon: CalendarDays,
                        color: "blue",
                        foot: "The adventure continues",
                      },
                      {
                        label: "Characters",
                        value: preview
                          ? 4
                          : current.characters.split(/[\n.]/).filter(Boolean)
                              .length,
                        icon: Users,
                        color: "orange",
                        foot: "Your recurring cast",
                      },
                    ].map((s) => (
                      <Stat key={s.label} {...s} />
                    ))}
                  </div>
                  <div className="z-dashboard-grid">
                    <EpisodeTable
                      episodes={props.episodes.filter(
                        (e) => e.series_id === current.id,
                      )}
                      series={allSeries}
                      preview={preview}
                      query=""
                      onOpen={props.onOpen}
                      onNew={() => go("Create Episode")}
                    />
                    <section className="z-card">
                      <CardTitle title="Your Story World" icon={BookOpen} />
                      <div className="z-form-body">
                        <h4>CHARACTER MEMORY</h4>
                        <p>{current.characters}</p>
                        <h4>VISUAL STYLE</h4>
                        <p>{current.visual_style}</p>
                        <button
                          className="z-btn z-soft z-full"
                          onClick={() => go("Series Memory")}
                        >
                          Open Series Memory
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </section>
                  </div>
                </>
              ) : (
                <Empty
                  title="Choose your first story world."
                  text="Create a series to start tracking its episodes."
                  action="Create series"
                  onAction={() => go("Create New Series")}
                />
              )}
            </>
          )}
          {page === "Characters Library" && (
            <>
              <div className="z-page-actions">
                <div>
                  <h2>Your cast of unforgettable characters</h2>
                  <p>
                    Local character references · save series cast details in
                    Series Memory.
                  </p>
                </div>
                <button
                  className="z-btn z-primary"
                  onClick={() => {
                    setCharacterOriginalName(null);
                    setCharacterEdit({
                      name: "",
                      role: "Supporting character",
                      description: "",
                      art: 0,
                    });
                  }}
                >
                  <Plus size={15} />
                  Add Character
                </button>
              </div>
              <div className="z-tabs z-mb">
                {["All", "Main character", "Supporting character"].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "selected" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t === "All" ? "All Characters" : t}
                  </button>
                ))}
              </div>
              <div className="z-character-grid">
                {characters
                  .filter(
                    (c) =>
                      (tab === "All" || c.role === tab) &&
                      c.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((c, i) => (
                    <article className="z-card z-character" key={c.name}>
                      <Art
                        source="characters"
                        crop={
                          [
                            [315, 410, 230, 138],
                            [588, 410, 230, 138],
                            [860, 410, 230, 138],
                            [315, 685, 230, 128],
                          ][c.art % 4]
                        }
                      />
                      <div>
                        <div className="z-series-title">
                          <h3>{c.name}</h3>
                          <MoreHorizontal size={17} />
                        </div>
                        <span className="z-tag">{c.role}</span>
                        <p>{c.description}</p>
                        <div className="z-character-actions">
                          <button
                            className="z-btn z-soft"
                            onClick={() => {
                              setCharacterOriginalName(c.name);
                              setCharacterEdit({ ...c });
                            }}
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            className="z-btn"
                            onClick={() => download(c, `zenbee-${c.name}.json`)}
                          >
                            <Download size={12} />
                            Export
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            </>
          )}
          {page === "Series Memory" && (
            <>
              <div className="z-page-actions">
                <div className="z-series-picker">
                  <BookOpen size={18} />
                  <select
                    value={current?.id || ""}
                    onChange={(e) => setSelectedSeries(Number(e.target.value))}
                  >
                    {allSeries.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="z-btn z-primary"
                  disabled={working}
                  onClick={saveMemory}
                >
                  <Save size={15} />
                  Save Memory
                </button>
              </div>
              <div className="z-dashboard-grid">
                <section className="z-card">
                  <CardTitle title="Story World & Continuity" icon={BookOpen} />
                  <div className="z-form-body">
                    <div className="z-memory-note">
                      <ShieldCheck size={20} />
                      <p>
                        A consistent world makes every story feel connected.
                        These series notes are included in future story
                        generation.
                      </p>
                    </div>
                    <label>
                      World Rules & Story Notes
                      <textarea
                        rows={9}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Describe your world, relationships, rules and story arcs…"
                      />
                    </label>
                    <h4>ESTABLISHED CHARACTER DETAILS</h4>
                    <p>
                      {current?.characters ||
                        "Create a series to add your recurring cast."}
                    </p>
                    <h4>VISUAL DIRECTION</h4>
                    <p>{current?.visual_style || "No visual style yet."}</p>
                  </div>
                </section>
                <section className="z-card">
                  <CardTitle title="Previous Episode Memory" icon={Clock3} />
                  <div className="z-form-body">
                    {props.episodes
                      .filter((e) => e.series_id === current?.id && e.story)
                      .slice(-10)
                      .map((e) => (
                        <div className="z-memory-entry" key={e.id}>
                          <span className="z-memory-number">{e.id}</span>
                          <div>
                            <strong>{e.story?.title}</strong>
                            <p>{e.story?.continuity_notes}</p>
                          </div>
                        </div>
                      ))}
                    {!props.episodes.some(
                      (e) => e.series_id === current?.id && e.story,
                    ) && (
                      <Empty
                        title="A story waiting to unfold."
                        text="Generated episodes will add their continuity notes here."
                      />
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
          {["Episode History", "Episodes"].includes(page) && (
            <>
              <div className="z-page-actions">
                <div className="z-tabs">
                  {["All", "script_ready", "scheduled", "failed"].map((t) => (
                    <button
                      key={t}
                      className={tab === t ? "selected" : ""}
                      onClick={() => setTab(t)}
                    >
                      {t.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
                <button
                  className="z-btn z-primary"
                  onClick={() => go("Create Episode")}
                >
                  <Plus size={15} />
                  New Episode
                </button>
              </div>
              <EpisodeTable
                episodes={props.episodes.filter(
                  (e) => tab === "All" || e.status === tab,
                )}
                series={allSeries}
                preview={preview && tab === "All"}
                query={query}
                onOpen={props.onOpen}
                onNew={() => go("Create Episode")}
              />
            </>
          )}
          {["Activity"].includes(page) && (
            <>
              <div className="z-page-actions">
                <h2>
                  {page === "Activity" ? "Your studio, in motion." : page}
                </h2>
                <button className="z-btn" onClick={props.onRefresh}>
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>
              <div className="z-stats">
                {[
                  {
                    label: "Scheduled",
                    value: props.episodes.filter(
                      (e) => e.status === "scheduled",
                    ).length,
                    icon: CalendarDays,
                    color: "purple",
                    foot: "Waiting for story generation",
                  },
                  {
                    label: "Generating",
                    value: props.episodes.filter(
                      (e) => e.status === "generating",
                    ).length,
                    icon: WandSparkles,
                    color: "blue",
                    foot: "Stories in progress",
                  },
                  {
                    label: "Scripts Ready",
                    value: props.episodes.filter(
                      (e) => e.status === "script_ready",
                    ).length,
                    icon: CheckCircle2,
                    color: "green",
                    foot: "Ready for review",
                  },
                  {
                    label: "Needs Attention",
                    value: props.episodes.filter((e) => e.status === "failed")
                      .length,
                    icon: Bell,
                    color: "orange",
                    foot: "Open an episode to retry",
                  },
                ].map((s) => (
                  <Stat key={s.label} {...s} />
                ))}
              </div>
              <section className="z-card">
                <CardTitle
                  title={
                    page === "Activity" ? "Recent Activity" : "Episode Jobs"
                  }
                  icon={Activity}
                />
                {props.episodes
                  .filter(
                    (e) =>
                      page !== "Failed Jobs & Retry" || e.status === "failed",
                  )
                  .map((e) => (
                    <div className="z-activity" key={e.id}>
                      <span
                        className={
                          "z-activity-icon " +
                          (e.status === "failed" ? "orange" : "purple")
                        }
                      >
                        {e.story ? (
                          <CheckCircle2 size={19} />
                        ) : (
                          <Clock3 size={19} />
                        )}
                      </span>
                      <div>
                        <strong>{e.topic}</strong>
                        <p>
                          {e.status === "script_ready"
                            ? "Story and scene prompts are ready."
                            : e.status === "failed"
                              ? e.error
                              : "Episode scheduled. Start story generation from episode details."}
                        </p>
                        <small>
                          {ist(e.generate_at)} IST · {e.attempts} generation
                          attempts
                        </small>
                      </div>
                      <button className="z-btn" onClick={() => props.onOpen(e)}>
                        {e.status === "failed"
                          ? "Review & retry"
                          : "View episode"}
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  ))}
                {!props.episodes.filter(
                  (e) =>
                    page !== "Failed Jobs & Retry" || e.status === "failed",
                ).length && (
                  <Empty
                    title={
                      page === "Failed Jobs & Retry"
                        ? "All clear. Keep creating!"
                        : "Your creative journey starts here."
                    }
                    text={
                      page === "Failed Jobs & Retry"
                        ? "No failed story-generation jobs."
                        : "Create an episode to start building your activity timeline."
                    }
                  />
                )}
              </section>
            </>
          )}
          {page === "AI Topic & Idea Generator" && (
            <>
              <div className="z-idea-layout">
                <form className="z-card" onSubmit={makeIdeas}>
                  <CardTitle title="Find Your Next Big Idea" icon={Lightbulb} />
                  <div className="z-form-body">
                    <label>
                      Your Series
                      <select
                        value={current?.id || ""}
                        onChange={(e) =>
                          setSelectedSeries(Number(e.target.value))
                        }
                      >
                        {allSeries.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                        {!allSeries.length && <option>New story idea</option>}
                      </select>
                    </label>
                    <label>
                      Topic or Theme
                      <input
                        value={ideaTopic}
                        onChange={(e) => setIdeaTopic(e.target.value)}
                        maxLength={100}
                        placeholder="Magic, friendship, a little adventure…"
                      />
                    </label>
                    <label>
                      Story Category
                      <select
                        value={ideaKind}
                        onChange={(e) => setIdeaKind(e.target.value)}
                      >
                        {[
                          "Adventure",
                          "Comedy",
                          "Magic",
                          "Friendship",
                          "Learning",
                          "Fantasy",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <div className="z-memory-note">
                      <Sparkles size={16} />
                      <p>
                        Template-based brainstorming. Story generation uses your
                        configured provider after you create an episode.
                      </p>
                    </div>
                    <button className="z-btn z-primary z-full">
                      <WandSparkles size={15} />
                      Generate Ideas
                    </button>
                  </div>
                </form>
                <div>
                  <div className="z-page-actions">
                    <div className="z-tabs">
                      {["All", "Saved Ideas"].map((t) => (
                        <button
                          className={tab === t ? "selected" : ""}
                          key={t}
                          onClick={() => setTab(t)}
                        >
                          {t === "All" ? "Fresh Ideas" : t}
                          {t === "Saved Ideas" && (
                            <span>{savedIdeas.length}</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <span className="z-subtle">
                      {ideas.length ? "Template ideas" : "Sample inspiration"}
                    </span>
                  </div>
                  <div className="z-idea-grid">
                    {showIdeas.map((idea, i) => (
                      <article className="z-card z-idea" key={idea.title}>
                        <Art
                          source="ideas"
                          crop={
                            [
                              [1149, 488, 193, 102],
                              [311, 647, 119, 50],
                              [311, 710, 119, 50],
                              [1149, 488, 193, 102],
                            ][i % 4]
                          }
                        />
                        <div>
                          <span className="z-tag">{idea.kind}</span>
                          <h3>{idea.title}</h3>
                          <p>{idea.summary}</p>
                          <div>
                            <button
                              className="z-btn z-soft"
                              onClick={() => {
                                localStorage.setItem(
                                  "zenbee-episode-idea",
                                  idea.title + ": " + idea.summary,
                                );
                                go("Create Episode");
                                props.notify(
                                  "Idea added to your episode draft.",
                                );
                              }}
                            >
                              Use Idea
                              <ArrowRight size={12} />
                            </button>
                            <button
                              className={
                                "z-save-idea " +
                                (savedIdeas.includes(idea.title) ? "saved" : "")
                              }
                              aria-label={"Save " + idea.title}
                              onClick={() => saveIdea(idea.title)}
                            >
                              <Star size={17} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!showIdeas.length && (
                    <Empty
                      title="Keep your favorite sparks here."
                      text="Save ideas with the star button to revisit them later."
                    />
                  )}
                </div>
              </div>
            </>
          )}
          {["Content Calendar"].includes(page) && (
            <>
              <div className="z-page-actions">
                <div className="z-tabs">
                  {["Calendar View", "List View"].map((t) => (
                    <button
                      className={view === t ? "selected" : ""}
                      key={t}
                      onClick={() => setView(t)}
                    >
                      {t === "Calendar View" ? (
                        <CalendarDays size={14} />
                      ) : (
                        <FileText size={14} />
                      )}
                      {t}
                    </button>
                  ))}
                </div>
                <div className="z-calendar-controls">
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
                <button
                  className="z-btn z-primary"
                  onClick={() => go("Create Episode")}
                >
                  <Plus size={15} />
                  Create Content
                </button>
              </div>
              {view === "List View" ? (
                <EpisodeTable
                  episodes={props.episodes.filter((e) => {
                    const d = new Date(
                      new Date(e.publish_at).toLocaleString("en-US", {
                        timeZone: "Asia/Kolkata",
                      }),
                    );
                    return d.getMonth() === month && d.getFullYear() === year;
                  })}
                  series={allSeries}
                  preview={false}
                  query=""
                  onOpen={props.onOpen}
                  onNew={() => go("Create Episode")}
                />
              ) : (
                <div className="z-calendar-layout">
                  <section className="z-card">
                    <div className="z-calendar-weekdays">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (d) => (
                          <strong key={d}>{d}</strong>
                        ),
                      )}
                    </div>
                    <div className="z-calendar-grid">
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
                          const events = props.episodes.filter((e) => {
                            const d = new Date(
                              new Date(e.publish_at).toLocaleString("en-US", {
                                timeZone: "Asia/Kolkata",
                              }),
                            );
                            return (
                              d.getFullYear() === year &&
                              d.getMonth() === month &&
                              d.getDate() === day
                            );
                          });
                          return (
                            <div
                              key={i}
                              className={
                                "z-calendar-day " + (!valid ? "muted" : "")
                              }
                            >
                              <span>{valid ? day : ""}</span>
                              {events.map((e) => (
                                <button
                                  key={e.id}
                                  onClick={() => props.onOpen(e)}
                                >
                                  <Film size={12} />
                                  <span>
                                    {e.topic}
                                    <small>
                                      {e.status.replaceAll("_", " ")}
                                    </small>
                                  </span>
                                </button>
                              ))}
                              {valid &&
                                preview &&
                                [3, 6, 11, 15, 20, 24, 28].includes(day) && (
                                  <button
                                    className="sample-event"
                                    onClick={() =>
                                      props.notify(
                                        "Sample calendar event. Create an episode to add your own publishing plan.",
                                      )
                                    }
                                  >
                                    <Film size={12} />
                                    <span>
                                      {
                                        [
                                          "Story draft",
                                          "Panda adventure",
                                          "Voice & review",
                                        ][day % 3]
                                      }
                                      <small>Design preview</small>
                                    </span>
                                  </button>
                                )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </section>
                  <div className="z-stack">
                    <section className="z-card">
                      <CardTitle
                        title="Your Publishing Plan"
                        icon={CalendarDays}
                      />
                      <div className="z-form-body">
                        <div className="z-calendar-stat">
                          <span className="z-stat-icon purple">
                            <CalendarDays />
                          </span>
                          <strong>{props.episodes.length}</strong>
                          <span>Planned episodes</span>
                        </div>
                        <p>
                          All publishing times use Asia/Kolkata (IST). Story
                          generation is planned before the publishing time.
                        </p>
                        <button
                          className="z-btn z-primary z-full"
                          onClick={() => go("Create Episode")}
                        >
                          Schedule an episode
                          <Plus size={13} />
                        </button>
                      </div>
                    </section>
                    <section className="z-card z-form-body">
                      <h3>
                        <ShieldCheck size={16} />A little planning. A steady
                        flow.
                      </h3>
                      <p>
                        Start with one episode a day and build a seven-day
                        buffer of finished videos. Publishing workers are not
                        connected yet.
                      </p>
                    </section>
                  </div>
                </div>
              )}
            </>
          )}
          {page === "Create Episode" && (
            <EpisodeCreate
              defaultLeadHours={workspacePreferences.generation_lead_hours}
              series={props.series}
              preview={preview}
              onSaved={async (e) => {
                setActiveEpisode(e.id);
                await props.onRefresh();
                go("Story & Script Editor");
              }}
              onCancel={() => go("Episode History")}
              onNewSeries={() => go("Create New Series")}
              notify={props.notify}
            />
          )}
          {[
            "Story & Script Editor",
            "Scene & Prompt Editor",
            "AI Video Generator",
            "Voice & Sound Studio",
            "Video Editor & Preview",
            "Thumbnail & Cover Creator",
          ].includes(page) && (
            <>
              <div className="z-editor-toolbar">
                <div className="z-series-picker">
                  <Clapperboard size={17} />
                  <select
                    value={current?.id || ""}
                    onChange={(e) => {
                      setSelectedSeries(Number(e.target.value));
                      setActiveEpisode(null);
                    }}
                  >
                    {allSeries.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    {!allSeries.length && <option>No series yet</option>}
                  </select>
                </div>
                <select
                  aria-label="Select episode"
                  value={selectedEpisode?.id || ""}
                  onChange={(e) => setActiveEpisode(Number(e.target.value))}
                >
                  <option value="">
                    {preview
                      ? "Preview · The Talking Panda"
                      : "Choose an episode"}
                  </option>
                  {props.episodes
                    .filter((e) => !current || e.series_id === current.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        Ep {e.id} — {e.topic}
                      </option>
                    ))}
                </select>
                <span className="z-tag amber">
                  {selectedEpisode?.story ? "Script ready" : "Draft preview"}
                </span>
                <div className="z-editor-toolbar-actions">
                  <button
                    className="z-btn"
                    disabled={working}
                    onClick={
                      [
                        "Story & Script Editor",
                        "Scene & Prompt Editor",
                      ].includes(page)
                        ? saveStory
                        : saveProductionDraft
                    }
                  >
                    <Save size={14} />
                    {[
                      "Story & Script Editor",
                      "Scene & Prompt Editor",
                    ].includes(page)
                      ? "Save Script"
                      : "Save Draft"}
                  </button>
                  <button
                    className="z-btn z-primary"
                    disabled={working}
                    onClick={
                      page === "Story & Script Editor"
                        ? generateStory
                        : page === "Thumbnail & Cover Creator"
                          ? exportCover
                          : requireMedia
                    }
                  >
                    <WandSparkles size={14} />
                    {working
                      ? "Working…"
                      : page === "Story & Script Editor"
                        ? "Generate Story"
                        : page === "Thumbnail & Cover Creator"
                          ? "Download Cover"
                          : "Generate " +
                            (page.includes("Voice")
                              ? "Voice"
                              : page.includes("Scene")
                                ? "Scene"
                                : "Video")}
                  </button>
                </div>
              </div>
              {["Story & Script Editor", "Scene & Prompt Editor"].includes(
                page,
              ) && (
                <>
                  <div className="z-tabs z-editor-tabs">
                    {[
                      "Story & Outline",
                      "Script",
                      "Storyboard",
                      "Characters",
                      "Dialogues",
                    ].map((t) => (
                      <button
                        key={t}
                        className={editorTab === t ? "selected" : ""}
                        onClick={() => setEditorTab(t)}
                      >
                        {t === "Script" ? (
                          <FileText size={14} />
                        ) : t === "Characters" ? (
                          <Users size={14} />
                        ) : (
                          <BookOpen size={14} />
                        )}
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="z-script-layout">
                    <section className="z-card z-scene-list">
                      <CardTitle
                        title={`Scenes (${draft.scenes.length})`}
                        icon={Clapperboard}
                        action="+ Add"
                        onAction={() => {
                          if (draft.scenes.length >= 8) {
                            props.notify(
                              "A story can contain up to eight scenes.",
                            );
                            return;
                          }
                          setDraft({
                            ...draft,
                            scenes: [
                              ...draft.scenes,
                              {
                                number: draft.scenes.length + 1,
                                duration_seconds: 5,
                                visual_prompt: "Describe the scene…",
                                dialogue: "",
                                narration: "",
                                caption: "",
                              },
                            ],
                          });
                          setSceneIndex(draft.scenes.length);
                        }}
                      />
                      {draft.scenes.map((s, i) => (
                        <button
                          className={sceneIndex === i ? "active" : ""}
                          key={i}
                          onClick={() => setSceneIndex(i)}
                        >
                          <Art
                            source="script"
                            crop={
                              [
                                [289, 404, 91, 56],
                                [289, 469, 91, 56],
                                [289, 534, 91, 56],
                                [289, 600, 91, 56],
                              ][i % 4]
                            }
                          />
                          <span>
                            <strong>Scene {i + 1}</strong>
                            <small>
                              {i === 0
                                ? "The Magical Chest"
                                : s.caption || "A new moment"}
                            </small>
                            <small>
                              <Clock3 size={10} />
                              {s.duration_seconds} seconds
                            </small>
                          </span>
                        </button>
                      ))}
                    </section>
                    <section className="z-card z-script-main">
                      <CardTitle
                        title={
                          editorTab === "Story & Outline"
                            ? "Story & Outline"
                            : `Scene ${sceneIndex + 1} — ${selectedScene.caption || "Your story"}`
                        }
                        icon={FileText}
                      />
                      <div className="z-form-body">
                        {editorTab === "Story & Outline" ? (
                          <>
                            <label>
                              Story Title
                              <input
                                value={draft.title}
                                onChange={(e) =>
                                  setDraft({ ...draft, title: e.target.value })
                                }
                              />
                            </label>
                            <label>
                              Story Synopsis
                              <textarea
                                rows={7}
                                value={draft.synopsis}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    synopsis: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Continuity Notes
                              <textarea
                                rows={5}
                                value={draft.continuity_notes}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    continuity_notes: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </>
                        ) : editorTab === "Storyboard" ? (
                          <div className="z-storyboard-grid">
                            {draft.scenes.map((s, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  setSceneIndex(i);
                                  setEditorTab("Script");
                                }}
                              >
                                <Art
                                  source="script"
                                  crop={[1380, 405, 270, 180]}
                                />
                                <strong>Scene {i + 1}</strong>
                                <p>{s.caption}</p>
                              </button>
                            ))}
                          </div>
                        ) : editorTab === "Characters" ? (
                          <>
                            <h3>Recurring Cast</h3>
                            <p>
                              {current?.characters || demoSeries[0].characters}
                            </p>
                            <button
                              className="z-btn z-soft z-full"
                              onClick={() => go("Characters Library")}
                            >
                              Open Character Library
                              <ArrowRight size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="z-script-format">
                              <span>H1</span>
                              <span>H2</span>
                              <b>B</b>
                              <i>I</i>
                              <span>☷</span>
                              <span className="z-word-count">
                                {
                                  (
                                    selectedScene.narration +
                                    " " +
                                    selectedScene.dialogue
                                  )
                                    .split(/\s+/)
                                    .filter(Boolean).length
                                }{" "}
                                words
                              </span>
                            </div>
                            <div className="z-scene-heading">
                              [Scene {sceneIndex + 1} — {selectedScene.caption}]
                            </div>
                            {page === "Scene & Prompt Editor" && (
                              <label>
                                AI Visual Prompt
                                <textarea
                                  rows={6}
                                  value={selectedScene.visual_prompt}
                                  onChange={(e) =>
                                    changeScene("visual_prompt", e.target.value)
                                  }
                                />
                              </label>
                            )}
                            {editorTab !== "Dialogues" && (
                              <label>
                                Narration (VO)
                                <textarea
                                  rows={4}
                                  value={selectedScene.narration}
                                  onChange={(e) =>
                                    changeScene("narration", e.target.value)
                                  }
                                />
                              </label>
                            )}
                            <label>
                              Character Dialogue
                              <textarea
                                rows={5}
                                value={selectedScene.dialogue}
                                onChange={(e) =>
                                  changeScene("dialogue", e.target.value)
                                }
                              />
                            </label>
                            <div className="z-input-row">
                              <label>
                                Caption
                                <input
                                  value={selectedScene.caption}
                                  onChange={(e) =>
                                    changeScene("caption", e.target.value)
                                  }
                                />
                              </label>
                              <label>
                                Duration (seconds)
                                <input
                                  type="number"
                                  min={1}
                                  max={15}
                                  value={selectedScene.duration_seconds}
                                  onChange={(e) =>
                                    changeScene(
                                      "duration_seconds",
                                      Math.max(
                                        1,
                                        Math.min(15, Number(e.target.value)),
                                      ),
                                    )
                                  }
                                />
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                    </section>
                    <div className="z-stack">
                      <section className="z-card">
                        <CardTitle title="Scene Preview" icon={ImagePlus} />
                        <div className="z-form-body">
                          <Art source="script" crop={[1380, 405, 270, 180]} />
                          <p className="z-center-note">
                            Reference artwork · Scene {sceneIndex + 1} of{" "}
                            {draft.scenes.length}
                          </p>
                          <div className="z-preview-dots">
                            {draft.scenes.map((_, i) => (
                              <button
                                key={i}
                                aria-label={`Scene ${i + 1}`}
                                className={sceneIndex === i ? "active" : ""}
                                onClick={() => setSceneIndex(i)}
                              />
                            ))}
                          </div>
                        </div>
                      </section>
                      <section className="z-card">
                        <CardTitle title="Creative Tools" icon={Sparkles} />
                        <div className="z-tool-buttons">
                          <button onClick={() => go("Scene & Prompt Editor")}>
                            <ImagePlus size={16} />
                            Scene & Prompts
                            <ArrowRight size={12} />
                          </button>
                          <button onClick={() => go("Voice & Sound Studio")}>
                            <Mic size={16} />
                            Voiceover Studio
                            <ArrowRight size={12} />
                          </button>
                          <button onClick={() => go("AI Video Generator")}>
                            <Video size={16} />
                            Video Generator
                            <ArrowRight size={12} />
                          </button>
                          <button
                            onClick={() => download(draft, "zenbee-story.json")}
                          >
                            <Download size={16} />
                            Download Script
                            <ArrowDownToLine size={12} />
                          </button>
                        </div>
                      </section>
                      <section className="z-card z-form-body">
                        <h3>
                          <ShieldCheck size={15} />
                          Make it yours
                        </h3>
                        <p>
                          Edit the story and prompts, then save. Preview drafts
                          save on this device; generated episode scripts save to
                          your database.
                        </p>
                      </section>
                    </div>
                  </div>
                </>
              )}
              {page === "AI Video Generator" && (
                <div className="z-video-layout">
                  <div className="z-stack">
                    <section className="z-card">
                      <CardTitle title="Script & Scene" icon={FileText} />
                      <div className="z-form-body">
                        <h3>Scene {sceneIndex + 1}</h3>
                        <p>{selectedScene.narration}</p>
                        <p>{selectedScene.dialogue}</p>
                        <button
                          className="z-btn z-soft z-full"
                          onClick={() => go("Story & Script Editor")}
                        >
                          <Pencil size={13} />
                          Edit Script
                        </button>
                      </div>
                    </section>
                    <section className="z-card">
                      <CardTitle title="Scene Prompt" icon={Sparkles} />
                      <div className="z-form-body">
                        <textarea
                          rows={8}
                          value={selectedScene.visual_prompt}
                          onChange={(e) =>
                            changeScene("visual_prompt", e.target.value)
                          }
                        />
                      </div>
                    </section>
                  </div>
                  <section className="z-card">
                    <div className="z-tabs z-compact-tabs">
                      {[
                        "Video Settings",
                        "Audio & Voice",
                        "Effects",
                        "Output",
                      ].map((t) => (
                        <button
                          key={t}
                          className={toolTab === t ? "selected" : ""}
                          onClick={() => setToolTab(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="z-form-body">
                      {toolTab === "Video Settings" ? (
                        <>
                          <h3>Video Style</h3>
                          <div className="z-style-choices">
                            {["3D Cartoon", "2D Animation", "Cinematic"].map(
                              (s, i) => (
                                <button
                                  key={s}
                                  className={
                                    tab === s || (tab === "All" && i === 0)
                                      ? "selected"
                                      : ""
                                  }
                                  onClick={() => setTab(s)}
                                >
                                  <Art
                                    source="characters"
                                    crop={
                                      [
                                        [315, 410, 230, 138],
                                        [588, 410, 230, 138],
                                        [860, 410, 230, 138],
                                      ][i]
                                    }
                                  />
                                  {s}
                                </button>
                              ),
                            )}
                          </div>
                          <h3>Aspect Ratio</h3>
                          <div className="z-ratio-options">
                            {["16:9", "9:16", "1:1", "4:5"].map((s) => (
                              <button
                                key={s}
                                className={format === s ? "selected" : ""}
                                onClick={() => setFormat(s)}
                              >
                                {s}
                                <small>
                                  {s === "9:16"
                                    ? "Shorts / Reels"
                                    : s === "16:9"
                                      ? "YouTube"
                                      : "Social"}
                                </small>
                              </button>
                            ))}
                          </div>
                          <div className="z-input-row">
                            <label>
                              Resolution
                              <select>
                                <option>1080p HD</option>
                                <option>720p</option>
                              </select>
                            </label>
                            <label>
                              Frame Rate
                              <select>
                                <option>30 FPS</option>
                                <option>24 FPS</option>
                              </select>
                            </label>
                          </div>
                          <label>
                            Characters Included
                            <input
                              value={current?.characters || "Tura · Panda"}
                              readOnly
                            />
                          </label>
                          <div className="z-input-row">
                            <label>
                              Mood
                              <select>
                                <option>Exciting & Magical</option>
                                <option>Calm & Gentle</option>
                                <option>Funny & Playful</option>
                              </select>
                            </label>
                            <label>
                              Language
                              <select>
                                <option>English</option>
                                <option>Tamil</option>
                                <option>Hindi</option>
                              </select>
                            </label>
                          </div>
                        </>
                      ) : toolTab === "Audio & Voice" ? (
                        <>
                          <h3>Every character has a voice.</h3>
                          <p>
                            Configure dialogue and preview your narration in the
                            voice studio.
                          </p>
                          <button
                            className="z-btn z-primary z-full"
                            onClick={() => go("Voice & Sound Studio")}
                          >
                            <Mic size={15} />
                            Open Voice Studio
                          </button>
                        </>
                      ) : toolTab === "Effects" ? (
                        <>
                          <h3>A little extra magic.</h3>
                          {[
                            "Soft cinematic lighting",
                            "Character consistency",
                            "Golden sparkle effects",
                            "Smooth camera motion",
                          ].map((s) => (
                            <label className="z-check-row" key={s}>
                              <input type="checkbox" defaultChecked />
                              {s}
                            </label>
                          ))}
                        </>
                      ) : (
                        <>
                          <h3>Output Settings</h3>
                          <label>
                            Video Format
                            <select>
                              <option>MP4 · H.264</option>
                              <option>WebM</option>
                            </select>
                          </label>
                          <p>
                            Rendering is not connected. Save the configuration
                            as JSON for your production setup.
                          </p>
                        </>
                      )}
                      <button
                        className="z-btn z-soft z-full"
                        onClick={() => {
                          localStorage.setItem(
                            "zenbee-video-settings",
                            JSON.stringify({
                              format,
                              style: tab,
                              scene: selectedScene,
                            }),
                          );
                          props.notify(
                            "Video configuration saved on this device.",
                          );
                        }}
                      >
                        <Save size={14} />
                        Save Configuration
                      </button>
                    </div>
                  </section>
                  <div className="z-stack">
                    <MediaPreview
                      title="Video Preview"
                      videoUrl={videoUrl}
                      videoRef={videoRef}
                      playing={playing}
                      setPlaying={setPlaying}
                    />
                    <section className="z-card z-form-body">
                      <span className="z-tag amber">
                        Provider not connected
                      </span>
                      <p>
                        Reference artwork is shown above. Connect a supported
                        video API and rendering backend to generate playable
                        video.
                      </p>
                      <div className="z-quick-grid">
                        <button
                          className="z-quick purple"
                          onClick={() => go("Video Editor & Preview")}
                        >
                          <Scissors size={22} />
                          Video Editor
                        </button>
                        <button
                          className="z-quick blue"
                          onClick={() => go("Voice & Sound Studio")}
                        >
                          <Mic size={22} />
                          Voice Studio
                        </button>
                      </div>
                    </section>
                  </div>
                </div>
              )}
              {page === "Voice & Sound Studio" && (
                <>
                  <div className="z-tabs z-editor-tabs">
                    {[
                      "AI Voiceover",
                      "Dialogue Studio",
                      "Background Music",
                      "Sound Effects",
                      "Audio Mixer",
                    ].map((t) => (
                      <button
                        key={t}
                        className={
                          toolTab === t ||
                          (toolTab === "Video Settings" && t === "AI Voiceover")
                            ? "selected"
                            : ""
                        }
                        onClick={() => setToolTab(t)}
                      >
                        {t === "Background Music" ? (
                          <AudioLines size={14} />
                        ) : (
                          <Mic size={14} />
                        )}
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="z-voice-layout">
                    <section className="z-card">
                      <CardTitle title="Select Character" icon={Users} />
                      <div className="z-voice-characters">
                        {["Tura", "Panda", "Narrator"].map((s, i) => (
                          <button
                            className={voiceName === s ? "selected" : ""}
                            key={s}
                            onClick={() => setVoiceName(s)}
                          >
                            {i < 2 ? (
                              <Art
                                source="characters"
                                crop={
                                  [
                                    [315, 410, 230, 138],
                                    [588, 410, 230, 138],
                                  ][i]
                                }
                              />
                            ) : (
                              <span className="z-stat-icon purple">
                                <Mic />
                              </span>
                            )}
                            <span>
                              <strong>{s}</strong>
                              <small>
                                {i === 0
                                  ? "Main character"
                                  : i === 1
                                    ? "Supporting character"
                                    : "Voice over"}
                              </small>
                            </span>
                            <MoreHorizontal size={14} />
                          </button>
                        ))}
                      </div>
                    </section>
                    <div className="z-stack">
                      <section className="z-card">
                        <CardTitle
                          title={
                            toolTab === "Background Music"
                              ? "Background Music"
                              : toolTab === "Sound Effects"
                                ? "Sound Effects"
                                : "Voiceover / Dialogue Editor"
                          }
                          icon={Mic}
                        />
                        <div className="z-form-body">
                          <textarea
                            rows={6}
                            value={voiceText}
                            onChange={(e) => setVoiceText(e.target.value)}
                            maxLength={2000}
                          />
                          <div className="z-input-row">
                            <label>
                              Language
                              <select>
                                <option>English</option>
                                <option>Tamil</option>
                                <option>Hindi</option>
                              </select>
                            </label>
                            <label>
                              Emotion / Tone
                              <select>
                                <option>Excited</option>
                                <option>Calm</option>
                                <option>Friendly</option>
                              </select>
                            </label>
                            <label>
                              Speed
                              <select
                                value={speed}
                                onChange={(e) => setSpeed(e.target.value)}
                              >
                                <option value="0.75">0.75x</option>
                                <option value="1">1.0x</option>
                                <option value="1.25">1.25x</option>
                              </select>
                            </label>
                          </div>
                          <div className="z-audio-player">
                            <button
                              aria-label="Preview browser voice"
                              onClick={() => {
                                if (!("speechSynthesis" in window)) {
                                  props.notify(
                                    "Browser speech preview is unavailable.",
                                  );
                                  return;
                                }
                                if (playing) {
                                  speechSynthesis.cancel();
                                  setPlaying(false);
                                  return;
                                }
                                const utterance = new SpeechSynthesisUtterance(
                                  voiceText,
                                );
                                utterance.rate = Number(speed);
                                utterance.onend = () => setPlaying(false);
                                speechSynthesis.speak(utterance);
                                setPlaying(true);
                                props.notify(
                                  "Playing a browser voice preview. This is not an AI-generated audio file.",
                                );
                              }}
                            >
                              {playing ? (
                                <Pause size={18} />
                              ) : (
                                <Play size={18} />
                              )}
                            </button>
                            <Waveform />
                            <span>Browser preview</span>
                          </div>
                        </div>
                      </section>
                      <div className="z-two-cards">
                        <section className="z-card z-form-body">
                          <h3>
                            <AudioLines size={16} />
                            Background Music
                          </h3>
                          <label className="z-upload-small">
                            <Plus size={15} />
                            {audioName || "Upload an audio file"}
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  setAudioUrl(URL.createObjectURL(f));
                                  setAudioName(f.name);
                                }
                              }}
                            />
                          </label>
                          {audioUrl ? (
                            <audio ref={audioRef} controls src={audioUrl} />
                          ) : (
                            <Waveform />
                          )}
                        </section>
                        <section className="z-card z-form-body">
                          <h3>
                            <Sparkles size={16} />
                            Sound Effects
                          </h3>
                          <div className="z-chip-row">
                            {[
                              "Magic Glow",
                              "Chest Open",
                              "Twinkle",
                              "Surprise",
                            ].map((s) => (
                              <span key={s} className="z-tag">
                                {s}
                              </span>
                            ))}
                          </div>
                          <p>
                            Effect labels for your audio plan. Connect an audio
                            library to add sound.
                          </p>
                        </section>
                      </div>
                      <section className="z-card z-form-body">
                        <h3>Audio Timeline · Planning Preview</h3>
                        <Timeline />
                        <button
                          className="z-btn z-soft z-full"
                          onClick={() =>
                            download(
                              {
                                voice: voiceName,
                                text: voiceText,
                                speed,
                                music: audioName,
                              },
                              "zenbee-audio-plan.json",
                            )
                          }
                        >
                          <Download size={14} />
                          Download Audio Plan
                        </button>
                      </section>
                    </div>
                    <div className="z-stack">
                      <section className="z-card">
                        <CardTitle title="Voice Library" icon={Mic} />
                        <div className="z-tool-buttons">
                          {[
                            "Tura — Child",
                            "Panda — Playful",
                            "Narrator — Calm",
                            "Narrator — Deep",
                          ].map((v) => (
                            <button
                              key={v}
                              onClick={() => {
                                setVoiceName(v);
                                props.notify(
                                  "Voice label selected. AI voice synthesis is not connected.",
                                );
                              }}
                            >
                              <Mic size={15} />
                              {v}
                              <Play size={13} />
                            </button>
                          ))}
                        </div>
                      </section>
                      <section className="z-card z-form-body">
                        <h3>Audio Notes</h3>
                        <p>
                          Browser speech preview is available for the script.
                          Uploaded audio plays locally. Exporting or mixing AI
                          voices requires the production backend.
                        </p>
                        <button
                          className="z-btn z-primary z-full"
                          onClick={() => {
                            localStorage.setItem(
                              "zenbee-audio-draft",
                              JSON.stringify({
                                voice: voiceName,
                                text: voiceText,
                                speed,
                              }),
                            );
                            props.notify("Voice draft saved on this device.");
                          }}
                        >
                          <Save size={14} />
                          Save Voice Draft
                        </button>
                      </section>
                    </div>
                  </div>
                </>
              )}
              {page === "Video Editor & Preview" && (
                <div className="z-cut-layout">
                  <section className="z-card z-media-library">
                    <CardTitle title="Media Library" icon={FolderOpen} />
                    <div className="z-form-body">
                      <label className="z-upload-small">
                        <Plus size={15} />
                        Upload Video
                        <input
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setVideoUrl(URL.createObjectURL(f));
                              setPlaying(false);
                              props.notify(
                                "Video loaded locally. It has not been uploaded to a server.",
                              );
                            }
                          }}
                        />
                      </label>
                      <div className="z-media-thumbs">
                        {Array.from({ length: 6 }, (_, i) => (
                          <button
                            key={i}
                            onClick={() =>
                              setSceneIndex(i % draft.scenes.length)
                            }
                          >
                            <Art
                              source="editor"
                              crop={
                                [
                                  [435, 368, 104, 105],
                                  [549, 368, 104, 105],
                                  [435, 487, 104, 95],
                                  [549, 487, 104, 95],
                                  [435, 595, 104, 80],
                                  [549, 595, 104, 80],
                                ][i]
                              }
                            />
                            <span>Reference {i + 1}</span>
                          </button>
                        ))}
                      </div>
                      <p className="z-help-text">
                        Reference artwork for planning. Upload your own video
                        for playback.
                      </p>
                    </div>
                  </section>
                  <div className="z-stack">
                    <MediaPreview
                      title="Video Editor & Preview"
                      videoUrl={videoUrl}
                      videoRef={videoRef}
                      playing={playing}
                      setPlaying={setPlaying}
                    />
                    <div className="z-edit-tools">
                      {[
                        { s: "Cut", i: Scissors },
                        { s: "Split", i: Layers3 },
                        { s: "Trim", i: Film },
                        { s: "Crop", i: ImagePlus },
                        { s: "Speed", i: Gauge },
                      ].map((t) => (
                        <button
                          key={t.s}
                          onClick={() =>
                            props.notify(
                              `${t.s} requires the FFmpeg rendering backend. Local video preview is available.`,
                            )
                          }
                        >
                          <t.i size={18} />
                          {t.s}
                        </button>
                      ))}
                    </div>
                    <section className="z-card z-form-body">
                      <h3>Episode Timeline · Planning Preview</h3>
                      <Timeline />
                      <p className="z-help-text">
                        Visual planning tracks. No media cuts or mixes have been
                        applied.
                      </p>
                    </section>
                  </div>
                  <div className="z-stack">
                    <section className="z-card">
                      <CardTitle title="Scene Properties" icon={Clapperboard} />
                      <div className="z-form-body">
                        <label>
                          Scene Name
                          <input
                            value={selectedScene.caption}
                            onChange={(e) =>
                              changeScene("caption", e.target.value)
                            }
                          />
                        </label>
                        <label>
                          Duration (seconds)
                          <input
                            type="number"
                            min="1"
                            max="15"
                            value={selectedScene.duration_seconds}
                            onChange={(e) =>
                              changeScene(
                                "duration_seconds",
                                Math.max(
                                  1,
                                  Math.min(15, Number(e.target.value)),
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Aspect Ratio
                          <select
                            value={format}
                            onChange={(e) => setFormat(e.target.value)}
                          >
                            <option>9:16</option>
                            <option>16:9</option>
                            <option>1:1</option>
                          </select>
                        </label>
                        <label>
                          Music Volume
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={musicVolume}
                            onChange={(e) => setMusicVolume(e.target.value)}
                          />
                          <small>{musicVolume}% · planned mix setting</small>
                        </label>
                      </div>
                    </section>
                    <section className="z-card z-form-body">
                      <h3>Quick Actions</h3>
                      <button
                        className="z-btn z-primary z-full"
                        onClick={() =>
                          download(
                            { story: draft, format, musicVolume },
                            "zenbee-edit-plan.json",
                          )
                        }
                      >
                        <Download size={14} />
                        Export Edit Plan
                      </button>
                      <button className="z-btn z-full" onClick={requireMedia}>
                        <Video size={14} />
                        Render & Publish
                      </button>
                    </section>
                  </div>
                </div>
              )}
              {page === "Thumbnail & Cover Creator" && (
                <>
                  <div className="z-cover-layout">
                    <section className="z-card z-cover-templates">
                      <CardTitle title="Templates" icon={Layers3} />
                      <div className="z-tool-buttons">
                        {[
                          "All Templates",
                          "Episode Thumbnail",
                          "Series Cover",
                          "Channel Banner",
                          "Shorts Cover",
                          "Kids / Cartoon",
                          "Custom Blank",
                        ].map((t) => (
                          <button
                            key={t}
                            className={
                              tab === t ||
                              (tab === "All" && t === "All Templates")
                                ? "selected"
                                : ""
                            }
                            onClick={() => {
                              setTab(t);
                              if (
                                t === "Series Cover" ||
                                t === "Channel Banner"
                              )
                                setCoverSize(t);
                            }}
                          >
                            <ImagePlus size={15} />
                            {t}
                          </button>
                        ))}
                      </div>
                    </section>
                    <section className="z-card z-cover-canvas">
                      <div
                        className={
                          "z-cover-picture filter-" + coverFilter.toLowerCase()
                        }
                      >
                        <Art source="thumbnails" crop={[538, 291, 666, 437]} />
                        <div>{coverText}</div>
                      </div>
                      <div className="z-cover-preview-label">
                        <span>Reference artwork · editable title & filter</span>
                        <span>{coverSize}</span>
                      </div>
                      <canvas ref={coverRef} className="z-hidden" />
                    </section>
                    <section className="z-card">
                      <div className="z-tabs z-compact-tabs">
                        <button className="selected">Edit</button>
                        <button
                          onClick={() =>
                            document.getElementById("cover-title")?.focus()
                          }
                        >
                          Text
                        </button>
                        <button onClick={requireMedia}>AI Generate</button>
                      </div>
                      <div className="z-form-body">
                        <h3>Canvas Size</h3>
                        <div className="z-canvas-sizes">
                          {[
                            "YouTube Thumbnail",
                            "Series Cover",
                            "Channel Banner",
                          ].map((s) => (
                            <button
                              className={coverSize === s ? "selected" : ""}
                              key={s}
                              onClick={() => setCoverSize(s)}
                            >
                              <ImagePlus size={20} />
                              {s}
                              <small>
                                {s === "Channel Banner"
                                  ? "2560 × 1440"
                                  : "1280 × 720"}
                              </small>
                            </button>
                          ))}
                        </div>
                        <label>
                          Cover Title
                          <input
                            id="cover-title"
                            value={coverText}
                            maxLength={50}
                            onChange={(e) => setCoverText(e.target.value)}
                          />
                        </label>
                        <h3 style={{ marginTop: 25 }}>Filters & Effects</h3>
                        <div className="z-filter-choices">
                          {["None", "Vibrant", "Bright"].map((s) => (
                            <button
                              className={coverFilter === s ? "selected" : ""}
                              key={s}
                              onClick={() => setCoverFilter(s)}
                            >
                              <Art
                                source="characters"
                                crop={[315, 410, 230, 138]}
                              />
                              {s}
                            </button>
                          ))}
                        </div>
                        <button
                          className="z-btn z-primary z-full"
                          onClick={exportCover}
                        >
                          <Download size={15} />
                          Download PNG
                        </button>
                        <button
                          className="z-btn z-full"
                          onClick={() => {
                            localStorage.setItem(
                              "zenbee-cover-draft",
                              JSON.stringify({
                                coverText,
                                coverFilter,
                                coverSize,
                              }),
                            );
                            props.notify(
                              "Cover settings saved on this device.",
                            );
                          }}
                        >
                          <Save size={14} />
                          Save Draft
                        </button>
                      </div>
                    </section>
                  </div>
                  <section className="z-card z-cover-bottom">
                    <CardTitle title="A Little Inspiration" icon={Sparkles} />
                    <div>
                      {Array.from({ length: 5 }, (_, i) => (
                        <button
                          key={i}
                          onClick={() =>
                            setCoverText(
                              [
                                "Drawing Comes Alive!",
                                "The Talking Panda",
                                "A Mini Adventure",
                                "The Big Reveal",
                                "Back to the Room",
                              ][i],
                            )
                          }
                        >
                          <Art
                            source="thumbnails"
                            crop={
                              [
                                [291, 816, 171, 100],
                                [478, 816, 171, 100],
                                [664, 816, 171, 100],
                                [852, 816, 171, 100],
                                [1040, 816, 154, 100],
                              ][i]
                            }
                          />
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </>
          )}
          {page === "Channels" && (
            <div className="z-channel-grid">
              {[
                {
                  name: "YouTube",
                  icon: Youtube,
                  desc: "Share your stories through Shorts and full episodes.",
                },
                {
                  name: "Instagram",
                  icon: Instagram,
                  desc: "Bring a little magic to Reels and your community.",
                },
              ].map((c) => (
                <section className="z-card z-channel-card" key={c.name}>
                  <span className={"z-channel-logo " + c.name.toLowerCase()}>
                    <c.icon size={34} />
                  </span>
                  <h2>{c.name}</h2>
                  <p>{c.desc}</p>
                  <span className="z-tag amber">Not connected</span>
                  <button
                    className="z-btn z-primary z-full"
                    onClick={props.onConnect}
                  >
                    Set up {c.name}
                    <ArrowUpRight size={14} />
                  </button>
                </section>
              ))}
            </div>
          )}
          {page === "Settings" && (
            <div className="z-settings-layout">
              <section className="z-card">
                <CardTitle title="Studio Configuration" icon={Settings2} />
                <div className="z-form-body">
                  {[
                    [
                      "Story provider",
                      props.mode === "demo"
                        ? "Sample templates (demo mode)"
                        : "OpenAI",
                    ],
                    [
                      "Backend connection",
                      props.connected ? "Connected" : "Offline",
                    ],
                    ["Publishing timezone", "Asia/Kolkata (IST)"],
                    ["Video & audio generation", "Not connected"],
                    ["Channel publishing", "Not connected"],
                  ].map(([k, v]) => (
                    <div className="z-setting-row" key={k}>
                      <span>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                  <button
                    className="z-btn z-soft z-full"
                    onClick={props.onRefresh}
                  >
                    <RefreshCw size={14} />
                    Refresh Connection
                  </button>
                </div>
              </section>
              <section className="z-card z-form-body">
                <h2>A little setup. Endless possibilities.</h2>
                <p>
                  Configure the story provider on the backend with
                  GENERATION_MODE, OPENAI_API_KEY and OPENAI_MODEL. Credentials
                  remain on the server.
                </p>
                <p>
                  Characters, idea bookmarks and production drafts saved locally
                  stay in this browser. Series, episode schedules and generated
                  scripts are saved in the database.
                </p>
                <button
                  className="z-btn z-full"
                  onClick={() =>
                    download(
                      { characters, savedIdeas },
                      "zenbee-local-workspace.json",
                    )
                  }
                >
                  <Download size={14} />
                  Export Local References
                </button>
              </section>
            </div>
          )}
          {page === "Production Queue" && (
            <ProductionWorkspace episodes={props.episodes} />
          )}
          {operationsPages.includes(page) && page !== "Production Queue" && (
            <OperationsWorkspace
              page={page}
              series={props.series}
              episodes={props.episodes}
              preview={preview}
              connected={props.connected}
              query={query}
              onNew={() => go("Create Episode")}
              onNavigate={go}
              onOpen={props.onOpen}
              onConnect={props.onConnect}
              onRefresh={props.onRefresh}
              notify={props.notify}
            />
          )}
          {settingsPages.includes(page) && (
            <SettingsWorkspace
              page={page}
              episodes={props.episodes}
              series={props.series}
              preview={preview}
              connected={props.connected}
              mode={props.mode}
              query={query}
              notify={props.notify}
              onNavigate={go}
              onConnect={props.onConnect}
              onNew={() => go("Create Episode")}
              onOpen={props.onOpen}
            />
          )}
          <footer className="z-footer">
            <span>🐝 A little spark. Endless stories.</span>
            <span>ZENBEE Studio · Your imagination, brought to life.</span>
          </footer>
        </main>
      </div>
      {characterEdit && (
        <div
          className="z-dialog-backdrop"
          onClick={() => setCharacterEdit(null)}
        >
          <form
            className="z-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="character-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const c = { ...characterEdit, name: characterEdit.name.trim() };
              if (!c.name) return;
              const next = characterOriginalName
                ? characters.map((x) =>
                    x.name === characterOriginalName ? c : x,
                  )
                : [...characters, c];
              setCharacters(next);
              localStorage.setItem("zenbee-characters", JSON.stringify(next));
              setCharacterEdit(null);
              props.notify(
                "Character reference saved on this device. Add it to your series cast for story generation.",
              );
            }}
          >
            <button
              type="button"
              className="z-dialog-close"
              aria-label="Close character editor"
              onClick={() => setCharacterEdit(null)}
            >
              <X size={18} />
            </button>
            <h2 id="character-title">A character worth remembering.</h2>
            <p>Your reference library is saved on this device.</p>
            <label>
              Name
              <input
                autoFocus
                required
                maxLength={60}
                value={characterEdit.name}
                onChange={(e) =>
                  setCharacterEdit({ ...characterEdit, name: e.target.value })
                }
              />
            </label>
            <label>
              Role
              <select
                value={characterEdit.role}
                onChange={(e) =>
                  setCharacterEdit({ ...characterEdit, role: e.target.value })
                }
              >
                <option>Main character</option>
                <option>Supporting character</option>
              </select>
            </label>
            <label>
              Appearance & Personality
              <textarea
                required
                rows={5}
                value={characterEdit.description}
                onChange={(e) =>
                  setCharacterEdit({
                    ...characterEdit,
                    description: e.target.value,
                  })
                }
              />
            </label>
            <button className="z-btn z-primary z-full">
              <Save size={15} />
              Save Character
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  color,
  foot,
}: {
  label: string;
  value: string | number;
  icon: typeof Film;
  color: string;
  foot: string;
}) {
  return (
    <article className="z-stat">
      <span className={"z-stat-icon " + color}>
        <Icon size={24} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{foot}</small>
      </div>
    </article>
  );
}
function CardTitle({
  title,
  icon: Icon,
  action,
  onAction,
}: {
  title: string;
  icon?: typeof Film;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="z-card-title">
      <h3>
        {Icon && <Icon size={17} />}
        {title}
      </h3>
      {action && (
        <button onClick={onAction}>
          {action}
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
function Empty({
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
    <div className="z-empty">
      <span>
        <Sparkles size={27} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="z-btn z-primary" onClick={onAction}>
          <Plus size={14} />
          {action}
        </button>
      )}
    </div>
  );
}
function EpisodeTable({
  episodes,
  series,
  preview,
  query,
  onOpen,
  onNew,
}: {
  episodes: Episode[];
  series: Series[];
  preview: boolean;
  query: string;
  onOpen: (e: Episode) => void;
  onNew: () => void;
}) {
  const examples = [
    "The Talking Panda",
    "A Jungle of Surprises",
    "The Little Star’s Big Wish",
  ];
  const filtered = episodes.filter((e) =>
    e.topic.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="z-card">
      <CardTitle
        title="Recent Episodes"
        icon={Film}
        action="Create episode"
        onAction={onNew}
      />
      {filtered.length || preview ? (
        <div className="z-table-wrap">
          <table className="z-table">
            <thead>
              <tr>
                <th>Episode</th>
                <th>Series</th>
                <th>Status</th>
                <th>Publishing · IST</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id}>
                  <td>
                    <button
                      className="z-episode-cell"
                      onClick={() => onOpen(e)}
                    >
                      <Art
                        source="series"
                        crop={
                          [
                            [310, 411, 274, 100],
                            [753, 411, 274, 100],
                            [1197, 411, 274, 100],
                          ][i % 3]
                        }
                      />
                      <span>
                        {e.topic}
                        <small>Episode {e.id}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    {series.find((s) => s.id === e.series_id)?.name || "Series"}
                  </td>
                  <td>
                    <span
                      className={
                        "z-tag " +
                        (e.status === "script_ready"
                          ? "green"
                          : e.status === "failed"
                            ? "red"
                            : "amber")
                      }
                    >
                      {e.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>{ist(e.publish_at)}</td>
                  <td>
                    <button
                      className="z-icon-btn"
                      aria-label={"Open " + e.topic}
                      onClick={() => onOpen(e)}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {preview &&
                !filtered.length &&
                examples
                  .filter((e) => e.toLowerCase().includes(query.toLowerCase()))
                  .map((e, i) => (
                    <tr key={e}>
                      <td>
                        <button className="z-episode-cell" onClick={onNew}>
                          <Art
                            crop={
                              [
                                [310, 411, 274, 100],
                                [753, 411, 274, 100],
                                [1197, 411, 274, 100],
                              ][i]
                            }
                          />
                          <span>
                            {e}
                            <small>Sample episode · design preview</small>
                          </span>
                        </button>
                      </td>
                      <td>{series[i % series.length]?.name}</td>
                      <td>
                        <span
                          className={"z-tag " + ["green", "amber", "blue"][i]}
                        >
                          {["Script ready", "Scheduled", "In production"][i]}
                        </span>
                      </td>
                      <td>Design preview</td>
                      <td>
                        <button
                          className="z-icon-btn"
                          onClick={onNew}
                          aria-label="Create your own episode"
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Your next great story belongs here."
          text="Add a topic and plan your first episode."
          action="Create Episode"
          onAction={onNew}
        />
      )}
    </section>
  );
}
function Waveform() {
  return (
    <div className="z-waveform" aria-hidden="true">
      {Array.from({ length: 65 }, (_, i) => (
        <i
          key={i}
          style={{
            height: `${12 + Math.abs(Math.sin(i * 1.9)) * 24 * (1 - i / 95)}px`,
          }}
        />
      ))}
    </div>
  );
}
function Timeline() {
  return (
    <div className="z-timeline">
      <div className="z-time-ruler">
        {["0:00", "0:05", "0:10", "0:15", "0:20", "0:25", "0:30"].map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      {[
        "Video / Scene",
        "Voiceover",
        "Music (BGM)",
        "Sound Effects",
        "Text / Caption",
      ].map((s, i) => (
        <div className="z-timeline-track" key={s}>
          <span>{s}</span>
          <div className={"z-track z-track-" + i}>
            {i === 0 ? (
              <>
                <Art crop={[310, 411, 274, 100]} />
                <Art crop={[753, 411, 274, 100]} />
                <Art crop={[1197, 411, 274, 100]} />
              </>
            ) : i < 3 ? (
              <Waveform />
            ) : (
              <span>{i === 3 ? "✦ ✧ ✦" : "A little spark of magic…"}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
function MediaPreview({
  title,
  videoUrl,
  videoRef,
  playing,
  setPlaying,
}: {
  title: string;
  videoUrl: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playing: boolean;
  setPlaying: (v: boolean) => void;
}) {
  return (
    <section className="z-card z-media-preview">
      <CardTitle title={title} icon={Video} />
      <div className="z-preview-image">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : (
          <Art source="video" crop={[1145, 326, 507, 264]} />
        )}
      </div>
      {!videoUrl && (
        <div className="z-video-controls">
          <button
            aria-label="Reference preview is not playable"
            onClick={() => setPlaying(false)}
          >
            <Play size={18} />
          </button>
          <span>Reference artwork</span>
          <div className="z-play-track">
            <i />
          </div>
          <span>No video file</span>
        </div>
      )}
    </section>
  );
}

function EpisodeCreate({
  series,
  preview,
  onSaved,
  onCancel,
  onNewSeries,
  notify,
  defaultLeadHours = 24,
}: {
  series: Series[];
  preview: boolean;
  onSaved: (e: Episode) => Promise<void>;
  onCancel: () => void;
  onNewSeries: () => void;
  notify: (s: string) => void;
  defaultLeadHours?: number;
}) {
  const [topic, setTopic] = useState(""),
    [summary, setSummary] = useState(""),
    [kind, setKind] = useState("Regular Episode"),
    [genres, setGenres] = useState(["Adventure"]),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [sid, setSid] = useState(series[0]?.id || 0);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("zenbee-episode-form-draft");
      if (saved) {
        const d = JSON.parse(saved);
        setTopic(d.topic);
        setSummary(d.summary);
        setKind(d.kind);
        setGenres(d.genres);
        setSid(d.sid);
      }
    } catch {}
    const idea = localStorage.getItem("zenbee-episode-idea");
    if (idea) {
      setTopic(idea.split(":")[0]);
      setSummary(idea);
      localStorage.removeItem("zenbee-episode-idea");
    }
  }, []);
  useEffect(() => {
    if (!sid && series.length) setSid(series[0].id);
  }, [series, sid]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sid) {
      setError("Create a workspace series before scheduling an episode.");
      return;
    }
    const data = new FormData(e.currentTarget);
    setSaving(true);
    setError("");
    try {
      const item = await request<Episode>("/episodes", {
        series_id: sid,
        topic: summary ? `${topic} — ${summary}`.slice(0, 1000) : topic,
        publish_at: new Date(
          String(data.get("publish_at")) + ":00+05:30",
        ).toISOString(),
        lead_hours: Number(data.get("lead_hours")),
      });
      localStorage.removeItem("zenbee-episode-form-draft");
      notify("Episode saved. Your story is ready to begin.");
      await onSaved(item);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to create episode. Start the backend and try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="z-stepper">
        {[
          "Episode Details",
          "Script & Story",
          "Storyboard",
          "Assets & Voice",
          "Video & Publish",
        ].map((s, i) => (
          <span key={s} className={i === 0 ? "active" : ""}>
            <b>{i + 1}</b>
            {s}
            {i < 4 && <ChevronRight size={14} />}
          </span>
        ))}
      </div>
      {error && (
        <div className="z-error" role="alert">
          {error}
        </div>
      )}
      <div className="z-episode-form-layout">
        <section className="z-card">
          <CardTitle title="Episode Details" icon={FileText} />
          <div className="z-form-body">
            <div className="z-input-row">
              <label>
                Select Series <em>*</em>
                <select
                  required
                  value={sid || ""}
                  onChange={(e) => setSid(Number(e.target.value))}
                >
                  <option value="" disabled>
                    Choose a series
                  </option>
                  {series.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Episode Title <em>*</em>
                <input
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={150}
                  placeholder="The Talking Panda"
                />
              </label>
            </div>
            {!series.length && (
              <div className="z-memory-note">
                <BookOpen size={17} />
                <p>
                  A series gives your episode its characters and style.{" "}
                  <button type="button" onClick={onNewSeries}>
                    Create your first series →
                  </button>
                </p>
              </div>
            )}
            <label>Episode Type</label>
            <div className="z-pill-options">
              {["Regular Episode", "Special", "Festival", "Q&A"].map((s) => (
                <button
                  type="button"
                  key={s}
                  className={kind === s ? "selected" : ""}
                  onClick={() => setKind(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <label>Genre / Category</label>
            <div className="z-pill-options">
              {[
                "Adventure",
                "Comedy",
                "Magic",
                "Friendship",
                "Learning",
                "Fantasy",
              ].map((s) => (
                <button
                  type="button"
                  key={s}
                  className={genres.includes(s) ? "selected" : ""}
                  onClick={() =>
                    setGenres(
                      genres.includes(s)
                        ? genres.filter((g) => g !== s)
                        : [...genres, s],
                    )
                  }
                >
                  {genres.includes(s) && <Check size={12} />}
                  {s}
                </button>
              ))}
            </div>
            <label>
              Episode Summary / Topic
              <textarea
                rows={5}
                value={summary}
                maxLength={800}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Tura draws a cute panda in her room. Suddenly, her drawing comes alive…"
              />
            </label>
            <div className="z-input-row">
              <label>
                Target Format
                <input value="Shorts / Reels · 9:16" readOnly />
              </label>
              <label>
                Story Duration
                <input value="Up to 60 seconds" readOnly />
              </label>
            </div>
            <p className="z-help-text">
              Episode title and summary are saved as the story topic. Type and
              category selections are included in the local planning draft.
            </p>
          </div>
        </section>
        <div className="z-stack">
          <section className="z-card">
            <CardTitle title="A Little Inspiration" icon={Sparkles} />
            <Art crop={[310, 411, 274, 100]} />
            <div className="z-form-body">
              <p>
                Your topic will become a story with character dialogue,
                narration, scene prompts and captions.
              </p>
            </div>
          </section>
          <section className="z-card">
            <CardTitle title="Publishing Plan" icon={CalendarDays} />
            <div className="z-form-body">
              <span className="z-tag">One-time publishing plan</span>
              <label>
                Publishing Date & Time · IST <em>*</em>
                <input type="datetime-local" name="publish_at" required />
              </label>
              <label>
                Start Generation
                <select
                  name="lead_hours"
                  defaultValue={String(defaultLeadHours)}
                >
                  {![6, 24, 48, 168].includes(defaultLeadHours) && (
                    <option value={defaultLeadHours}>
                      {defaultLeadHours} hours before publishing
                    </option>
                  )}
                  <option value="6">6 hours before publishing</option>
                  <option value="24">24 hours before publishing</option>
                  <option value="48">48 hours before publishing</option>
                  <option value="168">7 days before publishing</option>
                </select>
              </label>
              <p className="z-help-text">
                Plans are saved to your database. Story generation is started
                manually; automated workers and publishing are not connected.
              </p>
            </div>
          </section>
        </div>
      </div>
      <div className="z-form-footer">
        <button type="button" className="z-btn" onClick={onCancel}>
          Cancel
        </button>
        <div>
          <button
            className="z-btn"
            type="button"
            onClick={() => {
              localStorage.setItem(
                "zenbee-episode-form-draft",
                JSON.stringify({ topic, summary, kind, genres, sid }),
              );
              notify("Episode planning draft saved on this device.");
            }}
          >
            <Save size={14} />
            Save Local Draft
          </button>
          <button className="z-btn z-primary" disabled={saving}>
            {saving ? "Saving…" : "Next: Script & Story"}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </form>
  );
}
