use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::{YieldVault, errors::ErrorCode};

pub fn get_vault_total_value(
    _kamino_reserve: AccountInfo,
    vault: &YieldVault,
) -> Result {
    // TODO: Query Kamino reserve for actual collateral value
    Ok(vault.total_usdc_deposited)
}

pub fn withdraw_from_vault_internal(
    vault: &YieldVault,
    vault_buffer: &Account,
    destination: &Account,
    token_program: &Program,
    amount: u64,
    bump: u8,
) -> Result {
    let mint_key = vault.mint;
    let seeds = &[
        b"yield_vault",
        mint_key.as_ref(),
        &[bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: vault_buffer.to_account_info(),
        to: destination.to_account_info(),
        authority: vault.to_account_info(),
    };
    
    let cpi_ctx = CpiContext::new_with_signer(
        token_program.to_account_info(),
        cpi_accounts,
        signer,
    );
    
    token::transfer(cpi_ctx, amount)?;
    Ok(())
}

pub fn deposit_to_kamino_internal(
    _vault: &YieldVault,
    _from: &Account,
    _kamino_reserve: &AccountInfo,
    _kamino_collateral: &Account,
    _token_program: &Program,
    _amount: u64,
    _bump: u8,
) -> Result {
    //TODO: implement it
    msg!("Depositing to Kamino (placeholder)");
    Ok(())
}

pub fn withdraw_from_kamino_internal(
    _vault: &YieldVault,
    _kamino_reserve: &AccountInfo,
    _kamino_collateral: &Account,
    _to: &Account,
    _token_program: &Program,
    _amount: u64,
    _bump: u8,
) -> Result {
    //TODO: implement it
    msg!("Withdrawing from Kamino (placeholder)");
    Ok(())
}