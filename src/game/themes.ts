export const THEMES = ["beach", "cave"] as const;
export type ThemeId = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemeId = "beach";

export function isThemeId(value: unknown): value is ThemeId {
  return value === "beach" || value === "cave";
}

/** Canvas-drawn projectile palette. Beach balloons keep the existing toy colors. */
export interface ProjectileKind {
  id: string;
  fill: string;
  rim: string;
  highlight: string;
  splash: string;
  scale: number;
  vein?: string;
}

export const BALLOON_KINDS: ProjectileKind[] = [
  { id: "pink", fill: "#ff6ba8", rim: "#c73d7a", highlight: "#ffd4e8", splash: "#7eeaf6", scale: 1 },
  { id: "yellow", fill: "#ffd24a", rim: "#c99a12", highlight: "#fff3c2", splash: "#ffffff", scale: 1 },
  { id: "cyan", fill: "#3ad6e8", rim: "#1696a8", highlight: "#c8f6fc", splash: "#7eeaf6", scale: 1 },
  { id: "lime", fill: "#8ee63a", rim: "#4fa812", highlight: "#d8f9b0", splash: "#ffffff", scale: 1 },
  { id: "orange", fill: "#ff8a3a", rim: "#c85a12", highlight: "#ffd4b0", splash: "#7eeaf6", scale: 1 },
  { id: "magenta", fill: "#e84ad8", rim: "#a81ea0", highlight: "#f8c4f2", splash: "#ffffff", scale: 1 },
];

export const ROCK_KINDS: ProjectileKind[] = [
  {
    id: "slate",
    fill: "#6d7580",
    rim: "#2f3640",
    highlight: "#c5ced8",
    splash: "#b8c0c8",
    scale: 1,
    vein: "#9aa6b4",
  },
  {
    id: "granite",
    fill: "#8a8178",
    rim: "#4a433c",
    highlight: "#e4dcd2",
    splash: "#c8bfb4",
    scale: 1,
    vein: "#6b635a",
  },
  {
    id: "amber",
    fill: "#c4883a",
    rim: "#6e4210",
    highlight: "#f6d48a",
    splash: "#ffb14a",
    scale: 1,
    vein: "#f0c060",
  },
  {
    id: "mossy",
    fill: "#5d7a4c",
    rim: "#2d4426",
    highlight: "#c4dca6",
    splash: "#8aa86a",
    scale: 1,
    vein: "#3d5a32",
  },
  {
    id: "geode",
    fill: "#5c4d86",
    rim: "#2a2148",
    highlight: "#d2c4f4",
    splash: "#8e7ec8",
    scale: 1,
    vein: "#7eeaf6",
  },
  {
    id: "iron",
    fill: "#8a5c4c",
    rim: "#4a2e24",
    highlight: "#e8b8a4",
    splash: "#c88868",
    scale: 1,
    vein: "#c07048",
  },
];

export const WATER_COLORS = ["#7eeaf6", "#ffffff", "#5ad4e8", "#c8f8ff", "#3ec8d6", "#e8ffff"];
export const FIZZLE_COLORS = ["#f7f3ea", "#ffffff", "#e6dfd2", "#d9d2c6"];
export const DUST_COLORS = ["#8a7a68", "#c4b49c", "#5a5046", "#d8c8b0", "#6e6458"];
export const SPARK_COLORS = ["#ffb14a", "#ffe08a", "#ff7a2a", "#fff3c2", "#ffd24a"];
export const SHARD_COLORS = ["#6d7580", "#8a8178", "#c4883a", "#5d7a4c", "#5c4d86", "#8a5c4c"];
export const CHIP_COLORS = ["#7a7066", "#4a443c", "#c0b4a4", "#5c564e"];

export const TRAIL_RGB: Record<ThemeId, { r: number; g: number; b: number }> = {
  beach: { r: 18, g: 72, b: 96 },
  cave: { r: 255, g: 148, b: 52 },
};

export interface ThemePack {
  id: ThemeId;
  label: string;
  tagline: string;
  homeSubtitle: string;
  howSwipe: string;
  howWrong: string;
  pauseWait: string;
}

export const THEME_PACKS: Record<ThemeId, ThemePack> = {
  beach: {
    id: "beach",
    label: "Beach",
    tagline: "Sunny water balloons",
    homeSubtitle: "Swipe the right number before the balloon splashes back down.",
    howSwipe:
      "Water balloons fly up with numbers on them. Draw a blade through the correct answer. One balloon per swipe.",
    howWrong:
      "Hit a decoy, or let the right balloon fall, and you lose a life. Three lives. Combos multiply your score.",
    pauseWait: "The balloons will wait.",
  },
  cave: {
    id: "cave",
    label: "Cave",
    tagline: "Pickaxe and numbered rocks",
    homeSubtitle: "Swipe the right number before the rock falls back into the dark.",
    howSwipe:
      "Numbered rocks fly up from the cave floor. Draw a slash through the correct answer — it should feel like a pickaxe strike. One rock per swipe.",
    howWrong:
      "Hit a decoy, or let the right rock fall, and you lose a life. Three lives. Combos multiply your score.",
    pauseWait: "The rocks will wait.",
  },
};

export function kindsFor(theme: ThemeId): ProjectileKind[] {
  return theme === "cave" ? ROCK_KINDS : BALLOON_KINDS;
}
