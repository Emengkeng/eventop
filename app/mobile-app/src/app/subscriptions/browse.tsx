import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Filter, TrendingUp } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { usePlans } from '../../hooks/userPlans';

const CATEGORIES = ['All', 'Entertainment', 'Fitness', 'Education', 'Productivity', 'Shopping'];

export default function BrowsePlansScreen() {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('All');

  const filters = {
    ...(search && { search }),
    ...(selectedCategory !== 'All' && { category: selectedCategory }),
  };

  const { data: plans, isLoading } = usePlans(filters);

  const renderPlanCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => router.push(`/subscriptions/plan/${item.planPda}`)}
    >
      <Card style={styles.planCard}>
        <View style={styles.planHeader}>
          <View style={styles.planIcon}>
            <Text style={styles.planIconText}>
              {item.planName?.slice(0, 2).toUpperCase() || '??'}
            </Text>
          </View>
          <View style={styles.planInfo}>
            <Text style={styles.planName}>{item.planName || 'Unknown Plan'}</Text>
            <Text style={styles.merchantName}>
              {item.merchantWallet.slice(0, 8)}...
            </Text>
          </View>
        </View>

        {item.description && (
          <Text style={styles.planDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.planFooter}>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>
              ${(parseFloat(item.feeAmount) / 1_000_000).toFixed(2)}
            </Text>
            <Text style={styles.priceInterval}>/month</Text>
          </View>

          <View style={styles.subscribersContainer}>
            <TrendingUp size={14} color={colors.mutedForeground} />
            <Text style={styles.subscribers}>
              {item.totalSubscribers} subscriber{item.totalSubscribers !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {item.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Browse Plans</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Filter size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color={colors.mutedForeground} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search subscriptions..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category Chips */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === item && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(item)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === item && styles.categoryChipTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.categoriesContainer}
        showsHorizontalScrollIndicator={false}
      />

      {/* Plans List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading plans...</Text>
        </View>
      ) : !plans || plans.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>No plans found</Text>
          <Text style={styles.emptyDescription}>
            Try adjusting your search or filters
          </Text>
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.planPda}
          renderItem={renderPlanCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    color: colors.foreground,
  },
  categoriesContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    marginRight: spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryChipText: {
    ...typography.smallMedium,
    color: colors.foreground,
  },
  categoryChipTextActive: {
    color: colors.primaryForeground,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  planCard: {
    padding: spacing.lg,
    position: 'relative',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  planIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planIconText: {
    ...typography.h4,
    color: colors.foreground,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    ...typography.h4,
    color: colors.foreground,
  },
  merchantName: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  planDescription: {
    ...typography.body,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  planFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    ...typography.h3,
    color: colors.foreground,
  },
  priceInterval: {
    ...typography.small,
    color: colors.mutedForeground,
    marginLeft: spacing.xs,
  },
  subscribersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  subscribers: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  categoryBadge: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
  },
  categoryText: {
    ...typography.caption,
    color: colors.foreground,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});