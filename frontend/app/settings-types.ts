export type SystemPrefs = {
  workspace_name: string;
  language: "English" | "Tamil" | "Hindi";
  timezone: "Asia/Kolkata";
  date_format: "DD-MM-YYYY" | "YYYY-MM-DD";
  resolution: "1080p" | "720p";
  aspect_ratio: "9:16" | "16:9" | "1:1";
  image_format: "PNG" | "JPEG" | "WebP";
  generation_lead_hours: number;
  retry_attempts: number;
  concurrency: number;
  caption_template: string;
  autosave_drafts: boolean;
};
export type BrandPrefs = {
  name: string;
  tagline: string;
  description: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  heading_font: string;
  body_font: string;
  visual_style: string;
  prompt_style: string;
  logo: string;
};
export type NotificationPrefs = {
  generation: boolean;
  publishing: boolean;
  automation: boolean;
  costs: boolean;
  team: boolean;
  system: boolean;
  in_app: boolean;
  email_requested: boolean;
  frequency: string;
};
export type BudgetPrefs = {
  monthly_inr: string;
  warning_percent: number;
  show_estimate_alerts: boolean;
};
export type ProviderPrefs = {
  preferred_story_provider: string;
  preferred_video_provider: string;
  preferred_voice_provider: string;
  monthly_request_target: number;
};
export const roleNames = [
  "Owner",
  "Admin",
  "Content Manager",
  "Editor",
  "Designer",
  "Publisher",
  "Analyst",
] as const;
export const permissions = [
  "Dashboard",
  "Content Studio",
  "Automation",
  "Publishing",
  "Analytics",
  "Settings",
] as const;
export type Role = (typeof roleNames)[number];
export type Permission = (typeof permissions)[number];
export type RolePrefs = { matrix: Record<Role, Permission[]> };
export type SocialPrefs = {
  preferred_platforms: string[];
  default_platform: string;
  require_review: boolean;
  cross_post_requested: boolean;
};
export type Member = {
  name: string;
  email: string;
  role: Role;
  status: "Draft" | "Planned" | "Archived";
};
export type CostEntry = {
  provider: string;
  category: "Script" | "Video" | "Image" | "Voice" | "Other";
  amount_inr: string;
  quantity: number;
  recorded_on: string;
  note: string;
};
export type Saved<T> = {
  id: number;
  kind: string;
  name: string;
  enabled: boolean;
  data: T;
  updated_at: string;
};
export type EventRecord = {
  id: number;
  episode_id: number | null;
  action: string;
  detail: string;
  created_at: string;
};
export type ProviderStatus = {
  generation_mode: string;
  openai_key_configured: boolean;
  story_model: string;
  credential_source: string;
  network_tested: boolean;
  video_connected: boolean;
  voice_connected: boolean;
  publishing_connected: boolean;
  auth_enforced: boolean;
  cost_metering_connected: boolean;
};
export const systemDefaults: SystemPrefs = {
  workspace_name: "ZENBEE Studio",
  language: "English",
  timezone: "Asia/Kolkata",
  date_format: "DD-MM-YYYY",
  resolution: "1080p",
  aspect_ratio: "9:16",
  image_format: "PNG",
  generation_lead_hours: 24,
  retry_attempts: 3,
  concurrency: 1,
  caption_template: "A little spark. A new ZENBEE story. #ZENBEE",
  autosave_drafts: true,
};
export const brandDefaults: BrandPrefs = {
  name: "ZENBEE Studio",
  tagline: "A little spark. Endless stories.",
  description: "Create imaginative, family-friendly cartoon stories.",
  primary: "#7B3FF2",
  secondary: "#FF3F8E",
  accent: "#FFB26B",
  background: "#F9F7FF",
  surface: "#FFFFFF",
  text: "#241337",
  heading_font: "Arial",
  body_font: "Arial",
  visual_style: "Playful",
  prompt_style:
    "Vibrant 3D cartoon, warm magical light, expressive family-friendly characters.",
  logo: "",
};
export const notificationDefaults: NotificationPrefs = {
  generation: true,
  publishing: true,
  automation: true,
  costs: true,
  team: true,
  system: true,
  in_app: true,
  email_requested: false,
  frequency: "Instant",
};
export const budgetDefaults: BudgetPrefs = {
  monthly_inr: "3000.00",
  warning_percent: 80,
  show_estimate_alerts: true,
};
export const providerDefaults: ProviderPrefs = {
  preferred_story_provider: "Demo",
  preferred_video_provider: "Not configured",
  preferred_voice_provider: "Not configured",
  monthly_request_target: 100,
};
export const roleDefaults: RolePrefs = {
  matrix: {
    Owner: [...permissions],
    Admin: [...permissions],
    "Content Manager": ["Dashboard", "Content Studio", "Analytics"],
    Editor: ["Dashboard", "Content Studio"],
    Designer: ["Dashboard", "Content Studio"],
    Publisher: ["Dashboard", "Publishing"],
    Analyst: ["Dashboard", "Analytics"],
  },
};
export const socialDefaults: SocialPrefs = {
  preferred_platforms: ["YouTube", "Instagram"],
  default_platform: "YouTube",
  require_review: true,
  cross_post_requested: false,
};
