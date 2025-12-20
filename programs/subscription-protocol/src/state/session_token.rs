use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct SessionTokenTracker {
    #[max_len(64)]
    pub session_token: String,
    pub user: Pubkey,
    pub subscription: Pubkey,
    pub timestamp: i64,
    pub is_used: bool,
    pub bump: u8,
}