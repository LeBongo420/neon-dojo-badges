import { ACE_SCORE, FIELD_H, FIELD_W, NOVICE_SCORE, PILOT_SCORE, SHIP_R } from "./constants";
import { drawShadowText } from "./font";
import { gateBars, obstacleCenter, type Sim } from "./sim";
import { spriteImage, type SpriteKey } from "./sprites";

const NAVY = "#070b18";
const CREAM = "#f4ecd8";
const PINK = "#ff4d9a";

const STARS = Array.from({ length: 42 }, (_, i) => ({
  x: (i * 47) % FIELD_W,
  y: (i * 89) % FIELD_H,
  s: i % 6 === 0 ? 2 : 1,
  v: 10 + (i % 5) * 7,
}));

function blit(
  ctx: CanvasRenderingContext2D,
  key: SpriteKey,
  x: number,
  y: number,
  w: number,
  h: number,
  spin = 0,
) {
  const image = spriteImage(key);
  if (!image || !image.complete || image.naturalWidth === 0) return;
  ctx.save();
  ctx.translate(x, y);
  if (spin !== 0) ctx.rotate(spin);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D) {
  const cx = FIELD_W / 2;
  const cy = 86;
  const r = 58;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  for (let y = cy - r; y < cy + r; y += 7) {
    const band = Math.floor((y - (cy - r)) / 7);
    ctx.fillStyle = band % 2 === 0 ? CREAM : PINK;
    ctx.fillRect(cx - r, y, r * 2, 4);
  }
  ctx.restore();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawGrid(ctx: CanvasRenderingContext2D, time: number) {
  const vanishY = FIELD_H * 0.46;
  ctx.strokeStyle = "#8ea0c8";
  ctx.lineWidth = 1;
  const shift = (time * 28) % 28;
  for (let i = 0; i < 9; i += 1) {
    const y = vanishY + i * i * 4.2 + shift;
    if (y > FIELD_H) continue;
    ctx.globalAlpha = Math.min(0.85, (y - vanishY) / 180);
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(FIELD_W - 20, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.45;
  for (let i = -3; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(FIELD_W / 2, vanishY);
    ctx.lineTo(FIELD_W / 2 + i * 70, FIELD_H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  flicker: boolean,
) {
  const thrust = flicker && Math.floor(time * 12) % 2 === 0;
  blit(ctx, thrust ? "shipThrust" : "ship", x, y, 24, 24);
}

function drawRock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  spin: number,
  seed: number,
) {
  blit(ctx, seed % 2 === 0 ? "rock" : "rockB", x, y, r * 2, r * 2, spin);
}

function drawDrone(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  blit(ctx, "drone", x, y, r * 2, r * 2);
}

function drawGate(ctx: CanvasRenderingContext2D, y: number, gapX: number, gapW: number, barH: number) {
  const bars = gateBars({
    kind: "gate",
    x: 0,
    y,
    r: 0,
    vy: 0,
    phase: 0,
    amp: 0,
    spin: 0,
    gapX,
    gapW,
    barH,
    passed: false,
    seed: 0,
  });
  const bar = spriteImage("gateBar");
  for (const rect of bars) {
    if (!bar || !bar.complete || bar.naturalWidth === 0) continue;
    const scale = rect.h / bar.height;
    const tileW = bar.width * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    for (let x = rect.x; x < rect.x + rect.w; x += tileW) {
      ctx.drawImage(bar, x, rect.y, tileW, rect.h);
    }
    ctx.restore();
  }
  const markH = barH;
  const markW = (20 / 32) * barH;
  const gapLeft = gapX - gapW / 2;
  const gapRight = gapX + gapW / 2;
  blit(ctx, "markLeft", gapLeft - markW / 2, y, markW, markH);
  blit(ctx, "markRight", gapRight + markW / 2, y, markW, markH);
}

function drawDemo(ctx: CanvasRenderingContext2D, time: number) {
  drawRock(ctx, 54, 150 + ((time * 24) % 220), 16, time * 0.4, 11);
  drawDrone(ctx, 250 + Math.sin(time) * 20, 210 + ((time * 30) % 160), 11);
  drawGate(ctx, 300 + ((time * 18) % 40), 170, 90, 24);
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  reduceFlash: boolean,
) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, FIELD_W, FIELD_H);
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  gradient.addColorStop(0, "#101433");
  gradient.addColorStop(0.45, NAVY);
  gradient.addColorStop(1, "#160818");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  drawSun(ctx);
  for (const star of STARS) {
    const y = (star.y + sim.time * star.v) % FIELD_H;
    ctx.fillStyle = star.s === 2 ? CREAM : "#c9d0ea";
    ctx.fillRect(star.x, y, star.s, star.s);
  }
  drawGrid(ctx, sim.time);

  ctx.save();
  if (!reduceFlash && sim.shake > 0) {
    const j = sim.shake;
    ctx.translate((Math.random() - 0.5) * j, (Math.random() - 0.5) * j);
  }

  if (sim.phase === "title") drawDemo(ctx, sim.time);
  for (const obs of sim.obstacles) {
    if (obs.kind === "rock") {
      drawRock(ctx, obs.x, obs.y, obs.r, obs.spin, obs.seed);
    } else if (obs.kind === "drone") {
      const center = obstacleCenter(obs, sim.time);
      drawDrone(ctx, center.x, center.y, obs.r);
    } else {
      drawGate(ctx, obs.y, obs.gapX, obs.gapW, obs.barH);
    }
  }

  const blink = sim.grace > 0 && Math.floor(sim.time * 10) % 2 === 0;
  if (!(blink && !reduceFlash)) {
    drawShip(ctx, sim.shipX, sim.shipY, sim.time, sim.phase === "play" && !reduceFlash);
  }
  if (sim.phase === "play" && sim.grace > 0) {
    ctx.strokeStyle = CREAM;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(sim.shipX, sim.shipY, SHIP_R + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    drawShadowText(ctx, "READY", 8, 28, CREAM, 2);
  }

  if (sim.phase === "over") {
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sim.shipX - 8, sim.shipY - 8);
    ctx.lineTo(sim.shipX + 8, sim.shipY + 8);
    ctx.moveTo(sim.shipX + 8, sim.shipY - 8);
    ctx.lineTo(sim.shipX - 8, sim.shipY + 8);
    ctx.stroke();
  }

  for (const popup of sim.popups) {
    drawShadowText(ctx, popup.text, popup.x, popup.y, CREAM, 1);
  }
  ctx.restore();

  if (!reduceFlash) {
    ctx.fillStyle = "rgba(7, 11, 24, 0.18)";
    for (let y = 0; y < FIELD_H; y += 4) ctx.fillRect(0, y, FIELD_W, 1);
  }

  const score = String(Math.floor(sim.score)).padStart(6, "0");
  drawShadowText(ctx, `SCORE ${score}`, 8, 8, CREAM, 2);
  (["novice", "pilot", "ace"] as const).forEach((rank, index) => {
    const need = rank === "novice" ? NOVICE_SCORE : rank === "pilot" ? PILOT_SCORE : ACE_SCORE;
    const x = FIELD_W - 16 - index * 16;
    ctx.save();
    if (sim.score < need) ctx.globalAlpha = 0.4;
    blit(ctx, rank, x, 16, 14, 14);
    ctx.restore();
  });

  if (sim.paused) {
    ctx.fillStyle = "rgba(7, 11, 24, 0.55)";
    ctx.fillRect(0, FIELD_H / 2 - 16, FIELD_W, 28);
    drawShadowText(ctx, "PAUSED", 108, FIELD_H / 2 - 8, CREAM, 2);
  }
}
