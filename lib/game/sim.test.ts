import assert from "node:assert/strict";
import test from "node:test";
import {
  ACE_SCORE,
  NOVICE_SCORE,
  PILOT_SCORE,
  ranksReached,
} from "./constants";
import {
  createSim,
  emptyInput,
  hitsShip,
  launch,
  updateSim,
  type Obstacle,
} from "./sim";

function rock(partial: Partial<Obstacle>): Obstacle {
  return {
    kind: "rock",
    x: 100,
    y: 200,
    r: 12,
    vy: 0,
    phase: 0,
    amp: 0,
    spin: 0,
    gapX: 0,
    gapW: 0,
    barH: 0,
    passed: false,
    seed: 3,
    ...partial,
  };
}

test("a rock on the ship ends the run", () => {
  const sim = createSim(4);
  launch(sim);
  sim.grace = 0;
  sim.shipX = 100;
  sim.shipY = 200;
  sim.obstacles = [rock({ x: 100, y: 200, r: 12 })];
  updateSim(sim, 0.016, emptyInput());
  assert.equal(sim.phase, "over");
  assert.equal(hitsShip(sim, sim.obstacles[0]!), true);
});

test("grace time ignores a collision", () => {
  const sim = createSim(4);
  launch(sim);
  sim.grace = 1;
  sim.shipX = 100;
  sim.shipY = 200;
  sim.obstacles = [rock({ x: 100, y: 200 })];
  updateSim(sim, 0.016, emptyInput());
  assert.equal(sim.phase, "play");
});

test("a rock that falls past the ship counts as a dodge", () => {
  const sim = createSim(4);
  launch(sim);
  sim.grace = 0;
  sim.shipX = 30;
  sim.shipY = 200;
  sim.obstacles = [rock({ x: 220, y: 198, r: 12, vy: 200 })];
  updateSim(sim, 0.016, emptyInput());
  assert.equal(sim.phase, "play");
  assert.equal(sim.dodges, 1);
  assert.ok(sim.score > 18);
});

test("the gate gap is safe and the bar is not", () => {
  const sim = createSim(2);
  launch(sim);
  sim.grace = 0;
  const gate: Obstacle = {
    kind: "gate",
    x: 160,
    y: 200,
    r: 0,
    vy: 0,
    phase: 0,
    amp: 0,
    spin: 0,
    gapX: 160,
    gapW: 80,
    barH: 30,
    passed: false,
    seed: 0,
  };
  sim.shipX = 160;
  sim.shipY = 200;
  sim.obstacles = [gate];
  assert.equal(hitsShip(sim, gate), false);
  sim.shipX = 30;
  assert.equal(hitsShip(sim, gate), true);
});

test("ranks use the shared score thresholds", () => {
  assert.deepEqual(
    ranksReached(499).map((rank) => rank.name),
    [],
  );
  assert.deepEqual(
    ranksReached(NOVICE_SCORE).map((rank) => rank.name),
    ["Novice"],
  );
  assert.deepEqual(
    ranksReached(PILOT_SCORE).map((rank) => rank.name),
    ["Novice", "Pilot"],
  );
  assert.deepEqual(
    ranksReached(ACE_SCORE).map((rank) => rank.name),
    ["Novice", "Pilot", "Ace"],
  );
});
