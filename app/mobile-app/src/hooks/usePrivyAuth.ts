// import { useEffect } from 'react';
// import { usePrivy } from '@privy-io/expo';
// import { useWalletStore } from '../store/walletStore';
// import { useRouter } from 'expo-router';

// /**
//  * Custom hook to manage Privy authentication state
//  * Syncs Privy user with local wallet store
//  */
// export function usePrivyAuth() {
//   const { user, logout: privyLogout, getAccessToken } = usePrivy();
//   const { setWallet, setUserInfo, disconnect } = useWalletStore();
//   const router = useRouter();

//   useEffect(() => {
//     const syncUser = async () => {
//       if (user) {
//         try {
//           const accessToken = await getAccessToken();
          
//           const walletAddress = user.wallet?.address;
          
//           if (walletAddress && accessToken) {
//             setWallet(walletAddress, accessToken, user.id);
            
//             const loginMethod = user.linked_accounts.find(
//               (account) => account.type === 'email' || account.type === 'google_oauth' || account.type === 'twitter_oauth'
//             );
            
//             setUserInfo({
//               email: user.email?.address,
//               loginMethod: loginMethod?.type === 'email' 
//                 ? 'email' 
//                 : loginMethod?.type.includes('oauth')
//                 ? 'oauth'
//                 : 'wallet',
//             });
//           }
//         } catch (error) {
//           console.error('Error syncing Privy user:', error);
//         }
//       }
//     };

//     syncUser();
//   }, [user]);

//   // Logout function
//   const logout = async () => {
//     try {
//       await privyLogout();
//       disconnect();
//       router.replace('/auth/login');
//     } catch (error) {
//       console.error('Logout error:', error);
//     }
//   };

//   // Refresh access token
//   const refreshToken = async () => {
//     try {
//       const newToken = await getAccessToken();
//       const { updateAuthToken } = useWalletStore.getState();
//       updateAuthToken(newToken!);
//       return newToken;
//     } catch (error) {
//       console.error('Token refresh error:', error);
//       throw error;
//     }
//   };

//   return {
//     user,
//     logout,
//     refreshToken,
//     isAuthenticated: !!user,
//   };
// }