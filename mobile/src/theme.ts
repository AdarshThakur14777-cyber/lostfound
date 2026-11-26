export const colors = {
  bg: "#F6F7F9",
  card: "#FFFFFF",
  border: "#E3E6EA",
  text: "#14181F",
  muted: "#67707D",
  primary: "#1D4ED8",
  primarySoft: "#EAF0FE",
  danger: "#B42318",
  dangerSoft: "#FEECEB",
  success: "#067647",
  successSoft: "#E6F4EE",
  warn: "#B54708",
  warnSoft: "#FEF0E7",
  info: "#026AA2",
  infoSoft: "#E6F4FB",
  dark: "#101418",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { sm: 8, md: 12, lg: 16 };

export const statusColor: Record<string, { fg: string; bg: string }> = {
  open: { fg: colors.success, bg: colors.successSoft },
  claim_pending: { fg: colors.warn, bg: colors.warnSoft },
  in_custody: { fg: colors.info, bg: colors.infoSoft },
  returned: { fg: colors.success, bg: colors.successSoft },
  disposal_pending: { fg: colors.warn, bg: colors.warnSoft },
  disposed: { fg: colors.muted, bg: "#EEF0F3" },
  expired: { fg: colors.danger, bg: colors.dangerSoft },
  pending: { fg: colors.warn, bg: colors.warnSoft },
  verification_passed: { fg: colors.info, bg: colors.infoSoft },
  verification_failed: { fg: colors.danger, bg: colors.dangerSoft },
  approved: { fg: colors.success, bg: colors.successSoft },
  rejected: { fg: colors.danger, bg: colors.dangerSoft },
  handed_over: { fg: colors.success, bg: colors.successSoft },
  cancelled: { fg: colors.muted, bg: "#EEF0F3" },
  scheduled: { fg: colors.info, bg: colors.infoSoft },
  completed: { fg: colors.success, bg: colors.successSoft },
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
