import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api';

export function usePlans(filters?: { category?: string; search?: string }) {
  return useQuery({
    queryKey: ['plans', filters],
    queryFn: () => apiService.getPlans(filters),
    staleTime: 60000, // 1 minute
  });
}

export function usePlanDetail(planPda: string) {
  return useQuery({
    queryKey: ['plan', planPda],
    queryFn: () => apiService.getPlanDetail(planPda),
    enabled: !!planPda,
  });
}