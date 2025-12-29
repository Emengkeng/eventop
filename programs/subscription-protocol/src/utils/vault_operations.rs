use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::{YieldVault, ErrorCodes};

pub const JUPITER_LENDING_PROGRAM_DEVNET: &str = "7tjE28izRUjzmxC1QNXnNwcc4N82CNYCexf3k8mw67s3";
pub const JUPITER_LIQUIDITY_PROGRAM_DEVNET: &str = "5uDkCoM96pwGYhAUucvCzLfm5UcjVRuxz6gH81RnRBmL";

pub const JUPITER_LENDING_PROGRAM_MAINNET: &str = "jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9";
pub const JUPITER_LIQUIDITY_PROGRAM_MAINNET: &str = "jupeiUmn818Jg1ekPURTpr4mFo29p46vygyykFJ3wZC";

fn get_deposit_discriminator() -> Vec<u8> {
    // sha256("global:deposit")[0..8]
    vec![242, 35, 198, 137, 82, 225, 242, 182]
}

fn get_withdraw_discriminator() -> Vec<u8> {
    // sha256("global:withdraw")[0..8]
    vec![183, 18, 70, 156, 148, 109, 161, 34]
}

/// Get the total value held in the vault
/// Includes both buffer and Jupiter Lend deposits
/// 
/// # Arguments
/// * `jupiter_lending` - Jupiter lending account info
/// * `vault` - The yield vault
/// 
/// # Returns
/// * Total value in lamports
pub fn get_vault_total_value(
    jupiter_lending: AccountInfo,
    vault: &YieldVault,
    vault_buffer_account: Option<&Account<TokenAccount>>,
    vault_ftoken_account: Option<&Account<TokenAccount>>,
) -> Result<u64> {
    let mut total_value = 0u64;
    
    // Add buffer balance
    if let Some(buffer) = vault_buffer_account {
        total_value = total_value
            .checked_add(buffer.amount)
            .ok_or(ErrorCodes::MathOverflow)?;
    }
    
    // Add Jupiter Lend position value
    if let Some(ftoken_account) = vault_ftoken_account {
        let ftoken_balance = ftoken_account.amount;
        
        if ftoken_balance > 0 {
            // Deserialize Jupiter Lending account to get exchange rate
            let lending_data = jupiter_lending.try_borrow_data()?;
            
            // The Lending account structure (from IDL):
            // - First 8 bytes: discriminator
            // - Following bytes: account data
            require!(lending_data.len() >= 8, ErrorCodes::InvalidJupiterLendAccount);
            
            // Skip discriminator and read the Lending struct
            // Based on Jupiter Lend IDL, the token_exchange_price is at offset:
            // mint (32) + f_token_mint (32) + lending_id (2) + decimals (1) + rewards_rate_model (32) + 
            // liquidity_exchange_price (8) + token_exchange_price (8)
            let exchange_rate_offset = 8 + 32 + 32 + 2 + 1 + 32 + 8;
            
            require!(
                lending_data.len() >= exchange_rate_offset + 8,
                ErrorCodes::InvalidJupiterLendAccount
            );
            
            // Read token_exchange_price (u64) - represents value of 1 fToken
            let mut exchange_rate_bytes = [0u8; 8];
            exchange_rate_bytes.copy_from_slice(
                &lending_data[exchange_rate_offset..exchange_rate_offset + 8]
            );
            let exchange_rate = u64::from_le_bytes(exchange_rate_bytes);
            
            // Calculate underlying value: (fToken_balance * exchange_rate) / 1e9
            // Jupiter uses 1e9 precision for exchange rates
            let ftoken_value = (ftoken_balance as u128)
                .checked_mul(exchange_rate as u128)
                .ok_or(ErrorCodes::MathOverflow)?
                .checked_div(1_000_000_000) // 1e9 precision
                .ok_or(ErrorCodes::MathOverflow)? as u64;
            
            total_value = total_value
                .checked_add(ftoken_value)
                .ok_or(ErrorCodes::MathOverflow)?;
        }
    }
    
    // Fallback to tracked amount if no accounts provided
    if vault_buffer_account.is_none() && vault_ftoken_account.is_none() {
        return Ok(vault.total_usdc_deposited);
    }
    
    Ok(total_value)
}

/// Withdraw USDC from vault buffer to a destination account
/// Uses PDA signing to authorize the transfer
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
        authority: vault_info,
    };
    
    let cpi_ctx = CpiContext::new_with_signer(
        token_program.to_account_info(),
        cpi_accounts,
        signer,
    );
    
    token::transfer(cpi_ctx, amount)?;
    Ok(())
}

/// Deposit USDC to Jupiter Lend protocol
/// 
/// # Arguments
/// * `vault` - The yield vault (contains authority info)
/// * `from` - Source token account (vault buffer)
/// * `recipient_ftoken_account` - Destination for fTokens
/// * `jupiter_accounts` - Jupiter Lend specific accounts
/// * `token_program` - SPL Token program
/// * `amount` - Amount to deposit
pub fn deposit_to_jupiter_lend_internal<'info>(
    vault: &Account<'info, YieldVault>,
    from: &Account<'info, TokenAccount>,
    recipient_ftoken_account: &Account<'info, TokenAccount>,
    jupiter_accounts: &JupiterLendAccounts<'info>,
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
    let signer_seeds = &[&seeds[..]];

    // Build deposit instruction data
    let mut instruction_data = get_deposit_discriminator();
    instruction_data.extend_from_slice(&amount.to_le_bytes());

    let account_metas = vec![
        // Signer (vault PDA)
        AccountMeta::new(vault.key(), true),
        // Depositor token account (vault buffer)
        AccountMeta::new(from.key(), false),
        // Recipient token account (fToken account)
        AccountMeta::new(recipient_ftoken_account.key(), false),
        // Mint (underlying token)
        AccountMeta::new_readonly(jupiter_accounts.mint.key(), false),
        // Lending admin
        AccountMeta::new_readonly(jupiter_accounts.lending_admin.key(), false),
        // Lending
        AccountMeta::new(jupiter_accounts.lending.key(), false),
        // fToken mint
        AccountMeta::new(jupiter_accounts.f_token_mint.key(), false),
        // Supply token reserves liquidity
        AccountMeta::new(jupiter_accounts.supply_token_reserves_liquidity.key(), false),
        // Lending supply position on liquidity
        AccountMeta::new(jupiter_accounts.lending_supply_position_on_liquidity.key(), false),
        // Rate model
        AccountMeta::new_readonly(jupiter_accounts.rate_model.key(), false),
        // Vault
        AccountMeta::new(jupiter_accounts.jupiter_vault.key(), false),
        // Liquidity
        AccountMeta::new(jupiter_accounts.liquidity.key(), false),
        // Liquidity program
        AccountMeta::new(jupiter_accounts.liquidity_program.key(), false),
        // Rewards rate model
        AccountMeta::new_readonly(jupiter_accounts.rewards_rate_model.key(), false),
        // Token program
        AccountMeta::new_readonly(token_program.key(), false),
        // Associated token program
        AccountMeta::new_readonly(jupiter_accounts.associated_token_program.key(), false),
        // System program
        AccountMeta::new_readonly(jupiter_accounts.system_program.key(), false),
    ];

    let instruction = Instruction {
        program_id: jupiter_accounts.lending_program.key(),
        accounts: account_metas,
        data: instruction_data,
    };

    let account_infos = vec![
        vault.to_account_info(),
        from.to_account_info(),
        recipient_ftoken_account.to_account_info(),
        jupiter_accounts.mint.to_account_info(),
        jupiter_accounts.lending_admin.to_account_info(),
        jupiter_accounts.lending.to_account_info(),
        jupiter_accounts.f_token_mint.to_account_info(),
        jupiter_accounts.supply_token_reserves_liquidity.to_account_info(),
        jupiter_accounts.lending_supply_position_on_liquidity.to_account_info(),
        jupiter_accounts.rate_model.to_account_info(),
        jupiter_accounts.jupiter_vault.to_account_info(),
        jupiter_accounts.liquidity.to_account_info(),
        jupiter_accounts.liquidity_program.to_account_info(),
        jupiter_accounts.rewards_rate_model.to_account_info(),
        token_program.to_account_info(),
        jupiter_accounts.associated_token_program.to_account_info(),
        jupiter_accounts.system_program.to_account_info(),
    ];

    invoke_signed(&instruction, &account_infos, signer_seeds)
        .map_err(|_| ErrorCodes::JupiterLendDepositFailed)?;

    msg!("Deposited {} to Jupiter Lend", amount);
    Ok(())
}

/// Withdraw USDC from Jupiter Lend protocol
/// 
/// # Arguments
/// * `vault` - The yield vault
/// * `owner_ftoken_account` - Source fToken account (owned by vault)
/// * `recipient_token_account` - Destination for underlying tokens (vault buffer)
/// * `jupiter_accounts` - Jupiter Lend specific accounts
/// * `token_program` - SPL Token program
/// * `amount` - Amount of underlying assets to withdraw
pub fn withdraw_from_jupiter_lend_internal<'info>(
    vault: &Account<'info, YieldVault>,
    owner_ftoken_account: &Account<'info, TokenAccount>,
    recipient_token_account: &Account<'info, TokenAccount>,
    jupiter_accounts: &JupiterLendAccounts<'info>,
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
    let signer_seeds = &[&seeds[..]];

    // Build withdraw instruction data
    let mut instruction_data = get_withdraw_discriminator();
    instruction_data.extend_from_slice(&amount.to_le_bytes());

    let account_metas = vec![
        // Signer (vault PDA)
        AccountMeta::new(vault.key(), true),
        // Owner token account (fToken account)
        AccountMeta::new(owner_ftoken_account.key(), false),
        // Recipient token account (vault buffer)
        AccountMeta::new(recipient_token_account.key(), false),
        // Lending admin
        AccountMeta::new_readonly(jupiter_accounts.lending_admin.key(), false),
        // Lending
        AccountMeta::new(jupiter_accounts.lending.key(), false),
        // Mint (underlying token)
        AccountMeta::new_readonly(jupiter_accounts.mint.key(), false),
        // fToken mint
        AccountMeta::new(jupiter_accounts.f_token_mint.key(), false),
        // Supply token reserves liquidity
        AccountMeta::new(jupiter_accounts.supply_token_reserves_liquidity.key(), false),
        // Lending supply position on liquidity
        AccountMeta::new(jupiter_accounts.lending_supply_position_on_liquidity.key(), false),
        // Rate model
        AccountMeta::new_readonly(jupiter_accounts.rate_model.key(), false),
        // Vault
        AccountMeta::new(jupiter_accounts.jupiter_vault.key(), false),
        // Claim account
        AccountMeta::new(jupiter_accounts.claim_account.key(), false),
        // Liquidity
        AccountMeta::new(jupiter_accounts.liquidity.key(), false),
        // Liquidity program
        AccountMeta::new(jupiter_accounts.liquidity_program.key(), false),
        // Rewards rate model
        AccountMeta::new_readonly(jupiter_accounts.rewards_rate_model.key(), false),
        // Token program
        AccountMeta::new_readonly(token_program.key(), false),
        // Associated token program
        AccountMeta::new_readonly(jupiter_accounts.associated_token_program.key(), false),
        // System program
        AccountMeta::new_readonly(jupiter_accounts.system_program.key(), false),
    ];

    let instruction = Instruction {
        program_id: jupiter_accounts.lending_program.key(),
        accounts: account_metas,
        data: instruction_data,
    };

    let account_infos = vec![
        vault.to_account_info(),
        owner_ftoken_account.to_account_info(),
        recipient_token_account.to_account_info(),
        jupiter_accounts.lending_admin.to_account_info(),
        jupiter_accounts.lending.to_account_info(),
        jupiter_accounts.mint.to_account_info(),
        jupiter_accounts.f_token_mint.to_account_info(),
        jupiter_accounts.supply_token_reserves_liquidity.to_account_info(),
        jupiter_accounts.lending_supply_position_on_liquidity.to_account_info(),
        jupiter_accounts.rate_model.to_account_info(),
        jupiter_accounts.jupiter_vault.to_account_info(),
        jupiter_accounts.claim_account.to_account_info(),
        jupiter_accounts.liquidity.to_account_info(),
        jupiter_accounts.liquidity_program.to_account_info(),
        jupiter_accounts.rewards_rate_model.to_account_info(),
        token_program.to_account_info(),
        jupiter_accounts.associated_token_program.to_account_info(),
        jupiter_accounts.system_program.to_account_info(),
    ];

    invoke_signed(&instruction, &account_infos, signer_seeds)
        .map_err(|_| ErrorCodes::JupiterLendWithdrawFailed)?;

    msg!("Withdrew {} from Jupiter Lend", amount);
    Ok(())
}

pub struct JupiterLendAccounts<'info> {
    // Token accounts
    pub mint: AccountInfo<'info>,
    pub f_token_mint: AccountInfo<'info>,
    
    // Protocol accounts
    pub lending_admin: AccountInfo<'info>,
    pub lending: AccountInfo<'info>,
    
    // Liquidity protocol accounts
    pub supply_token_reserves_liquidity: AccountInfo<'info>,
    pub lending_supply_position_on_liquidity: AccountInfo<'info>,
    pub rate_model: AccountInfo<'info>,
    pub jupiter_vault: AccountInfo<'info>,
    pub liquidity: AccountInfo<'info>,
    pub liquidity_program: AccountInfo<'info>,
    
    pub rewards_rate_model: AccountInfo<'info>,
    pub claim_account: AccountInfo<'info>,
    
    // Programs
    pub lending_program: AccountInfo<'info>,
    pub associated_token_program: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
}