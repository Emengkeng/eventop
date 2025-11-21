import axios from 'axios';
import { useWalletStore } from '../store/walletStore';

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

// Add auth token to all requests
api.interceptors.request.use(
  (config) => {
    const authToken = useWalletStore.getState().authToken;
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors (token expired)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired - need to refresh or logout
      const { disconnect } = useWalletStore.getState();
      disconnect();
      // Optionally redirect to login
    }
    return Promise.reject(error);
  }
);

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
  getUserSubscriptions: async (userId: string) => {
    const { data } = await api.get<SubscriptionResponse[]>(`/subscriptions/user/${userId}`);
    return data;
  },

  getSubscriptionDetail: async (subscriptionPda: string) => {
    const { data } = await api.get(`/subscriptions/${subscriptionPda}`);
    return data;
  },

  getUpcomingPayments: async (userId: string) => {
    const { data } = await api.get(`/subscriptions/user/${userId}/upcoming`);
    return data;
  },

  // Wallet
  getWalletBalance: async (walletPda: string) => {
    const { data } = await api.get<WalletBalance>(`/subscriptions/wallet/${walletPda}/balance`);
    return data;
  },

  getUserStats: async (userId: string) => {
    const { data } = await api.get(`/subscriptions/user/${userId}/stats`);
    return data;
  },
};