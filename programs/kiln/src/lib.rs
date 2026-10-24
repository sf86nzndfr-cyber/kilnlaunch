//! KILN bonding-curve program (Anchor 0.30). Deploy with `anchor build && anchor deploy --provider.cluster devnet`,
//! then put the program id into the KILN app to enable buy/sell.
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, SetAuthority, Token, TokenAccount, Transfer as SplTransfer};
use anchor_spl::token::spl_token::instruction::AuthorityType;

declare_id!("11111111111111111111111111111111"); // replaced by `anchor keys sync`

pub const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000; // 1B tokens, 6 decimals
pub const VIRTUAL_SOL: u64 = 30_000_000_000;          // 30 SOL virtual
pub const VIRTUAL_TOKENS: u64 = 1_073_000_000_000_000;
pub const GRADUATION_LAMPORTS: u64 = 85_000_000_000;  // 85 SOL
pub const FEE_BPS: u64 = 100;                         // 1%

#[program]
pub mod kiln {
    use super::*;

    pub fn initialize_launch(ctx: Context<InitializeLaunch>) -> Result<()> {
        let curve = &mut ctx.accounts.curve;
        curve.mint = ctx.accounts.mint.key();
        curve.creator = ctx.accounts.creator.key();
        curve.virtual_sol_reserves = VIRTUAL_SOL;
        curve.virtual_token_reserves = VIRTUAL_TOKENS;
        curve.real_sol_reserves = 0;
        curve.real_token_reserves = TOTAL_SUPPLY;
        curve.total_supply = TOTAL_SUPPLY;
        curve.complete = false;
        curve.bump = ctx.bumps.curve;

        let mint_key = ctx.accounts.mint.key();
        let seeds: &[&[u8]] = &[b"curve", mint_key.as_ref(), &[curve.bump]];
        let signer = &[seeds];
        token::mint_to(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.curve_vault.to_account_info(),
            authority: curve.to_account_info(),
        }, signer), TOTAL_SUPPLY)?;
        // Revoke mint authority forever. Freeze authority is never set (mint::freeze_authority omitted).
        token::set_authority(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), SetAuthority {
            current_authority: curve.to_account_info(),
            account_or_mint: ctx.accounts.mint.to_account_info(),
        }, signer), AuthorityType::MintTokens, None)?;
        Ok(())
    }

    pub fn buy_tokens(ctx: Context<Trade>, sol_in: u64, min_tokens_out: u64) -> Result<()> {
        let curve = &mut ctx.accounts.curve;
        require!(!curve.complete, KilnError::CurveComplete);
        let fee = sol_in * FEE_BPS / 10_000;
        let net = sol_in - fee;
        // constant product: x*y=k
        let k = (curve.virtual_sol_reserves as u128) * (curve.virtual_token_reserves as u128);
        let new_sol = curve.virtual_sol_reserves as u128 + net as u128;
        let out = (curve.virtual_token_reserves as u128 - k / new_sol) as u64;
        let out = out.min(curve.real_token_reserves);
        require!(out >= min_tokens_out, KilnError::Slippage);

        transfer(CpiContext::new(ctx.accounts.system_program.to_account_info(), Transfer {
            from: ctx.accounts.user.to_account_info(), to: curve.to_account_info() }), net)?;
        transfer(CpiContext::new(ctx.accounts.system_program.to_account_info(), Transfer {
            from: ctx.accounts.user.to_account_info(), to: ctx.accounts.fee_vault.to_account_info() }), fee)?;

        let mint_key = curve.mint;
        let seeds: &[&[u8]] = &[b"curve", mint_key.as_ref(), &[curve.bump]];
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), SplTransfer {
            from: ctx.accounts.curve_vault.to_account_info(), to: ctx.accounts.user_ata.to_account_info(),
            authority: curve.to_account_info() }, &[seeds]), out)?;

        curve.virtual_sol_reserves += net;
        curve.virtual_token_reserves -= out;
        curve.real_sol_reserves += net;
        curve.real_token_reserves -= out;
        if curve.real_sol_reserves >= GRADUATION_LAMPORTS { curve.complete = true; emit!(Graduated { mint: curve.mint }); }
        emit!(TradeEvent { mint: curve.mint, user: ctx.accounts.user.key(), is_buy: true, sol: net, tokens: out });
        Ok(())
    }

    pub fn sell_tokens(ctx: Context<Trade>, tokens_in: u64, min_sol_out: u64) -> Result<()> {
        let curve = &mut ctx.accounts.curve;
        require!(!curve.complete, KilnError::CurveComplete);
        let k = (curve.virtual_sol_reserves as u128) * (curve.virtual_token_reserves as u128);
        let new_tok = curve.virtual_token_reserves as u128 + tokens_in as u128;
        let gross = (curve.virtual_sol_reserves as u128 - k / new_tok) as u64;
        let gross = gross.min(curve.real_sol_reserves);
        let fee = gross * FEE_BPS / 10_000;
        let out = gross - fee;
        require!(out >= min_sol_out, KilnError::Slippage);

        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), SplTransfer {
            from: ctx.accounts.user_ata.to_account_info(), to: ctx.accounts.curve_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info() }), tokens_in)?;
        // curve PDA is program-owned: move lamports directly
        **curve.to_account_info().try_borrow_mut_lamports()? -= gross;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += out;
        **ctx.accounts.fee_vault.to_account_info().try_borrow_mut_lamports()? += fee;

        curve.virtual_sol_reserves -= gross;
        curve.virtual_token_reserves += tokens_in;
        curve.real_sol_reserves -= gross;
        curve.real_token_reserves += tokens_in;
        emit!(TradeEvent { mint: curve.mint, user: ctx.accounts.user.key(), is_buy: false, sol: out, tokens: tokens_in });
        Ok(())
    }

    /// Gated: only after graduation. Releases reserves to the migration authority, which
    /// creates the Raydium CPMM pool and burns the LP in the same transaction (client-assembled).
    pub fn migrate_liquidity(ctx: Context<Migrate>) -> Result<()> {
        let curve = &mut ctx.accounts.curve;
        require!(curve.complete, KilnError::NotGraduated);
        let sol = curve.real_sol_reserves;
        let toks = curve.real_token_reserves;
        let mint_key = curve.mint;
        let seeds: &[&[u8]] = &[b"curve", mint_key.as_ref(), &[curve.bump]];
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), SplTransfer {
            from: ctx.accounts.curve_vault.to_account_info(), to: ctx.accounts.migrator_ata.to_account_info(),
            authority: curve.to_account_info() }, &[seeds]), toks)?;
        **curve.to_account_info().try_borrow_mut_lamports()? -= sol;
        **ctx.accounts.migrator.to_account_info().try_borrow_mut_lamports()? += sol;
        curve.real_sol_reserves = 0;
        curve.real_token_reserves = 0;
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct BondingCurve {
    pub mint: Pubkey, pub creator: Pubkey,
    pub virtual_sol_reserves: u64, pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64, pub real_token_reserves: u64,
    pub total_supply: u64, pub complete: bool, pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializeLaunch<'info> {
    #[account(mut)] pub creator: Signer<'info>,
    #[account(init, payer = creator, mint::decimals = 6, mint::authority = curve)]
    pub mint: Account<'info, Mint>,
    #[account(init, payer = creator, space = 8 + BondingCurve::INIT_SPACE, seeds = [b"curve", mint.key().as_ref()], bump)]
    pub curve: Account<'info, BondingCurve>,
    #[account(init, payer = creator, associated_token::mint = mint, associated_token::authority = curve)]
    pub curve_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(mut)] pub user: Signer<'info>,
    #[account(mut, seeds = [b"curve", curve.mint.as_ref()], bump = curve.bump)]
    pub curve: Account<'info, BondingCurve>,
    #[account(mut, associated_token::mint = curve.mint, associated_token::authority = curve)]
    pub curve_vault: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = user, associated_token::mint = mint, associated_token::authority = user)]
    pub user_ata: Account<'info, TokenAccount>,
    #[account(address = curve.mint)] pub mint: Account<'info, Mint>,
    /// CHECK: protocol fee PDA
    #[account(mut, seeds = [b"fees"], bump)] pub fee_vault: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Migrate<'info> {
    #[account(mut, address = MIGRATION_AUTHORITY)] pub migrator: Signer<'info>,
    #[account(mut, seeds = [b"curve", curve.mint.as_ref()], bump = curve.bump)]
    pub curve: Account<'info, BondingCurve>,
    #[account(mut, associated_token::mint = curve.mint, associated_token::authority = curve)]
    pub curve_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = curve.mint, token::authority = migrator)]
    pub migrator_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub const MIGRATION_AUTHORITY: Pubkey = pubkey!("11111111111111111111111111111111"); // set before deploy

#[event] pub struct TradeEvent { pub mint: Pubkey, pub user: Pubkey, pub is_buy: bool, pub sol: u64, pub tokens: u64 }
#[event] pub struct Graduated { pub mint: Pubkey }

#[error_code]
pub enum KilnError {
    #[msg("Curve has graduated; trading moved to Raydium")] CurveComplete,
    #[msg("Slippage exceeded")] Slippage,
    #[msg("Curve has not reached the graduation threshold")] NotGraduated,
}
