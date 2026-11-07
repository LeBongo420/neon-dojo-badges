import { publicPath } from "@/lib/base-path";

export const SPRITE_SRC = {
  ship: publicPath("/sprites/ship.png"),
  shipThrust: publicPath("/sprites/ship_thrust.png"),
  rock: publicPath("/sprites/rock.png"),
  rockB: publicPath("/sprites/rock_b.png"),
  drone: publicPath("/sprites/drone.png"),
  gateBar: publicPath("/sprites/gate_bar.png"),
  markLeft: publicPath("/sprites/gate_mark_left.png"),
  markRight: publicPath("/sprites/gate_mark_right.png"),
  novice: publicPath("/badges/novice.png"),
  pilot: publicPath("/badges/pilot.png"),
  ace: publicPath("/badges/ace.png"),
} as const;

export type SpriteKey = keyof typeof SPRITE_SRC;

const cache = new Map<SpriteKey, HTMLImageElement>();

export function preloadSprites() {
  if (typeof window === "undefined") return;
  (Object.keys(SPRITE_SRC) as SpriteKey[]).forEach((key) => {
    if (cache.has(key)) return;
    const image = new Image();
    image.src = SPRITE_SRC[key];
    cache.set(key, image);
  });
}

export function spriteImage(key: SpriteKey) {
  preloadSprites();
  return cache.get(key) ?? null;
}

export function spriteReady(key: SpriteKey) {
  const image = spriteImage(key);
  return Boolean(image && image.complete && image.naturalWidth > 0);
}
