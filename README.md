# Neon Dojo Badges

A top-down 8-bit dodge game for the MLH x Solana hackathon (hacking opened Friday 6 Nov 2026, 17:00 UK). You fly a small ship through a navy synthwave field, dodge rocks, neon gates, and drones, then save a best score on Solana devnet and claim a free badge.

This is devnet only. There is no mainnet config, no payment, and no real money.

Play it here: https://lebongo420.github.io/neon-dojo-badges/

## How to play

Launch, then steer with the arrow keys or WASD. On a phone, drag inside the playfield, or use the on-screen pad labeled Up, Down, Left, and Right. Those buttons are 48px tall. Pause sits in the middle of the pad.

The run ends when the ship touches a hazard. Score climbs while you last, plus a bonus for every hazard that passes you. A close pass adds a bit more and shows the word CLOSE.

| Rank | Shape | Chevrons | Best score |
| --- | --- | --- | --- |
| Novice | Circle | 1, pointing up | 500 |
| Pilot | Hexagon | 2, pointing up | 1,500 |
| Ace | Star | 3, pointing up | 3,000 |

Colour is never the only cue. Rocks are jagged, gates are striped bars with a gap and inward marks, and drones are diamonds with wings and a square eye. Ranks differ by shape and by how many chevrons they carry. Sound stays off until you turn it on.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:43123

A static export (no Pages subpath) is:

```bash
npm run build
npm run start
```

That serves the `out/` folder on port 43123. The GitHub Pages build sets `NEXT_PUBLIC_BASE_PATH=/neon-dojo-badges` so scripts and pictures load under that subpath. The workflow in `.github/workflows/pages.yml` does that on every push to `main`.

## On-chain score and badges

The Anchor program in `programs/neon_dojo` is written and wired to the site. It stores a wallet's best score only when the new score is higher, keeps a top-10 board, and mints one free badge NFT per rank (Novice 500, Pilot 1500, Ace 3000). Each mint is a 1-of-1 token with the mint authority revoked. No payment.

It is not live on devnet yet. A deploy needs about 1.3 test SOL, and the public devnet faucets did not provide it. The site says "Not deployed" until someone with devnet SOL runs:

```bash
solana-keygen new -o ~/.config/solana/neon-dojo-deployer.json --no-bip39-passphrase
solana config set --url devnet --keypair ~/.config/solana/neon-dojo-deployer.json
solana airdrop 2

anchor build
cargo test -p neon-dojo --lib
anchor deploy --provider.cluster devnet
cp target/idl/neon_dojo.json public/idl/neon_dojo.json
```

Do not commit the deployer key. The published program id is `EoShEYPGFAarnDTUAQXDxHnQhNkb69vUxVgiErLFRSRd`. After a fresh `anchor build` without the original program keypair, Anchor may create a new id. Copy that id into `lib/game/constants.ts` and `Anchor.toml` if you deploy your own copy.

After a run, switch Phantom or Solflare to Solana Devnet, connect, get devnet SOL from the Solana faucet, save the best score, then claim each rank once. Scores are reported by the browser. The program does not replay the game.

## AI disclosure

Grokky (a Grok Bot coding assistant running in Cursor) wrote the game, website, and Solana program. Pixy made the in-event pixel art. No artwork from before Friday 6 November 2026 5:00pm UK was used in the submitted game.
