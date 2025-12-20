use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use crate::{ProtocolConfig, ProtocolInitialized, ErrorCode};

#[derive(Accounts)]
pub struct InitializeProtocol {
    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [b"protocol_config"],
        bump
    )]
    pub protocol_config: Account,

    #[account(mut)]
    pub authority: Signer,

    /// CHECK: Treasury account
    pub treasury: AccountInfo,

    pub system_program: Program,
}

pub fn handler(
    ctx: Context,
    protocol_fee_bps: u16,
) -> Result {
    require!(protocol_fee_bps <= 1000, ErrorCode::FeeTooHigh);
    
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