use anchor_lang::prelude::*;

#[event]
pub struct ProtocolInitialized {
    pub authority: Pubkey,
    pub fee_bps: u16,
    pub treasury: Pubkey,
}

#[event]
pub struct YieldVaultInitialized {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub target_buffer_bps: u16,
}

#[event]
pub struct ProtocolFeeUpdated {
    pub old_fee_bps: u16,
    pub new_fee_bps: u16,
}

#[event]
pub struct SubscriptionWalletCreated {
    pub wallet_pda: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct YieldEnabled {
    pub wallet_pda: Pubkey,
    pub shares_issued: u64,
    pub usdc_amount: u64,
    pub buffer_amount: u64,
}

#[event]
pub struct YieldDisabled {
    pub wallet_pda: Pubkey,
    pub shares_redeemed: u64,
    pub usdc_received: u64,
}

#[event]
pub struct YieldDeposit {
    pub wallet_pda: Pubkey,
    pub shares_issued: u64,
    pub usdc_amount: u64,
}

#[event]
pub struct YieldWithdrawal {
    pub wallet_pda: Pubkey,
    pub shares_redeemed: u64,
    pub usdc_received: u64,
}

#[event]
pub struct WalletDeposit {
    pub wallet_pda: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct WalletWithdrawal {
    pub wallet_pda: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct VaultRebalanced {
    pub action: String,
    pub amount: u64,
}

#[event]
pub struct EmergencyModeChanged {
    pub enabled: bool,
    pub frozen_rate: u64,
}

#[event]
pub struct MerchantPlanRegistered {
    pub plan_pda: Pubkey,
}

#[event]
pub struct SubscriptionCreated {
    pub subscription_pda: Pubkey,
    pub user: Pubkey,
    pub wallet: Pubkey,
    pub merchant: Pubkey,
    pub plan_id: String,
    pub session_token: String,
}

#[event]
pub struct PaymentExecuted {
    pub subscription_pda: Pubkey,
    pub wallet_pda: Pubkey,
    pub user: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    pub protocol_fee: u64,
    pub merchant_received: u64,
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