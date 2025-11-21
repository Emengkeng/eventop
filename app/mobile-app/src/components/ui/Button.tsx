import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

interface ButtonProps {
  children: string;
  onPress?: () => void;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const buttonStyle = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    disabled && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    styles[`${variant}Text`],
    styles[`size_${size}Text`],
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'default' ? colors.primaryForeground : colors.foreground} />
      ) : (
        <Text style={textStyle}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  default: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  destructive: {
    backgroundColor: colors.destructive,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  size_default: {
    height: 48,
    paddingHorizontal: spacing.lg,
  },
  size_sm: {
    height: 40,
    paddingHorizontal: spacing.md,
  },
  size_lg: {
    height: 56,
    paddingHorizontal: spacing.xl,
  },
  text: {
    ...typography.bodyMedium,
  },
  defaultText: {
    color: colors.primaryForeground,
  },
  secondaryText: {
    color: colors.secondaryForeground,
  },
  destructiveText: {
    color: colors.destructiveForeground,
  },
  outlineText: {
    color: colors.foreground,
  },
  ghostText: {
    color: colors.foreground,
  },
  size_defaultText: {
    fontSize: 16,
  },
  size_smText: {
    fontSize: 14,
  },
  size_lgText: {
    fontSize: 18,
  },
});