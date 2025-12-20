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