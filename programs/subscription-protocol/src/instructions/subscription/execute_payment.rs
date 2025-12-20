use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::{
    SubscriptionState, SubscriptionWallet, MerchantPlan, ProtocolConfig,
    YieldVault, PaymentExecuted, ErrorCodes
};
use crate::utils::{
    get_vault_total_value, calculate_shares_for_withdrawal,
    withdraw_from_vault_internal
};

#[derive(Accounts)]
pub struct ExecutePaymentFromWallet<'info> {
    #[account(
        mut,
        seeds = [
            b"subscription",
            subscription_state.user.as_ref(),
            subscription_state.merchant.as_ref(),
            subscription_state.mint.as_ref()
        ],
        bump = subscription_state.bump,
        constraint = subscription_state.is_active @ ErrorCodes::SubscriptionInactive,
    )]
    pub subscription_state: Account<'info, SubscriptionState>,

    #[account(
        mut,
        seeds = [
            b"subscription_wallet",
            subscription_wallet.owner.as_ref(),
            subscription_wallet.mint.as_ref()
        ],
        bump = subscription_wallet.bump,
        constraint = subscription_wallet.key() == subscription_state.subscription_wallet
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(
        constraint = merchant_plan.key() == subscription_state.merchant_plan,
        constraint = merchant_plan.is_active @ ErrorCodes::PlanInactive,
    )]
    pub merchant_plan: Account<'info, MerchantPlan>,

    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        token::mint = subscription_wallet.mint,
        token::authority = subscription_wallet
    )]
    pub wallet_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = subscription_state.mint,
        constraint = merchant_token_account.owner == merchant_plan.merchant
    )]
    pub merchant_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = subscription_state.mint,
        constraint = protocol_treasury.owner == protocol_config.treasury
    )]
    pub protocol_treasury: Account<'info, TokenAccount>,

    // Optional yield vault accounts (if user has yield enabled)
    #[account(
        mut,
        seeds = [b"yield_vault", subscription_wallet.mint.as_ref()],
        bump = yield_vault.as_ref().unwrap().bump,
    )]
    pub yield_vault: Option<Account<'info, YieldVault>>,

    #[account(mut)]
    pub vault_buffer: Option<Account<'info, TokenAccount>>,

    /// CHECK: Kamino reserve
    pub kamino_reserve: Option<AccountInfo<'info>>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ExecutePaymentFromWallet>) -> Result<()> {
    let subscription = &mut ctx.accounts.subscription_state;
    let merchant_plan = &ctx.accounts.merchant_plan;
    let wallet = &mut ctx.accounts.subscription_wallet;
    let protocol_config = &ctx.accounts.protocol_config;
    let current_time = Clock::get()?.unix_timestamp;
    
    require!(subscription.is_active, ErrorCodes::SubscriptionInactive);
    
    let time_since_last = current_time - subscription.last_payment_timestamp;
    require!(
        time_since_last >= subscription.payment_interval,
        ErrorCodes::PaymentTooEarly
    );

    // Calculate fees
    let base_amount = subscription.fee_amount;
    let protocol_fee = (base_amount as u128)
        .checked_mul(protocol_config.protocol_fee_bps as u128)
        .unwrap()
        .checked_div(10_000)
        .unwrap() as u64;
    
    let merchant_receives = base_amount.checked_sub(protocol_fee)
        .ok_or(ErrorCodes::MathOverflow)?;
    
    let total_charge = base_amount;

    // Check if we need to redeem shares from yield vault
    let wallet_balance = ctx.accounts.wallet_token_account.amount;
    if wallet_balance < total_charge && wallet.is_yield_enabled && wallet.yield_shares > 0 {
        // Need to redeem shares
        let shortfall = total_charge.checked_sub(wallet_balance)
            .ok_or(ErrorCodes::MathOverflow)?;
        
        let vault = &mut ctx.accounts.yield_vault.as_mut().unwrap();
        
        // Calculate shares needed
        let total_vault_value = get_vault_total_value(
            ctx.accounts.kamino_reserve.clone().unwrap(),
            &vault,
        )?;
        
        let shares_needed = calculate_shares_for_withdrawal(
            shortfall,
            vault.total_shares_issued,
            total_vault_value,
        )?;
        
        require!(
            wallet.yield_shares >= shares_needed,
            ErrorCodes::InsufficientShares
        );

        // Withdraw from vault
        withdraw_from_vault_internal(
            &vault,
            ctx.accounts.vault_buffer.as_ref().unwrap(),
            &ctx.accounts.wallet_token_account,
            &ctx.accounts.token_program,
            shortfall,
            vault.bump,
        )?;

        // Update share balances
        wallet.yield_shares = wallet.yield_shares
            .checked_sub(shares_needed)
            .ok_or(ErrorCodes::MathOverflow)?;
        
        vault.total_shares_issued = vault.total_shares_issued
            .checked_sub(shares_needed)
            .ok_or(ErrorCodes::MathOverflow)?;
    }

    // Now verify we have enough funds
    let final_balance = ctx.accounts.wallet_token_account.amount;
    require!(final_balance >= total_charge, ErrorCodes::InsufficientFunds);

    // Create PDA signer
    let owner_key = wallet.owner;
    let mint_key = wallet.mint;
    let bump = wallet.bump;
    let seeds = &[
        b"subscription_wallet",
        owner_key.as_ref(),
        mint_key.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Transfer to merchant
    if merchant_receives > 0 {
        let transfer_merchant = Transfer {
            from: ctx.accounts.wallet_token_account.to_account_info(),
            to: ctx.accounts.merchant_token_account.to_account_info(),
            authority: wallet.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_merchant,
            signer_seeds,
        );
        
        token::transfer(cpi_ctx, merchant_receives)?;
    }

    // Transfer protocol fee
    if protocol_fee > 0 {
        let transfer_protocol = Transfer {
            from: ctx.accounts.wallet_token_account.to_account_info(),
            to: ctx.accounts.protocol_treasury.to_account_info(),
            authority: wallet.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_protocol,
            signer_seeds,
        );
        
        token::transfer(cpi_ctx, protocol_fee)?;
    }

    // Update state
    subscription.last_payment_timestamp = current_time;
    subscription.total_paid = subscription.total_paid
        .checked_add(total_charge)
        .ok_or(ErrorCodes::MathOverflow)?;
    subscription.payment_count = subscription.payment_count
        .checked_add(1)
        .ok_or(ErrorCodes::MathOverflow)?;

    wallet.total_spent = wallet.total_spent
        .checked_add(total_charge)
        .ok_or(ErrorCodes::MathOverflow)?;

    emit!(PaymentExecuted {
        subscription_pda: subscription.key(),
        wallet_pda: wallet.key(),
        user: subscription.user,
        merchant: subscription.merchant,
        amount: total_charge,
        protocol_fee: protocol_fee,
        merchant_received: merchant_receives,
        payment_number: subscription.payment_count,
    });

    Ok(())
}