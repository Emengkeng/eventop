use anchor_lang::prelude::*;
use crate::{ProtocolConfig, ProtocolFeeUpdated, ErrorCodes};

#[derive(Accounts)]
pub struct UpdateProtocolFee<'info> {
    #[account(
        mut,
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
        has_one = authority @ ErrorCodes::UnauthorizedProtocolUpdate
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    pub authority: Signer<'info>,
}

pub fn handler(
    ctx: Context<UpdateProtocolFee>,
    new_fee_bps: u16,
) -> Result<()> {
    require!(new_fee_bps <= 1000, ErrorCodes::FeeTooHigh);
    
    let config = &mut ctx.accounts.protocol_config;
    let old_fee = config.protocol_fee_bps;
    config.protocol_fee_bps = new_fee_bps;

    emit!(ProtocolFeeUpdated {
        old_fee_bps: old_fee,
        new_fee_bps: new_fee_bps,
    });

    Ok(())
}