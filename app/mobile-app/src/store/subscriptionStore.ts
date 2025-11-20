import { create } from 'zustand';

export interface Subscription {
  subscriptionPda: string;
  merchantWallet: string;
  merchantName: string;
  planName: string;
  feeAmount: number;
  paymentInterval: number;
  lastPaymentTimestamp: number;
  nextPaymentDate: Date;
  totalPaid: number;
  paymentCount: number;
  isActive: boolean;
  logoUrl?: string;
}

interface SubscriptionState {
  subscriptions: Subscription[];
  loading: boolean;
  error: string | null;

  // Actions
  setSubscriptions: (subscriptions: Subscription[]) => void;
  addSubscription: (subscription: Subscription) => void;
  updateSubscription: (pda: string, updates: Partial<Subscription>) => void;
  removeSubscription: (pda: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  subscriptions: [],
  loading: false,
  error: null,

  setSubscriptions: (subscriptions) => set({ subscriptions }),
  
  addSubscription: (subscription) =>
    set((state) => ({
      subscriptions: [subscription, ...state.subscriptions],
    })),
  
  updateSubscription: (pda, updates) =>
    set((state) => ({
      subscriptions: state.subscriptions.map((sub) =>
        sub.subscriptionPda === pda ? { ...sub, ...updates } : sub
      ),
    })),
  
  removeSubscription: (pda) =>
    set((state) => ({
      subscriptions: state.subscriptions.filter((sub) => sub.subscriptionPda !== pda),
    })),
  
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));