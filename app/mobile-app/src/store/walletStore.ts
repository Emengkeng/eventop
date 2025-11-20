import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { PublicKey } from '@solana/web3.js';

const storage = new MMKV();

interface WalletState {
  publicKey: string | null;
  authToken: string | null;
  isConnected: boolean;
  subscriptionWalletPda: string | null;
  balance: {
    total: number;
    committed: number;
    available: number;
    yieldEnabled: boolean;
  };
  
  // Actions
  setWallet: (publicKey: string, authToken: string) => void;
  setSubscriptionWallet: (pda: string) => void;
  updateBalance: (balance: Partial<WalletState['balance']>) => void;
  disconnect: () => void;
  hydrate: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  publicKey: null,
  authToken: null,
  isConnected: false,
  subscriptionWalletPda: null,
  balance: {
    total: 0,
    committed: 0,
    available: 0,
    yieldEnabled: false,
  },

  setWallet: (publicKey, authToken) => {
    storage.set('wallet.publicKey', publicKey);
    storage.set('wallet.authToken', authToken);
    set({ publicKey, authToken, isConnected: true });
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

  disconnect: () => {
    storage.delete('wallet.publicKey');
    storage.delete('wallet.authToken');
    storage.delete('wallet.subscriptionPda');
    set({
      publicKey: null,
      authToken: null,
      isConnected: false,
      subscriptionWalletPda: null,
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

    if (publicKey && authToken) {
      set({
        publicKey,
        authToken,
        isConnected: true,
        subscriptionWalletPda: subscriptionPda || null,
      });
    }
  },
}));