use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};
use crate::{YieldVault, YieldVaultInitialized, ErrorCodes};

#[derive(Accounts)]
pub struct InitializeYieldVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + YieldVault::INIT_SPACE,
        seeds = [b"yield_vault", mint.key().as_ref()],
        bump
    )]
    pub yield_vault: Account<'info, YieldVault>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub mint: Account<'info, Mint>,

    /// USDC buffer token account (owned by yield_vault PDA)
    pub usdc_buffer: Account<'info, TokenAccount>,

    /// Jupiter Lend fToken account (owned by yield_vault PDA)
    /// This replaces kamino_collateral
    pub jupiter_ftoken_account: Account<'info, TokenAccount>,

    /// Jupiter Lend lending account
    /// CHECK: Jupiter Lend protocol account
    pub jupiter_lending: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeYieldVault>,
    target_buffer_bps: u16,
) -> Result<()> {
    require!(target_buffer_bps <= 5000, ErrorCodes::InvalidBufferRatio); // Max 50%
    
    let vault = &mut ctx.accounts.yield_vault;
    vault.authority = ctx.accounts.authority.key();
    vault.mint = ctx.accounts.mint.key();
    vault.usdc_buffer = ctx.accounts.usdc_buffer.key();
    vault.jupiter_ftoken_account = ctx.accounts.jupiter_ftoken_account.key();
    vault.jupiter_lending = ctx.accounts.jupiter_lending.key();
    vault.total_shares_issued = 0;
    vault.total_usdc_deposited = 0;
    vault.target_buffer_bps = target_buffer_bps;
    vault.emergency_mode = false;
    vault.emergency_exchange_rate = 1_000_000;
    vault.bump = ctx.bumps.yield_vault;

    emit!(YieldVaultInitialized {
        vault: vault.key(),
        authority: vault.authority,
        target_buffer_bps,
    });

    Ok(())
}