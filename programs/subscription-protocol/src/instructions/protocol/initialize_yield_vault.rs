use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};
use crate::{YieldVault, YieldVaultInitialized, ErrorCode};

#[derive(Accounts)]
pub struct InitializeYieldVault {
    #[account(
        init,
        payer = authority,
        space = 8 + YieldVault::INIT_SPACE,
        seeds = [b"yield_vault", mint.key().as_ref()],
        bump
    )]
    pub yield_vault: Account,

    #[account(mut)]
    pub authority: Signer,

    pub mint: Account,

    /// CHECK: Will be initialized separately
    pub usdc_buffer: Account,

    /// CHECK: Will be initialized separately
    pub kamino_collateral: Account,

    /// CHECK: Kamino reserve address
    pub kamino_reserve: AccountInfo,

    pub system_program: Program,
}

pub fn handler(
    ctx: Context,
    target_buffer_bps: u16,
) -> Result {
    require!(target_buffer_bps <= 5000, ErrorCode::InvalidBufferRatio);
    
    let vault = &mut ctx.accounts.yield_vault;
    vault.authority = ctx.accounts.authority.key();
    vault.mint = ctx.accounts.mint.key();
    vault.usdc_buffer = ctx.accounts.usdc_buffer.key();
    vault.kamino_collateral = ctx.accounts.kamino_collateral.key();
    vault.kamino_reserve = ctx.accounts.kamino_reserve.key();
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