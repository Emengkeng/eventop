use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct SubscriptionState {
    pub user: Pubkey,
    pub subscription_wallet: Pubkey, // KEY CHANGE: Links to wallet instead of escrow
    pub merchant: Pubkey,
    pub mint: Pubkey,
    pub merchant_plan: Pubkey,
    pub fee_amount: u64,
    pub payment_interval: i64,
    pub last_payment_timestamp: i64,
    pub total_paid: u64,
    pub payment_count: u32,
    pub is_active: bool,
    #[max_len(64)]
    pub session_token: String,
    pub bump: u8,
}