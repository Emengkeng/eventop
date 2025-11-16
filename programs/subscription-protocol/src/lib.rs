use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint, CloseAccount};
use clockwork_sdk::state::Thread;

declare_id!("7sfgAWayriXLDnDvseZTNo3DvwVV7SrybvVFhjJgjkJH");

#[program]
pub mod subscription_protocol {
    use super::*;

    /// Create a Subscription Wallet (Virtual Card) for a user
    pub fn create_subscription_wallet(
        ctx: Context<CreateSubscriptionWallet>,
    ) -> Result<()> {
        let wallet = &mut ctx.accounts.subscription_wallet;
        
        wallet.owner = ctx.accounts.user.key();
        wallet.main_token_account = ctx.accounts.main_token_account.key();
        wallet.mint = ctx.accounts.mint.key();
        wallet.total_subscriptions = 0;
        wallet.total_spent = 0;
        wallet.yield_vault = Pubkey::default(); // Set when yield enabled
        wallet.yield_strategy = YieldStrategy::None;
        wallet.is_yield_enabled = false;
        wallet.bump = ctx.bumps.subscription_wallet;

        emit!(SubscriptionWalletCreated {
            wallet_pda: wallet.key(),
            owner: wallet.owner,
            mint: wallet.mint,
        });

        msg!("Subscription Wallet created for user: {}", wallet.owner);

        Ok(())
    }

    /// Enable yield earning on idle funds in Subscription Wallet
    pub fn enable_yield(
        ctx: Context<EnableYield>,
        strategy: YieldStrategy,
    ) -> Result<()> {
        let wallet = &mut ctx.accounts.subscription_wallet;
        
        require!(!wallet.is_yield_enabled, ErrorCode::YieldAlreadyEnabled);

        // Initialize yield vault connection based on strategy
        wallet.yield_vault = match strategy {
            YieldStrategy::MarginfiLend => ctx.accounts.yield_vault.key(),
            YieldStrategy::KaminoLend => ctx.accounts.yield_vault.key(),
            YieldStrategy::SolendPool => ctx.accounts.yield_vault.key(),
            YieldStrategy::DriftDeposit => ctx.accounts.yield_vault.key(),
            YieldStrategy::None => return Err(ErrorCode::InvalidYieldStrategy.into()),
        };

        wallet.yield_strategy = strategy;
        wallet.is_yield_enabled = true;

        emit!(YieldEnabled {
            wallet_pda: wallet.key(),
            strategy: format!("{:?}", strategy),
            vault: wallet.yield_vault,
        });

        msg!("Yield enabled with strategy: {:?}", strategy);

        Ok(())
    }

    /// Deposit funds into Subscription Wallet
    pub fn deposit_to_wallet(
        ctx: Context<DepositToWallet>,
        amount: u64,
    ) -> Result<()> {
        let wallet = &ctx.accounts.subscription_wallet;
        
        require!(amount > 0, ErrorCode::InvalidDepositAmount);

        // Transfer from user's main wallet to subscription wallet
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.wallet_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // If yield enabled, deposit to yield protocol
        if wallet.is_yield_enabled {
            deposit_to_yield_vault(
                &ctx.accounts.subscription_wallet,
                &ctx.accounts.wallet_token_account,
                &ctx.accounts.yield_vault_account,
                &ctx.accounts.token_program,
                amount,
            )?;
        }

        emit!(WalletDeposit {
            wallet_pda: wallet.key(),
            user: wallet.owner,
            amount: amount,
            deposited_to_yield: wallet.is_yield_enabled,
        });

        msg!("Deposited {} tokens to Subscription Wallet", amount);

        Ok(())
    }

    /// Withdraw idle funds from Subscription Wallet
    pub fn withdraw_from_wallet(
        ctx: Context<WithdrawFromWallet>,
        amount: u64,
    ) -> Result<()> {
        let wallet = &ctx.accounts.subscription_wallet;
        
        require!(amount > 0, ErrorCode::InvalidWithdrawAmount);

        // Calculate available balance (total - committed to subscriptions)
        let committed_amount = calculate_committed_balance(
            &ctx.accounts.subscription_wallet,
        )?;
        
        let available_balance = if wallet.is_yield_enabled {
            // Get balance from yield vault
            get_yield_vault_balance(&ctx.accounts.yield_vault_account)?
        } else {
            ctx.accounts.wallet_token_account.amount
        };

        let withdrawable = available_balance.saturating_sub(committed_amount);
        require!(amount <= withdrawable, ErrorCode::InsufficientAvailableBalance);

        // If yield enabled, withdraw from yield vault first
        if wallet.is_yield_enabled {
            withdraw_from_yield_vault(
                &ctx.accounts.subscription_wallet,
                &ctx.accounts.yield_vault_account,
                &ctx.accounts.wallet_token_account,
                &ctx.accounts.token_program,
                amount,
            )?;
        }

        // Create PDA signer seeds
        let owner_key = wallet.owner;
        let mint_key = wallet.mint;
        let bump = wallet.bump;
        let seeds = &[
            b"subscription_wallet",
            owner_key.as_ref(),
            mint_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        // Transfer from wallet to user
        let cpi_accounts = Transfer {
            from: ctx.accounts.wallet_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.subscription_wallet.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        emit!(WalletWithdrawal {
            wallet_pda: wallet.key(),
            user: wallet.owner,
            amount: amount,
        });

        msg!("Withdrawn {} tokens from Subscription Wallet", amount);

        Ok(())
    }

    /// Register merchant plan
    pub fn register_merchant(
        ctx: Context<RegisterMerchant>,
        plan_id: String,
        plan_name: String,
        fee_amount: u64,
        payment_interval_seconds: i64,
    ) -> Result<()> {
        require!(plan_id.len() <= 32, ErrorCode::PlanIdTooLong);
        require!(plan_name.len() <= 64, ErrorCode::PlanNameTooLong);
        require!(fee_amount > 0, ErrorCode::InvalidFeeAmount);
        require!(payment_interval_seconds > 0, ErrorCode::InvalidInterval);

        let merchant_plan = &mut ctx.accounts.merchant_plan;
        
        merchant_plan.merchant = ctx.accounts.merchant.key();
        merchant_plan.mint = ctx.accounts.mint.key();
        merchant_plan.plan_id = plan_id;
        merchant_plan.plan_name = plan_name;
        merchant_plan.fee_amount = fee_amount;
        merchant_plan.payment_interval = payment_interval_seconds;
        merchant_plan.is_active = true;
        merchant_plan.total_subscribers = 0;
        merchant_plan.bump = ctx.bumps.merchant_plan;

        Ok(())
    }

    /// Subscribe using Subscription Wallet (New approach!)
    pub fn subscribe_with_wallet(
        ctx: Context<SubscribeWithWallet>,
    ) -> Result<()> {
        let merchant_plan = &ctx.accounts.merchant_plan;
        let wallet = &mut ctx.accounts.subscription_wallet;
        
        require!(merchant_plan.is_active, ErrorCode::PlanInactive);
        require!(
            wallet.owner == ctx.accounts.user.key(),
            ErrorCode::UnauthorizedWalletAccess
        );

        // Calculate required buffer (3 months minimum)
        let min_buffer = merchant_plan.fee_amount.checked_mul(3).unwrap();
        
        // Check if wallet has sufficient balance
        let wallet_balance = if wallet.is_yield_enabled {
            get_yield_vault_balance(&ctx.accounts.wallet_yield_vault)?
        } else {
            ctx.accounts.wallet_token_account.amount
        };

        require!(
            wallet_balance >= min_buffer,
            ErrorCode::InsufficientWalletBalance
        );

        let subscription = &mut ctx.accounts.subscription_state;
        
        // Link subscription to wallet
        subscription.user = ctx.accounts.user.key();
        subscription.subscription_wallet = wallet.key();
        subscription.merchant = merchant_plan.merchant;
        subscription.mint = merchant_plan.mint;
        subscription.merchant_plan = ctx.accounts.merchant_plan.key();
        subscription.fee_amount = merchant_plan.fee_amount;
        subscription.payment_interval = merchant_plan.payment_interval;
        subscription.last_payment_timestamp = Clock::get()?.unix_timestamp;
        subscription.bump = ctx.bumps.subscription_state;
        subscription.is_active = true;
        subscription.total_paid = 0;
        subscription.payment_count = 0;

        // Increment wallet's subscription count
        wallet.total_subscriptions = wallet.total_subscriptions.checked_add(1).unwrap();

        // Increment merchant plan subscribers
        let merchant_plan = &mut ctx.accounts.merchant_plan;
        merchant_plan.total_subscribers = merchant_plan.total_subscribers.checked_add(1).unwrap();

        emit!(SubscriptionCreated {
            subscription_pda: subscription.key(),
            user: subscription.user,
            wallet: subscription.subscription_wallet,
            merchant: subscription.merchant,
            plan_id: merchant_plan.plan_id.clone(),
        });

        msg!("Subscription created using Subscription Wallet");

        Ok(())
    }

    /// Execute payment from Subscription Wallet
    pub fn execute_payment_from_wallet(ctx: Context<ExecutePaymentFromWallet>) -> Result<()> {
        let subscription = &mut ctx.accounts.subscription_state;
        let merchant_plan = &ctx.accounts.merchant_plan;
        let wallet = &mut ctx.accounts.subscription_wallet;
        let current_time = Clock::get()?.unix_timestamp;
        
        require!(subscription.is_active, ErrorCode::SubscriptionInactive);
        require!(merchant_plan.is_active, ErrorCode::PlanInactive);

        // Verify subscription linked to correct wallet
        require!(
            subscription.subscription_wallet == wallet.key(),
            ErrorCode::InvalidSubscriptionWallet
        );

        // Check payment interval
        let time_since_last = current_time - subscription.last_payment_timestamp;
        require!(
            time_since_last >= subscription.payment_interval,
            ErrorCode::PaymentTooEarly
        );

        let fee_to_charge = subscription.fee_amount;

        // Get current balance from wallet (or yield vault)
        let available_balance = if wallet.is_yield_enabled {
            get_yield_vault_balance(&ctx.accounts.wallet_yield_vault)?
        } else {
            ctx.accounts.wallet_token_account.amount
        };

        require!(
            available_balance >= fee_to_charge,
            ErrorCode::InsufficientWalletBalance
        );

        // If yield enabled, withdraw payment amount from yield vault
        if wallet.is_yield_enabled {
            withdraw_from_yield_vault(
                &ctx.accounts.subscription_wallet,
                &ctx.accounts.wallet_yield_vault,
                &ctx.accounts.wallet_token_account,
                &ctx.accounts.token_program,
                fee_to_charge,
            )?;
        }

        // Create wallet PDA signer seeds
        let owner_key = wallet.owner;
        let mint_key = wallet.mint;
        let bump = wallet.bump;
        let seeds = &[
            b"subscription_wallet",
            owner_key.as_ref(),
            mint_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        // Transfer from wallet directly to merchant
        let cpi_accounts = Transfer {
            from: ctx.accounts.wallet_token_account.to_account_info(),
            to: ctx.accounts.merchant_token_account.to_account_info(),
            authority: ctx.accounts.subscription_wallet.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, fee_to_charge)?;

        // Update states
        subscription.last_payment_timestamp = current_time;
        subscription.total_paid += fee_to_charge;
        subscription.payment_count += 1;
        wallet.total_spent += fee_to_charge;

        emit!(PaymentExecuted {
            subscription_pda: subscription.key(),
            wallet_pda: wallet.key(),
            user: subscription.user,
            merchant: subscription.merchant,
            amount: fee_to_charge,
            payment_number: subscription.payment_count,
        });

        msg!("Payment executed from Subscription Wallet: {}", fee_to_charge);

        Ok(())
    }

    /// Cancel subscription (no refund needed, funds stay in wallet)
    pub fn cancel_subscription_wallet(ctx: Context<CancelSubscriptionWallet>) -> Result<()> {
        let subscription = &ctx.accounts.subscription_state;
        let wallet = &mut ctx.accounts.subscription_wallet;
        let merchant_plan = &mut ctx.accounts.merchant_plan;
        
        require!(subscription.is_active, ErrorCode::SubscriptionInactive);

        // Decrement counters
        wallet.total_subscriptions = wallet.total_subscriptions.saturating_sub(1);
        merchant_plan.total_subscribers = merchant_plan.total_subscribers.saturating_sub(1);

        emit!(SubscriptionCancelled {
            subscription_pda: subscription.key(),
            wallet_pda: wallet.key(),
            user: subscription.user,
            merchant: subscription.merchant,
            payments_made: subscription.payment_count,
        });

        msg!("Subscription cancelled. Funds remain in Subscription Wallet.");

        Ok(())
    }

    /// Claim accumulated yield rewards
    pub fn claim_yield_rewards(ctx: Context<ClaimYieldRewards>) -> Result<()> {
        let wallet = &ctx.accounts.subscription_wallet;
        
        require!(wallet.is_yield_enabled, ErrorCode::YieldNotEnabled);

        // Get current yield balance
        let total_with_yield = get_yield_vault_balance(&ctx.accounts.yield_vault_account)?;
        let original_deposits = ctx.accounts.wallet_token_account.amount;
        let yield_earned = total_with_yield.saturating_sub(original_deposits);

        require!(yield_earned > 0, ErrorCode::NoYieldToClaim);

        // Withdraw only yield earnings to user's main wallet
        withdraw_from_yield_vault(
            &ctx.accounts.subscription_wallet,
            &ctx.accounts.yield_vault_account,
            &ctx.accounts.user_token_account,
            &ctx.accounts.token_program,
            yield_earned,
        )?;

        emit!(YieldClaimed {
            wallet_pda: wallet.key(),
            user: wallet.owner,
            amount: yield_earned,
        });

        msg!("Claimed {} yield rewards", yield_earned);

        Ok(())
    }
}

// Helper functions for yield integration

fn deposit_to_yield_vault(
    _wallet: &Account<SubscriptionWallet>,
    _from: &Account<TokenAccount>,
    _vault: &AccountInfo,
    _token_program: &Program<Token>,
    _amount: u64,
) -> Result<()> {
    // TODO: Integrate with actual yield protocol
    // This is a placeholder for Marginfi/Kamino/Solend CPI
    msg!("Depositing to yield vault (placeholder)");
    Ok(())
}

fn withdraw_from_yield_vault(
    _wallet: &Account<SubscriptionWallet>,
    _vault: &AccountInfo,
    _to: &Account<TokenAccount>,
    _token_program: &Program<Token>,
    _amount: u64,
) -> Result<()> {
    // TODO: Integrate with actual yield protocol
    msg!("Withdrawing from yield vault (placeholder)");
    Ok(())
}

fn get_yield_vault_balance(_vault: &AccountInfo) -> Result<u64> {
    // TODO: Query actual yield protocol balance
    Ok(0) // Placeholder
}

fn calculate_committed_balance(_wallet: &Account<SubscriptionWallet>) -> Result<u64> {
    // TODO: Query all active subscriptions and calculate 3-month buffer requirement
    Ok(0) // Placeholder
}

// Account Structures

#[derive(Accounts)]
pub struct CreateSubscriptionWallet<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + SubscriptionWallet::INIT_SPACE,
        seeds = [
            b"subscription_wallet",
            user.key().as_ref(),
            mint.key().as_ref()
        ],
        bump
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(
        init,
        payer = user,
        token::mint = mint,
        token::authority = subscription_wallet,
    )]
    pub main_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct EnableYield<'info> {
    #[account(
        mut,
        seeds = [
            b"subscription_wallet",
            subscription_wallet.owner.as_ref(),
            subscription_wallet.mint.as_ref()
        ],
        bump = subscription_wallet.bump,
        has_one = owner @ ErrorCode::UnauthorizedWalletAccess
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    pub owner: Signer<'info>,

    /// CHECK: Yield vault account (protocol-specific)
    pub yield_vault: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct DepositToWallet<'info> {
    #[account(
        seeds = [
            b"subscription_wallet",
            subscription_wallet.owner.as_ref(),
            subscription_wallet.mint.as_ref()
        ],
        bump = subscription_wallet.bump,
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        token::mint = subscription_wallet.mint,
        token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = subscription_wallet.mint,
        token::authority = subscription_wallet
    )]
    pub wallet_token_account: Account<'info, TokenAccount>,

    /// CHECK: Yield vault (if enabled)
    pub yield_vault_account: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawFromWallet<'info> {
    #[account(
        seeds = [
            b"subscription_wallet",
            subscription_wallet.owner.as_ref(),
            subscription_wallet.mint.as_ref()
        ],
        bump = subscription_wallet.bump,
        has_one = owner @ ErrorCode::UnauthorizedWalletAccess
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        token::mint = subscription_wallet.mint,
        token::authority = owner
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = subscription_wallet.mint,
        token::authority = subscription_wallet
    )]
    pub wallet_token_account: Account<'info, TokenAccount>,

    /// CHECK: Yield vault (if enabled)
    pub yield_vault_account: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(plan_id: String)]
pub struct RegisterMerchant<'info> {
    #[account(
        init,
        payer = merchant,
        space = 8 + MerchantPlan::INIT_SPACE,
        seeds = [
            b"merchant_plan",
            merchant.key().as_ref(),
            mint.key().as_ref(),
            plan_id.as_bytes()
        ],
        bump
    )]
    pub merchant_plan: Account<'info, MerchantPlan>,

    #[account(mut)]
    pub merchant: Signer<'info>,

    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubscribeWithWallet<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + SubscriptionState::INIT_SPACE,
        seeds = [
            b"subscription",
            user.key().as_ref(),
            merchant_plan.merchant.as_ref(),
            merchant_plan.mint.as_ref()
        ],
        bump
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
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(
        mut,
        constraint = merchant_plan.is_active @ ErrorCode::PlanInactive
    )]
    pub merchant_plan: Account<'info, MerchantPlan>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        token::mint = subscription_wallet.mint,
        token::authority = subscription_wallet
    )]
    pub wallet_token_account: Account<'info, TokenAccount>,

    /// CHECK: Yield vault (if yield enabled)
    pub wallet_yield_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

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
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(
        constraint = merchant_plan.key() == subscription_state.merchant_plan @ ErrorCode::InvalidMerchantPlan,
    )]
    pub merchant_plan: Account<'info, MerchantPlan>,

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

    /// CHECK: Yield vault (if enabled)
    pub wallet_yield_vault: AccountInfo<'info>,

    /// CHECK: Clockwork thread
    #[account(constraint = thread.authority == subscription_state.key() @ ErrorCode::UnauthorizedCaller)]
    pub thread: Account<'info, Thread>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelSubscriptionWallet<'info> {
    #[account(
        mut,
        seeds = [
            b"subscription",
            subscription_state.user.as_ref(),
            subscription_state.merchant.as_ref(),
            subscription_state.mint.as_ref()
        ],
        bump = subscription_state.bump,
        has_one = user @ ErrorCode::UnauthorizedCancellation,
        close = user
    )]
    pub subscription_state: Account<'info, SubscriptionState>,

    #[account(
        mut,
        constraint = subscription_wallet.key() == subscription_state.subscription_wallet
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(mut)]
    pub merchant_plan: Account<'info, MerchantPlan>,

    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimYieldRewards<'info> {
    #[account(
        seeds = [
            b"subscription_wallet",
            subscription_wallet.owner.as_ref(),
            subscription_wallet.mint.as_ref()
        ],
        bump = subscription_wallet.bump,
        has_one = owner @ ErrorCode::UnauthorizedWalletAccess
    )]
    pub subscription_wallet: Account<'info, SubscriptionWallet>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        token::mint = subscription_wallet.mint,
        token::authority = owner
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// CHECK: Yield vault
    pub yield_vault_account: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

// State Accounts

#[account]
#[derive(InitSpace)]
pub struct SubscriptionWallet {
    pub owner: Pubkey,
    pub main_token_account: Pubkey,
    pub mint: Pubkey,
    pub yield_vault: Pubkey,
    pub yield_strategy: YieldStrategy,
    pub is_yield_enabled: bool,
    pub total_subscriptions: u32,
    pub total_spent: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MerchantPlan {
    pub merchant: Pubkey,
    pub mint: Pubkey,
    #[max_len(32)]
    pub plan_id: String,
    #[max_len(64)]
    pub plan_name: String,
    pub fee_amount: u64,
    pub payment_interval: i64,
    pub is_active: bool,
    pub total_subscribers: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SubscriptionState {
    pub user: Pubkey,
    pub subscription_wallet: Pubkey, // KEY CHANGE: Links to wallet instead of escrow
    pub merchant: Pubkey,
    pub mint: Pubkey,
    pub merchant_plan: Pubkey,
    pub fee_amount: u64,
    pub payment_interval: i64,
    pub last_payment_timestamp: i64,
    pub total_paid: u64,
    pub payment_count: u32,
    pub is_active: bool,
    pub bump: u8,
}

// Enums

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum YieldStrategy {
    None,
    MarginfiLend,    // Marginfi USDC lending
    KaminoLend,      // Kamino Liquidity
    SolendPool,      // Solend lending pool
    DriftDeposit,    // Drift Protocol deposits
}

// Events

#[event]
pub struct SubscriptionWalletCreated {
    pub wallet_pda: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct YieldEnabled {
    pub wallet_pda: Pubkey,
    pub strategy: String,
    pub vault: Pubkey,
}

#[event]
pub struct WalletDeposit {
    pub wallet_pda: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub deposited_to_yield: bool,
}

#[event]
pub struct WalletWithdrawal {
    pub wallet_pda: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct SubscriptionCreated {
    pub subscription_pda: Pubkey,
    pub user: Pubkey,
    pub wallet: Pubkey,
    pub merchant: Pubkey,
    pub plan_id: String,
}

#[event]
pub struct PaymentExecuted {
    pub subscription_pda: Pubkey,
    pub wallet_pda: Pubkey,
    pub user: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    pub payment_number: u32,
}

#[event]
pub struct SubscriptionCancelled {
    pub subscription_pda: Pubkey,
    pub wallet_pda: Pubkey,
    pub user: Pubkey,
    pub merchant: Pubkey,
    pub payments_made: u32,
}

#[event]
pub struct YieldClaimed {
    pub wallet_pda: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

// Error Codes

#[error_code]
pub enum ErrorCode {
    #[msg("Subscription is not active")]
    SubscriptionInactive,
    
    #[msg("Payment interval has not elapsed yet")]
    PaymentTooEarly,
    
    #[msg("Plan ID exceeds maximum length")]
    PlanIdTooLong,

    #[msg("Plan name exceeds maximum length")]
    PlanNameTooLong,

    #[msg("Fee amount must be greater than zero")]
    InvalidFeeAmount,

    #[msg("Payment interval must be greater than zero")]
    InvalidInterval,

    #[msg("Merchant plan is not active")]
    PlanInactive,

    #[msg("Invalid merchant plan reference")]
    InvalidMerchantPlan,

    #[msg("Caller is not authorized to execute payment")]
    UnauthorizedCaller,

    #[msg("Only the subscription user can cancel")]
    UnauthorizedCancellation,

    #[msg("Unauthorized access to subscription wallet")]
    UnauthorizedWalletAccess,

    #[msg("Invalid deposit amount")]
    InvalidDepositAmount,

    #[msg("Invalid withdrawal amount")]
    InvalidWithdrawAmount,

    #[msg("Insufficient available balance in wallet")]
    InsufficientAvailableBalance,

    #[msg("Insufficient wallet balance for subscription")]
    InsufficientWalletBalance,

    #[msg("Invalid subscription wallet reference")]
    InvalidSubscriptionWallet,

    #[msg("Yield is already enabled")]
    YieldAlreadyEnabled,

    #[msg("Yield is not enabled")]
    YieldNotEnabled,

    #[msg("Invalid yield strategy")]
    InvalidYieldStrategy,

    #[msg("No yield rewards to claim")]
    NoYieldToClaim,
}