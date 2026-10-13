import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { theme } from '@/constants/theme';
import { statusPresentation } from '@/features/task/status';
import { TaskStatus } from '@/features/task/types';

export function StatusBadge({ status, urgent }: { status: TaskStatus; urgent?: boolean }) {
  const presentation = statusPresentation(status);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={urgent ? `${presentation.label}. Urgente` : presentation.label}
      style={[styles.badge, { backgroundColor: presentation.fill }]}>
      <MaterialIcons name={presentation.icon} size={22} color={presentation.color} />
      <AppText weight="semibold" color={presentation.color} style={styles.label}>
        {presentation.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: theme.radius,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
  },
});
