use anchor_lang::prelude::*;
use crate::{SubscriptionWallet, ErrorCodes};

/// Calculate buffer amount based on total amount and buffer basis points
/// 
/// # Arguments
/// * `total_amount` - Total amount in lamports
/// * `buffer_bps` - Buffer percentage in basis points (e.g., 1500 = 15%)
/// 
/// # Returns
/// * Buffer amount in lamports
/// 
/// # Example
/// ```
/// let buffer = calculate_buffer_amount(10_000, 1500)?; // 1,500 (15% of 10,000)
/// ```
pub fn calculate_buffer_amount(total_amount: u64, buffer_bps: u16) -> Result<u64> {
    let buffer = (total_amount as u128)
        .checked_mul(buffer_bps as u128)
        .ok_or(ErrorCodes::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ErrorCodes::MathOverflow)? as u64;
    
    Ok(buffer)
}

/// Calculate shares to issue for a deposit
/// Uses current exchange rate: shares = (deposit * total_shares) / total_value
/// 
/// # Arguments
/// * `deposit_amount` - Amount being deposited
/// * `total_shares` - Total shares currently issued
/// * `total_vault_value` - Total value in the vault
/// 
/// # Returns
/// * Number of shares to issue
/// 
/// # Example
/// ```
/// // Vault has 10,000 value and 5,000 shares (2:1 ratio)
/// // User deposits 1,000
/// let shares = calculate_shares_for_deposit(1_000, 5_000, 10_000)?;
/// // Returns 500 shares
/// ```
pub fn calculate_shares_for_deposit(
    deposit_amount: u64,
    total_shares: u64,
    total_vault_value: u64,
) -> Result<u64> {
    // First deposit: 1:1 ratio
    if total_shares == 0 || total_vault_value == 0 {
        return Ok(deposit_amount);
    }
    
    // Subsequent deposits: proportional to current ratio
    // shares = (deposit * total_shares) / total_value
    let shares = (deposit_amount as u128)
        .checked_mul(total_shares as u128)
        .ok_or(ErrorCodes::MathOverflow)?
        .checked_div(total_vault_value as u128)
        .ok_or(ErrorCodes::MathOverflow)? as u64;
    
    Ok(shares)
}

/// Calculate USDC value of shares
/// Uses exchange rate: value = (shares * total_value) / total_shares
/// 
/// # Arguments
/// * `shares` - Number of shares to value
/// * `total_shares` - Total shares issued
/// * `total_vault_value` - Total value in vault
/// 
/// # Returns
/// * USDC value in lamports
/// 
/// # Example
/// ```
/// // Vault has 10,000 value and 5,000 shares
/// // User has 1,000 shares
/// let value = calculate_usdc_value_of_shares(1_000, 5_000, 10_000)?;
/// // Returns 2,000
/// ```
pub fn calculate_usdc_value_of_shares(
    shares: u64,
    total_shares: u64,
    total_vault_value: u64,
) -> Result<u64> {
    if total_shares == 0 {
        return Ok(0);
    }
    
    // value = (shares * total_value) / total_shares
    let value = (shares as u128)
        .checked_mul(total_vault_value as u128)
        .ok_or(ErrorCodes::MathOverflow)?
        .checked_div(total_shares as u128)
        .ok_or(ErrorCodes::MathOverflow)? as u64;
    
    Ok(value)
}

/// Calculate shares needed for withdrawal of specific USDC amount
/// Inverse of value calculation: shares = (amount * total_shares) / total_value
/// 
/// # Arguments
/// * `withdraw_amount` - USDC amount to withdraw
/// * `total_shares` - Total shares issued
/// * `total_vault_value` - Total value in vault
/// 
/// # Returns
/// * Number of shares needed
/// 
/// # Example
/// ```
/// // Vault has 10,000 value and 5,000 shares
/// // User wants to withdraw 2,000 USDC
/// let shares = calculate_shares_for_withdrawal(2_000, 5_000, 10_000)?;
/// // Returns 1,000 shares
/// ```
pub fn calculate_shares_for_withdrawal(
    withdraw_amount: u64,
    total_shares: u64,
    total_vault_value: u64,
) -> Result<u64> {
    if total_vault_value == 0 {
        return Ok(0);
    }
    
    // shares_needed = (amount * total_shares) / total_value
    let shares = (withdraw_amount as u128)
        .checked_mul(total_shares as u128)
        .ok_or(ErrorCodes::MathOverflow)?
        .checked_div(total_vault_value as u128)
        .ok_or(ErrorCodes::MathOverflow)? as u64;
    
    Ok(shares)
}

/// Calculate current exchange rate (price per share)
/// Returns rate with 6 decimals precision (1_000_000 = 1:1)
/// 
/// # Arguments
/// * `total_shares` - Total shares issued
/// * `total_vault_value` - Total value in vault
/// 
/// # Returns
/// * Exchange rate with 6 decimals (e.g., 1_500_000 = 1.5 USDC per share)
/// 
/// # Example
/// ```
/// // Vault has 10,000 value and 5,000 shares
/// let rate = calculate_current_exchange_rate(5_000, 10_000)?;
/// // Returns 2_000_000 (2.0 USDC per share)
/// ```
pub fn calculate_current_exchange_rate(
    total_shares: u64,
    total_vault_value: u64,
) -> Result<u64> {
    if total_shares == 0 {
        return Ok(1_000_000); // 1:1 with 6 decimals
    }
    
    // rate = (total_value * 1e6) / total_shares
    let rate = (total_vault_value as u128)
        .checked_mul(1_000_000)
        .ok_or(ErrorCodes::MathOverflow)?
        .checked_div(total_shares as u128)
        .ok_or(ErrorCodes::MathOverflow)? as u64;
    
    Ok(rate)
}

/// Calculate committed balance for a wallet (3-month subscription buffer)
/// This represents funds that should not be withdrawn
/// 
/// # Arguments
/// * `wallet` - The subscription wallet
/// 
/// # Returns
/// * Committed amount in lamports
/// 
/// # TODO
/// This is a placeholder. In production, you would:
/// 1. Query all active subscriptions for this wallet
/// 2. Calculate 3 months worth of subscription fees
/// 3. Return the sum
/// 
/// # Example
/// ```
/// let committed = calculate_committed_balance(&wallet)?;
/// let withdrawable = wallet_balance - committed;
/// ```
pub fn calculate_committed_balance(_wallet: &SubscriptionWallet) -> Result<u64> {
    // TODO: Query all active subscriptions and calculate 3-month buffer
    // For now, returns 0 (no restrictions)
    // 
    // Production implementation would:
    // 1. Iterate through active subscriptions
    // 2. For each subscription: fee_amount * 3
    // 3. Sum all commitments
    // 
    // Example:
    // if wallet has subscriptions:
    //   - Netflix: $10/month → $30 committed
    //   - Spotify: $5/month → $15 committed
    //   - Total: $45 committed
    
    Ok(0)
}
