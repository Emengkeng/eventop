import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, Lock, Info } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Card } from '../..//components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function YieldScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Yield Earning</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Coming Soon Banner */}
        <Card style={styles.comingSoonBanner}>
          <View style={styles.comingSoonIcon}>
            <Lock size={32} color={colors.primary} />
          </View>
          <Text style={styles.comingSoonTitle}>Coming Soon</Text>
          <Text style={styles.comingSoonDescription}>
            Yield earning feature is currently under development. Soon you'll be able to earn passive income on your idle subscription balance!
          </Text>
        </Card>

        {/* Preview: What You'll Earn */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What You'll Earn</Text>
          <Card>
            <View style={styles.yieldPreview}>
              <View style={styles.yieldItem}>
                <Text style={styles.yieldLabel}>Current Balance</Text>
                <Text style={styles.yieldValue}>$250.00</Text>
              </View>
              <View style={styles.yieldItem}>
                <Text style={styles.yieldLabel}>Est. APY</Text>
                <Text style={styles.yieldValue}>6.2%</Text>
              </View>
              <View style={styles.yieldItem}>
                <Text style={styles.yieldLabel}>Monthly Earnings</Text>
                <Text style={styles.yieldValueHighlight}>~$1.29</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <Card>
            <View style={styles.howItWorks}>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Enable Yield</Text>
                  <Text style={styles.stepDescription}>
                    Turn on yield earning with one tap
                  </Text>
                </View>
              </View>

              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Earn Automatically</Text>
                  <Text style={styles.stepDescription}>
                    Your idle balance earns interest through DeFi protocols
                  </Text>
                </View>
              </View>

              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Withdraw Anytime</Text>
                  <Text style={styles.stepDescription}>
                    Access your funds and earnings whenever you need
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* Supported Protocols */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supported Protocols</Text>
          <View style={styles.protocols}>
            {['Marginfi', 'Kamino', 'Solend', 'Drift'].map((protocol) => (
              <Card key={protocol} style={styles.protocolCard}>
                <Text style={styles.protocolName}>{protocol}</Text>
              </Card>
            ))}
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Info size={20} color={colors.info} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Safe & Secure</Text>
            <Text style={styles.infoText}>
              Your funds are deposited into battle-tested DeFi protocols with billions in TVL. Smart contracts are audited and non-custodial.
            </Text>
          </View>
        </View>

        {/* CTA Button */}
        <Button disabled style={styles.ctaButton}>
          Notify Me When Available
        </Button>
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
  comingSoonBanner: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  comingSoonIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonTitle: {
    ...typography.h2,
    color: colors.foreground,
  },
  comingSoonDescription: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: '80%',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.foreground,
  },
  yieldPreview: {
    gap: spacing.lg,
  },
  yieldItem: {
    gap: spacing.xs,
  },
  yieldLabel: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  yieldValue: {
    ...typography.h3,
    color: colors.foreground,
  },
  yieldValueHighlight: {
    ...typography.h3,
    color: colors.success,
  },
  howItWorks: {
    gap: spacing.lg,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  stepContent: {
    flex: 1,
    gap: spacing.xs,
  },
  stepTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  stepDescription: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  protocols: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  protocolCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  protocolName: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  infoBox: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  infoContent: {
    flex: 1,
    gap: spacing.xs,
  },
  infoTitle: {
    ...typography.bodyMedium,
    color: colors.info,
  },
  infoText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  ctaButton: {
    marginTop: spacing.md,
  },
});