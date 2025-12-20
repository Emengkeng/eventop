use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod utils;
pub mod errors;
pub mod events;

pub use state::*;
pub use instructions::*;
pub use errors::*;
pub use events::*;

declare_id!("GPVtSfXPiy8y4SkJrMC3VFyKUmGVhMrRbAp2NhiW1Ds2");

#[program]
pub mod subscription_protocol {
    use super::*;

    // ========================================================================
    // Protocol Configuration
    // ========================================================================

    /// Initialize protocol configuration (one-time, by deployer)
    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        protocol_fee_bps: u16,
    ) -> Result<()> {
        instructions::protocol::initialize_protocol::handler(ctx, protocol_fee_bps)
    }

    /// Initialize the global yield vault (one-time setup)
    pub fn initialize_yield_vault(
        ctx: Context<InitializeYieldVault>,
        target_buffer_bps: u16,
    ) -> Result<()> {
        instructions::protocol::initialize_yield_vault::handler(ctx, target_buffer_bps)
    }

    /// Update protocol fee (admin only)
    pub fn update_protocol_fee(
        ctx: Context<UpdateProtocolFee>,
        new_fee_bps: u16,
    ) -> Result<()> {
        instructions::protocol::update_protocol_fee::handler(ctx, new_fee_bps)
    }

    // ========================================================================
    // Subscription Wallet Management
    // ========================================================================

    /// Create a Subscription Wallet (Virtual Card) for a user
    pub fn create_subscription_wallet(
        ctx: Context<CreateSubscriptionWallet>,
    ) -> Result<()> {
        instructions::wallet::create_wallet::handler(ctx)
    }

    /// Deposit funds into Subscription Wallet
    pub fn deposit_to_wallet(
        ctx: Context<DepositToWallet>,
        amount: u64,
    ) -> Result<()> {
        instructions::wallet::deposit::handler(ctx, amount)
    }

    /// Withdraw idle funds from Subscription Wallet
    pub fn withdraw_from_wallet(
        ctx: Context<WithdrawFromWallet>,
        amount: u64,
    ) -> Result<()> {
        instructions::wallet::withdraw::handler(ctx, amount)
    }

    // ========================================================================
    // Yield Operations
    // ========================================================================

    /// Enable yield earning - moves funds to pooled vault
    pub fn enable_yield(
        ctx: Context<EnableYield>,
        amount: u64,
    ) -> Result<()> {
        instructions::yield_ops::enable_yield::handler(ctx, amount)
    }

    /// Disable yield - redeems all shares back to user's wallet
    pub fn disable_yield(
        ctx: Context<DisableYield>,
    ) -> Result<()> {
        instructions::yield_ops::disable_yield::handler(ctx)
    }

    /// Deposit more funds to yield vault (add to existing position)
    pub fn deposit_to_yield(
        ctx: Context<DepositToYield>,
        amount: u64,
    ) -> Result<()> {
        instructions::yield_ops::deposit_to_yield::handler(ctx, amount)
    }

    /// Withdraw from yield position (partial or full)
    pub fn withdraw_from_yield(
        ctx: Context<WithdrawFromYield>,
        shares_to_redeem: u64,
    ) -> Result<()> {
        instructions::yield_ops::withdraw_from_yield::handler(ctx, shares_to_redeem)
    }

    // ========================================================================
    // Vault Management
    // ========================================================================

    /// Protocol-level rebalancing: Move funds between buffer and Kamino
    pub fn rebalance_vault(
        ctx: Context<RebalanceVault>,
    ) -> Result<()> {
        instructions::vault_management::rebalance_vault::handler(ctx)
    }

    /// Emergency mode: Disable yield operations protocol-wide
    pub fn set_emergency_mode(
        ctx: Context<SetEmergencyMode>,
        enabled: bool,
    ) -> Result<()> {
        instructions::vault_management::set_emergency_mode::handler(ctx, enabled)
    }

    // ========================================================================
    // Subscription Management
    // ========================================================================

    /// Register merchant plan
    pub fn register_merchant(
        ctx: Context<RegisterMerchant>,
        plan_id: String,
        plan_name: String,
        fee_amount: u64,
        payment_interval_seconds: i64,
    ) -> Result<()> {
        instructions::subscription::register_merchant::handler(
            ctx,
            plan_id,
            plan_name,
            fee_amount,
            payment_interval_seconds,
        )
    }

    /// Subscribe using Subscription Wallet
    pub fn subscribe_with_wallet(
        ctx: Context<SubscribeWithWallet>,
        session_token: String,
    ) -> Result<()> {
        instructions::subscription::subscribe::handler(ctx, session_token)
    }

    /// Execute payment - with automatic yield redemption if needed
    pub fn execute_payment_from_wallet(
        ctx: Context<ExecutePaymentFromWallet>
    ) -> Result<()> {
        instructions::subscription::execute_payment::handler(ctx)
    }

    /// Cancel subscription
    pub fn cancel_subscription_wallet(
        ctx: Context<CancelSubscriptionWallet>
    ) -> Result<()> {
        instructions::subscription::cancel_subscription::handler(ctx)
    }
}