use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::{SubscriptionWallet, YieldVault, YieldDisabled, ErrorCode};
use crate::utils::{
    calculate_usdc_value_of_shares,
    get_vault_total_value,
    withdraw_from_vault_internal
};

#[derive(Accounts)]
pub struct DisableYield<'info> {
    #[account(
        mut,
        seeds = [
            b"subscription_wallet",
            subscription_wallet.owner.as_ref(),
            subscription_wallet.mint.as_ref()
        ],
        bump = subscription_wallet.bump,
        has_one = owner @ ErrorCode::UnauthorizedWalletAccess
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(
        mut,
        seeds = [b"yield_vault", subscription_wallet.mint.as_ref()],
        bump = yield_vault.bump,
    )]
    pub yield_vault: Account<'info, YieldVault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        token::mint = subscription_wallet.mint,
        token::authority = subscription_wallet
    )]
    pub wallet_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = subscription_wallet.mint,
        constraint = vault_buffer.key() == yield_vault.usdc_buffer
    )]
    pub vault_buffer: Account<'info, TokenAccount>,

    /// CHECK: Kamino reserve
    pub kamino_reserve: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<DisableYield>) -> Result<()> {
    let wallet = &mut ctx.accounts.subscription_wallet;
    let vault = &mut ctx.accounts.yield_vault;
    
    require!(wallet.is_yield_enabled, ErrorCode::YieldNotEnabled);
    require!(wallet.yield_shares > 0, ErrorCode::NoSharesToRedeem);

    // Calculate USDC value of shares
    let usdc_value = calculate_usdc_value_of_shares(
        wallet.yield_shares,
        vault.total_shares_issued,
        get_vault_total_value(ctx.accounts.kamino_reserve.clone(), &vault)?,
    )?;

    // Withdraw from vault to user's wallet
    withdraw_from_vault_internal(
        &vault,
        &ctx.accounts.vault_buffer,
        &ctx.accounts.wallet_token_account,
        &ctx.accounts.token_program,
        usdc_value,
        vault.bump,
    )?;

    // Update state
    vault.total_shares_issued = vault.total_shares_issued
        .checked_sub(wallet.yield_shares)
        .ok_or(ErrorCode::MathOverflow)?;
    vault.total_usdc_deposited = vault.total_usdc_deposited
        .checked_sub(usdc_value)
        .ok_or(ErrorCode::MathOverflow)?;

    let shares_redeemed = wallet.yield_shares;
    wallet.yield_shares = 0;
    wallet.is_yield_enabled = false;

    emit!(YieldDisabled {
        wallet_pda: wallet.key(),
        shares_redeemed,
        usdc_received: usdc_value,
    });

    Ok(())
}