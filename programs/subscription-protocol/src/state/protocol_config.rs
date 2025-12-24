use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub protocol_fee_bps: u16,
    pub bump: u8,
}

impl ProtocolConfig {
    pub const LEN: usize = 8 + 32 + 32 + 2 + 1;

    pub fn get_pda(program_id: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[b"protocol_config"],
            program_id,
        )
    }

    pub fn calculate_fee(&self, amount: u64) -> u64 {
        (amount as u128)
            .saturating_mul(self.protocol_fee_bps as u128)
            .checked_div(10_000)
            .unwrap_or(0) as u64
    }
}