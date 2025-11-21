import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Wallet, Mail, Lock } from 'lucide-react-native';
import { usePrivy, useLoginWithEmail, useLoginWithOAuth } from '@privy-io/expo';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useWalletStore } from '../../store/walletStore';

export default function LoginScreen() {
  const router = useRouter();
  const { user, getAccessToken } = usePrivy();
  const { setWallet } = useWalletStore();
  const { login, state } = useLoginWithOAuth();
  
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [showCodeInput, setShowCodeInput] = React.useState(false);

  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail({
    onSendCodeSuccess: () => setShowCodeInput(true),
    onLoginSuccess: async (user, isNewUser) => {
      const accessToken = await getAccessToken();
      setWallet(user.id, accessToken!);
      router.replace('/(tabs)');
    },
    onError: (error) => {
      console.error('Email login error:', error);
    },
  });

  const loginWithGoogle = async () => {
    try {
      const user = await login({ provider: 'google' });
      const accessToken = await getAccessToken();
      setWallet(user!.id, accessToken!);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Google login error:', error);
    } finally {
    }
  };

  const loginWithTwitter = async () => {
    try {
      const user = await login({ provider: 'twitter' });
      const accessToken = await getAccessToken();
      setWallet(user!.id, accessToken!);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Google login error:', error);
    } finally {
    }
  };

//   const { login: loginWithGoogle, state: googleState } = useLoginWithOAuth({
//     onLoginSuccess: async (user, isNewUser) => {
//       const accessToken = await user.getAccessToken();
//       setWallet(user.id, accessToken);
//       router.replace('/(tabs)');
//     },
//     onError: (error) => {
//       console.error('Google login error:', error);
//     },
//   });

//   const { login: loginWithTwitter, state: twitterState } = useLoginWithOAuth({
//     onLoginSuccess: async (user, isNewUser) => {
//       const accessToken = await user.getAccessToken();
//       setWallet(user.id, accessToken);
//       router.replace('/(tabs)');
//     },
//     onError: (error) => {
//       console.error('Twitter login error:', error);
//     },
//   });

  React.useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
    }
  }, [user]);

  const handleSendCode = async () => {
    if (!email.trim()) return;
    await sendCode({ email });
  };

  const handleLoginWithCode = async () => {
    if (!code.trim()) return;
    await loginWithCode({ code, email });
  };

  const isLoading = 
    emailState.status === 'sending-code' || 
    emailState.status === 'submitting-code' ||
    state.status === 'loading';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.iconContainer}>
          <View style={styles.icon}>
            <Wallet size={48} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>
          Sign in to manage your subscriptions
        </Text>

        {/* Email Login */}
        <Card style={styles.emailCard}>
          {!showCodeInput ? (
            <>
              <Input
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
              <Button
                onPress={handleSendCode}
                loading={emailState.status === 'sending-code'}
                disabled={isLoading || !email.trim()}
              >
                Continue with Email
              </Button>
            </>
          ) : (
            <>
              <View style={styles.codeHeader}>
                <Mail size={20} />
                <Text style={styles.codeSent}>Code sent to {email}</Text>
              </View>
              <Input
                label="Verification Code"
                value={code}
                onChangeText={setCode}
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                maxLength={6}
                editable={!isLoading}
              />
              <Button
                onPress={handleLoginWithCode}
                loading={emailState.status === 'submitting-code'}
                disabled={isLoading || !code.trim()}
              >
                Verify Code
              </Button>
              <TouchableOpacity
                onPress={() => {
                  setShowCodeInput(false);
                  setCode('');
                }}
                disabled={isLoading}
              >
                <Text style={styles.linkText}>Use different email</Text>
              </TouchableOpacity>
            </>
          )}
        </Card>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* OAuth Buttons */}
        <View style={styles.oauthButtons}>
          <Button
            variant="outline"
            onPress={loginWithGoogle}
            loading={state.status === 'loading'}
            disabled={isLoading}
          >
            Google
          </Button>
          <Button
            variant="outline"
            onPress={loginWithTwitter}
            loading={state.status === 'loading'}
            disabled={isLoading}
          >
            Twitter
          </Button>
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  emailCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  codeSent: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  linkText: {
    ...typography.small,
    color: colors.primary,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  oauthButtons: {
    gap: spacing.md,
  },
  terms: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});