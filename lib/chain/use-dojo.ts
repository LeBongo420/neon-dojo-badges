"use client";

import "@/lib/chain/buffer-polyfill";
import { AnchorError, AnchorProvider, BN, Program, type Idl } from "@anchor-lang/core";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { publicPath } from "@/lib/base-path";
import { PROGRAM_ID, RANKS, type RankTier } from "@/lib/game/constants";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const PROGRAM = new PublicKey(PROGRAM_ID);

export interface BoardRow {
  player: string;
  score: number;
}

export interface ClaimedBadge {
  tier: RankTier;
  mint: string;
}

export interface DojoChain {
  connected: boolean;
  wallet: string | null;
  onChainBest: number | null;
  claims: ClaimedBadge[];
  board: BoardRow[];
  programReady: boolean | null;
  busy: boolean;
  message: string;
  refresh: () => Promise<void>;
  saveScore: (score: number) => Promise<void>;
  claim: (tier: RankTier) => Promise<void>;
  airdrop: () => Promise<void>;
}

interface MethodBuilder {
  accounts(accounts: Record<string, PublicKey>): MethodBuilder;
  preInstructions(ixs: ReturnType<typeof ComputeBudgetProgram.setComputeUnitLimit>[]): MethodBuilder;
  rpc(): Promise<string>;
}

function pda(seeds: Uint8Array[], program: PublicKey) {
  return PublicKey.findProgramAddressSync(seeds, program)[0];
}

function explain(err: unknown) {
  if (err instanceof AnchorError) return err.error.errorMessage;
  const text = err instanceof Error ? err.message : String(err);
  if (/user rejected|rejected the request/i.test(text)) return "The wallet closed the request.";
  if (/insufficient|0x1\b|debit/i.test(text)) {
    return "This wallet needs devnet SOL for the fee. Request devnet SOL below. No real money is used.";
  }
  if (/ScoreNotHigher|not higher/i.test(text)) {
    return "Devnet already has this score or a higher one for this wallet.";
  }
  if (/ScoreTooLow|below this badge/i.test(text)) {
    return "The saved devnet score is still below this rank.";
  }
  if (/already in use|already been processed/i.test(text)) {
    return "That badge is already claimed for this wallet.";
  }
  if (/BadUri|art link/i.test(text)) {
    return "Open the app at localhost, 127.0.0.1, or an https address so the badge art link is accepted.";
  }
  if (/IDL missing|program description/i.test(text)) return text;
  return text.replace(/\s+/g, " ").slice(0, 280);
}

async function loadIdl() {
  const response = await fetch(publicPath("/idl/neon_dojo.json"));
  if (!response.ok) {
    throw new Error("The on-chain program description is not loaded. You can still play.");
  }
  return (await response.json()) as Idl;
}

export function useDojoChain(): DojoChain {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [onChainBest, setOnChainBest] = useState<number | null>(null);
  const [claims, setClaims] = useState<ClaimedBadge[]>([]);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [programReady, setProgramReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Connect a wallet on Solana devnet to save a score.");

  const refresh = useCallback(async () => {
    try {
      const programInfo = await connection.getAccountInfo(PROGRAM);
      setProgramReady(Boolean(programInfo?.executable));
      const idl = await loadIdl();
      const provider = new AnchorProvider(connection, wallet ?? {
        publicKey: PublicKey.default,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (tx) => tx,
      }, { commitment: "confirmed" });
      const program = new Program(idl, provider);
      const accounts = program.account as unknown as {
        board: { fetchNullable: (address: PublicKey) => Promise<{ entries: { player: PublicKey; score: BN }[] } | null> };
        playerScore: { fetchNullable: (address: PublicKey) => Promise<{ bestScore: BN; owner: PublicKey } | null> };
        badgeClaim: { fetchNullable: (address: PublicKey) => Promise<{ tier: number; mint: PublicKey } | null> };
      };
      const boardAccount = await accounts.board.fetchNullable(pda([new TextEncoder().encode("board")], PROGRAM));
      const rows = (boardAccount?.entries ?? [])
        .map((entry) => ({
          player: entry.player.toBase58(),
          score: Number(entry.score.toString()),
        }))
        .filter((entry) => entry.score > 0);
      setBoard(rows);

      if (!wallet) {
        setOnChainBest(null);
        setClaims([]);
        return;
      }
      const scoreAccount = await accounts.playerScore.fetchNullable(
        pda([new TextEncoder().encode("score"), wallet.publicKey.toBytes()], PROGRAM),
      );
      setOnChainBest(scoreAccount ? Number(scoreAccount.bestScore.toString()) : 0);
      const found: ClaimedBadge[] = [];
      for (const rank of RANKS) {
        const claim = await accounts.badgeClaim.fetchNullable(
          pda(
            [new TextEncoder().encode("badge"), wallet.publicKey.toBytes(), Uint8Array.from([rank.tier])],
            PROGRAM,
          ),
        );
        if (claim) found.push({ tier: rank.tier, mint: claim.mint.toBase58() });
      }
      setClaims(found);
      if (!programInfo?.executable) {
        setMessage("This devnet address has no program yet. Play locally, or deploy with the README steps.");
      } else if (!scoreAccount) {
        setMessage("No devnet score for this wallet yet.");
      } else {
        setMessage(`Best score on devnet: ${Number(scoreAccount.bestScore.toString()).toLocaleString("en-GB")}.`);
      }
    } catch (err) {
      setMessage(explain(err));
    }
  }, [connection, wallet]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const withProgram = useCallback(async () => {
    if (!wallet) throw new Error("Connect a devnet wallet first.");
    const idl = await loadIdl();
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    return { program: new Program(idl, provider), wallet };
  }, [connection, wallet]);

  const saveScore = useCallback(async (score: number) => {
    setBusy(true);
    try {
      const { program, wallet: signer } = await withProgram();
      const methods = program.methods as unknown as {
        submitScore: (score: BN) => MethodBuilder;
      };
      const signature = await methods
        .submitScore(new BN(score))
        .accounts({
          player: signer.publicKey,
          playerScore: pda([new TextEncoder().encode("score"), signer.publicKey.toBytes()], PROGRAM),
          board: pda([new TextEncoder().encode("board")], PROGRAM),
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      setMessage(`Saved on devnet. Transaction ${signature.slice(0, 8)}…`);
      await refresh();
    } catch (err) {
      setMessage(explain(err));
    } finally {
      setBusy(false);
    }
  }, [refresh, withProgram]);

  const claim = useCallback(async (tier: RankTier) => {
    setBusy(true);
    try {
      const { program, wallet: signer } = await withProgram();
      const rank = RANKS[tier];
      const origin = window.location.origin;
      const uri = `${origin}${publicPath(`/badges/${rank.id}`)}`;
      const tierSeed = Uint8Array.from([tier]);
      const mint = pda([new TextEncoder().encode("mint"), signer.publicKey.toBytes(), tierSeed], PROGRAM);
      const methods = program.methods as unknown as {
        claimBadge: (tier: number, uri: string) => MethodBuilder;
      };
      const signature = await methods
        .claimBadge(tier, uri)
        .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })])
        .accounts({
          player: signer.publicKey,
          playerScore: pda([new TextEncoder().encode("score"), signer.publicKey.toBytes()], PROGRAM),
          badgeClaim: pda([new TextEncoder().encode("badge"), signer.publicKey.toBytes(), tierSeed], PROGRAM),
          mint,
          mintAuthority: pda([new TextEncoder().encode("mint-auth"), signer.publicKey.toBytes(), tierSeed], PROGRAM),
          tokenAccount: pda(
            [signer.publicKey.toBytes(), TOKEN_PROGRAM.toBytes(), mint.toBytes()],
            ATA_PROGRAM,
          ),
          metadata: pda(
            [new TextEncoder().encode("metadata"), METADATA_PROGRAM.toBytes(), mint.toBytes()],
            METADATA_PROGRAM,
          ),
          masterEdition: pda(
            [
              new TextEncoder().encode("metadata"),
              METADATA_PROGRAM.toBytes(),
              mint.toBytes(),
              new TextEncoder().encode("edition"),
            ],
            METADATA_PROGRAM,
          ),
          tokenProgram: TOKEN_PROGRAM,
          associatedTokenProgram: ATA_PROGRAM,
          tokenMetadataProgram: METADATA_PROGRAM,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      setMessage(`${rank.name} badge claimed. Transaction ${signature.slice(0, 8)}…`);
      await refresh();
    } catch (err) {
      setMessage(explain(err));
    } finally {
      setBusy(false);
    }
  }, [refresh, withProgram]);

  const airdrop = useCallback(async () => {
    if (!wallet) {
      setMessage("Connect a wallet before requesting devnet SOL.");
      return;
    }
    setBusy(true);
    try {
      const signature = await connection.requestAirdrop(wallet.publicKey, 1_000_000_000);
      await connection.confirmTransaction(signature, "confirmed");
      setMessage("Devnet SOL requested. It can take a moment to show in the wallet. No real money.");
    } catch (err) {
      setMessage(`Devnet faucet refused the request. Try again shortly, or use faucet.solana.com. ${explain(err)}`);
    } finally {
      setBusy(false);
    }
  }, [connection, wallet]);

  return {
    connected: Boolean(wallet),
    wallet: wallet ? wallet.publicKey.toBase58() : null,
    onChainBest,
    claims,
    board,
    programReady,
    busy,
    message,
    refresh,
    saveScore,
    claim,
    airdrop,
  };
}
