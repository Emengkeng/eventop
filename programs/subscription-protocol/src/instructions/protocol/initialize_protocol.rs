use anchor_lang::prelude::*;
use crate::{ProtocolConfig, ProtocolInitialized, ErrorCodes};

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [b"protocol_config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Treasury account
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeProtocol>,
    protocol_fee_bps: u16,
) -> Result<()> {
    require!(protocol_fee_bps <= 1000, ErrorCodes::FeeTooHigh);
    
    let config = &mut ctx.accounts.protocol_config;
    config.authority = ctx.accounts.authority.key();
    config.protocol_fee_bps = protocol_fee_bps;
    config.treasury = ctx.accounts.treasury.key();
    config.bump = ctx.bumps.protocol_config;

    emit!(ProtocolInitialized {
        authority: config.authority,
        fee_bps: protocol_fee_bps,
        treasury: config.treasury,
    });

    Ok(())
}