/**
 * Semantic color tokens for consistent styling across pages.
 * Use these instead of ad-hoc Tailwind color classes.
 */

export const colors = {
  // Success
  successBg: 'bg-green-50',
  successText: 'text-green-700',
  successBorder: 'border-green-200',
  successIcon: 'text-green-600',

  // Error
  errorBg: 'bg-red-50',
  errorText: 'text-red-700',
  errorBorder: 'border-red-200',
  errorIcon: 'text-red-600',

  // Warning
  warningBg: 'bg-amber-50',
  warningText: 'text-amber-700',
  warningBorder: 'border-amber-200',
  warningIcon: 'text-amber-600',

  // Info
  infoBg: 'bg-blue-50',
  infoText: 'text-blue-700',
  infoBorder: 'border-blue-200',
  infoIcon: 'text-blue-600',

  // Status badges
  pendingBg: 'bg-gray-100',
  pendingText: 'text-gray-700',
  sentBg: 'bg-blue-100',
  sentText: 'text-blue-700',
  acceptedBg: 'bg-green-100',
  acceptedText: 'text-green-700',
  disputedBg: 'bg-red-100',
  disputedText: 'text-red-700',
} as const;

/** Compound class helpers for common patterns */
export const statusClasses = {
  success: `${colors.successBg} ${colors.successText} ${colors.successBorder}`,
  error: `${colors.errorBg} ${colors.errorText} ${colors.errorBorder}`,
  warning: `${colors.warningBg} ${colors.warningText} ${colors.warningBorder}`,
  info: `${colors.infoBg} ${colors.infoText} ${colors.infoBorder}`,
} as const;
