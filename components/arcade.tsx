"use client";

import { useEffect, useState } from "react";
import { DevnetPanel } from "@/components/devnet-panel";
import { GameCanvas, type RunResult } from "@/components/game-canvas";
import { WalletProviders } from "@/components/wallet-providers";
import { useDojoChain } from "@/lib/chain/use-dojo";

const LOCAL_BEST = "neon-dojo-visit-best";

function Cabinet() {
  const chain = useDojoChain();
  const [run, setRun] = useState<RunResult | null>(null);
  const [visitBest, setVisitBest] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [reduceFlash, setReduceFlash] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.hydrated = "yes";
    const stored = Number(window.localStorage.getItem(LOCAL_BEST) ?? "0");
    const prefersCalm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      if (Number.isFinite(stored)) setVisitBest(stored);
      if (prefersCalm) setReduceFlash(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function finish(next: RunResult) {
    setRun(next);
    setVisitBest((current) => {
      const best = Math.max(current, next.score);
      window.localStorage.setItem(LOCAL_BEST, String(best));
      return best;
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold tracking-wide text-[#d5cbb6]">MLH x Solana hackathon</p>
        <h1 className="pixel text-2xl text-[#f4ecd8] sm:text-3xl">NEON DOJO BADGES</h1>
        <p className="max-w-2xl text-base leading-7 text-[#f4ecd8]">
          A top-down dodge run. Stay alive, save your best score on Solana devnet, and claim a free Novice, Pilot, or Ace badge.
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[440px_minmax(0,1fr)]">
        <GameCanvas
          reduceFlash={reduceFlash}
          soundOn={soundOn}
          onRunEnd={finish}
          canSave={Boolean(run) && chain.connected && !chain.busy}
          onSave={() => {
            if (run) void chain.saveScore(run.score);
          }}
        />
        <DevnetPanel
          chain={chain}
          run={run}
          visitBest={visitBest}
          soundOn={soundOn}
          reduceFlash={reduceFlash}
          onToggleSound={() => setSoundOn((value) => !value)}
          onToggleFlash={() => setReduceFlash((value) => !value)}
        />
      </div>
    </div>
  );
}

export function Arcade() {
  return (
    <WalletProviders>
      <Cabinet />
    </WalletProviders>
  );
}
