import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

export interface SubscriptionStateAccount {
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

export interface MerchantPlanAccount {
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

// export interface SubscriptionWalletAccount {
//   owner: PublicKey;
//   mainTokenAccount: PublicKey;
//   mint: PublicKey;
//   yieldVault: PublicKey;
//   yieldStrategy: number;
//   isYieldEnabled: boolean;
//   totalSubscriptions: number;
//   totalSpent: BN;
//   bump: number;
// }

export interface SubscriptionStateAccount {
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

export interface SubscriptionWalletAccount {
  owner: PublicKey;
  mainTokenAccount: PublicKey;
  mint: PublicKey;
  yieldVault: PublicKey;
  yieldStrategy: unknown;
  isYieldEnabled: boolean;
  totalSubscriptions: number;
  totalSpent: BN;
  bump: number;
}

export interface MerchantPlanAccount {
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

export interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface SubscriptionDetails {
  merchant: string;
  merchantPlan: string;
  feeAmount: string;
  lastPaymentTimestamp: string;
  paymentInterval: string;
  isActive: boolean;
}

export function isValidSubscriptionAccount(
  account: unknown,
): account is SubscriptionStateAccount {
  const acc = account as SubscriptionStateAccount;
  return (
    acc.merchant instanceof PublicKey &&
    acc.merchantPlan instanceof PublicKey &&
    typeof acc.isActive === 'boolean'
  );
}
