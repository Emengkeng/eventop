import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Wallet as WalletIcon, ExternalLink } from 'lucide-react-native';
import { usePrivy } from '@privy-io/expo';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useWalletStore } from '../../store/walletStore';
import { solanaService } from '../../services/solana';

export default function DepositScreen() {
  const router = useRouter();
  const { user } = usePrivy();
  const { subscriptionWalletPda } = useWalletStore();
  
  const [amount, setAmount] = React.useState('');
  const [walletConnected, setWalletConnected] = React.useState(false);
  const [connectedAddress, setConnectedAddress] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleConnectWallet = async () => {
    if (!user) {
      Alert.alert('Error', 'Please login first');
      return;
    }

    setLoading(true);
    try {
      const { publicKey } = await solanaService.connectWallet();
      setConnectedAddress(publicKey);
      setWalletConnected(true);
      Alert.alert('Success', 'Wallet connected successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectWallet = () => {
    setWalletConnected(false);
    setConnectedAddress(null);
    solanaService.disconnect();
  };

  const handleDeposit = async () => {
    if (!walletConnected || !connectedAddress) {
      Alert.alert('Error', 'Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      // Create and sign deposit transaction
      // This is where you'd create the actual Solana transaction
      // For now, showing the flow
      
      Alert.alert(
        'Confirm Deposit',
        `Deposit ${amount} USDC to your Subscription Wallet?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              try {
                // TODO: Create actual transaction here
                // const tx = await createDepositTransaction(amount, subscriptionWalletPda);
                // const signature = await solanaService.signAndSendTransaction(tx);
                
                Alert.alert('Success', 'Deposit completed successfully');
                setAmount('');
                router.back();
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Deposit failed');
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to prepare transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Deposit Funds</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Wallet Connection Card */}
        <Card>
          <View style={styles.cardHeader}>
            <WalletIcon size={20} />
            <Text style={styles.cardTitle}>External Wallet</Text>
          </View>

          {!walletConnected ? (
            <>
              <Text style={styles.description}>
                Connect your Solana wallet to deposit funds into your Subscription Wallet
              </Text>
              <Button
                onPress={handleConnectWallet}
                loading={loading}
                disabled={loading}
              >
                Connect Wallet
              </Button>
            </>
          ) : (
            <>
              <View style={styles.walletInfo}>
                <Text style={styles.walletLabel}>Connected Wallet</Text>
                <Text style={styles.walletAddress}>
                  {connectedAddress?.slice(0, 8)}...{connectedAddress?.slice(-8)}
                </Text>
              </View>
              <Button
                variant="outline"
                onPress={handleDisconnectWallet}
                disabled={loading}
              >
                Disconnect
              </Button>
            </>
          )}
        </Card>

        {/* Amount Input */}
        {walletConnected && (
          <Card>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Deposit Amount</Text>
            </View>

            <Input
              label="Amount (USDC)"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              editable={!loading}
            />

            <View style={styles.quickAmounts}>
              {['10', '25', '50', '100'].map((quickAmount) => (
                <TouchableOpacity
                  key={quickAmount}
                  style={styles.quickAmountButton}
                  onPress={() => setAmount(quickAmount)}
                  disabled={loading}
                >
                  <Text style={styles.quickAmountText}>${quickAmount}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              onPress={handleDeposit}
              loading={loading}
              disabled={loading || !amount || parseFloat(amount) <= 0}
            >
              {`Deposit${amount ? ` $${amount}` : ''}`}
            </Button>
          </Card>
        )}

        {/* Subscription Wallet Info */}
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Destination</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Subscription Wallet</Text>
            <Text style={styles.infoValue}>
              {subscriptionWalletPda
                ? `${subscriptionWalletPda.slice(0, 8)}...${subscriptionWalletPda.slice(-8)}`
                : 'Not created yet'}
            </Text>
          </View>

          <TouchableOpacity style={styles.viewExplorer}>
            <Text style={styles.viewExplorerText}>View on Explorer</Text>
            <ExternalLink size={16} />
          </TouchableOpacity>
        </Card>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            1. Connect your external Solana wallet{'\n'}
            2. Enter the amount you want to deposit{'\n'}
            3. Approve the transaction in your wallet{'\n'}
            4. Funds will appear in your Subscription Wallet
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.foreground,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h4,
    color: colors.foreground,
  },
  description: {
    ...typography.body,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  walletInfo: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  walletLabel: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  walletAddress: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  quickAmountText: {
    ...typography.smallMedium,
    color: colors.foreground,
  },
  infoRow: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  infoLabel: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  viewExplorer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  viewExplorerText: {
    ...typography.smallMedium,
    color: colors.primary,
  },
  infoBox: {
    padding: spacing.lg,
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  infoTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  infoText: {
    ...typography.small,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
});