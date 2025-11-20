import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { useWalletStore } from '../store/walletStore';

export function useSubscriptions() {
  const publicKey = useWalletStore((state) => state.publicKey);

  return useQuery({
    queryKey: ['subscriptions', publicKey],
    queryFn: () => apiService.getUserSubscriptions(publicKey!),
    enabled: !!publicKey,
    refetchInterval: 30000, // Refetch every 30s
  });
}

export function useUpcomingPayments() {
  const publicKey = useWalletStore((state) => state.publicKey);

  return useQuery({
    queryKey: ['upcoming-payments', publicKey],
    queryFn: () => apiService.getUpcomingPayments(publicKey!),
    enabled: !!publicKey,
  });
}