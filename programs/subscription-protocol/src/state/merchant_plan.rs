use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct MerchantPlan {
    pub merchant: Pubkey,
    pub mint: Pubkey,
    #[max_len(32)]
    pub plan_id: String,
    #[max_len(64)]
    pub plan_name: String,
    pub fee_amount: u64,
    pub payment_interval: i64,
    pub is_active: bool,
    pub total_subscribers: u32,
    pub bump: u8,
}