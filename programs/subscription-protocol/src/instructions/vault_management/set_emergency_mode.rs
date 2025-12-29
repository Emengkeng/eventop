use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::{YieldVault, EmergencyModeChanged, ErrorCodes};
use crate::utils::{calculate_current_exchange_rate, get_vault_total_value};

#[derive(Accounts)]
pub struct SetEmergencyMode<'info> {
    #[account(
        mut,
        seeds = [b"yield_vault", yield_vault.mint.as_ref()],
        bump = yield_vault.bump,
        has_one = authority @ ErrorCodes::UnauthorizedProtocolUpdate
    )]
    pub yield_vault: Account<'info, YieldVault>,

    pub authority: Signer<'info>,

    #[account(
        mut,
        token::mint = yield_vault.mint,
        constraint = vault_buffer.key() == yield_vault.usdc_buffer
    )]
    pub vault_buffer: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = f_token_mint.key(),
        constraint = jupiter_ftoken_account.key() == yield_vault.jupiter_ftoken_account
    )]
    pub jupiter_ftoken_account: Account<'info, TokenAccount>,

    /// CHECK: Jupiter Lend fToken mint
    pub f_token_mint: AccountInfo<'info>,

    /// CHECK: Jupiter Lend lending account
    pub jupiter_lending: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<SetEmergencyMode>, enabled: bool) -> Result<()> {
    let vault = &mut ctx.accounts.yield_vault;
    
    vault.emergency_mode = enabled;
    
    if enabled {
        // Freeze exchange rate at current value
        vault.emergency_exchange_rate = calculate_current_exchange_rate(
            vault.total_shares_issued,
            get_vault_total_value(
                ctx.accounts.jupiter_lending.clone(),
                &vault,
                Some(&ctx.accounts.vault_buffer),
                Some(&ctx.accounts.jupiter_ftoken_account),
            )?,
        )?;
    }

    emit!(EmergencyModeChanged {
        enabled,
        frozen_rate: vault.emergency_exchange_rate,
    });

    Ok(())
}