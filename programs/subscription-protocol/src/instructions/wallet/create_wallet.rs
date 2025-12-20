use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::{SubscriptionWallet, SubscriptionWalletCreated};

#[derive(Accounts)]
pub struct CreateSubscriptionWallet {
    #[account(
        init,
        payer = user,
        space = 8 + SubscriptionWallet::INIT_SPACE,
        seeds = [
            b"subscription_wallet",
            user.key().as_ref(),
            mint.key().as_ref()
        ],
        bump
    )]
    pub subscription_wallet: Account,

    #[account(
        mut,
        constraint = main_token_account.owner == subscription_wallet.key(),
        constraint = main_token_account.mint == mint.key()
    )]
    pub main_token_account: Account,

    #[account(mut)]
    pub user: Signer,

    pub mint: Account,
    pub token_program: Program,
    pub system_program: Program,
}

pub fn handler(ctx: Context) -> Result {
    let wallet = &mut ctx.accounts.subscription_wallet;
    
    wallet.owner = ctx.accounts.user.key();
    wallet.main_token_account = ctx.accounts.main_token_account.key();
    wallet.mint = ctx.accounts.mint.key();
    wallet.total_subscriptions = 0;
    wallet.total_spent = 0;
    wallet.yield_shares = 0;
    wallet.is_yield_enabled = false;
    wallet.bump = ctx.bumps.subscription_wallet;

    emit!(SubscriptionWalletCreated {
        wallet_pda: wallet.key(),
        owner: wallet.owner,
        mint: wallet.mint,
    });

    msg!("Subscription Wallet created for user: {}", wallet.owner);

    Ok(())
}