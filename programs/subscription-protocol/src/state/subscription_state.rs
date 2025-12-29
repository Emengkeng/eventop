use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct SubscriptionState {    
    pub user: Pubkey,
    pub subscription_wallet: Pubkey,
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

impl SubscriptionState {
    pub const LEN: usize = 8 + 160 + 8 + 24 + 4 + 1 + 68 + 1;

    /// Get the subscription state PDA
    pub fn get_pda(
        user: &Pubkey,
        merchant: &Pubkey,
        mint: &Pubkey,
        program_id: &Pubkey,
    ) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[
                b"subscription",
                user.as_ref(),
                merchant.as_ref(),
                mint.as_ref(),
            ],
            program_id,
        )
    }

    pub fn is_payment_due(&self, current_time: i64) -> bool {
        current_time >= self.last_payment_timestamp + self.payment_interval
    }

    pub fn time_until_next_payment(&self, current_time: i64) -> i64 {
        (self.last_payment_timestamp + self.payment_interval) - current_time
    }
}