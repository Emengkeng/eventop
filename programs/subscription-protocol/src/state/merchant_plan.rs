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

impl MerchantPlan {
    pub const LEN: usize = 8 + 64 + 36 + 68 + 8 + 8 + 1 + 4 + 1;

    /// Get the merchant plan PDA
    pub fn get_pda(
        merchant: &Pubkey,
        mint: &Pubkey,
        plan_id: &str,
        program_id: &Pubkey,
    ) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[
                b"merchant_plan",
                merchant.as_ref(),
                mint.as_ref(),
                plan_id.as_bytes(),
            ],
            program_id,
        )
    }

    pub fn is_payment_due(&self, last_payment_timestamp: i64, current_time: i64) -> bool {
        current_time >= last_payment_timestamp + self.payment_interval
    }
}