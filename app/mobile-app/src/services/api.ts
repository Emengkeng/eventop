import axios from 'axios';

const API_URL = __DEV__ 
  ? 'http://localhost:3001' 
  : 'https://api.yourapp.com';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API Types
export interface MerchantPlan {
  planPda: string;
  merchantWallet: string;
  planId: string;
  planName: string;
  mint: string;
  feeAmount: string;
  paymentInterval: string;
  isActive: boolean;
  totalSubscribers: number;
  description?: string;
  logoUrl?: string;
  category?: string;
}

export interface SubscriptionResponse {
  subscriptionPda: string;
  userWallet: string;
  merchantWallet: string;
  merchantPlanPda: string;
  feeAmount: string;
  paymentInterval: string;
  lastPaymentTimestamp: string;
  totalPaid: string;
  paymentCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface WalletBalance {
  walletPda: string;
  ownerWallet: string;
  mint: string;
  isYieldEnabled: boolean;
  totalSubscriptions: number;
  totalSpent: string;
}

// API Functions
export const apiService = {
  // Plans
  getPlans: async (params?: { category?: string; search?: string }) => {
    const { data } = await api.get<MerchantPlan[]>('/merchants/plans/search', { params });
    return data;
  },

  getPlanDetail: async (planPda: string) => {
    const { data } = await api.get<MerchantPlan>(`/merchants/plans/${planPda}`);
    return data;
  },

  // Subscriptions
  getUserSubscriptions: async (walletAddress: string) => {
    const { data } = await api.get<SubscriptionResponse[]>(`/subscriptions/user/${walletAddress}`);
    return data;
  },

  getSubscriptionDetail: async (subscriptionPda: string) => {
    const { data } = await api.get(`/subscriptions/${subscriptionPda}`);
    return data;
  },

  getUpcomingPayments: async (walletAddress: string) => {
    const { data } = await api.get(`/subscriptions/user/${walletAddress}/upcoming`);
    return data;
  },

  // Wallet
  getWalletBalance: async (walletPda: string) => {
    const { data } = await api.get<WalletBalance>(`/subscriptions/wallet/${walletPda}/balance`);
    return data;
  },

  getUserStats: async (walletAddress: string) => {
    const { data } = await api.get(`/subscriptions/user/${walletAddress}/stats`);
    return data;
  },
};