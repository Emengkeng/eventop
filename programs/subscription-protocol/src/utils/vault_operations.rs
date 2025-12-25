use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::{YieldVault, ErrorCodes};
use kamino_lend;
use kamino_lend::state::Reserve;

/// Get the total value held in the vault
/// Includes both buffer and Kamino deposits
/// 
/// # Arguments
/// * `kamino_reserve` - Kamino reserve account info
/// * `vault` - The yield vault
/// 
/// # Returns
/// * Total value in lamports
/// 
/// # TODO
/// Currently returns tracked amount. In production, should:
/// 1. Query Kamino reserve for actual collateral value
/// 2. Add buffer balance
/// 3. Return total
/// 
/// # Example
/// ```
/// let total = get_vault_total_value(kamino_reserve, &vault)?;
/// ```
pub fn get_vault_total_value(
    kamino_reserve: AccountInfo,
    vault: &YieldVault,
    vault_buffer: &Account<TokenAccount>,
    vault_collateral: &Account<TokenAccount>,
) -> Result<u64> {
    // Deserialize Kamino reserve to get exchange rate
    let reserve_data = kamino_reserve.try_borrow_data()?;
    let reserve = Reserve::try_deserialize(&mut &reserve_data[..])?;
    
    // Calculate total liquidity in the reserve
    let borrowed_amount = reserve.liquidity.borrowed_amount_wads
        .try_floor_u64()
        .ok_or(ErrorCodes::MathOverflow)?;
    
    let total_liquidity = reserve.liquidity.available_amount
        .checked_add(borrowed_amount)
        .ok_or(ErrorCodes::MathOverflow)?;
    
    let total_collateral_supply = reserve.collateral.mint_total_supply;
    
    // Calculate our Kamino position value
    // value = (our_kUSDC_balance * total_liquidity) / total_collateral_supply
    let kamino_value = (vault_collateral.amount as u128)
        .checked_mul(total_liquidity as u128)
        .ok_or(ErrorCodes::MathOverflow)?
        .checked_div(total_collateral_supply as u128)
        .ok_or(ErrorCodes::MathOverflow)?;
    
    // Total vault value = Kamino position + buffer
    let total_value = (kamino_value as u64)
        .checked_add(vault_buffer.amount)
        .ok_or(ErrorCodes::MathOverflow)?;
    
    Ok(total_value)
}

/// Withdraw USDC from vault buffer to a destination account
/// Uses PDA signing to authorize the transfer
/// 
/// # Arguments
/// * `vault_info` - The yield vault AccountInfo (PDA)
/// * `vault` - The yield vault account data
/// * `vault_buffer` - Buffer token account
/// * `destination` - Destination token account
/// * `token_program` - SPL Token program
/// * `amount` - Amount to withdraw
/// 
/// # Security
/// Uses vault PDA as authority with proper seeds
/// 
/// # Example
/// ```
/// withdraw_from_vault_internal(
///     ctx.accounts.yield_vault.to_account_info(),
///     &ctx.accounts.yield_vault,
///     &buffer_account,
///     &user_account,
///     &token_program,
///     1000
/// )?;
/// ```
pub fn withdraw_from_vault_internal<'info>(
    vault_info: AccountInfo<'info>,
    vault: &YieldVault,
    vault_buffer: &Account<'info, TokenAccount>,
    destination: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    let mint_key = vault.mint;
    let bump = vault.bump;
    let seeds = &[
        b"yield_vault",
        mint_key.as_ref(),
        &[bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: vault_buffer.to_account_info(),
        to: destination.to_account_info(),
        authority: vault_info, // Use the AccountInfo, not the data struct
    };
    
    let cpi_ctx = CpiContext::new_with_signer(
        token_program.to_account_info(),
        cpi_accounts,
        signer,
    );
    
    token::transfer(cpi_ctx, amount)?;
    Ok(())
}

/// Deposit USDC to Kamino lending protocol
/// 
/// # Arguments
/// * `vault` - The yield vault
/// * `from` - Source token account (vault buffer)
/// * `kamino_reserve` - Kamino reserve account
/// * `kamino_collateral` - Kamino collateral token account
/// * `token_program` - SPL Token program
/// * `amount` - Amount to deposit
/// * `bump` - PDA bump seed
/// 
/// # TODO
/// Implement actual Kamino CPI call
/// 
/// # Kamino Integration
/// ```
/// // Production implementation would:
/// use kamino::cpi::accounts::DepositReserveLiquidity;
/// use kamino::cpi::deposit_reserve_liquidity;
/// 
/// let cpi_accounts = DepositReserveLiquidity {
///     reserve: kamino_reserve,
///     reserve_liquidity_supply: vault_buffer,
///     user_collateral: kamino_collateral,
///     user_transfer_authority: vault,
///     ...
/// };
/// 
/// deposit_reserve_liquidity(cpi_ctx, amount)?;
/// ```
pub fn deposit_to_kamino_internal<'info>(
    vault: &Account<'info, YieldVault>,
    vault_buffer: &Account<'info, TokenAccount>,
    vault_collateral: &Account<'info, TokenAccount>,
    
    kamino_program: &AccountInfo<'info>,
    reserve: &AccountInfo<'info>,
    lending_market: &AccountInfo<'info>,
    lending_market_authority: &AccountInfo<'info>,
    reserve_liquidity_supply: &AccountInfo<'info>,
    reserve_collateral_mint: &AccountInfo<'info>,
    
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, ErrorCodes::InvalidAmount);
    require!(vault_buffer.amount >= amount, ErrorCodes::InsufficientFunds);
    
    let mint_key = vault.mint;
    let bump = vault.bump;
    let seeds = &[
        b"yield_vault",
        mint_key.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = kamino_lend::cpi::accounts::DepositReserveLiquidity {
        owner: vault.to_account_info(),
        reserve: reserve.clone(),
        lending_market: lending_market.clone(),
        lending_market_authority: lending_market_authority.clone(),
        reserve_liquidity_supply: reserve_liquidity_supply.clone(),
        reserve_collateral_mint: reserve_collateral_mint.clone(),
        user_source_liquidity: vault_buffer.to_account_info(),
        user_destination_collateral: vault_collateral.to_account_info(),
        // token_program: token_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        kamino_program.clone(),
        cpi_accounts,
        signer_seeds,
    );

    kamino_lend::cpi::deposit_reserve_liquidity(cpi_ctx, amount)?;
    
    msg!("Deposited {} USDC to Kamino", amount);
    Ok(())
}

/// Withdraw USDC from Kamino lending protocol
/// 
/// # Arguments
/// * `vault` - The yield vault
/// * `kamino_reserve` - Kamino reserve account
/// * `kamino_collateral` - Kamino collateral token account
/// * `to` - Destination token account (vault buffer)
/// * `token_program` - SPL Token program
/// * `amount` - Amount to withdraw
/// * `bump` - PDA bump seed
/// 
/// # TODO
/// Implement actual Kamino CPI call
/// 
/// # Kamino Integration
/// ```
/// // Production implementation would:
/// use kamino::cpi::accounts::RedeemReserveCollateral;
/// use kamino::cpi::redeem_reserve_collateral;
/// 
/// let cpi_accounts = RedeemReserveCollateral {
///     reserve: kamino_reserve,
///     reserve_collateral_mint: kamino_collateral_mint,
///     user_collateral: kamino_collateral,
///     user_liquidity: vault_buffer,
///     user_transfer_authority: vault,
///     ...
/// };
/// 
/// redeem_reserve_collateral(cpi_ctx, collateral_amount)?;
/// ```
pub fn withdraw_from_kamino_internal<'info>(
    vault: &Account<'info, YieldVault>,
    vault_buffer: &Account<'info, TokenAccount>,
    vault_collateral: &Account<'info, TokenAccount>,
    
    kamino_program: &AccountInfo<'info>,
    reserve: &AccountInfo<'info>,
    lending_market: &AccountInfo<'info>,
    lending_market_authority: &AccountInfo<'info>,
    reserve_collateral_mint: &AccountInfo<'info>,
    reserve_liquidity_supply: &AccountInfo<'info>,
    
    token_program: &Program<'info, Token>,
    collateral_amount: u64, // Amount of kUSDC to redeem
) -> Result<()> {
    require!(collateral_amount > 0, ErrorCodes::InvalidAmount);
    require!(
        vault_collateral.amount >= collateral_amount,
        ErrorCodes::InsufficientCollateral
    );
    
    let mint_key = vault.mint;
    let bump = vault.bump;
    let seeds = &[
        b"yield_vault",
        mint_key.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = kamino_lend::cpi::accounts::RedeemReserveCollateral {
        owner: vault.to_account_info(),
        lending_market: lending_market.clone(),
        lending_market_authority: lending_market_authority.clone(),
        reserve: reserve.clone(),
        reserve_collateral_mint: reserve_collateral_mint.clone(),
        reserve_liquidity_supply: reserve_liquidity_supply.clone(),
        user_source_collateral: vault_collateral.to_account_info(),
        user_destination_liquidity: vault_buffer.to_account_info(),
        // token_program: token_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        kamino_program.clone(),
        cpi_accounts,
        signer_seeds,
    );

    kamino_lend::cpi::redeem_reserve_collateral(cpi_ctx, collateral_amount)?;
    
    msg!("Redeemed {} kUSDC from Kamino", collateral_amount);
    Ok(())
}

pub fn calculate_collateral_for_liquidity(
    liquidity_amount: u64,
    kamino_reserve: &AccountInfo,
) -> Result<u64> {
    let reserve_data = kamino_reserve.try_borrow_data()?;
    let reserve = Reserve::try_deserialize(&mut &reserve_data[..])?;
    
    let borrowed_amount = reserve.liquidity.borrowed_amount_wads
        .try_floor_u64()
        .ok_or(ErrorCodes::MathOverflow)?;
    
    let total_liquidity = reserve.liquidity.available_amount
        .checked_add(borrowed_amount)
        .ok_or(ErrorCodes::MathOverflow)?;
    
    let total_collateral_supply = reserve.collateral.mint_total_supply;
    
    // collateral_needed = (liquidity_amount * total_collateral_supply) / total_liquidity
    let collateral_needed = (liquidity_amount as u128)
        .checked_mul(total_collateral_supply as u128)
        .ok_or(ErrorCodes::MathOverflow)?
        .checked_div(total_liquidity as u128)
        .ok_or(ErrorCodes::MathOverflow)?;
    
    Ok(collateral_needed as u64)
}