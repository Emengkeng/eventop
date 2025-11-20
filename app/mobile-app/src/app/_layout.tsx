import React from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useWalletStore } from '../store/walletStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
    },
  },
});

export default function RootLayout() {
  const hydrate = useWalletStore((state) => state.hydrate);

  React.useEffect(() => {
    // Hydrate wallet state from storage
    hydrate();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/wallet-connect" />
          <Stack.Screen name="subscriptions/browse" />
          <Stack.Screen name="subscriptions/[id]" />
          <Stack.Screen name="wallet/deposit" />
          <Stack.Screen name="wallet/withdraw" />
          <Stack.Screen name="wallet/yield" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}