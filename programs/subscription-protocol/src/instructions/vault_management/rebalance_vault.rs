use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::{YieldVault, VaultRebalanced, ErrorCode};
use crate::utils::{
    calculate_buffer_amount,
    get_vault_total_value,
    deposit_to_kamino_internal,
    withdraw_from_kamino_internal
};

#[derive(Accounts)]
pub struct RebalanceVault<'info> {
    #[account(
        mut,
        seeds = [b"yield_vault", yield_vault.mint.as_ref()],
        bump = yield_vault.bump,
        has_one = authority @ ErrorCode::UnauthorizedProtocolUpdate
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
        token::mint = yield_vault.mint,
        constraint = kamino_collateral_account.key() == yield_vault.kamino_collateral
    )]
    pub kamino_collateral_account: Account<'info, TokenAccount>,

    /// CHECK: Kamino reserve
    pub kamino_reserve: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<RebalanceVault>) -> Result<()> {
    let vault = &ctx.accounts.yield_vault;
    
    require!(!vault.emergency_mode, ErrorCode::EmergencyModeEnabled);

    let buffer_balance = ctx.accounts.vault_buffer.amount;
    let total_value = get_vault_total_value(
        ctx.accounts.kamino_reserve.clone(),
        &vault,
    )?;
    
    let target_buffer = calculate_buffer_amount(total_value, vault.target_buffer_bps)?;

    if buffer_balance < target_buffer {
        // Need to withdraw from Kamino to top up buffer
        let shortfall = target_buffer.checked_sub(buffer_balance)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // CPI to Kamino to redeem collateral
        withdraw_from_kamino_internal(
            &vault,
            &ctx.accounts.kamino_reserve,
            &ctx.accounts.kamino_collateral_account,
            &ctx.accounts.vault_buffer,
            &ctx.accounts.token_program,
            shortfall,
            vault.bump,
        )?;
        
        emit!(VaultRebalanced {
            action: "withdraw_from_kamino".to_string(),
            amount: shortfall,
        });
    } else if buffer_balance > target_buffer {
        // Buffer too high, deposit excess to Kamino
        let excess = buffer_balance.checked_sub(target_buffer)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // Only rebalance if excess is significant (> 1% of total)
        let min_rebalance = total_value.checked_div(100)
            .ok_or(ErrorCode::MathOverflow)?;
        
        if excess > min_rebalance {
            // CPI to Kamino to deposit
            deposit_to_kamino_internal(
                &vault,
                &ctx.accounts.vault_buffer,
                &ctx.accounts.kamino_reserve,
                &ctx.accounts.kamino_collateral_account,
                &ctx.accounts.token_program,
                excess,
                vault.bump,
            )?;
            
            emit!(VaultRebalanced {
                action: "deposit_to_kamino".to_string(),
                amount: excess,
            });
        }
    }

    Ok(())
}