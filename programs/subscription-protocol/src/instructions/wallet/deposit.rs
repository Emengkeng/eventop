use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::{SubscriptionWallet, WalletDeposit, ErrorCodes};

#[derive(Accounts)]
pub struct DepositToWallet<'info> {
    #[account(
        seeds = [
            b"subscription_wallet",
            subscription_wallet.owner.as_ref(),
            subscription_wallet.mint.as_ref()
        ],
        bump = subscription_wallet.bump,
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        token::mint = subscription_wallet.mint,
        token::authority = user
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

pub fn handler(ctx: Context<DepositToWallet>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCodes::InvalidDepositAmount);

    // Transfer from user's main wallet to subscription wallet
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.wallet_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    emit!(WalletDeposit {
        wallet_pda: ctx.accounts.subscription_wallet.key(),
        user: ctx.accounts.subscription_wallet.owner,
        amount: amount,
    });

    msg!("Deposited {} tokens to Subscription Wallet", amount);

    Ok(())
}