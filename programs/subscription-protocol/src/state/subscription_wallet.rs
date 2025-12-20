use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct SubscriptionWallet {
    pub owner: Pubkey,
    pub main_token_account: Pubkey,
    pub mint: Pubkey,
    pub yield_vault: Pubkey,
    pub yield_strategy: YieldStrategy,
    pub is_yield_enabled: bool,
    pub total_subscriptions: u32,
    pub total_spent: u64,
    pub yield_shares: u64,
    pub bump: u8,
}