import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { usePrivy } from '@privy-io/expo';

/**
 * Hook to protect routes that require authentication
 * Redirects to login if user is not authenticated
 */
export function useAuthGuard() {
  const { user, isReady } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !user) {
      router.replace('/auth/login');
    }
  }, [user, isReady]);

  return {
    isAuthenticated: !!user,
    isLoading: !isReady,
  };
}