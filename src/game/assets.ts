import { type ThemeId, DEFAULT_THEME } from "./themes.ts";

export type { ProjectileKind as BalloonKind } from "./themes.ts";
export { BALLOON_KINDS, ROCK_KINDS } from "./themes.ts";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export interface ThemeBackdrop {
  portrait: HTMLImageElement;
  landscape: HTMLImageElement;
}

export interface GameAssets {
  beach: ThemeBackdrop;
  cave: ThemeBackdrop;
}

let cache: GameAssets | null = null;
let pending: Promise<GameAssets> | null = null;

const BEACH_LANDSCAPE = "/assets/craftpix/beach-landscape.png";
const BEACH_PORTRAIT = "/assets/craftpix/beach-portrait.png";
const CAVE_LANDSCAPE = "/assets/cave/cave-landscape.jpg";
const CAVE_PORTRAIT = "/assets/cave/cave-portrait.jpg";

export function preloadAssets(): Promise<GameAssets> {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;
  pending = (async () => {
    const [beachPortrait, beachLandscape, cavePortrait, caveLandscape] = await Promise.all([
      loadImage(BEACH_PORTRAIT),
      loadImage(BEACH_LANDSCAPE),
      loadImage(CAVE_PORTRAIT),
      loadImage(CAVE_LANDSCAPE),
    ]);
    cache = {
      beach: { portrait: beachPortrait, landscape: beachLandscape },
      cave: { portrait: cavePortrait, landscape: caveLandscape },
    };
    return cache;
  })();
  return pending;
}

export function getAssets(): GameAssets | null {
  return cache;
}

export function backdropFor(assets: GameAssets, theme: ThemeId = DEFAULT_THEME): ThemeBackdrop {
  return assets[theme];
}
