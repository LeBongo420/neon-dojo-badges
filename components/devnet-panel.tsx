"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Button } from "@/components/ui/button";
import { RankMark } from "@/components/rank-mark";
import { DEVNET_EXPLORER, RANKS } from "@/lib/game/constants";
import type { DojoChain } from "@/lib/chain/use-dojo";
import type { RunResult } from "@/components/game-canvas";

function shortKey(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function DevnetPanel({
  chain,
  run,
  visitBest,
  soundOn,
  reduceFlash,
  onToggleSound,
  onToggleFlash,
}: {
  chain: DojoChain;
  run: RunResult | null;
  visitBest: number;
  soundOn: boolean;
  reduceFlash: boolean;
  onToggleSound: () => void;
  onToggleFlash: () => void;
}) {
  return (
    <section className="flex flex-col gap-5" aria-label="Devnet scores and badges">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 border-2 border-[#7ef0c8] px-3 py-2 text-sm font-semibold text-[#f4ecd8]">
          <span className="inline-block size-3 bg-[#f4ecd8]" aria-hidden="true" />
          Solana devnet
        </span>
        <a className="text-sm underline" href={DEVNET_EXPLORER}>
          View program
        </a>
      </div>
      <p className="text-base leading-6 text-[#f4ecd8]">
        Set the wallet to Devnet before you approve a transaction. Phantom: Settings, Developer Settings, then Solana Devnet. This page never talks to mainnet. Badges are free. No real money.
      </p>
      <div className="wallet-slot">
        <WalletMultiButton />
      </div>
      <p className="text-sm text-[#d5cbb6]" aria-live="polite">
        {chain.wallet ? `Wallet ${shortKey(chain.wallet)}. ` : "Wallet not connected. "}
        {chain.programReady === false ? "Program not found on devnet yet. " : ""}
        {chain.message}
      </p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="border border-[var(--border)] p-3">
          <dt className="text-[#d5cbb6]">This run</dt>
          <dd className="text-2xl text-[#f4ecd8]">{run ? run.score.toLocaleString("en-GB") : "—"}</dd>
        </div>
        <div className="border border-[var(--border)] p-3">
          <dt className="text-[#d5cbb6]">Best on this browser</dt>
          <dd className="text-2xl text-[#f4ecd8]">{visitBest.toLocaleString("en-GB")}</dd>
        </div>
        <div className="border border-[var(--border)] p-3">
          <dt className="text-[#d5cbb6]">Best on devnet</dt>
          <dd className="text-2xl text-[#f4ecd8]">
            {chain.onChainBest === null ? "—" : chain.onChainBest.toLocaleString("en-GB")}
          </dd>
        </div>
        <div className="border border-[var(--border)] p-3">
          <dt className="text-[#d5cbb6]">Program</dt>
          <dd className="text-base text-[#f4ecd8]">
            {chain.programReady === null ? "Checking" : chain.programReady ? "Deployed" : "Not deployed"}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-11"
          disabled={!run || chain.busy || !chain.connected}
          onClick={() => run && void chain.saveScore(run.score)}
        >
          Save best score
        </Button>
        <Button type="button" variant="outline" className="h-11" disabled={chain.busy || !chain.connected} onClick={() => void chain.airdrop()}>
          Request devnet SOL
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={onToggleSound}>
          {soundOn ? "Sound on" : "Sound off"}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={onToggleFlash}>
          {reduceFlash ? "Calm effects on" : "Calm effects off"}
        </Button>
      </div>
      <div>
        <h2 className="pixel mb-3 text-sm text-[#f4ecd8]">Badges</h2>
        <ul className="flex flex-col gap-3">
          {RANKS.map((rank) => {
            const claimed = chain.claims.find((item) => item.tier === rank.tier);
            const saved = chain.onChainBest ?? 0;
            const eligible = saved >= rank.score;
            let detail = `Needs a saved score of ${rank.score.toLocaleString("en-GB")}.`;
            if (!chain.connected) detail = "Connect a wallet to claim.";
            else if (claimed) detail = `Claimed. Mint ${shortKey(claimed.mint)}.`;
            else if (eligible) detail = "Ready to claim. One per wallet.";
            else if (chain.onChainBest !== null) {
              detail = `Saved ${saved.toLocaleString("en-GB")}. Need ${rank.score.toLocaleString("en-GB")}.`;
            }
            return (
              <li key={rank.id} className="flex items-center gap-3 border border-[var(--border)] p-3">
                <RankMark tier={rank.tier} size={56} earned={Boolean(claimed) || eligible} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-[#f4ecd8]">
                    {rank.name}
                    <span className="ml-2 text-sm font-normal text-[#d5cbb6]">
                      {rank.shape}, {rank.chevrons} chevron{rank.chevrons === 1 ? "" : "s"} up
                    </span>
                  </p>
                  <p className="text-sm text-[#d5cbb6]">{detail}</p>
                </div>
                <Button
                  type="button"
                  className="h-11"
                  disabled={chain.busy || !chain.connected || !eligible || Boolean(claimed)}
                  onClick={() => void chain.claim(rank.tier)}
                >
                  {claimed ? "Claimed" : `Claim ${rank.name}`}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <h2 className="pixel mb-3 text-sm text-[#f4ecd8]">Leaderboard</h2>
        {chain.board.length === 0 ? (
          <p className="text-sm text-[#d5cbb6]">No saved scores yet. Finish a run and save your best.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {chain.board.map((row, index) => (
              <li key={`${row.player}-${index}`} className="flex items-center justify-between gap-3 border border-[var(--border)] px-3 py-2 text-sm">
                <span className="text-[#d5cbb6]">{index + 1}. {shortKey(row.player)}</span>
                <span className="font-semibold text-[#f4ecd8]">{row.score.toLocaleString("en-GB")}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div>
        <h2 className="pixel mb-2 text-sm text-[#f4ecd8]">How to read the field</h2>
        <ul className="flex flex-col gap-2 text-sm leading-6 text-[#f4ecd8]">
          <li>Jagged outline: rock. It falls straight.</li>
          <li>Striped bars with inward marks: neon gate. Fly the gap.</li>
          <li>Diamond with side wings and a square eye: drone. It weaves left and right.</li>
          <li>A hit ends the run. Score grows while you last, plus a bonus for each dodge.</li>
        </ul>
      </div>
    </section>
  );
}
