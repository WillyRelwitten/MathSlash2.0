export interface BalloonKind {
  id: string;
  fill: string;
  rim: string;
  highlight: string;
  splash: string;
  scale: number;
}

/** Beach-toy water balloons. Drawn in canvas — no sprite images. */
export const BALLOON_KINDS: BalloonKind[] = [
  { id: "pink", fill: "#ff6ba8", rim: "#c73d7a", highlight: "#ffd4e8", splash: "#7eeaf6", scale: 1 },
  { id: "yellow", fill: "#ffd24a", rim: "#c99a12", highlight: "#fff3c2", splash: "#ffffff", scale: 1 },
  { id: "cyan", fill: "#3ad6e8", rim: "#1696a8", highlight: "#c8f6fc", splash: "#7eeaf6", scale: 1 },
  { id: "lime", fill: "#8ee63a", rim: "#4fa812", highlight: "#d8f9b0", splash: "#ffffff", scale: 1 },
  { id: "orange", fill: "#ff8a3a", rim: "#c85a12", highlight: "#ffd4b0", splash: "#7eeaf6", scale: 1 },
  { id: "magenta", fill: "#e84ad8", rim: "#a81ea0", highlight: "#f8c4f2", splash: "#ffffff", scale: 1 },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export interface GameAssets {
  portrait: HTMLImageElement;
  landscape: HTMLImageElement;
}

let cache: GameAssets | null = null;
let pending: Promise<GameAssets> | null = null;

const BEACH_LANDSCAPE = "/assets/craftpix/beach-landscape.png";
const BEACH_PORTRAIT = "/assets/craftpix/beach-portrait.png";

export function preloadAssets(): Promise<GameAssets> {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;
  pending = (async () => {
    const [portrait, landscape] = await Promise.all([
      loadImage(BEACH_PORTRAIT),
      loadImage(BEACH_LANDSCAPE),
    ]);
    cache = { portrait, landscape };
    return cache;
  })();
  return pending;
}

export function getAssets(): GameAssets | null {
  return cache;
}
