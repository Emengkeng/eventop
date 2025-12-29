use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::{SubscriptionWallet, YieldVault, YieldEnabled, ErrorCodes};
use crate::utils::{
    calculate_buffer_amount,
    calculate_shares_for_deposit,
    get_vault_total_value
};

#[derive(Accounts)]
pub struct EnableYield<'info> {
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

    /// CHECK: Jupiter Lend lending account
    pub jupiter_lending: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<EnableYield>, amount: u64) -> Result<()> {
    let wallet = &mut ctx.accounts.subscription_wallet;
    let vault = &mut ctx.accounts.yield_vault;
    
    require!(!wallet.is_yield_enabled, ErrorCodes::YieldAlreadyEnabled);
    require!(amount > 0, ErrorCodes::InvalidDepositAmount);
    require!(
        ctx.accounts.wallet_token_account.amount >= amount,
        ErrorCodes::InsufficientWalletBalance
    );

    // Calculate how much goes to yield vs buffer
    let buffer_amount = calculate_buffer_amount(amount, vault.target_buffer_bps)?;
    let yield_amount = amount.checked_sub(buffer_amount)
        .ok_or(ErrorCodes::MathOverflow)?;

    require!(yield_amount > 0, ErrorCodes::YieldAmountTooSmall);

    // Calculate shares to issue (1:1 initially, will accrue yield over time)
    let shares_to_issue = if vault.total_shares_issued == 0 {
        // First deposit: 1:1 ratio
        yield_amount
    } else {
        // Subsequent deposits: based on current exchange rate
        calculate_shares_for_deposit(
            yield_amount,
            vault.total_shares_issued,
            get_vault_total_value(
                ctx.accounts.jupiter_lending.clone(),
                &vault,
                Some(&ctx.accounts.vault_buffer),
                None, // fToken account not needed for share calculation during deposit
            )?,
        )?
    };

    // Transfer yield portion to vault buffer
    let cpi_accounts = Transfer {
        from: ctx.accounts.wallet_token_account.to_account_info(),
        to: ctx.accounts.vault_buffer.to_account_info(),
        authority: wallet.to_account_info(),
    };
    
    let owner_key = wallet.owner;
    let mint_key = wallet.mint;
    let bump = wallet.bump;
    let seeds = &[
        b"subscription_wallet",
        owner_key.as_ref(),
        mint_key.as_ref(),
        &[bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer,
    );
    token::transfer(cpi_ctx, yield_amount)?;

    // Update state
    wallet.yield_shares = shares_to_issue;
    wallet.is_yield_enabled = true;
    
    vault.total_shares_issued = vault.total_shares_issued
        .checked_add(shares_to_issue)
        .ok_or(ErrorCodes::MathOverflow)?;
    vault.total_usdc_deposited = vault.total_usdc_deposited
        .checked_add(yield_amount)
        .ok_or(ErrorCodes::MathOverflow)?;

    emit!(YieldEnabled {
        wallet_pda: wallet.key(),
        shares_issued: shares_to_issue,
        usdc_amount: yield_amount,
        buffer_amount,
    });

    msg!("Yield enabled: {} shares issued for {} USDC", shares_to_issue, yield_amount);

    Ok(())
}