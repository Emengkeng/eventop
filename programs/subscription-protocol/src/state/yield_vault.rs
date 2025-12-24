use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct YieldVault {   
     pub authority: Pubkey,
    pub mint: Pubkey,
    pub usdc_buffer: Pubkey,
    pub kamino_collateral: Pubkey,
    pub kamino_reserve: Pubkey,
    pub total_shares_issued: u64,
    pub total_usdc_deposited: u64,
    pub target_buffer_bps: u16,
    pub emergency_mode: bool,
    pub emergency_exchange_rate: u64,
    pub bump: u8,
}

impl YieldVault {
    pub const LEN: usize = 8 + 160 + 24 + 2 + 1 + 8 + 1;

    pub fn get_pda(mint: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[b"yield_vault", mint.as_ref()],
            program_id,
        )
    }

    pub fn is_operational(&self) -> bool {
        !self.emergency_mode
    }

    pub fn calculate_target_buffer(&self, total_value: u64) -> u64 {
        (total_value as u128)
            .saturating_mul(self.target_buffer_bps as u128)
            .checked_div(10_000)
            .unwrap_or(0) as u64
    }
}
