import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSubscriptions } from '../../hooks/useSubscriptions';

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { data: subscriptions, isLoading } = useSubscriptions();

  const activeSubscriptions = subscriptions?.filter((s: { isActive: any; }) => s.isActive) || [];
  const inactiveSubscriptions = subscriptions?.filter((s: { isActive: any; }) => !s.isActive) || [];

  const renderSubscription = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => router.push(`/subscriptions/${item.subscriptionPda}`)}
    >
      <Card style={styles.subscriptionCard}>
        <View style={styles.subscriptionHeader}>
          <View style={styles.subscriptionIcon}>
            <Text style={styles.subscriptionIconText}>
              {item.merchantWallet.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionName}>
              {item.merchantPlanPda.slice(0, 16)}...
            </Text>
            <Text style={styles.subscriptionPrice}>
              ${(parseFloat(item.feeAmount) / 1_000_000).toFixed(2)}/month
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            !item.isActive && styles.statusBadgeInactive,
          ]}>
            {item.isActive && <View style={styles.activeDot} />}
            <Text style={[
              styles.statusText,
              !item.isActive && styles.statusTextInactive,
            ]}>
              {item.isActive ? 'Active' : 'Cancelled'}
            </Text>
          </View>
        </View>

        <View style={styles.subscriptionFooter}>
          <Text style={styles.footerText}>
            {item.paymentCount} payment{item.paymentCount !== 1 ? 's' : ''} made
          </Text>
          <Text style={styles.footerText}>
            Total: ${(parseFloat(item.totalPaid) / 1_000_000).toFixed(2)}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Subscriptions</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/subscriptions/browse')}
        >
          <Plus size={20} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={[...activeSubscriptions, ...inactiveSubscriptions]}
          keyExtractor={(item) => item.subscriptionPda}
          renderItem={renderSubscription}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Card>
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No subscriptions yet</Text>
                <Text style={styles.emptyDescription}>
                  Start by browsing available plans
                </Text>
                <Button
                  onPress={() => router.push('/subscriptions/browse')}
                  style={styles.emptyButton}
                >
                  Browse Plans
                </Button>
              </View>
            </Card>
          }
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.foreground,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  subscriptionCard: {
    padding: spacing.lg,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusBadgeInactive: {
    backgroundColor: 'rgba(161, 161, 170, 0.1)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.success,
  },
  statusText: {
    ...typography.caption,
    color: colors.success,
  },
  statusTextInactive: {
    color: colors.mutedForeground,
  },
  subscriptionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
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
});