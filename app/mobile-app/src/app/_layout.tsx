import React from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { PrivyProvider } from '@privy-io/expo';
import { useWalletStore } from '../store/walletStore';
import { PRIVY_CONFIG } from '../config/privy';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
    },
  },
});

function RootNavigator() {
  const hydrate = useWalletStore((state) => state.hydrate);

  React.useEffect(() => {
    hydrate();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="subscriptions/browse" />
      <Stack.Screen name="subscriptions/[id]" />
      <Stack.Screen name="wallet/deposit" />
      <Stack.Screen name="wallet/withdraw" />
      <Stack.Screen name="wallet/yield" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PrivyProvider
        appId={PRIVY_CONFIG.appId}
        clientId={PRIVY_CONFIG.clientId}
      >
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <RootNavigator />
        </QueryClientProvider>
      </PrivyProvider>
    </GestureHandlerRootView>
  );
}