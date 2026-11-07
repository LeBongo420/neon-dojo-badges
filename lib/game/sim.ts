import {
  ACE_SCORE,
  CLOSE_POINTS,
  DODGE_POINTS,
  FIELD_H,
  FIELD_W,
  MAX_SCORE,
  NOVICE_SCORE,
  PILOT_SCORE,
  POINTS_PER_SECOND,
  SHIP_R,
} from "./constants";

export type Phase = "title" | "play" | "over";
export type ObstacleKind = "rock" | "gate" | "drone";

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  y: number;
  r: number;
  vy: number;
  phase: number;
  amp: number;
  spin: number;
  gapX: number;
  gapW: number;
  barH: number;
  passed: boolean;
  seed: number;
}

export interface Popup {
  text: string;
  x: number;
  y: number;
  life: number;
}

export interface Sim {
  phase: Phase;
  paused: boolean;
  time: number;
  score: number;
  dodges: number;
  closeCalls: number;
  shipX: number;
  shipY: number;
  obstacles: Obstacle[];
  popups: Popup[];
  spawnIn: number;
  grace: number;
  shake: number;
  rngState: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  pointer: boolean;
  pointerX: number;
  pointerY: number;
}

export function emptyInput(): InputState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    pointer: false,
    pointerX: 0,
    pointerY: 0,
  };
}

export function createSim(seed = 1): Sim {
  return {
    phase: "title",
    paused: false,
    time: 0,
    score: 0,
    dodges: 0,
    closeCalls: 0,
    shipX: FIELD_W / 2,
    shipY: FIELD_H * 0.74,
    obstacles: [],
    popups: [],
    spawnIn: 0.7,
    grace: 0,
    shake: 0,
    rngState: seed || 1,
  };
}

export function launch(sim: Sim) {
  sim.phase = "play";
  sim.paused = false;
  sim.time = 0;
  sim.score = 0;
  sim.dodges = 0;
  sim.closeCalls = 0;
  sim.shipX = FIELD_W / 2;
  sim.shipY = FIELD_H * 0.78;
  sim.obstacles = [];
  sim.popups = [];
  sim.spawnIn = 0.45;
  sim.grace = 1.35;
  sim.shake = 0;
}

function rand(sim: Sim) {
  sim.rngState = (sim.rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(sim.rngState ^ (sim.rngState >>> 15), 1 | sim.rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function scrollSpeed(time: number) {
  return Math.min(220, 76 + time * 2.5);
}

export function obstacleCenter(obs: Obstacle, time: number) {
  if (obs.kind === "drone") {
    return {
      x: obs.x + Math.sin(time * 2.3 + obs.phase) * obs.amp,
      y: obs.y,
    };
  }
  return { x: obs.x, y: obs.y };
}

export function gateBars(obs: Obstacle) {
  const top = obs.y - obs.barH / 2;
  const leftW = obs.gapX - obs.gapW / 2;
  const rightX = obs.gapX + obs.gapW / 2;
  return [
    { x: 0, y: top, w: Math.max(0, leftW), h: obs.barH },
    { x: rightX, y: top, w: Math.max(0, FIELD_W - rightX), h: obs.barH },
  ];
}

function circleHitsRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function hitsShip(sim: Sim, obs: Obstacle) {
  if (obs.kind === "gate") {
    return gateBars(obs).some((bar) =>
      circleHitsRect(sim.shipX, sim.shipY, SHIP_R, bar.x, bar.y, bar.w, bar.h),
    );
  }
  const center = obstacleCenter(obs, sim.time);
  const dx = sim.shipX - center.x;
  const dy = sim.shipY - center.y;
  const reach = SHIP_R + obs.r;
  return dx * dx + dy * dy < reach * reach;
}

function pushPopup(sim: Sim, text: string) {
  sim.popups.push({
    text,
    x: sim.shipX - 20,
    y: sim.shipY - 22,
    life: 0.85,
  });
}

function spawn(sim: Sim) {
  const speed = scrollSpeed(sim.time);
  const roll = rand(sim);
  let kind: ObstacleKind = "rock";
  if (sim.time >= 16 && roll > 0.62) kind = "gate";
  else if (sim.time >= 8 && roll > 0.58) kind = "drone";

  const gateLive = sim.obstacles.some((obs) => obs.kind === "gate" && obs.y < FIELD_H * 0.7);
  if (kind === "gate" && gateLive) kind = "rock";

  if (kind === "rock") {
    const r = 13 + rand(sim) * 10;
    sim.obstacles.push({
      kind,
      x: 28 + rand(sim) * (FIELD_W - 56),
      y: -r - 4,
      r,
      vy: speed,
      phase: 0,
      amp: 0,
      spin: rand(sim) * Math.PI,
      gapX: 0,
      gapW: 0,
      barH: 0,
      passed: false,
      seed: Math.floor(rand(sim) * 255),
    });
    return;
  }

  if (kind === "drone") {
    sim.obstacles.push({
      kind,
      x: FIELD_W / 2,
      y: -24,
      r: 11,
      vy: speed * 1.08,
      phase: rand(sim) * Math.PI * 2,
      amp: 46 + rand(sim) * 48,
      spin: 0,
      gapX: 0,
      gapW: 0,
      barH: 0,
      passed: false,
      seed: Math.floor(rand(sim) * 255),
    });
    return;
  }

  const gapW = Math.max(84, 132 - sim.time * 0.55);
  const gapX = gapW / 2 + 18 + rand(sim) * (FIELD_W - gapW - 36);
  sim.obstacles.push({
    kind: "gate",
    x: FIELD_W / 2,
    y: -24,
    r: 0,
    vy: speed * 0.92,
    phase: 0,
    amp: 0,
    spin: 0,
    gapX,
    gapW,
    barH: 26,
    passed: false,
    seed: 0,
  });
}

function markPass(sim: Sim, obs: Obstacle) {
  obs.passed = true;
  sim.dodges += 1;
  let bonus = DODGE_POINTS;
  let close = false;
  if (obs.kind === "gate") {
    const edge = Math.abs(sim.shipX - obs.gapX) - (obs.gapW / 2 - SHIP_R);
    close = edge > -16 && edge < 8;
  } else {
    const center = obstacleCenter(obs, sim.time);
    close = Math.abs(sim.shipX - center.x) < obs.r + SHIP_R + 16;
  }
  if (close) {
    bonus += CLOSE_POINTS;
    sim.closeCalls += 1;
    pushPopup(sim, `CLOSE +${bonus}`);
  } else {
    pushPopup(sim, `+${bonus}`);
  }
  sim.score = Math.min(MAX_SCORE, sim.score + bonus);
}

function moveShip(sim: Sim, dt: number, input: InputState) {
  const speed = 176;
  if (input.pointer) {
    const dx = input.pointerX - sim.shipX;
    const dy = input.pointerY - sim.shipY;
    const dist = Math.hypot(dx, dy);
    if (dist > 3) {
      const step = Math.min(speed, dist * 7);
      sim.shipX += (dx / dist) * step * dt;
      sim.shipY += (dy / dist) * step * dt;
    }
  } else {
    let vx = 0;
    let vy = 0;
    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    if (input.up) vy -= 1;
    if (input.down) vy += 1;
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    sim.shipX += vx * speed * dt;
    sim.shipY += vy * speed * dt;
  }
  sim.shipX = Math.max(16, Math.min(FIELD_W - 16, sim.shipX));
  sim.shipY = Math.max(FIELD_H * 0.4, Math.min(FIELD_H - 24, sim.shipY));
}

export function updateSim(sim: Sim, dt: number, input: InputState) {
  const step = Math.max(0, Math.min(0.033, dt));
  if (sim.shake > 0) sim.shake = Math.max(0, sim.shake - step * 16);

  if (sim.phase === "title") {
    sim.time += step;
    sim.shipX = FIELD_W / 2 + Math.sin(sim.time * 0.9) * 64;
    sim.shipY = FIELD_H * 0.74;
    return;
  }
  if (sim.phase !== "play" || sim.paused) return;

  sim.time += step;
  sim.score = Math.min(MAX_SCORE, sim.score + POINTS_PER_SECOND * step);
  if (sim.grace > 0) sim.grace = Math.max(0, sim.grace - step);
  moveShip(sim, step, input);

  for (const obs of sim.obstacles) {
    obs.y += obs.vy * step;
    if (obs.kind === "rock") obs.spin += step * 0.9;
  }

  if (sim.grace <= 0) {
    for (const obs of sim.obstacles) {
      if (hitsShip(sim, obs)) {
        sim.phase = "over";
        sim.paused = false;
        sim.shake = 10;
        sim.score = Math.floor(sim.score);
        return;
      }
    }
  }

  for (const obs of sim.obstacles) {
    if (!obs.passed && obs.y > sim.shipY) markPass(sim, obs);
  }

  sim.obstacles = sim.obstacles.filter((obs) => obs.y < FIELD_H + 70);
  sim.spawnIn -= step;
  const gateBlocking = sim.obstacles.some((obs) => obs.kind === "gate" && obs.y < sim.shipY);
  if (!gateBlocking && sim.spawnIn <= 0) {
    spawn(sim);
    sim.spawnIn = Math.max(0.62, 1.42 - sim.time * 0.012);
  }

  for (const popup of sim.popups) {
    popup.life -= step;
    popup.y -= 22 * step;
  }
  sim.popups = sim.popups.filter((popup) => popup.life > 0);
}

export function finalScore(sim: Sim) {
  return Math.floor(sim.score);
}

export const RANK_LINES = [
  { name: "Novice", score: NOVICE_SCORE },
  { name: "Pilot", score: PILOT_SCORE },
  { name: "Ace", score: ACE_SCORE },
];
