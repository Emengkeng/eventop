use anchor_lang::prelude::*;
use crate::errors::ErrorCode;

pub fn calculate_buffer_amount(total_amount: u64, buffer_bps: u16) -> Result {
    let buffer = (total_amount as u128)
        .checked_mul(buffer_bps as u128)
        .unwrap()
        .checked_div(10_000)
        .unwrap() as u64;
    Ok(buffer)
}

pub fn calculate_shares_for_deposit(
    deposit_amount: u64,
    total_shares: u64,
    total_vault_value: u64,
) -> Result {
    if total_shares == 0 || total_vault_value == 0 {
        return Ok(deposit_amount);
    }
    
    let shares = (deposit_amount as u128)
        .checked_mul(total_shares as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(total_vault_value as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;
    
    Ok(shares)
}

pub fn calculate_usdc_value_of_shares(
    shares: u64,
    total_shares: u64,
    total_vault_value: u64,
) -> Result {
    if total_shares == 0 {
        return Ok(0);
    }
    
    let value = (shares as u128)
        .checked_mul(total_vault_value as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(total_shares as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;
    
    Ok(value)
}

pub fn calculate_shares_for_withdrawal(
    withdraw_amount: u64,
    total_shares: u64,
    total_vault_value: u64,
) -> Result {
    let shares = (withdraw_amount as u128)
        .checked_mul(total_shares as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(total_vault_value as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;
    
    Ok(shares)
}

pub fn calculate_current_exchange_rate(
    total_shares: u64,
    total_vault_value: u64,
) -> Result {
    if total_shares == 0 {
        return Ok(1_000_000);
    }
    
    let rate = (total_vault_value as u128)
        .checked_mul(1_000_000)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(total_shares as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;
    
    Ok(rate)
}

pub fn calculate_committed_balance(_wallet: &crate::SubscriptionWallet) -> Result {
    // TODO: Query all active subscriptions and calculate 3-month buffer
    Ok(0)
}