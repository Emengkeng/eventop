use anchor_lang::prelude::*;
use crate::{YieldVault, EmergencyModeChanged, ErrorCode};
use crate::utils::{calculate_current_exchange_rate, get_vault_total_value};

#[derive(Accounts)]
pub struct SetEmergencyMode<'info> {
    #[account(
        mut,
        seeds = [b"yield_vault", yield_vault.mint.as_ref()],
        bump = yield_vault.bump,
        has_one = authority @ ErrorCode::UnauthorizedProtocolUpdate
    )]
    pub yield_vault: Account<'info, YieldVault>,

    pub authority: Signer<'info>,

    /// CHECK: Kamino reserve
    pub kamino_reserve: AccountInfo<'info>,
}

pub fn handler(ctx: Context<SetEmergencyMode>, enabled: bool) -> Result<()> {
    let vault = &mut ctx.accounts.yield_vault;
    
    vault.emergency_mode = enabled;
    
    if enabled {
        // Freeze exchange rate at current value
        vault.emergency_exchange_rate = calculate_current_exchange_rate(
            vault.total_shares_issued,
            get_vault_total_value(ctx.accounts.kamino_reserve.clone(), &vault)?,
        )?;
    }

    emit!(EmergencyModeChanged {
        enabled,
        frozen_rate: vault.emergency_exchange_rate,
    });

    Ok(())
}