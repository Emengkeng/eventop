import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User as UserIcon,
  Mail,
  Settings,
  FileText,
  HelpCircle,
  LogOut,
  ChevronRight,
} from 'lucide-react-native';
import { usePrivy } from '@privy-io/expo';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { useWalletStore } from '../../store/walletStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = usePrivy();
  const { disconnect } = useWalletStore();

  
  const userLinkedAccounts = user?.linked_accounts || [];
  const googleAccount = userLinkedAccounts.find((acc) => acc.type === 'google_oauth');
  const twitterAccount = userLinkedAccounts.find((acc) => acc.type === 'twitter_oauth');
  const userEmail = googleAccount?.email || twitterAccount?.username || user?.id;

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              disconnect();
              router.replace('/auth/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out');
            }
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
      <ChevronRight size={20} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <Text style={styles.title}>Profile</Text>

        {/* User Info Card */}
        <Card style={styles.userCard}>
          <View style={styles.userIcon}>
            <UserIcon size={32} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {googleAccount?.name || twitterAccount?.username || 'User'}
            </Text>
            {userEmail && (
              <View style={styles.emailRow}>
                <Mail size={14} />
                <Text style={styles.userEmail}>{userEmail}</Text>
              </View>
            )}
            {googleAccount && (
              <Text style={styles.userAuth}>Connected via Google</Text>
            )}
            {twitterAccount && (
              <Text style={styles.userAuth}>Connected via Twitter</Text>
            )}
          </View>
        </Card>

        {/* User ID */}
        {user?.id && (
          <Card>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>User ID</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {user.id}
              </Text>
            </View>
          </Card>
        )}

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
              icon={UserIcon}
              title="Linked Accounts"
              onPress={() => Alert.alert('Coming Soon', 'Account management is under development')}
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

        {/* Logout */}
        <Card noPadding style={styles.logoutCard}>
          <MenuItem
            icon={LogOut}
            title="Log Out"
            onPress={handleLogout}
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  userIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  userName: {
    ...typography.h4,
    color: colors.foreground,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  userEmail: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  userAuth: {
    ...typography.caption,
    color: colors.mutedForeground,
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
  logoutCard: {
    marginTop: spacing.md,
  },
  version: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});