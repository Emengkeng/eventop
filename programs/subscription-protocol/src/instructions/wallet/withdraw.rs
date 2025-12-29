use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::{SubscriptionWallet, WalletWithdrawal, ErrorCodes};
use crate::utils::calculate_committed_balance;

#[derive(Accounts)]
pub struct WithdrawFromWallet<'info> {
    #[account(
        seeds = [
            b"subscription_wallet",
            subscription_wallet.owner.as_ref(),
            subscription_wallet.mint.as_ref()
        ],
        bump = subscription_wallet.bump,
        has_one = owner @ ErrorCodes::UnauthorizedWalletAccess
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        token::mint = subscription_wallet.mint,
        token::authority = owner
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = subscription_wallet.mint,
        token::authority = subscription_wallet
    )]
    pub wallet_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<WithdrawFromWallet>, amount: u64) -> Result<()> {
    let wallet = &ctx.accounts.subscription_wallet;
    
    require!(amount > 0, ErrorCodes::InvalidWithdrawAmount);

    // Calculate committed balance (3 months buffer for subscriptions)
    let committed_amount = calculate_committed_balance(
        &ctx.accounts.subscription_wallet,
    )?;
    
    let available_balance = ctx.accounts.wallet_token_account.amount;
    let withdrawable = available_balance.saturating_sub(committed_amount);
    
    require!(amount <= withdrawable, ErrorCodes::InsufficientAvailableBalance);

    // Create PDA signer seeds
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

    // Transfer from wallet to user
    let cpi_accounts = Transfer {
        from: ctx.accounts.wallet_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.subscription_wallet.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;

    emit!(WalletWithdrawal {
        wallet_pda: wallet.key(),
        user: wallet.owner,
        amount: amount,
    });

    msg!("Withdrawn {} tokens from Subscription Wallet", amount);

    Ok(())
}