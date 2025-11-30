import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// ============================================
// ENUMS
// ============================================

export enum YieldStrategy {
  None = 'None',
  MarginfiLend = 'MarginfiLend',
  KaminoLend = 'KaminoLend',
  SolendPool = 'SolendPool',
  DriftDeposit = 'DriftDeposit',
}

export enum TransactionType {
  SubscriptionCreated = 'subscription_created',
  Payment = 'payment',
  Cancel = 'cancel',
  Deposit = 'deposit',
  Withdrawal = 'withdrawal',
}

// ============================================
// ACCOUNT TYPES (from Rust program)
// ============================================

export interface SubscriptionWallet {
  owner: PublicKey;
  mainTokenAccount: PublicKey;
  mint: PublicKey;
  yieldVault: PublicKey;
  yieldStrategy: YieldStrategy;
  isYieldEnabled: boolean;
  totalSubscriptions: number;
  totalSpent: BN;
  bump: number;
}

export interface MerchantPlan {
  merchant: PublicKey;
  mint: PublicKey;
  planId: string;
  planName: string;
  feeAmount: BN;
  paymentInterval: BN;
  isActive: boolean;
  totalSubscribers: number;
  bump: number;
}

export interface SubscriptionState {
  user: PublicKey;
  subscriptionWallet: PublicKey;
  merchant: PublicKey;
  mint: PublicKey;
  merchantPlan: PublicKey;
  feeAmount: BN;
  paymentInterval: BN;
  lastPaymentTimestamp: BN;
  totalPaid: BN;
  paymentCount: number;
  isActive: boolean;
  bump: number;
}

// ============================================
// EVENT TYPES (from Rust program)
// ============================================

export interface SubscriptionWalletCreatedEvent {
  walletPda: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
}

export interface YieldEnabledEvent {
  walletPda: PublicKey;
  strategy: string;
  vault: PublicKey;
}

export interface WalletDepositEvent {
  walletPda: PublicKey;
  user: PublicKey;
  amount: BN;
  depositedToYield: boolean;
}

export interface WalletWithdrawalEvent {
  walletPda: PublicKey;
  user: PublicKey;
  amount: BN;
}

export interface SubscriptionCreatedEvent {
  subscriptionPda: PublicKey;
  user: PublicKey;
  wallet: PublicKey;
  merchant: PublicKey;
  planId: string;
}

export interface PaymentExecutedEvent {
  subscriptionPda: PublicKey;
  walletPda: PublicKey;
  user: PublicKey;
  merchant: PublicKey;
  amount: BN;
  paymentNumber: number;
}

export interface SubscriptionCancelledEvent {
  subscriptionPda: PublicKey;
  walletPda: PublicKey;
  user: PublicKey;
  merchant: PublicKey;
  paymentsMade: number;
}

export interface YieldClaimedEvent {
  walletPda: PublicKey;
  user: PublicKey;
  amount: BN;
}

// ============================================
// DISCRIMINATED UNION FOR ALL EVENTS
// ============================================

export type ProgramEvent =
  | { name: 'SubscriptionWalletCreated'; data: SubscriptionWalletCreatedEvent }
  | { name: 'YieldEnabled'; data: YieldEnabledEvent }
  | { name: 'WalletDeposit'; data: WalletDepositEvent }
  | { name: 'WalletWithdrawal'; data: WalletWithdrawalEvent }
  | { name: 'SubscriptionCreated'; data: SubscriptionCreatedEvent }
  | { name: 'PaymentExecuted'; data: PaymentExecutedEvent }
  | { name: 'SubscriptionCancelled'; data: SubscriptionCancelledEvent }
  | { name: 'YieldClaimed'; data: YieldClaimedEvent };

// ============================================
// DATABASE ENTITY TYPES
// ============================================

export interface MerchantPlanEntity {
  planPda: string;
  merchantWallet: string;
  planId: string;
  planName: string;
  mint: string;
  feeAmount: string;
  paymentInterval: string;
  isActive: boolean;
  totalSubscribers: number;
  totalRevenue: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubscriptionEntity {
  subscriptionPda: string;
  userWallet: string;
  subscriptionWalletPda: string;
  merchantWallet: string;
  merchantPlanPda: string;
  mint: string;
  feeAmount: string;
  paymentInterval: string;
  lastPaymentTimestamp: string;
  totalPaid: string;
  paymentCount: number;
  isActive: boolean;
  cancelledAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubscriptionWalletEntity {
  walletPda: string;
  ownerWallet: string;
  mint: string;
  isYieldEnabled: boolean;
  yieldStrategy?: string;
  yieldVault?: string;
  totalSubscriptions: number;
  totalSpent: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TransactionEntity {
  signature: string;
  subscriptionPda: string;
  type: TransactionType;
  amount: string;
  fromWallet: string;
  toWallet: string;
  slot: number;
  blockTime: string;
  status: 'success' | 'failed';
  createdAt?: Date;
}

// ============================================
// UTILITY TYPES
// ============================================

export interface AccountWithPubkey<T> {
  pubkey: PublicKey;
  account: T;
}

export interface TransactionRecordData {
  signature: string;
  subscriptionPda: string;
  type: TransactionType;
  amount: string;
  fromWallet: string;
  toWallet: string;
  slot: number;
}

// ============================================
// ACCOUNT DISCRIMINATORS
// ============================================

/**
 * Account discriminators are the first 8 bytes of each account type
 * Computed as: sha256("account:<AccountName>")[0..8]
 *
 */
export const ACCOUNT_DISCRIMINATORS = {
  MerchantPlan: Buffer.from([186, 54, 183, 129, 39, 81, 74, 89]),
  SubscriptionState: Buffer.from([35, 41, 45, 165, 253, 34, 95, 225]),
  SubscriptionWallet: Buffer.from([255, 81, 65, 25, 250, 57, 38, 118]),
};

// ============================================
// TYPE GUARDS
// ============================================

export function isSubscriptionWalletEvent(event: ProgramEvent): event is {
  name: 'SubscriptionWalletCreated';
  data: SubscriptionWalletCreatedEvent;
} {
  return event.name === 'SubscriptionWalletCreated';
}

export function isPaymentExecutedEvent(
  event: ProgramEvent,
): event is { name: 'PaymentExecuted'; data: PaymentExecutedEvent } {
  return event.name === 'PaymentExecuted';
}

export function isSubscriptionCancelledEvent(event: ProgramEvent): event is {
  name: 'SubscriptionCancelled';
  data: SubscriptionCancelledEvent;
} {
  return event.name === 'SubscriptionCancelled';
}

// ============================================
// CONVERSION HELPERS
// ============================================

/**
 * Convert blockchain account to database entity
 */
export function subscriptionWalletToEntity(
  pubkey: PublicKey,
  account: SubscriptionWallet,
): SubscriptionWalletEntity {
  return {
    walletPda: pubkey.toString(),
    ownerWallet: account.owner.toString(),
    mint: account.mint.toString(),
    isYieldEnabled: account.isYieldEnabled,
    yieldStrategy: account.yieldStrategy,
    yieldVault: account.yieldVault.toString(),
    totalSubscriptions: account.totalSubscriptions,
    totalSpent: account.totalSpent.toString(),
  };
}

export function merchantPlanToEntity(
  pubkey: PublicKey,
  account: MerchantPlan,
): Omit<MerchantPlanEntity, 'totalRevenue'> {
  return {
    planPda: pubkey.toString(),
    merchantWallet: account.merchant.toString(),
    planId: account.planId,
    planName: account.planName,
    mint: account.mint.toString(),
    feeAmount: account.feeAmount.toString(),
    paymentInterval: account.paymentInterval.toString(),
    isActive: account.isActive,
    totalSubscribers: account.totalSubscribers,
  };
}

export function subscriptionStateToEntity(
  pubkey: PublicKey,
  account: SubscriptionState,
): SubscriptionEntity {
  return {
    subscriptionPda: pubkey.toString(),
    userWallet: account.user.toString(),
    subscriptionWalletPda: account.subscriptionWallet.toString(),
    merchantWallet: account.merchant.toString(),
    merchantPlanPda: account.merchantPlan.toString(),
    mint: account.mint.toString(),
    feeAmount: account.feeAmount.toString(),
    paymentInterval: account.paymentInterval.toString(),
    lastPaymentTimestamp: account.lastPaymentTimestamp.toString(),
    totalPaid: account.totalPaid.toString(),
    paymentCount: account.paymentCount,
    isActive: account.isActive,
  };
}
