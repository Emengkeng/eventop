use anchor_lang::prelude::*;
use crate::{
    SubscriptionState, SubscriptionWallet, MerchantPlan,
    SubscriptionCancelled, ErrorCodes
};

#[derive(Accounts)]
pub struct CancelSubscriptionWallet<'info> {
    #[account(
        mut,
        seeds = [
            b"subscription",
            subscription_state.user.as_ref(),
            subscription_state.merchant.as_ref(),
            subscription_state.mint.as_ref()
        ],
        bump = subscription_state.bump,
        has_one = user @ ErrorCodes::UnauthorizedCancellation,
        close = user
    )]
    pub subscription_state: Account<'info, SubscriptionState>,

    #[account(
        mut,
        constraint = subscription_wallet.key() == subscription_state.subscription_wallet
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(mut)]
    pub merchant_plan: Account<'info, MerchantPlan>,

    #[account(mut)]
    pub user: Signer<'info>,
}

pub fn handler(ctx: Context<CancelSubscriptionWallet>) -> Result<()> {
    let subscription = &ctx.accounts.subscription_state;
    let wallet = &mut ctx.accounts.subscription_wallet;
    let merchant_plan = &mut ctx.accounts.merchant_plan;
    
    require!(subscription.is_active, ErrorCodes::SubscriptionInactive);

    wallet.total_subscriptions = wallet.total_subscriptions.saturating_sub(1);
    merchant_plan.total_subscribers = merchant_plan.total_subscribers.saturating_sub(1);

    emit!(SubscriptionCancelled {
        subscription_pda: subscription.key(),
        wallet_pda: wallet.key(),
        user: subscription.user,
        merchant: subscription.merchant,
        payments_made: subscription.payment_count,
    });

    Ok(())
}