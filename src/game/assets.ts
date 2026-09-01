export interface FruitKind {
  id: string;
  src: string;
  juice: string;
  scale: number;
}

export const FRUIT_KINDS: FruitKind[] = [
  { id: "watermelon", src: "/sprites/watermelon.png", juice: "#e14b4b", scale: 1.08 },
  { id: "apple", src: "/sprites/apple.png", juice: "#dc3b3b", scale: 0.96 },
  { id: "orange", src: "/sprites/orange.png", juice: "#f08a2a", scale: 0.98 },
  { id: "banana", src: "/sprites/banana.png", juice: "#e8c43a", scale: 1.1 },
  { id: "kiwi", src: "/sprites/kiwi.png", juice: "#8fbf3a", scale: 0.92 },
  { id: "strawberry", src: "/sprites/strawberry.png", juice: "#e0365a", scale: 0.9 },
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
  fruits: Record<string, HTMLImageElement>;
  portrait: HTMLImageElement;
  landscape: HTMLImageElement;
}

let cache: GameAssets | null = null;
let pending: Promise<GameAssets> | null = null;

export function preloadAssets(): Promise<GameAssets> {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;
  pending = (async () => {
    const [portrait, landscape, ...fruitImgs] = await Promise.all([
      loadImage("/bg-portrait.jpg"),
      loadImage("/bg-landscape.jpg"),
      ...FRUIT_KINDS.map((f) => loadImage(f.src)),
    ]);
    const fruits: Record<string, HTMLImageElement> = {};
    FRUIT_KINDS.forEach((f, i) => {
      fruits[f.id] = fruitImgs[i]!;
    });
    cache = { fruits, portrait, landscape };
    return cache;
  })();
  return pending;
}

export function getAssets(): GameAssets | null {
  return cache;
}
