//! Neon Dojo on Solana devnet: a wallet's best score, plus one free badge NFT
//! per rank (Novice, Pilot, Ace). No payment. Scores are whatever the player
//! reports; the game is client-side, so this is an honor-system record.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3, mpl_token_metadata,
        CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata,
    },
    token::{self, spl_token, Mint, MintTo, SetAuthority, Token, TokenAccount},
};

declare_id!("EoShEYPGFAarnDTUAQXDxHnQhNkb69vUxVgiErLFRSRd");

pub mod constants {
    use super::*;

    #[constant]
    pub const NOVICE_SCORE: u64 = 500;
    #[constant]
    pub const PILOT_SCORE: u64 = 1_500;
    #[constant]
    pub const ACE_SCORE: u64 = 3_000;
    #[constant]
    pub const MAX_SCORE: u64 = 1_000_000;

    pub const TIER_NOVICE: u8 = 0;
    pub const TIER_PILOT: u8 = 1;
    pub const TIER_ACE: u8 = 2;

    pub const SCORE_SEED: &[u8] = b"score";
    pub const BOARD_SEED: &[u8] = b"board";
    pub const BADGE_SEED: &[u8] = b"badge";
    pub const MINT_SEED: &[u8] = b"mint";
    pub const MINT_AUTH_SEED: &[u8] = b"mint-auth";

    pub const BOARD_LEN: usize = 10;
}

pub mod error {
    use super::*;

    #[error_code]
    pub enum NeonDojoError {
        #[msg("Score must be between 1 and 1000000")]
        ScoreOutOfRange,
        #[msg("Score is not higher than the saved best")]
        ScoreNotHigher,
        #[msg("Unknown badge tier")]
        BadTier,
        #[msg("Best score is below this badge")]
        ScoreTooLow,
        #[msg("Score account does not belong to this wallet")]
        WrongPlayer,
        #[msg("Badge art link must be a short localhost or https URL for this rank")]
        BadUri,
        #[msg("Metadata account is not the expected PDA")]
        BadMetadata,
    }
}

pub mod state {
    use super::*;

    #[account]
    #[derive(InitSpace)]
    pub struct PlayerScore {
        pub owner: Pubkey,
        pub best_score: u64,
        pub updated_at: i64,
        pub bump: u8,
    }

    #[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
    pub struct BoardEntry {
        pub player: Pubkey,
        pub score: u64,
    }

    #[account]
    #[derive(InitSpace)]
    pub struct Board {
        pub entries: [BoardEntry; 10],
        pub bump: u8,
    }

    #[account]
    #[derive(InitSpace)]
    pub struct BadgeClaim {
        pub owner: Pubkey,
        pub tier: u8,
        pub mint: Pubkey,
        pub claimed_at: i64,
        pub bump: u8,
    }
}

use constants::*;
use error::NeonDojoError;
use state::{BadgeClaim, Board, PlayerScore};

#[program]
pub mod neon_dojo {
    use super::*;

    pub fn submit_score(ctx: Context<SubmitScore>, score: u64) -> Result<()> {
        require!(
            score > 0 && score <= MAX_SCORE,
            NeonDojoError::ScoreOutOfRange
        );

        let clock = Clock::get()?;
        let record = &mut ctx.accounts.player_score;
        let previous = record.best_score;
        if record.owner == Pubkey::default() {
            record.owner = ctx.accounts.player.key();
            record.bump = ctx.bumps.player_score;
            record.best_score = 0;
        }
        require!(
            record.owner == ctx.accounts.player.key(),
            NeonDojoError::WrongPlayer
        );
        require!(score > previous, NeonDojoError::ScoreNotHigher);

        record.best_score = score;
        record.updated_at = clock.unix_timestamp;
        record.bump = ctx.bumps.player_score;

        let board = &mut ctx.accounts.board;
        if board.bump == 0 {
            board.bump = ctx.bumps.board;
        }
        place_on_board(board, ctx.accounts.player.key(), score);
        msg!("Neon Dojo best score {} saved", score);
        Ok(())
    }

    pub fn claim_badge(ctx: Context<ClaimBadge>, tier: u8, uri: String) -> Result<()> {
        let threshold = threshold_for(tier)?;
        require!(
            ctx.accounts.player_score.best_score >= threshold,
            NeonDojoError::ScoreTooLow
        );
        validate_uri(&uri, tier)?;
        check_metadata_pdas(&ctx, tier)?;

        let player_key = ctx.accounts.player.key();
        let tier_bytes = [tier];
        let auth_bump = [ctx.bumps.mint_authority];
        let signer_seeds: &[&[u8]] = &[
            MINT_AUTH_SEED,
            player_key.as_ref(),
            &tier_bytes,
            &auth_bump,
        ];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                &[signer_seeds],
            ),
            1,
        )?;

        let name = tier_name(tier)?.to_string();
        create_metadata_accounts_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.key(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.metadata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    mint_authority: ctx.accounts.mint_authority.to_account_info(),
                    payer: ctx.accounts.player.to_account_info(),
                    update_authority: ctx.accounts.mint_authority.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                &[signer_seeds],
            ),
            mpl_token_metadata::types::DataV2 {
                name,
                symbol: "DOJO".to_string(),
                uri,
                seller_fee_basis_points: 0,
                creators: None,
                collection: None,
                uses: None,
            },
            false,
            true,
            None,
        )?;

        create_master_edition_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.key(),
                CreateMasterEditionV3 {
                    edition: ctx.accounts.master_edition.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    update_authority: ctx.accounts.mint_authority.to_account_info(),
                    mint_authority: ctx.accounts.mint_authority.to_account_info(),
                    payer: ctx.accounts.player.to_account_info(),
                    metadata: ctx.accounts.metadata.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                &[signer_seeds],
            ),
            Some(0),
        )?;

        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                SetAuthority {
                    current_authority: ctx.accounts.mint_authority.to_account_info(),
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                },
                &[signer_seeds],
            ),
            spl_token::instruction::AuthorityType::MintTokens,
            None,
        )?;
        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                SetAuthority {
                    current_authority: ctx.accounts.mint_authority.to_account_info(),
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                },
                &[signer_seeds],
            ),
            spl_token::instruction::AuthorityType::FreezeAccount,
            None,
        )?;

        let claim = &mut ctx.accounts.badge_claim;
        claim.owner = player_key;
        claim.tier = tier;
        claim.mint = ctx.accounts.mint.key();
        claim.claimed_at = Clock::get()?.unix_timestamp;
        claim.bump = ctx.bumps.badge_claim;
        msg!("Neon Dojo badge tier {} claimed", tier);
        Ok(())
    }
}

fn threshold_for(tier: u8) -> Result<u64> {
    match tier {
        TIER_NOVICE => Ok(NOVICE_SCORE),
        TIER_PILOT => Ok(PILOT_SCORE),
        TIER_ACE => Ok(ACE_SCORE),
        _ => err!(NeonDojoError::BadTier),
    }
}

fn tier_name(tier: u8) -> Result<&'static str> {
    match tier {
        TIER_NOVICE => Ok("Neon Dojo Novice"),
        TIER_PILOT => Ok("Neon Dojo Pilot"),
        TIER_ACE => Ok("Neon Dojo Ace"),
        _ => err!(NeonDojoError::BadTier),
    }
}

fn validate_uri(uri: &str, tier: u8) -> Result<()> {
    require!(
        !uri.is_empty() && uri.len() <= 200,
        NeonDojoError::BadUri
    );
    require!(
        !uri.chars().any(|c| c.is_whitespace()),
        NeonDojoError::BadUri
    );
    require!(!uri.contains(".."), NeonDojoError::BadUri);
    let prefix_ok = uri.starts_with("https://")
        || uri.starts_with("http://127.0.0.1:")
        || uri.starts_with("http://localhost:")
        || uri.starts_with("http://0.0.0.0:");
    require!(prefix_ok, NeonDojoError::BadUri);
    let suffix = match tier {
        TIER_NOVICE => "/badges/novice",
        TIER_PILOT => "/badges/pilot",
        TIER_ACE => "/badges/ace",
        _ => return err!(NeonDojoError::BadTier),
    };
    require!(uri.ends_with(suffix), NeonDojoError::BadUri);
    Ok(())
}

fn check_metadata_pdas(ctx: &Context<ClaimBadge>, _tier: u8) -> Result<()> {
    let mint_key = ctx.accounts.mint.key();
    let (metadata_pda, _) = Pubkey::find_program_address(
        &[
            b"metadata",
            mpl_token_metadata::ID.as_ref(),
            mint_key.as_ref(),
        ],
        &mpl_token_metadata::ID,
    );
    require_keys_eq!(
        ctx.accounts.metadata.key(),
        metadata_pda,
        NeonDojoError::BadMetadata
    );
    let (edition_pda, _) = Pubkey::find_program_address(
        &[
            b"metadata",
            mpl_token_metadata::ID.as_ref(),
            mint_key.as_ref(),
            b"edition",
        ],
        &mpl_token_metadata::ID,
    );
    require_keys_eq!(
        ctx.accounts.master_edition.key(),
        edition_pda,
        NeonDojoError::BadMetadata
    );
    Ok(())
}

fn place_on_board(board: &mut Board, player: Pubkey, score: u64) {
    if let Some(existing) = board.entries.iter_mut().find(|entry| entry.player == player) {
        if score > existing.score {
            existing.score = score;
        }
    } else if let Some(slot) = board.entries.iter_mut().find(|entry| entry.score == 0) {
        slot.player = player;
        slot.score = score;
    } else if let Some(lowest) = board
        .entries
        .iter_mut()
        .min_by_key(|entry| entry.score)
    {
        if score > lowest.score {
            lowest.player = player;
            lowest.score = score;
        }
    }
    board.entries.sort_by(|a, b| b.score.cmp(&a.score));
}

#[derive(Accounts)]
pub struct SubmitScore<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        init_if_needed,
        payer = player,
        space = 8 + PlayerScore::INIT_SPACE,
        seeds = [SCORE_SEED, player.key().as_ref()],
        bump
    )]
    pub player_score: Account<'info, PlayerScore>,
    #[account(
        init_if_needed,
        payer = player,
        space = 8 + Board::INIT_SPACE,
        seeds = [BOARD_SEED],
        bump
    )]
    pub board: Account<'info, Board>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(tier: u8)]
pub struct ClaimBadge<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        seeds = [SCORE_SEED, player.key().as_ref()],
        bump = player_score.bump,
        constraint = player_score.owner == player.key() @ NeonDojoError::WrongPlayer
    )]
    pub player_score: Account<'info, PlayerScore>,
    #[account(
        init,
        payer = player,
        space = 8 + BadgeClaim::INIT_SPACE,
        seeds = [BADGE_SEED, player.key().as_ref(), &[tier]],
        bump
    )]
    pub badge_claim: Account<'info, BadgeClaim>,
    #[account(
        init,
        payer = player,
        seeds = [MINT_SEED, player.key().as_ref(), &[tier]],
        bump,
        mint::decimals = 0,
        mint::authority = mint_authority,
        mint::freeze_authority = mint_authority
    )]
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA signer for minting. Seeds are checked here.
    #[account(
        seeds = [MINT_AUTH_SEED, player.key().as_ref(), &[tier]],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = player,
        associated_token::mint = mint,
        associated_token::authority = player,
        associated_token::token_program = token_program
    )]
    pub token_account: Account<'info, TokenAccount>,
    /// CHECK: Metaplex metadata PDA, verified in the instruction.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    /// CHECK: Metaplex master edition PDA, verified in the instruction.
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[cfg(test)]
mod board_unit {
    use super::*;
    use super::state::BoardEntry;

    fn empty_board() -> Board {
        Board {
            entries: [BoardEntry {
                player: Pubkey::default(),
                score: 0,
            }; BOARD_LEN],
            bump: 1,
        }
    }

    #[test]
    fn board_keeps_highest_ten_and_updates_in_place() {
        let mut board = empty_board();
        let players: Vec<Pubkey> = (0..12).map(|_| Pubkey::new_unique()).collect();
        for (index, player) in players.iter().enumerate() {
            place_on_board(&mut board, *player, ((index as u64) + 1) * 100);
        }
        assert_eq!(board.entries[0].score, 1200);
        assert_eq!(board.entries[0].player, players[11]);
        assert_eq!(board.entries[9].score, 300);
        assert!(board.entries.iter().all(|entry| entry.score >= 300));
        assert!(board
            .entries
            .iter()
            .all(|entry| entry.player != players[0]));

        place_on_board(&mut board, players[11], 5_000);
        assert_eq!(board.entries[0].player, players[11]);
        assert_eq!(board.entries[0].score, 5_000);
        assert_eq!(
            board.entries.iter().filter(|entry| entry.player == players[11]).count(),
            1
        );
    }
}
