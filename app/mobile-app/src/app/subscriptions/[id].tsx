import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, DollarSign, Activity, AlertCircle } from 'lucide-react-native';
import { format } from 'date-fns';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function SubscriptionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  //TODO: Mock data - will replace with actual API call
  const subscription = {
    subscriptionPda: id,
    merchantWallet: '8xK2...9pQ3',
    merchantName: 'Premium Service',
    planName: 'Pro Plan',
    feeAmount: 9990000, // 9.99 USDC (in micro-lamports)
    paymentInterval: 2592000, // 30 days
    lastPaymentTimestamp: Date.now() / 1000 - 604800, // 7 days ago
    nextPaymentDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
    totalPaid: 29970000,
    paymentCount: 3,
    isActive: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  };

  const handlePause = () => {
    Alert.alert(
      'Pause Subscription',
      'Are you sure you want to pause this subscription? You won\'t be charged until you resume it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause',
          style: 'destructive',
          onPress: () => {
            // Implement pause logic
            Alert.alert('Success', 'Subscription paused');
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel this subscription? This action cannot be undone.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: () => {
            // Implement cancel logic
            router.back();
          },
        },
      ]
    );
  };

  const daysUntilPayment = Math.ceil(
    (subscription.nextPaymentDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Subscription Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Merchant Card */}
        <Card style={styles.merchantCard}>
          <View style={styles.merchantIcon}>
            <Text style={styles.merchantIconText}>
              {subscription.merchantName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.merchantName}>{subscription.merchantName}</Text>
          <Text style={styles.planName}>{subscription.planName}</Text>
          
          <View style={styles.statusBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.statusText}>Active</Text>
          </View>
        </Card>

        {/* Next Payment Card */}
        <Card>
          <View style={styles.cardHeader}>
            <Calendar size={20} />
            <Text style={styles.cardTitle}>Next Payment</Text>
          </View>

          <View style={styles.paymentInfo}>
            <View>
              <Text style={styles.paymentDate}>
                {format(subscription.nextPaymentDate, 'MMMM d, yyyy')}
              </Text>
              <Text style={styles.paymentTime}>
                in {daysUntilPayment} day{daysUntilPayment !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={styles.paymentAmount}>
              ${(subscription.feeAmount / 1_000_000).toFixed(2)}
            </Text>
          </View>
        </Card>

        {/* Payment History */}
        <Card>
          <View style={styles.cardHeader}>
            <Activity size={20} />
            <Text style={styles.cardTitle}>Payment History</Text>
          </View>

          <View style={styles.historyStats}>
            <View style={styles.historyStat}>
              <Text style={styles.historyStatLabel}>Total Paid</Text>
              <Text style={styles.historyStatValue}>
                ${(subscription.totalPaid / 1_000_000).toFixed(2)}
              </Text>
            </View>
            <View style={styles.historyDivider} />
            <View style={styles.historyStat}>
              <Text style={styles.historyStatLabel}>Payments</Text>
              <Text style={styles.historyStatValue}>{subscription.paymentCount}</Text>
            </View>
            <View style={styles.historyDivider} />
            <View style={styles.historyStat}>
              <Text style={styles.historyStatLabel}>Since</Text>
              <Text style={styles.historyStatValue}>
                {format(subscription.createdAt, 'MMM yyyy')}
              </Text>
            </View>
          </View>

          {/* Timeline */}
          <View style={styles.timeline}>
            {[...Array(Math.min(subscription.paymentCount, 5))].map((_, index) => {
              const paymentDate = new Date(
                subscription.createdAt.getTime() + index * 30 * 24 * 60 * 60 * 1000
              );
              return (
                <View key={index} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineDate}>
                      {format(paymentDate, 'MMM d, yyyy')}
                    </Text>
                    <Text style={styles.timelineAmount}>
                      ${(subscription.feeAmount / 1_000_000).toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.timelineStatus}>Success</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Subscription Info */}
        <Card>
          <View style={styles.cardHeader}>
            <DollarSign size={20} />
            <Text style={styles.cardTitle}>Subscription Info</Text>
          </View>

          <View style={styles.infoRows}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Subscription ID</Text>
              <Text style={styles.infoValue}>{subscription.subscriptionPda}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Merchant</Text>
              <Text style={styles.infoValue}>{subscription.merchantWallet}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Billing Cycle</Text>
              <Text style={styles.infoValue}>Monthly</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Started</Text>
              <Text style={styles.infoValue}>
                {format(subscription.createdAt, 'MMM d, yyyy')}
              </Text>
            </View>
          </View>
        </Card>

        {/* Warning Box */}
        <View style={styles.warningBox}>
          <AlertCircle size={20} />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Automatic Renewal</Text>
            <Text style={styles.warningText}>
              Your subscription will automatically renew every month. Funds are deducted from your Subscription Wallet.
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button variant="outline" onPress={handlePause} style={styles.actionButton}>
            Pause Subscription
          </Button>
          <Button variant="destructive" onPress={handleCancel}>
            Cancel Subscription
          </Button>
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
  merchantCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    position: 'relative',
  },
  merchantIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  merchantIconText: {
    ...typography.h2,
    color: colors.foreground,
  },
  merchantName: {
    ...typography.h2,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  planName: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
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
  paymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentDate: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  paymentTime: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  paymentAmount: {
    ...typography.h3,
    color: colors.foreground,
  },
  historyStats: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  historyStat: {
    flex: 1,
    alignItems: 'center',
  },
  historyStatLabel: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  historyStatValue: {
    ...typography.h4,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  historyDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  timeline: {
    gap: spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.success,
  },
  timelineContent: {
    flex: 1,
  },
  timelineDate: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  timelineAmount: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  timelineStatus: {
    ...typography.smallMedium,
    color: colors.success,
  },
  infoRows: {
    gap: spacing.md,
  },
  infoRow: {
    gap: spacing.xs,
  },
  infoLabel: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  warningBox: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  warningContent: {
    flex: 1,
    gap: spacing.xs,
  },
  warningTitle: {
    ...typography.bodyMedium,
    color: colors.warning,
  },
  warningText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  actions: {
    gap: spacing.md,
  },
  actionButton: {
    marginBottom: 0,
  },
});