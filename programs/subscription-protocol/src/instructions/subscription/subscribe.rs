use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use crate::{
    SubscriptionState, SubscriptionWallet, MerchantPlan,
    SessionTokenTracker, SubscriptionCreated, ErrorCodes
};

#[derive(Accounts)]
#[instruction(session_token: String)]
pub struct SubscribeWithWallet<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + SubscriptionState::INIT_SPACE,
        seeds = [
            b"subscription",
            user.key().as_ref(),
            merchant_plan.merchant.as_ref(),
            merchant_plan.mint.as_ref()
        ],
        bump
    )]
    pub subscription_state: Account<'info, SubscriptionState>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + SessionTokenTracker::INIT_SPACE,
        seeds = [
            b"session_token",
            session_token.as_bytes()
        ],
        bump,
        constraint = !session_token_tracker.is_used @ ErrorCodes::SessionTokenAlreadyUsed
    )]
    pub session_token_tracker: Account<'info, SessionTokenTracker>,

    #[account(
        mut,
        seeds = [
            b"subscription_wallet",
            subscription_wallet.owner.as_ref(),
            subscription_wallet.mint.as_ref()
        ],
        bump = subscription_wallet.bump,
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(
        mut,
        constraint = merchant_plan.is_active @ ErrorCodes::PlanInactive
    )]
    pub merchant_plan: Account<'info, MerchantPlan>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        token::mint = subscription_wallet.mint,
        token::authority = subscription_wallet
    )]
    pub wallet_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubscribeWithWallet>,
    session_token: String,
) -> Result<()> {
    let merchant_plan = &ctx.accounts.merchant_plan;
    let wallet = &mut ctx.accounts.subscription_wallet;
    
    require!(merchant_plan.is_active, ErrorCodes::PlanInactive);
    require!(
        wallet.owner == ctx.accounts.user.key(),
        ErrorCodes::UnauthorizedWalletAccess
    );
    require!(session_token.len() <= 64, ErrorCodes::SessionTokenTooLong);
    require!(!session_token.is_empty(), ErrorCodes::SessionTokenRequired);

    let tracker = &ctx.accounts.session_token_tracker;
    if tracker.is_used {
        return Err(ErrorCodes::SessionTokenAlreadyUsed.into());
    }

    if !tracker.session_token.is_empty() && tracker.session_token != session_token {
        msg!("Security alert: Session token mismatch detected");
        return Err(ErrorCodes::SessionTokenAlreadyUsed.into());
    }

    // Calculate required buffer (3 months)
    let min_buffer = merchant_plan.fee_amount.checked_mul(3).unwrap();
    let wallet_balance = ctx.accounts.wallet_token_account.amount;

    require!(
        wallet_balance >= min_buffer,
        ErrorCodes::InsufficientWalletBalance
    );

    // Create subscription
    let subscription = &mut ctx.accounts.subscription_state;
    
    subscription.user = ctx.accounts.user.key();
    subscription.subscription_wallet = wallet.key();
    subscription.merchant = merchant_plan.merchant;
    subscription.mint = merchant_plan.mint;
    subscription.merchant_plan = ctx.accounts.merchant_plan.key();
    subscription.fee_amount = merchant_plan.fee_amount;
    subscription.payment_interval = merchant_plan.payment_interval;
    subscription.last_payment_timestamp = Clock::get()?.unix_timestamp;
    subscription.session_token = session_token.clone();
    subscription.bump = ctx.bumps.subscription_state;
    subscription.is_active = true;
    subscription.total_paid = 0;
    subscription.payment_count = 0;

    // Mark session token as used
    let tracker = &mut ctx.accounts.session_token_tracker;
    tracker.session_token = session_token.clone();
    tracker.user = ctx.accounts.user.key();
    tracker.subscription = subscription.key();
    tracker.timestamp = Clock::get()?.unix_timestamp;
    tracker.is_used = true;
    tracker.bump = ctx.bumps.session_token_tracker;

    // Update counters
    wallet.total_subscriptions = wallet.total_subscriptions
        .checked_add(1)
        .ok_or(ErrorCodes::MathOverflow)?;

    let merchant_plan = &mut ctx.accounts.merchant_plan;
    merchant_plan.total_subscribers = merchant_plan.total_subscribers
        .checked_add(1)
        .ok_or(ErrorCodes::MathOverflow)?;

    emit!(SubscriptionCreated {
        subscription_pda: subscription.key(),
        user: subscription.user,
        wallet: subscription.subscription_wallet,
        merchant: subscription.merchant,
        plan_id: merchant_plan.plan_id.clone(),
        session_token: session_token,
    });

    Ok(())
}