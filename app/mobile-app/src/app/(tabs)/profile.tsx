import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User,
  Wallet,
  Settings,
  FileText,
  HelpCircle,
  LogOut,
  ChevronRight,
  Copy,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Card } from '../..//components/ui/Card';
import { useWalletStore } from '../../store/walletStore';
import { solanaService } from '../../services/solana';

export default function ProfileScreen() {
  const router = useRouter();
  const { publicKey, disconnect } = useWalletStore();

  const handleCopyAddress = async () => {
    if (publicKey) {
      await Clipboard.setStringAsync(publicKey);
      Alert.alert('Copied', 'Wallet address copied to clipboard');
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Wallet',
      'Are you sure you want to disconnect your wallet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            disconnect();
            solanaService.disconnect();
            router.replace('/auth/wallet-connect');
          },
        },
      ]
    );
  };

  const MenuItem = ({ icon: Icon, title, onPress, danger = false }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <Icon size={20} color={danger ? colors.destructive : colors.foreground} />
        <Text style={[styles.menuItemText, danger && styles.menuItemTextDanger]}>
          {title}
        </Text>
      </View>
      <ChevronRight size={20} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <Text style={styles.title}>Profile</Text>

        {/* Wallet Card */}
        <Card style={styles.walletCard}>
          <View style={styles.walletIcon}>
            <Wallet size={32} color={colors.primary} />
          </View>
          <View style={styles.walletInfo}>
            <Text style={styles.walletLabel}>Connected Wallet</Text>
            <Text style={styles.walletAddress}>
              {publicKey ? `${publicKey.slice(0, 8)}...${publicKey.slice(-8)}` : 'Not connected'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyAddress}
          >
            <Copy size={20} color={colors.foreground} />
          </TouchableOpacity>
        </Card>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Card noPadding>
            <MenuItem
              icon={Settings}
              title="Settings"
              onPress={() => Alert.alert('Coming Soon', 'Settings screen is under development')}
            />
            <MenuItem
              icon={User}
              title="Edit Profile"
              onPress={() => Alert.alert('Coming Soon', 'Profile editing is under development')}
            />
          </Card>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <Card noPadding>
            <MenuItem
              icon={HelpCircle}
              title="Help Center"
              onPress={() => Alert.alert('Coming Soon', 'Help center is under development')}
            />
            <MenuItem
              icon={FileText}
              title="Terms & Privacy"
              onPress={() => Alert.alert('Coming Soon', 'Terms screen is under development')}
            />
          </Card>
        </View>

        {/* Disconnect */}
        <Card noPadding style={styles.disconnectCard}>
          <MenuItem
            icon={LogOut}
            title="Disconnect Wallet"
            onPress={handleDisconnect}
            danger
          />
        </Card>

        {/* Version */}
        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.foreground,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  walletIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletInfo: {
    flex: 1,
  },
  walletLabel: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  walletAddress: {
    ...typography.bodyMedium,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.smallMedium,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  menuItemText: {
    ...typography.body,
    color: colors.foreground,
  },
  menuItemTextDanger: {
    color: colors.destructive,
  },
  disconnectCard: {
    marginTop: spacing.md,
  },
  version: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});