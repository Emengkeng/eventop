import { usePrivy } from '@privy-io/expo';
import { useWalletStore } from '../store/walletStore';

export function useRefreshAuthToken() {
  const { user, getAccessToken } = usePrivy();
  const { setWallet } = useWalletStore();

  const refreshToken = async () => {
    if (!user) return null;
    
    try {
      const accessToken = await getAccessToken();
      setWallet(user.id, accessToken!);
      return accessToken;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  };

  return { refreshToken };
}