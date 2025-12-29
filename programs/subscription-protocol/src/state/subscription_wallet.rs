use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct SubscriptionWallet {    
    pub owner: Pubkey,
    pub main_token_account: Pubkey,
    pub mint: Pubkey,
    pub total_subscriptions: u32,
    pub total_spent: u64,
    pub yield_shares: u64,
    pub is_yield_enabled: bool,
    pub bump: u8,
}

impl SubscriptionWallet {
    pub const LEN: usize = 8 + 96 + 4 + 16 + 1 + 1;

    pub fn get_pda(owner: &Pubkey, mint: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[
                b"subscription_wallet",
                owner.as_ref(),
                mint.as_ref(),
            ],
            program_id,
        )
    }

    pub fn has_active_subscriptions(&self) -> bool {
        self.total_subscriptions > 0
    }

    pub fn calculate_yield_value(&self, vault_total_value: u64, vault_total_shares: u64) -> u64 {
        if vault_total_shares == 0 || !self.is_yield_enabled {
            return 0;
        }
        
        // value = (shares * total_value) / total_shares
        (self.yield_shares as u128)
            .saturating_mul(vault_total_value as u128)
            .checked_div(vault_total_shares as u128)
            .unwrap_or(0) as u64
    }
}