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

impl SessionTokenTracker {
    pub const LEN: usize = 8 + 68 + 32 + 32 + 8 + 1 + 1;

    /// Get the session token tracker PDA
    pub fn get_pda(session_token: &str, program_id: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[
                b"session_token",
                session_token.as_bytes(),
            ],
            program_id,
        )
    }

    pub fn is_valid(&self, current_time: i64, max_age_seconds: i64) -> bool {
        !self.is_used && (current_time - self.timestamp) <= max_age_seconds
    }
}