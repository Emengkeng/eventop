use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::{SubscriptionWallet, YieldVault, YieldWithdrawal, ErrorCodes};
use crate::utils::{
    calculate_collateral_for_liquidity, calculate_usdc_value_of_shares, get_vault_total_value, withdraw_from_kamino_internal, withdraw_from_vault_internal
};

#[derive(Accounts)]
pub struct WithdrawFromYield<'info> {
    #[account(
        mut,
        seeds = [
            b"subscription_wallet",
            subscription_wallet.owner.as_ref(),
            subscription_wallet.mint.as_ref()
        ],
        bump = subscription_wallet.bump,
        has_one = owner @ ErrorCodes::UnauthorizedWalletAccess
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

   #[account(
        mut,
        constraint = vault_collateral.key() == yield_vault.kamino_collateral @ ErrorCodes::InvalidCollateralAccount
    )]
    pub vault_collateral: Account<'info, TokenAccount>,

    pub kamino_reserve: AccountInfo<'info>,

    pub kamino_program: AccountInfo<'info>,

    pub lending_market: AccountInfo<'info>,

    pub lending_market_authority: AccountInfo<'info>,

    pub reserve_liquidity_supply: AccountInfo<'info>,

    pub reserve_collateral_mint: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<WithdrawFromYield>,
    shares_to_redeem: u64,
) -> Result<()> {
    let wallet = &mut ctx.accounts.subscription_wallet;
    let vault = &mut ctx.accounts.yield_vault;
    
    require!(wallet.is_yield_enabled, ErrorCodes::YieldNotEnabled);
    require!(shares_to_redeem > 0, ErrorCodes::InvalidShareAmount);
    require!(
        wallet.yield_shares >= shares_to_redeem,
        ErrorCodes::InsufficientShares
    );

    let usdc_value = calculate_usdc_value_of_shares(
        shares_to_redeem,
        vault.total_shares_issued,
        get_vault_total_value(
            ctx.accounts.kamino_reserve.clone(),
            &vault,
            &ctx.accounts.vault_buffer,
            &ctx.accounts.vault_collateral,
        )?,
    )?;

    if ctx.accounts.vault_buffer.amount < usdc_value {
        let shortfall = usdc_value
            .checked_sub(ctx.accounts.vault_buffer.amount)
            .ok_or(ErrorCodes::MathOverflow)?;
        
        let collateral_needed = calculate_collateral_for_liquidity(
            shortfall,
            &ctx.accounts.kamino_reserve,
        )?;
        
        withdraw_from_kamino_internal(
            vault,
            &ctx.accounts.vault_buffer,
            &ctx.accounts.vault_collateral,
            &ctx.accounts.kamino_program,
            &ctx.accounts.kamino_reserve,
            &ctx.accounts.lending_market,
            &ctx.accounts.lending_market_authority,
            &ctx.accounts.reserve_collateral_mint,
            &ctx.accounts.reserve_liquidity_supply,
            &ctx.accounts.token_program,
            collateral_needed,
        )?;
    }

    withdraw_from_vault_internal(
        vault.to_account_info(),
        &vault,
        &ctx.accounts.vault_buffer,
        &ctx.accounts.wallet_token_account,
        &ctx.accounts.token_program,
        usdc_value
    )?;

    wallet.yield_shares = wallet.yield_shares
        .checked_sub(shares_to_redeem)
        .ok_or(ErrorCodes::MathOverflow)?;
    
    vault.total_shares_issued = vault.total_shares_issued
        .checked_sub(shares_to_redeem)
        .ok_or(ErrorCodes::MathOverflow)?;
    vault.total_usdc_deposited = vault.total_usdc_deposited
        .checked_sub(usdc_value)
        .ok_or(ErrorCodes::MathOverflow)?;

    emit!(YieldWithdrawal {
        wallet_pda: wallet.key(),
        shares_redeemed: shares_to_redeem,
        usdc_received: usdc_value,
    });

    Ok(())
}