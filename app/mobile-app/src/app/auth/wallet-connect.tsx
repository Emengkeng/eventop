import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Wallet, Shield, TrendingUp, Zap } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useWalletStore } from '../../store/walletStore';
import { solanaService } from '../../services/solana';

export default function WalletConnectScreen() {
  const router = useRouter();
  const { setWallet } = useWalletStore();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      const { publicKey, authToken } = await solanaService.connectWallet();
      
      // Save to store
      setWallet(publicKey, authToken);

      // Navigate to home
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.icon}>
            <Wallet size={48} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Welcome to{'\n'}Subscription Wallet</Text>
        <Text style={styles.subtitle}>
          Manage all your subscriptions in one place with automatic payments
        </Text>

        {/* Features */}
        <View style={styles.features}>
          <Card style={styles.featureCard}>
            <Shield size={24} />
            <Text style={styles.featureTitle}>Secure & Non-Custodial</Text>
            <Text style={styles.featureDescription}>
              Your wallet, your keys. We never have access to your funds.
            </Text>
          </Card>

          <Card style={styles.featureCard}>
            <TrendingUp size={24} />
            <Text style={styles.featureTitle}>Earn Yield on Idle Funds</Text>
            <Text style={styles.featureDescription}>
              Turn on yield to earn interest on unused subscription balance.
            </Text>
          </Card>

          <Card style={styles.featureCard}>
            <Zap size={24} />
            <Text style={styles.featureTitle}>Automatic Payments</Text>
            <Text style={styles.featureDescription}>
              Never miss a payment. Subscriptions renew automatically.
            </Text>
          </Card>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Connect Button */}
        <View style={styles.buttonContainer}>
          <Button
            onPress={handleConnect}
            loading={loading}
            disabled={loading}
          >
            Connect Wallet
          </Button>

          <Text style={styles.helperText}>
            By connecting, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
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
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  features: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  featureCard: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  featureTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  featureDescription: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  errorContainer: {
    padding: spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.small,
    color: colors.destructive,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: spacing.md,
  },
  helperText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});