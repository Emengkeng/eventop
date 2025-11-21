import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

interface WalletState {
  publicKey: string | null;
  authToken: string | null;
  isConnected: boolean;
  subscriptionWalletPda: string | null;
  userId: string | null; // Privy user ID
  email: string | null;
  loginMethod: 'email' | 'oauth' | 'wallet' | null;
  balance: {
    total: number;
    committed: number;
    available: number;
    yieldEnabled: boolean;
  };
  
  setWallet: (publicKey: string, authToken: string, userId?: string) => void;
  setUserInfo: (info: { email?: string; loginMethod?: 'email' | 'oauth' | 'wallet' }) => void;
  setSubscriptionWallet: (pda: string) => void;
  updateBalance: (balance: Partial<WalletState['balance']>) => void;
  updateAuthToken: (token: string) => void; // For token refresh
  disconnect: () => void;
  hydrate: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  publicKey: null,
  authToken: null,
  isConnected: false,
  subscriptionWalletPda: null,
  userId: null,
  email: null,
  loginMethod: null,
  balance: {
    total: 0,
    committed: 0,
    available: 0,
    yieldEnabled: false,
  },

  setWallet: (publicKey, authToken, userId) => {
    storage.set('wallet.publicKey', publicKey);
    storage.set('wallet.authToken', authToken);
    if (userId) {
      storage.set('wallet.userId', userId);
    }
    set({ 
      publicKey, 
      authToken, 
      userId: userId || null,
      isConnected: true 
    });
  },

  setUserInfo: (info) => {
    if (info.email) {
      storage.set('wallet.email', info.email);
    }
    if (info.loginMethod) {
      storage.set('wallet.loginMethod', info.loginMethod);
    }
    set({ 
      email: info.email || get().email,
      loginMethod: info.loginMethod || get().loginMethod,
    });
  },

  setSubscriptionWallet: (pda) => {
    storage.set('wallet.subscriptionPda', pda);
    set({ subscriptionWalletPda: pda });
  },

  updateBalance: (balance) => {
    set((state) => ({
      balance: { ...state.balance, ...balance },
    }));
  },

  updateAuthToken: (token) => {
    storage.set('wallet.authToken', token);
    set({ authToken: token });
  },

  disconnect: () => {
    storage.delete('wallet.publicKey');
    storage.delete('wallet.authToken');
    storage.delete('wallet.subscriptionPda');
    storage.delete('wallet.userId');
    storage.delete('wallet.email');
    storage.delete('wallet.loginMethod');
    
    set({
      publicKey: null,
      authToken: null,
      isConnected: false,
      subscriptionWalletPda: null,
      userId: null,
      email: null,
      loginMethod: null,
      balance: {
        total: 0,
        committed: 0,
        available: 0,
        yieldEnabled: false,
      },
    });
  },

  hydrate: () => {
    const publicKey = storage.getString('wallet.publicKey');
    const authToken = storage.getString('wallet.authToken');
    const subscriptionPda = storage.getString('wallet.subscriptionPda');
    const userId = storage.getString('wallet.userId');
    const email = storage.getString('wallet.email');
    const loginMethod = storage.getString('wallet.loginMethod') as 'email' | 'oauth' | 'wallet' | null;

    if (publicKey && authToken) {
      set({
        publicKey,
        authToken,
        isConnected: true,
        subscriptionWalletPda: subscriptionPda || null,
        userId: userId || null,
        email: email || null,
        loginMethod: loginMethod || null,
      });
    }
  },
}));