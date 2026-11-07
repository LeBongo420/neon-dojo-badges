"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RankMark } from "@/components/rank-mark";
import { FIELD_H, FIELD_W, RANKS, nextRank, ranksReached } from "@/lib/game/constants";
import { createAudio, type DojoAudio } from "@/lib/game/audio";
import { drawFrame } from "@/lib/game/draw";
import { preloadSprites } from "@/lib/game/sprites";
import {
  createSim,
  emptyInput,
  finalScore,
  launch,
  updateSim,
  type InputState,
  type Phase,
} from "@/lib/game/sim";

export interface RunResult {
  score: number;
  dodges: number;
  closeCalls: number;
}

interface Hud {
  phase: Phase;
  paused: boolean;
  score: number;
  dodges: number;
  closeCalls: number;
  grace: boolean;
}

export function GameCanvas({
  reduceFlash,
  soundOn,
  onRunEnd,
  onSave,
  canSave,
}: {
  reduceFlash: boolean;
  soundOn: boolean;
  onRunEnd: (run: RunResult) => void;
  onSave: () => void;
  canSave: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef(createSim(1));
  const inputRef = useRef<InputState>(emptyInput());
  const audioRef = useRef<DojoAudio | null>(null);
  const reported = useRef(false);
  const reduceRef = useRef(reduceFlash);
  const soundRef = useRef(soundOn);
  const onRunEndRef = useRef(onRunEnd);
  reduceRef.current = reduceFlash;
  soundRef.current = soundOn;
  onRunEndRef.current = onRunEnd;

  const [hud, setHud] = useState<Hud>({
    phase: "title",
    paused: false,
    score: 0,
    dodges: 0,
    closeCalls: 0,
    grace: false,
  });

  useEffect(() => {
    preloadSprites();
    simRef.current.rngState = (Math.floor(performance.now()) % 100000) + 1;
    audioRef.current = createAudio();
    return () => audioRef.current?.setEnabled(false);
  }, []);

  useEffect(() => {
    audioRef.current?.setEnabled(soundOn);
  }, [soundOn]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.dataset.ready = "yes";
    ctx.imageSmoothingEnabled = false;
    preloadSprites();
    let frame = 0;
    let last = performance.now();
    let acc = 0;
    let lastPhase: Phase = simRef.current.phase;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sim = simRef.current;
      try {
        if (!document.hidden) updateSim(sim, dt, inputRef.current);
        drawFrame(ctx, sim, reduceRef.current);
        canvas.dataset.frames = String(Number(canvas.dataset.frames ?? "0") + 1);
      } catch (err) {
        canvas.dataset.error = err instanceof Error ? err.message : String(err);
      }
      if (sim.phase === "over" && !reported.current) {
        reported.current = true;
        audioRef.current?.over();
        onRunEndRef.current({
          score: finalScore(sim),
          dodges: sim.dodges,
          closeCalls: sim.closeCalls,
        });
      }
      acc += dt;
      if (sim.phase !== lastPhase || acc > 0.12) {
        lastPhase = sim.phase;
        acc = 0;
        setHud({
          phase: sim.phase,
          paused: sim.paused,
          score: Math.floor(sim.score),
          dodges: sim.dodges,
          closeCalls: sim.closeCalls,
          grace: sim.grace > 0 && sim.phase === "play",
        });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const setKey = (key: string, down: boolean) => {
      const input = inputRef.current;
      const name = key.toLowerCase();
      if (key === "ArrowLeft" || name === "a") input.left = down;
      if (key === "ArrowRight" || name === "d") input.right = down;
      if (key === "ArrowUp" || name === "w") input.up = down;
      if (key === "ArrowDown" || name === "s") input.down = down;
    };
    const onDown = (event: KeyboardEvent) => {
      const sim = simRef.current;
      if (sim.phase === "play" && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
        event.preventDefault();
      }
      setKey(event.key, true);
      if (event.key === "Escape" && sim.phase === "play") {
        sim.paused = !sim.paused;
      }
      if (event.key === "Enter" && sim.phase === "title") start();
    };
    const onUp = (event: KeyboardEvent) => setKey(event.key, false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  function start() {
    reported.current = false;
    launch(simRef.current);
    audioRef.current?.setEnabled(soundRef.current);
    audioRef.current?.launch();
    canvasRef.current?.focus();
  }

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    inputRef.current.pointer = true;
    inputRef.current.pointerX = ((event.clientX - rect.left) / rect.width) * FIELD_W;
    inputRef.current.pointerY = ((event.clientY - rect.top) / rect.height) * FIELD_H;
  }

  const reached = ranksReached(hud.score);
  const upcoming = nextRank(hud.score);
  const live = hud.phase === "play"
    ? `Score ${hud.score.toLocaleString("en-GB")}. ${hud.grace ? "Ready." : ""} ${reached.map((rank) => `${rank.name} reached.`).join(" ")}`
    : hud.phase === "over"
      ? `Game over. Score ${hud.score.toLocaleString("en-GB")}.`
      : "Neon Dojo. Press Launch to fly.";

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={FIELD_W}
          height={FIELD_H}
          tabIndex={0}
          aria-label="Playfield. Steer with arrow keys, WASD, drag, or the direction pad."
          className="playfield aspect-[2/3] w-full rounded-md border-2 border-[var(--border)] bg-[#070b18]"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            pointFromEvent(event);
          }}
          onPointerMove={(event) => {
            if (inputRef.current.pointer) pointFromEvent(event);
          }}
          onPointerUp={() => {
            inputRef.current.pointer = false;
          }}
          onPointerCancel={() => {
            inputRef.current.pointer = false;
          }}
        />
        {hud.phase !== "play" || hud.paused ? (
          <div className="absolute inset-x-0 bottom-0 border-t-2 border-[var(--border)] bg-[#070b18]/95 p-4">
            {hud.phase === "title" ? (
              <div className="flex flex-col gap-3">
                <p className="pixel text-sm text-[#f4ecd8]">NEON DOJO</p>
                <p className="text-base leading-6 text-[#f4ecd8]">
                  Fly the ship. Rocks are jagged, gates are striped bars with a gap, drones are diamonds with wings.
                </p>
                <Button type="button" className="h-12 text-base" onClick={start}>
                  Launch
                </Button>
              </div>
            ) : null}
            {hud.paused ? (
              <div className="flex flex-col gap-3">
                <p className="pixel text-sm text-[#f4ecd8]">PAUSED</p>
                <Button
                  type="button"
                  className="h-12 text-base"
                  onClick={() => {
                    simRef.current.paused = false;
                  }}
                >
                  Resume
                </Button>
              </div>
            ) : null}
            {hud.phase === "over" ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
                    <path d="M6 6 L30 30 M30 6 L6 30" stroke="#f4ecd8" strokeWidth="4" />
                  </svg>
                  <div>
                    <p className="pixel text-sm text-[#f4ecd8]">GAME OVER</p>
                    <p className="text-base text-[#f4ecd8]">
                      Score {hud.score.toLocaleString("en-GB")}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[#d5cbb6]">
                  {hud.dodges} dodges, {hud.closeCalls} close calls.
                  {upcoming
                    ? ` ${upcoming.name} needs ${(upcoming.score - hud.score).toLocaleString("en-GB")} more.`
                    : " Ace rank reached."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {RANKS.map((rank) => {
                    const got = hud.score >= rank.score;
                    return (
                      <div key={rank.id} className="flex items-center gap-2 text-sm text-[#f4ecd8]">
                        <RankMark tier={rank.tier} size={36} earned={got} />
                        <span>{got ? `${rank.name} earned` : rank.name}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="h-12 text-base" onClick={start}>
                    Fly again
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 text-base"
                    disabled={!canSave}
                    onClick={onSave}
                  >
                    Save best on devnet
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="sr-only" aria-live="polite">
        {live}
      </div>
      <DirectionPad
        onChange={(key, down) => {
          if (key === "left") inputRef.current.left = down;
          if (key === "right") inputRef.current.right = down;
          if (key === "up") inputRef.current.up = down;
          if (key === "down") inputRef.current.down = down;
        }}
        onPause={() => {
          if (simRef.current.phase === "play") simRef.current.paused = !simRef.current.paused;
        }}
      />
    </div>
  );
}

function DirectionPad({
  onChange,
  onPause,
}: {
  onChange: (key: "left" | "right" | "up" | "down", down: boolean) => void;
  onPause: () => void;
}) {
  const bind = (key: "left" | "right" | "up" | "down") => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onChange(key, true);
    },
    onPointerUp: () => onChange(key, false),
    onPointerLeave: () => onChange(key, false),
    onPointerCancel: () => onChange(key, false),
  });
  const padButton = "h-12 min-h-12 w-full min-w-11 touch-manipulation text-base";
  return (
    <div className="grid grid-cols-3 gap-2 touch-none" aria-label="Direction pad">
      <span />
      <Button type="button" variant="outline" className={padButton} {...bind("up")}>
        Up
      </Button>
      <span />
      <Button type="button" variant="outline" className={padButton} {...bind("left")}>
        Left
      </Button>
      <Button type="button" variant="secondary" className={padButton} onClick={onPause}>
        Pause
      </Button>
      <Button type="button" variant="outline" className={padButton} {...bind("right")}>
        Right
      </Button>
      <span />
      <Button type="button" variant="outline" className={padButton} {...bind("down")}>
        Down
      </Button>
      <span />
    </div>
  );
}
