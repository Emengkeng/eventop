// app/(tabs)/index.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet, TrendingUp, Calendar, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { useWalletStore } from '../../../src/store/walletStore';
import { useSubscriptions, useUpcomingPayments } from '../../../src/hooks/useSubscriptions';
import { useWalletBalance } from '../../hooks/userWalletBalance';

export default function HomeScreen() {
  const router = useRouter();
  const { publicKey, balance } = useWalletStore();
  const { data: subscriptions, isLoading: subsLoading, refetch } = useSubscriptions();
  const { data: upcomingPayments } = useUpcomingPayments();
  const { data: walletBalance } = useWalletBalance();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Calculate stats
  const activeSubscriptions = subscriptions?.filter(s => s.isActive).length || 0;
  const totalBalance = walletBalance ? parseFloat(walletBalance.totalSpent) / 1_000_000 : balance.total;
  const committedBalance = balance.committed;
  const availableBalance = totalBalance - committedBalance;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.walletAddress}>
              {publicKey ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}` : 'Connect Wallet'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.walletIcon}
            onPress={() => router.push('/profile')}
          >
            <Wallet size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <LinearGradient
          colors={['#18181b', '#27272a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <TouchableOpacity onPress={() => router.push('/wallet/yield')}>
              <View style={styles.yieldBadge}>
                <TrendingUp size={12} color={colors.success} />
                <Text style={styles.yieldText}>Coming Soon</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.balanceAmount}>
            ${totalBalance.toFixed(2)}
          </Text>

          <View style={styles.balanceBreakdown}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Available</Text>
              <Text style={styles.breakdownValue}>${availableBalance.toFixed(2)}</Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Committed</Text>
              <Text style={styles.breakdownValue}>${committedBalance.toFixed(2)}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/wallet/deposit')}
            >
              <View style={styles.actionIcon}>
                <ArrowDownRight size={20} color={colors.foreground} />
              </View>
              <Text style={styles.actionText}>Deposit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/wallet/withdraw')}
            >
              <View style={styles.actionIcon}>
                <ArrowUpRight size={20} color={colors.foreground} />
              </View>
              <Text style={styles.actionText}>Withdraw</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/subscriptions/browse')}
            >
              <View style={styles.actionIcon}>
                <Plus size={20} color={colors.foreground} />
              </View>
              <Text style={styles.actionText}>Subscribe</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Upcoming Payments */}
        {upcomingPayments && upcomingPayments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Calendar size={20} color={colors.foreground} />
                <Text style={styles.sectionTitle}>Upcoming Payments</Text>
              </View>
            </View>

            <Card noPadding>
              {upcomingPayments.slice(0, 3).map((payment: any, index: number) => (
                <TouchableOpacity
                  key={payment.subscriptionPda}
                  style={[
                    styles.paymentItem,
                    index !== upcomingPayments.slice(0, 3).length - 1 && styles.paymentItemBorder,
                  ]}
                  onPress={() => router.push(`/subscriptions/${payment.subscriptionPda}`)}
                >
                  <View style={styles.paymentIcon}>
                    <Text style={styles.paymentIconText}>
                      {payment.merchantWallet.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentMerchant}>
                      {payment.merchantWallet.slice(0, 8)}...
                    </Text>
                    <Text style={styles.paymentDate}>
                      {payment.daysUntil === 0
                        ? 'Today'
                        : `In ${payment.daysUntil} day${payment.daysUntil > 1 ? 's' : ''}`}
                    </Text>
                  </View>
                  <Text style={styles.paymentAmount}>
                    ${(parseFloat(payment.amount) / 1_000_000).toFixed(2)}
                  </Text>
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        )}

        {/* Active Subscriptions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Subscriptions</Text>
            <TouchableOpacity onPress={() => router.push('/subscriptions')}>
              <Text style={styles.sectionLink}>View All</Text>
            </TouchableOpacity>
          </View>

          {subsLoading ? (
            <Card>
              <Text style={styles.loadingText}>Loading subscriptions...</Text>
            </Card>
          ) : !subscriptions || subscriptions.length === 0 ? (
            <Card>
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No active subscriptions</Text>
                <Text style={styles.emptyDescription}>
                  Browse plans and subscribe to services
                </Text>
                <Button
                  onPress={() => router.push('/subscriptions/browse')}
                  style={styles.emptyButton}
                >
                  Browse Plans
                </Button>
              </View>
            </Card>
          ) : (
            <View style={styles.subscriptionsList}>
              {subscriptions.slice(0, 3).map((sub: any) => (
                <TouchableOpacity
                  key={sub.subscriptionPda}
                  onPress={() => router.push(`/subscriptions/${sub.subscriptionPda}`)}
                >
                  <Card style={styles.subscriptionCard}>
                    <View style={styles.subscriptionHeader}>
                      <View style={styles.subscriptionIcon}>
                        <Text style={styles.subscriptionIconText}>
                          {sub.merchantWallet.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.subscriptionInfo}>
                        <Text style={styles.subscriptionName}>
                          {sub.merchantPlanPda.slice(0, 16)}...
                        </Text>
                        <Text style={styles.subscriptionPrice}>
                          ${(parseFloat(sub.feeAmount) / 1_000_000).toFixed(2)}/month
                        </Text>
                      </View>
                      <View style={styles.subscriptionBadge}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeBadgeText}>Active</Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  walletAddress: {
    ...typography.h3,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  walletIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  yieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  yieldText: {
    ...typography.caption,
    color: colors.success,
  },
  balanceAmount: {
    ...typography.h1,
    fontSize: 40,
    color: colors.primaryForeground,
  },
  balanceBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  breakdownItem: {
    flex: 1,
  },
  breakdownLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  breakdownValue: {
    ...typography.bodyMedium,
    color: colors.primaryForeground,
    marginTop: spacing.xs,
  },
  breakdownDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primaryForeground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    ...typography.caption,
    color: colors.primaryForeground,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.foreground,
  },
  sectionLink: {
    ...typography.smallMedium,
    color: colors.primary,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  paymentItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentIconText: {
    ...typography.smallMedium,
    color: colors.foreground,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentMerchant: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  paymentDate: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  paymentAmount: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  loadingText: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.foreground,
  },
  emptyDescription: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: spacing.md,
  },
  subscriptionsList: {
    gap: spacing.md,
  },
  subscriptionCard: {
    padding: spacing.lg,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  subscriptionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionIconText: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionName: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  subscriptionPrice: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.success,
  },
  activeBadgeText: {
    ...typography.caption,
    color: colors.success,
  },
});