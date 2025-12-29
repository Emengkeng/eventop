use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Token, TokenAccount},
    associated_token::AssociatedToken,
};
use crate::{YieldVault, VaultRebalanced, ErrorCodes};
use crate::utils::{
    calculate_buffer_amount,
    get_vault_total_value,
    deposit_to_jupiter_lend_internal,
    withdraw_from_jupiter_lend_internal,
    JupiterLendAccounts,
};

#[derive(Accounts)]
pub struct RebalanceVault<'info> {
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

    // Jupiter Lend accounts
    /// CHECK: Jupiter Lend mint
    pub mint: AccountInfo<'info>,
    
    /// CHECK: Jupiter Lend fToken mint
    pub f_token_mint: AccountInfo<'info>,
    
    /// CHECK: Jupiter Lend admin
    pub lending_admin: AccountInfo<'info>,
    
    /// CHECK: Jupiter Lend lending account
    #[account(mut)]
    pub lending: AccountInfo<'info>,
    
    /// CHECK: Jupiter Lend supply reserves
    #[account(mut)]
    pub supply_token_reserves_liquidity: AccountInfo<'info>,
    
    /// CHECK: Jupiter Lend supply position
    #[account(mut)]
    pub lending_supply_position_on_liquidity: AccountInfo<'info>,
    
    /// CHECK: Jupiter Lend rate model
    pub rate_model: AccountInfo<'info>,
    
    /// CHECK: Jupiter Lend vault
    #[account(mut)]
    pub jupiter_vault: AccountInfo<'info>,
    
    /// CHECK: Jupiter Lend claim account (for withdrawals)
    #[account(mut)]
    pub claim_account: AccountInfo<'info>,
    
    /// CHECK: Jupiter Lend liquidity
    #[account(mut)]
    pub liquidity: AccountInfo<'info>,
    
    /// CHECK: Jupiter Lend liquidity program
    #[account(mut)]
    pub liquidity_program: AccountInfo<'info>,
    
    /// CHECK: Jupiter Lend rewards rate model
    pub rewards_rate_model: AccountInfo<'info>,
    
    /// CHECK: Jupiter Lend lending program
    pub lending_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RebalanceVault>) -> Result<()> {
    let vault = &ctx.accounts.yield_vault;
    
    require!(!vault.emergency_mode, ErrorCodes::EmergencyModeEnabled);

    let buffer_balance = ctx.accounts.vault_buffer.amount;
    let total_value = get_vault_total_value(
        ctx.accounts.lending.clone(),
        &vault,
        Some(&ctx.accounts.vault_buffer),
        Some(&ctx.accounts.jupiter_ftoken_account),
    )?;
    
    let target_buffer = calculate_buffer_amount(total_value, vault.target_buffer_bps)?;

    // Build Jupiter Lend accounts struct
    let jupiter_accounts = JupiterLendAccounts {
        mint: ctx.accounts.mint.clone(),
        f_token_mint: ctx.accounts.f_token_mint.clone(),
        lending_admin: ctx.accounts.lending_admin.clone(),
        lending: ctx.accounts.lending.clone(),
        supply_token_reserves_liquidity: ctx.accounts.supply_token_reserves_liquidity.clone(),
        lending_supply_position_on_liquidity: ctx.accounts.lending_supply_position_on_liquidity.clone(),
        rate_model: ctx.accounts.rate_model.clone(),
        jupiter_vault: ctx.accounts.jupiter_vault.clone(),
        liquidity: ctx.accounts.liquidity.clone(),
        liquidity_program: ctx.accounts.liquidity_program.clone(),
        rewards_rate_model: ctx.accounts.rewards_rate_model.clone(),
        claim_account: ctx.accounts.claim_account.clone(),
        lending_program: ctx.accounts.lending_program.clone(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    if buffer_balance < target_buffer {
        // Need to withdraw from Jupiter Lend to top up buffer
        let shortfall = target_buffer.checked_sub(buffer_balance)
            .ok_or(ErrorCodes::MathOverflow)?;
        
        // Withdraw from Jupiter Lend
        withdraw_from_jupiter_lend_internal(
            &vault,
            &ctx.accounts.jupiter_ftoken_account,
            &ctx.accounts.vault_buffer,
            &jupiter_accounts,
            &ctx.accounts.token_program,
            shortfall,
        )?;
        
        emit!(VaultRebalanced {
            action: "withdraw_from_jupiter_lend".to_string(),
            amount: shortfall,
        });
    } else if buffer_balance > target_buffer {
        // Buffer too high, deposit excess to Jupiter Lend
        let excess = buffer_balance.checked_sub(target_buffer)
            .ok_or(ErrorCodes::MathOverflow)?;
        
        // Only rebalance if excess is significant (> 1% of total)
        let min_rebalance = total_value.checked_div(100)
            .ok_or(ErrorCodes::MathOverflow)?;
        
        if excess > min_rebalance {
            // Deposit to Jupiter Lend
            deposit_to_jupiter_lend_internal(
                &vault,
                &ctx.accounts.vault_buffer,
                &ctx.accounts.jupiter_ftoken_account,
                &jupiter_accounts,
                &ctx.accounts.token_program,
                excess,
            )?;
            
            emit!(VaultRebalanced {
                action: "deposit_to_jupiter_lend".to_string(),
                amount: excess,
            });
        }
    }

    Ok(())
}