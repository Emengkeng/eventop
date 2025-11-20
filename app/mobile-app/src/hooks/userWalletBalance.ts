import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { useWalletStore } from '../store/walletStore';

export function useWalletBalance() {
  const subscriptionWalletPda = useWalletStore((state) => state.subscriptionWalletPda);

  return useQuery({
    queryKey: ['wallet-balance', subscriptionWalletPda],
    queryFn: () => apiService.getWalletBalance(subscriptionWalletPda!),
    enabled: !!subscriptionWalletPda,
    refetchInterval: 10000, // Refetch every 10s
  });
}