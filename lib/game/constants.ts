export const FIELD_W = 320;
export const FIELD_H = 480;
export const SHIP_R = 7;

export const POINTS_PER_SECOND = 18;
export const DODGE_POINTS = 35;
export const CLOSE_POINTS = 20;

export const NOVICE_SCORE = 500;
export const PILOT_SCORE = 1_500;
export const ACE_SCORE = 3_000;
export const MAX_SCORE = 1_000_000;

export const PROGRAM_ID = "EoShEYPGFAarnDTUAQXDxHnQhNkb69vUxVgiErLFRSRd";
export const DEVNET_RPC = "https://api.devnet.solana.com";
export const DEVNET_EXPLORER = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`;

export const RANKS = [
  {
    id: "novice",
    tier: 0,
    name: "Novice",
    score: NOVICE_SCORE,
    shape: "Circle",
    chevrons: 1,
  },
  {
    id: "pilot",
    tier: 1,
    name: "Pilot",
    score: PILOT_SCORE,
    shape: "Hexagon",
    chevrons: 2,
  },
  {
    id: "ace",
    tier: 2,
    name: "Ace",
    score: ACE_SCORE,
    shape: "Star",
    chevrons: 3,
  },
] as const;

export type RankId = (typeof RANKS)[number]["id"];
export type RankTier = 0 | 1 | 2;

export function ranksReached(score: number) {
  return RANKS.filter((rank) => score >= rank.score);
}

export function nextRank(score: number) {
  return RANKS.find((rank) => score < rank.score) ?? null;
}
