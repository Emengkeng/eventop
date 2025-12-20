use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCodes {
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

    #[msg("Only the subscription user can cancel")]
    UnauthorizedCancellation,

    #[msg("Unauthorized access to subscription wallet")]
    UnauthorizedWalletAccess,

    #[msg("Invalid deposit amount")]
    InvalidDepositAmount,

    #[msg("Invalid withdrawal amount")]
    InvalidWithdrawAmount,

    #[msg("Insufficient wallet balance for subscription")]
    InsufficientWalletBalance,

    #[msg("Insufficient funds in wallet")]
    InsufficientFunds,
    
    #[msg("Invalid merchant token account")]
    InvalidMerchantAccount,
    
    #[msg("Math operation overflow")]
    MathOverflow,

    #[msg("Protocol fee exceeds maximum allowed (10%)")]
    FeeTooHigh,

    #[msg("Unauthorized protocol configuration update")]
    UnauthorizedProtocolUpdate,

    #[msg("Invalid treasury account")]
    InvalidTreasuryAccount,

    #[msg("Session token exceeds maximum length (64 characters)")]
    SessionTokenTooLong,

    #[msg("Session token is required")]
    SessionTokenRequired,

    #[msg("Session token already used")]
    SessionTokenAlreadyUsed,

    #[msg("Yield is already enabled")]
    YieldAlreadyEnabled,

    #[msg("Yield is not enabled")]
    YieldNotEnabled,

    #[msg("Invalid buffer ratio (must be <= 50%)")]
    InvalidBufferRatio,

    #[msg("Yield amount too small after buffer calculation")]
    YieldAmountTooSmall,

    #[msg("No shares to redeem")]
    NoSharesToRedeem,

    #[msg("Invalid share amount")]
    InvalidShareAmount,

    #[msg("Insufficient shares")]
    InsufficientShares,

    #[msg("Emergency mode is enabled")]
    EmergencyModeEnabled,

    #[msg("Insufficient available balance in wallet")]
    InsufficientAvailableBalance,
}